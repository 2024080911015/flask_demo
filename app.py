from flask import Flask, request, jsonify, render_template, session
import os
import torch
from werkzeug.security import generate_password_hash, check_password_hash
from apscheduler.schedulers.background import BackgroundScheduler

import step3_recommend
from step3_recommend import COMMUNITY_RULES
from t_plus_1_scheduler import run_pipeline

# 引入拆分出来的模块
from models import db, Account, UserInfo, FriendGroup, FriendMapping, ChatHistory, Message, CompetitionExperience
from agent_api import agent_bp

from activity_api import activity_bp

app = Flask(__name__)
app.json.ensure_ascii = False
app.json.sort_keys = False

app.secret_key = 'genshin_impact_nb'
current_dir = os.path.dirname(os.path.abspath(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(current_dir, "campus_social.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
app.register_blueprint(agent_bp)
app.register_blueprint(activity_bp)

# ==========================================
# 初始化全局变量与内存数据
# ==========================================
user_name_map = {}
user_info_map = {}
with app.app_context():
    # SQLite 性能优化：启用 WAL 模式 + 忙等待超时
    from sqlalchemy import event
    @event.listens_for(db.engine, 'connect')
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute('PRAGMA journal_mode=WAL')
        cursor.execute('PRAGMA busy_timeout=5000')
        cursor.execute('PRAGMA synchronous=NORMAL')
        cursor.close()
    db.create_all()
    # 迁移：移除 messages 表的唯一约束（破冰留言 → 私聊）
    try:
        from sqlalchemy import inspect, text
        inspector = inspect(db.engine)
        if 'users' in inspector.get_table_names():
            try:
                with db.engine.connect() as conn:
                    duplicate_count = conn.execute(text(
                        "SELECT COUNT(*) FROM ("
                        "SELECT uid FROM users WHERE uid IS NOT NULL "
                        "GROUP BY uid HAVING COUNT(*) > 1)"
                    )).scalar() or 0
                    if duplicate_count:
                        conn.execute(text(
                            "DELETE FROM users "
                            "WHERE uid IS NOT NULL AND rowid NOT IN ("
                            "SELECT MIN(rowid) FROM users WHERE uid IS NOT NULL GROUP BY uid)"
                        ))
                        print(f"[Migrate] Removed duplicate users rows for {duplicate_count} uid(s).")
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_users_uid ON users(uid)"))
                    conn.commit()
            except Exception as e:
                print(f"[Migrate] users.uid unique guard skipped: {e}")
        if 'messages' in inspector.get_table_names():
            # 检查是否存在旧约束（表级 UNIQUE CONSTRAINT，非索引）
            constraints = inspector.get_unique_constraints('messages')
            has_unique = any(c['name'] == 'uq_sender_receiver' for c in constraints)
            if has_unique:
                print("[Migrate] 检测到旧版破冰留言约束，正在迁移为私聊模式...")
                with db.engine.connect() as conn:
                    # 清理上次可能失败的残留
                    conn.execute(text("DROP TABLE IF EXISTS messages_new"))
                    conn.execute(text("CREATE TABLE messages_new (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL, content TEXT NOT NULL, is_read BOOLEAN DEFAULT 0 NOT NULL, created_at DATETIME NOT NULL)"))
                    conn.execute(text("INSERT INTO messages_new (id, sender_id, receiver_id, content, is_read, created_at) SELECT id, sender_id, receiver_id, content, is_read, created_at FROM messages"))
                    conn.execute(text("DROP TABLE messages"))
                    conn.execute(text("ALTER TABLE messages_new RENAME TO messages"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_messages_sender_id ON messages (sender_id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_messages_receiver_id ON messages (receiver_id)"))
                    conn.commit()
                print("[Migrate] 迁移完成：已支持无限次私聊。")
        # 迁移：为 activity_participants 添加 invited_by 列（组队邀请功能）
        try:
            cols = [c['name'] for c in inspector.get_columns('activity_participants')]
            if 'invited_by' not in cols:
                print("[Migrate] 检测到缺少 invited_by 列，正在添加...")
                with db.engine.connect() as conn:
                    conn.execute(text("ALTER TABLE activity_participants ADD COLUMN invited_by INTEGER DEFAULT NULL"))
                    conn.commit()
                print("[Migrate] invited_by 列添加完成。")
        except Exception as e:
            print(f"[Migrate] invited_by 迁移提示: {e}")
    except Exception as e:
        print(f"[Migrate] 迁移提示: {e}")
    accounts = Account.query.all()
    for acc in accounts:
        user_name_map[acc.uid] = acc.username
    users_list = UserInfo.query.all()
    user_info_map = {u.uid: u.info for u in users_list}
    step3_recommend.user_info_map = dict(user_info_map)

print("Loading GNN model...")
try:
    embeddings = torch.load("user_embeddings.pt", map_location='cpu', weights_only=False)
except FileNotFoundError:
    pass

follow_dict = step3_recommend.follow_dict

# ==========================================
# 页面路由
# ==========================================
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def home(path):
    if path.startswith('api/') or path.startswith('tuijian') or path.startswith('community') or \
       path.startswith('users') or path.startswith('user') or path.startswith('following') or \
       path.startswith('followers') or path.startswith('social'):
        from flask import abort
        abort(404)
    return render_template('index.html')

# ==========================================
# 推荐与查询 API
# ==========================================
@app.route('/community')
def get_community():
    return jsonify({"status": "success", "communities": list(COMMUNITY_RULES.keys())})

@app.route('/tuijian')
def tuijian():
    sid = request.args.get('id', type=int)
    mode = request.args.get('mode', default='social', type=str)
    community_tag = request.args.get('community', default=None, type=str)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    
    is_cold_start = False
    try:
        import step3_recommend
        if not step3_recommend.has_embedding(sid): is_cold_start = True
    except: is_cold_start = True

    rec_ids =[]
    my_following = follow_dict.get(sid, [])
    if is_cold_start:
        import re
        target_info = user_info_map.get(sid, "")
        target_words = set(re.findall(r'[\u4e00-\u9fa5]+', target_info))
        scores =[]
        for uid, info in user_info_map.items():
            if uid == sid or uid in my_following: continue
            if community_tag:
                comm_keywords = COMMUNITY_RULES.get(community_tag,[])
                if not any(kw in info for kw in comm_keywords): continue
            words = set(re.findall(r'[\u4e00-\u9fa5]+', info))
            scores.append((uid, len(target_words & words)))
        scores.sort(key=lambda x: x[1], reverse=True)
        rec_ids = [u for u, score in scores[:5]]
        mode = "content_based (冷启动降级)"
    else:
        rec_ids = step3_recommend.recommend_friends(sid, top_k=5, mode=mode, community=community_tag)

    rec_data_list =[{"id": rid, "username": user_name_map.get(rid, f"User_{rid}"), "info": user_info_map.get(rid, f"未知")} for rid in rec_ids]
    return jsonify({"student_id": sid, "mode": mode, "student_info": user_info_map.get(sid, f"ID:{sid}"), "recommend_friends": rec_data_list, "recommend_ids": rec_ids, "count": len(rec_data_list)})

@app.route('/api/search_users')
def search_users():
    query = request.args.get('q', '').strip().lower()
    if not query: return jsonify({"status": "success", "results": []})
    results =[]
    for uid, username in user_name_map.items():
        if query == str(uid) or query in username.lower():
            results.append({"id": uid, "username": username, "info": user_info_map.get(uid, "未知")})
            if len(results) >= 50: break
    return jsonify({"status": "success", "results": results})

@app.route('/user')
def get_user():
    sid = request.args.get('id', type=int)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    account = Account.query.get(sid)
    return jsonify({
        "student_id": sid, 
        "username": user_name_map.get(sid, f"User_{sid}"), 
        "student_info": user_info_map.get(sid, f"未知"), 
        "avatar": account.avatar if account else None,
        "signature": account.signature if account else "未设置签名",
        "status": account.status if account else "找朋友"
    })

@app.route('/following')
def get_following():
    sid = request.args.get('id', type=int)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    following_list = follow_dict.get(sid, [])
    data_list =[{"id": fid, "username": user_name_map.get(fid, f"User_{fid}"), "info": user_info_map.get(fid, f"未知")} for fid in following_list]
    return jsonify({"student_id": sid, "count": len(data_list), "following": data_list})

@app.route('/followers')
def get_followers():
    sid = request.args.get('id', type=int)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    followers_list =[uid for uid, following in follow_dict.items() if sid in following]
    data_list =[{"id": fid, "username": user_name_map.get(fid, f"User_{fid}"), "info": user_info_map.get(fid, f"未知")} for fid in followers_list]
    return jsonify({"student_id": sid, "followers_count": len(data_list), "followers": data_list})

@app.route('/social/stats')
def get_social_stats():
    total_users = len(user_info_map)
    total_follows = sum(len(following) for following in follow_dict.values())
    avg_follows = total_follows / total_users if total_users > 0 else 0
    follower_counts = {}
    for uid, following in follow_dict.items():
        for fid in following: follower_counts[fid] = follower_counts.get(fid, 0) + 1
    top_users = sorted(follower_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    most_popular_info =[{"id": u, "username": user_name_map.get(u, f"User_{u}"), "info": user_info_map.get(u, f"未知"), "followers_count": c} for u, c in top_users]
    max_follows = max(follower_counts.values()) if follower_counts else 0
    return jsonify({"total_users": total_users, "total_follows": total_follows, "average_follows": round(avg_follows, 2), "max_follows": max_follows, "most_popular_users": most_popular_info})

@app.route('/social/report')
def get_social_report():
    sid = request.args.get('id', type=int)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    following_list = follow_dict.get(sid,[])
    followers_list = [uid for uid, following in follow_dict.items() if sid in following]
    all_friends = list(set(following_list) | set(followers_list))
    total_connections = len(all_friends)
    if total_connections == 0: status_title, status_desc = "潜水节点", "你的社交网络还是白纸一张，目前处于绝对。"
    elif total_connections <= 20: status_title, status_desc = "萌新节点", "你的社交圈较小，处于网络边缘，有很大拓展空间。"
    elif total_connections <= 35: status_title, status_desc = "活跃节点", "你的社交范围适中，在特定圈子内保持着良好连接。"
    elif total_connections <= 45: status_title, status_desc = "核心节点", "你是圈子里的活跃分子，社交网络已相当稳固。"
    else: status_title, status_desc = "超级枢纽", "你是校园社交网络的连接者，信息传播的关键节点。"
    community_counts = {}
    total_classified = 0
    for fid in all_friends:
        info_str = str(user_info_map.get(fid, ""))
        for comm, keywords in COMMUNITY_RULES.items():
            if any(kw in info_str for kw in keywords):
                community_counts[comm] = community_counts.get(comm, 0) + 1
                total_classified += 1
    distribution =[]
    dominant_comm = None
    max_count = 0
    if total_classified > 0:
        for comm, count in community_counts.items():
            distribution.append({"name": comm, "percent": round((count / total_classified) * 100), "count": count})
            if count > max_count: max_count = count; dominant_comm = comm
        distribution.sort(key=lambda x: x['percent'], reverse=True)
    advice = "系统建议：你的圈层非常丰富多元！继续保持开放的社交态度，你是连接不同群体的重要桥梁。"
    if total_connections == 0: advice = "系统建议：不妨先在上方【AI 智能推荐】里逛逛，试着关注几个带有相似标签的同学破冰吧！"
    elif dominant_comm == "硬核极客圈": advice = "系统建议：你的技术圈子已成型。可以多参加线下黑客松，将线上好友转化为技术合伙人。"
    return jsonify({"student_id": sid, "status": {"title": status_title, "description": status_desc, "total_connections": total_connections}, "distribution": distribution, "advice": advice})

# ==========================================
# 认证与用户管理 API
# ==========================================
QUESTION_SCORE_RULES = {
    "social_scene": {
        "one_on_one": {"scores": {"social": 35, "openness": 45, "communication": 70}, "label": "一对一慢热"},
        "small_group": {"scores": {"social": 60, "openness": 65, "collaboration": 65}, "label": "小群体活动"},
        "public_event": {"scores": {"social": 85, "openness": 80, "collaboration": 60}, "label": "公开活动型"},
    },
    "team_role": {
        "leader": {"scores": {"social": 75, "collaboration": 85, "learning": 65}, "label": "组织推进"},
        "specialist": {"scores": {"collaboration": 70, "learning": 85, "communication": 55}, "label": "专业攻坚"},
        "supporter": {"scores": {"collaboration": 80, "communication": 70, "learning": 55}, "label": "稳定补位"},
    },
    "study_drive": {
        "competition": {"scores": {"learning": 90, "collaboration": 75, "openness": 60}, "label": "竞赛科研"},
        "daily_study": {"scores": {"learning": 70, "collaboration": 65, "schedule": 70}, "label": "课程互助"},
        "life_friend": {"scores": {"social": 75, "openness": 70, "communication": 70}, "label": "生活兴趣"},
    },
    "schedule": {
        "morning": {"scores": {"schedule": 90, "learning": 65}, "label": "早睡早起"},
        "stable": {"scores": {"schedule": 70, "communication": 65}, "label": "规律在线"},
        "night": {"scores": {"schedule": 35, "openness": 60, "learning": 60}, "label": "夜间活跃"},
    },
    "conflict_style": {
        "direct": {"scores": {"communication": 80, "collaboration": 70}, "label": "直接沟通"},
        "balance": {"scores": {"communication": 75, "collaboration": 85}, "label": "协调折中"},
        "avoid": {"scores": {"communication": 50, "collaboration": 55, "social": 35}, "label": "低冲突慢调"},
    },
    "introvert_contact": {
        "text_first": {"scores": {"communication": 75, "social": 35}, "label": "文字破冰"},
        "common_task": {"scores": {"collaboration": 75, "learning": 65}, "label": "任务破冰"},
        "friend_intro": {"scores": {"social": 45, "communication": 65}, "label": "熟人介绍"},
    },
    "event_preference": {
        "sports": {"scores": {"social": 80, "openness": 75}, "label": "运动户外"},
        "workshop": {"scores": {"learning": 80, "collaboration": 75}, "label": "技术共创"},
        "culture": {"scores": {"openness": 80, "communication": 70}, "label": "文艺兴趣"},
    },
}

SCORE_KEYS = ["social", "collaboration", "learning", "openness", "communication", "schedule"]
DERIVED_PROFILE_TAGS = {
    "社交牛逼症", "社恐星人", "社交普通型", "温和", "技术大牛", "早睡早起", "熬夜的神", "镇圈大佬"
}

def build_questionnaire_profile(questionnaire):
    """把注册问卷答案转换为可检索的画像字段和推荐标签。"""
    questionnaire = questionnaire or {}
    answered_keys = [k for k, v in questionnaire.items() if k != "self_description" and v not in (None, "")]
    if not answered_keys:
        return [], [], {key: 50 for key in SCORE_KEYS}

    totals = {k: [] for k in SCORE_KEYS}
    preference_labels = []

    for question_id, options in QUESTION_SCORE_RULES.items():
        answer = questionnaire.get(question_id)
        rule = options.get(answer)
        if not rule:
            continue
        preference_labels.append(rule["label"])
        for key, score in rule["scores"].items():
            if key in totals:
                totals[key].append(score)

    try:
        activity_radius = int(questionnaire.get("activity_radius", 3))
    except (TypeError, ValueError):
        activity_radius = 3
    radius_score = max(1, min(activity_radius, 5)) * 20
    totals["openness"].append(radius_score)
    totals["social"].append(30 + radius_score * 0.6)

    scores = {
        key: int(round(sum(values) / len(values))) if values else 50
        for key, values in totals.items()
    }

    derived_tags = []
    if scores["social"] >= 75:
        derived_tags.append("社交牛逼症")
    elif scores["social"] <= 45:
        derived_tags.append("社恐星人")
    else:
        derived_tags.append("社交普通型")
    if scores["collaboration"] >= 75:
        derived_tags.append("温和")
    if scores["learning"] >= 75:
        derived_tags.append("技术大牛")
    if scores["schedule"] >= 80:
        derived_tags.append("早睡早起")
    elif scores["schedule"] <= 45:
        derived_tags.append("熬夜的神")
    if scores["openness"] >= 75:
        derived_tags.append("镇圈大佬")

    score_text = "|".join([
        f"社交{scores['social']}",
        f"协作{scores['collaboration']}",
        f"学习{scores['learning']}",
        f"开放{scores['openness']}",
        f"沟通{scores['communication']}",
        f"作息{scores['schedule']}",
    ])
    preference_text = " ".join(preference_labels[:5]) or "未填写"
    self_description = str(questionnaire.get("self_description", "")).replace(",", "，").strip()[:80]

    info_parts = [
        f"画像分:{score_text}",
        f"社交倾向:{preference_text}",
    ]
    if self_description:
        info_parts.append(f"自述:{self_description}")

    return info_parts, derived_tags, scores

def merge_questionnaire_profile_info(info, questionnaire_parts, derived_tags):
    parts = [p for p in (info or "").split(",") if p]
    filtered = [
        p for p in parts
        if not (p.startswith("画像分:") or p.startswith("社交倾向:") or p.startswith("自述:"))
    ]

    tag_index = next((i for i, p in enumerate(filtered) if p.startswith("标签:")), None)
    if tag_index is None:
        filtered.append(f"标签:{' '.join(dict.fromkeys(derived_tags)) or '萌新'}")
    else:
        existing_tags = [
            tag for tag in filtered[tag_index].split(":", 1)[1].split()
            if tag not in DERIVED_PROFILE_TAGS
        ]
        merged_tags = " ".join(dict.fromkeys(existing_tags + derived_tags))
        filtered[tag_index] = f"标签:{merged_tags or '萌新'}"

    return ",".join(filtered + questionnaire_parts)

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    questionnaire_parts, derived_tags, profile_scores = build_questionnaire_profile(data.get('questionnaire'))
    raw_tags = data.get('tags', '萌新')
    merged_tags = " ".join(dict.fromkeys((raw_tags.split() if raw_tags else []) + derived_tags))
    info = data.get('info', ",".join([
        f"性别:{data.get('gender', '未知')}",
        f"年级:{data.get('grade', '大一')}",
        f"专业:{data.get('major', '未知')}",
        f"爱好:{data.get('hobbies', '无')}",
        f"标签:{merged_tags or '萌新'}",
        f"技能:{data.get('skills', '')}",
        *questionnaire_parts,
    ]))

    if not username or not password:
        return jsonify({"status": "error", "message": "账号和密码不能为空"}), 400
    if len(username) < 2 or len(username) > 20:
        return jsonify({"status": "error", "message": "用户名长度需在2-20个字符之间"}), 400
    if len(password) < 6:
        return jsonify({"status": "error", "message": "密码长度不能少于6位"}), 400
    if Account.query.filter_by(username=username).first():
        return jsonify({"status": "error", "message": "该用户名已被注册"}), 409

    try:
        # 数据库内自增 uid，避免全局变量并发冲突
        from sqlalchemy import func
        max_uid = db.session.query(func.max(Account.uid)).scalar() or 0
        new_uid = max_uid + 1
        db.session.add(Account(uid=new_uid, username=username, password_hash=generate_password_hash(password)))
        db.session.add(UserInfo(uid=new_uid, info=info))
        db.session.commit()
        user_info_map[new_uid] = info
        step3_recommend.user_info_map[new_uid] = info
        user_name_map[new_uid] = username
        return jsonify({"status": "success", "message": "注册成功", "data": {"uid": new_uid, "username": username, "info": info, "profile_scores": profile_scores}}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"注册失败: {str(e)}"}), 500

@app.route('/api/questionnaire/update', methods=['POST'])
def update_questionnaire_profile():
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401

    uid = session['uid']
    data = request.get_json() or {}
    questionnaire_parts, derived_tags, profile_scores = build_questionnaire_profile(data.get('questionnaire'))

    try:
        u_info = UserInfo.query.get(uid)
        old_info = u_info.info if u_info else ""
        new_info = merge_questionnaire_profile_info(old_info, questionnaire_parts, derived_tags)
        if u_info:
            u_info.info = new_info
        else:
            db.session.add(UserInfo(uid=uid, info=new_info))
        db.session.commit()
        user_info_map[uid] = new_info
        step3_recommend.user_info_map[uid] = new_info
        return jsonify({
            "status": "success",
            "message": "画像问卷已更新",
            "data": {"info": new_info, "profile_scores": profile_scores}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json()
    account = Account.query.filter_by(username=data.get('username')).first()
    if not account or not check_password_hash(account.password_hash, data.get('password')):
        return jsonify({"status": "error", "message": "错误"}), 401
    session['uid'] = account.uid
    session['username'] = account.username
    return jsonify({"status": "success", "message": "成功", "data": {"uid": account.uid, "username": account.username}}), 200

@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"status": "success"}), 200

@app.route('/api/auth/me', methods=['GET'])
def api_current_user():
    if 'uid' in session: return jsonify({"status": "success", "logged_in": True, "data": {"uid": session['uid'], "username": session['username']}}), 200
    return jsonify({"status": "success", "logged_in": False}), 200

@app.route('/api/user/update', methods=['POST'])
def update_user_profile():
    if 'uid' not in session: 
        return jsonify({"status": "error", "message": "未登录"}), 401
    
    uid = session['uid']
    data = request.json
    
    # 1. 签名长度校验（30字限制）
    signature = data.get('signature', '').strip()
    if len(signature) > 30:
        return jsonify({"status": "error", "message": "签名不能超过 30 个汉字"}), 400
    
    try:
        # 获取数据库中的账号对象
        acc = Account.query.get(uid)
        if not acc:
            return jsonify({"status": "error", "message": "用户不存在"}), 404

        # 2. 更新新增字段（签名与状态）
        if 'signature' in data: 
            acc.signature = signature
        if 'status' in data: 
            acc.status = data.get('status')
        
        # 3. 用户名修改逻辑（含唯一性检查）
        new_username = data.get('username')
        if new_username and new_username != acc.username:
            # 检查数据库中是否已存在该用户名
            existing_user = Account.query.filter_by(username=new_username).first()
            if existing_user:
                return jsonify({"status": "error", "message": "该用户名已被占用"}), 400
            
            acc.username = new_username
            session['username'] = new_username  # 同步更新 Session 中的缓存
            user_name_map[uid] = new_username   # 同步更新内存 Map

        # 4. 核心：个人标签资料更新
        new_info = data.get('info')
        if new_info:
            # 更新数据库 UserInfo 表
            u_info = UserInfo.query.get(uid)
            if u_info:
                u_info.info = new_info
            else:
                # 容错：如果 UserInfo 记录丢失则新建
                db.session.add(UserInfo(uid=uid, info=new_info))
            
            # 更新内存中的资料 Map，保证 API 立即返回新结果
            global user_info_map
            user_info_map[uid] = new_info
            step3_recommend.user_info_map[uid] = new_info

        # 提交所有更改到数据库
        db.session.commit()
        
        return jsonify({
            "status": "success", 
            "message": "资料修改成功！下次模型重训后，GNN 将根据你的新标签重新计算推荐。"
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
       
# ==========================================
# 核心修复：这个就是之前消失的星图实时头像接口！
# ==========================================
@app.route('/api/users/avatars', methods=['GET'])
def get_all_avatars():
    """实时返回所有有头像的用户的映射表，用于星图截胡 graph.json 的延迟"""
    try:
        accounts = Account.query.all()
        # 将 uid 强制转为 string，确保前端 JS 能完美匹配
        avatar_map = {str(acc.uid): acc.avatar for acc in accounts if acc.avatar}
        return jsonify({"status": "success", "avatars": avatar_map})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 头像上传与访问
# ==========================================
@app.route('/api/user/upload_avatar', methods=['POST'])
def upload_avatar():
    if 'uid' not in session: return jsonify({"status": "error", "message": "未登录"}), 401
    file = request.files.get('avatar')
    if not file or file.filename == '': return jsonify({"status": "error", "message": "未选择文件"}), 400
    file.seek(0, os.SEEK_END)
    if file.tell() > 5 * 1024 * 1024: return jsonify({"status": "error", "message": "文件最大 5MB"}), 400
    file.seek(0)
    try:
        filename = f"{session['uid']}_avatar.{file.filename.rsplit('.', 1)[1].lower()}"
        avatars_dir = os.path.join(current_dir, 'static', 'avatars')
        os.makedirs(avatars_dir, exist_ok=True)
        file.save(os.path.join(avatars_dir, filename))
        account = Account.query.get(session['uid'])
        if account and account.avatar and account.avatar != filename:
            old_filepath = os.path.join(avatars_dir, account.avatar)
            if os.path.exists(old_filepath): os.remove(old_filepath)
        account.avatar = filename
        db.session.commit()
        return jsonify({"status": "success", "message": "上传成功", "avatar": filename})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/user/avatar/<int:uid>', methods=['GET'])
def get_user_avatar(uid):
    account = Account.query.get(uid)
    return jsonify({"status": "success", "avatar": account.avatar if account else None})

# ==========================================
# 🆕 竞赛经历管理 API
# ==========================================
@app.route('/api/user/competitions', methods=['GET'])
def get_user_competitions():
    """获取用户竞赛经历（含历史经历 + 当前参与的活动）"""
    uid = request.args.get('uid', type=int)
    if not uid:
        return jsonify({"status": "error", "message": "缺少uid参数"}), 400

    # 1. 手动添加的竞赛经历
    experiences = CompetitionExperience.query.filter_by(uid=uid).order_by(CompetitionExperience.created_at.desc()).all()
    exp_list = [{
        "id": e.id,
        "type": "experience",
        "competition_name": e.competition_name,
        "role": e.role,
        "year": e.year,
        "description": e.description
    } for e in experiences]

    # 2. 当前正在参与的活动（status=1 且不是发起人）
    from models import ActivityParticipant, Activity
    current_parts = db.session.query(ActivityParticipant, Activity).join(
        Activity, ActivityParticipant.activity_id == Activity.id
    ).filter(
        ActivityParticipant.uid == uid,
        ActivityParticipant.status == 1,
        ActivityParticipant.is_initiator == False
    ).all()

    for part, act in current_parts:
        exp_list.append({
            "id": act.id,
            "type": "ongoing",
            "competition_name": act.category or act.title or "未知比赛",
            "role": "队员",
            "year": act.deadline[:4] if act.deadline else "进行中",
            "description": f"参与 {act.publisher_uid} 发起的项目"
        })

    return jsonify({"status": "success", "data": exp_list})

@app.route('/api/user/competitions', methods=['POST'])
def add_competition_experience():
    """添加竞赛经历"""
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401
    uid = session['uid']
    data = request.get_json() or {}
    name = (data.get('competition_name') or '').strip()
    role = (data.get('role') or '队员').strip()
    year = (data.get('year') or '').strip()
    desc = (data.get('description') or '').strip()

    if not name or not year:
        return jsonify({"status": "error", "message": "竞赛名称和年份不能为空"}), 400
    if len(name) > 200:
        return jsonify({"status": "error", "message": "竞赛名称过长"}), 400

    try:
        exp = CompetitionExperience(uid=uid, competition_name=name, role=role, year=year, description=desc)
        db.session.add(exp)
        db.session.commit()
        return jsonify({"status": "success", "message": "竞赛经历已添加", "data": {"id": exp.id}}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/user/competitions/<int:exp_id>', methods=['DELETE'])
def delete_competition_experience(exp_id):
    """删除竞赛经历"""
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401
    exp = CompetitionExperience.query.get(exp_id)
    if not exp:
        return jsonify({"status": "error", "message": "记录不存在"}), 404
    if exp.uid != session['uid']:
        return jsonify({"status": "error", "message": "无权删除他人经历"}), 403
    try:
        db.session.delete(exp)
        db.session.commit()
        return jsonify({"status": "success", "message": "已删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 管理员 API & 社交互动 API
# ==========================================
@app.route('/api/admin/retrain', methods=['POST'])
def admin_retrain():
    global user_info_map, follow_dict
    try:
        result = run_pipeline()
        if result.get('status') != 'success': raise Exception(result.get('message', '未知错误'))
        step3_recommend.embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
        step3_recommend.load_embedding_uid_order()
        step3_recommend.follow_dict = step3_recommend.load_social_data()
        follow_dict = step3_recommend.follow_dict
        users_list = UserInfo.query.all()
        user_info_map = {u.uid: u.info for u in users_list}
        step3_recommend.user_info_map = dict(user_info_map)
        return jsonify({"status": "success", "message": "模型重训完毕！已成功吸收新增的社交关系与新用户！"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/api/social/toggle_follow', methods=['POST'])
def toggle_follow():
    if 'uid' not in session: return jsonify({"status": "error", "message": "请先登录"}), 401
    current_uid = session['uid']
    if current_uid == 0: return jsonify({"status": "error", "message": "管理员账号不可参与社交！"}), 403
    target_uid = int(request.json.get('target_id'))
    action = request.json.get('action')
    try:
        from datetime import datetime
        from sqlalchemy import text
        if current_uid not in step3_recommend.follow_dict: step3_recommend.follow_dict[current_uid] =[]
        if action == 'follow' and target_uid not in step3_recommend.follow_dict[current_uid]:
            step3_recommend.follow_dict[current_uid].append(target_uid)
            db.session.execute(text("INSERT INTO edges_time (timestamp, source_id, target_id) VALUES (:ts, :s, :t)"), {'ts': datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 's': current_uid, 't': target_uid})
        elif action == 'unfollow' and target_uid in step3_recommend.follow_dict[current_uid]:
            step3_recommend.follow_dict[current_uid].remove(target_uid)
            db.session.execute(text("DELETE FROM edges_time WHERE source_id = :s AND target_id = :t"), {'s': current_uid, 't': target_uid})
        db.session.commit()
        return jsonify({"status": "success", "message": f"已{'关注' if action=='follow' else '取消关注'}"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
# ==社交脉冲接口==
@app.route('/api/social/pulse', methods=['GET'])
def get_social_pulse():
    """获取当前用户所有好友的动态脉冲（是否亮红点）"""
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    my_uid = session['uid']
    
    from models import Activity, UserVisitLog
    from sqlalchemy import func
    
    # 1. 获取我的好友列表 (基于 follow_dict)
    my_friends = follow_dict.get(my_uid, [])
    
    pulse_data = {}
    for fid in my_friends:
        # 找该好友最后一次发布活动的时间
        last_act = Activity.query.filter_by(publisher_uid=fid).order_by(Activity.created_at.desc()).first()
        # 找我最后一次看该好友的时间
        last_visit = UserVisitLog.query.filter_by(viewer_uid=my_uid, target_uid=fid).first()
        
        has_update = False
        if last_act:
            if not last_visit or last_act.created_at > last_visit.last_visit_at:
                has_update = True
        
        pulse_data[str(fid)] = has_update
        
    return jsonify({"status": "success", "pulse": pulse_data})

@app.route('/api/social/mark_read', methods=['POST'])
def mark_social_read():
    """当用户点击查看某人时，更新访问时间，消灭红点"""
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    my_uid = session['uid']
    target_uid = request.json.get('target_id')
    
    from models import UserVisitLog
    log = UserVisitLog.query.filter_by(viewer_uid=my_uid, target_uid=target_uid).first()
    if not log:
        log = UserVisitLog(viewer_uid=my_uid, target_uid=target_uid)
        db.session.add(log)
    else:
        log.last_visit_at = datetime.now()
    
    db.session.commit()
    return jsonify({"status": "success"})
# ===============
@app.route('/api/groups', methods=['GET'])
def get_friend_groups():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    groups = FriendGroup.query.filter_by(uid=uid).all()
    mappings = FriendMapping.query.filter_by(uid=uid).all()
    return jsonify({"status": "success", "groups":[{"id": g.id, "name": g.name} for g in groups], "mappings": {m.target_uid: m.group_id for m in mappings}})

@app.route('/api/groups/create', methods=['POST'])
def create_friend_group():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    new_group = FriendGroup(uid=session['uid'], name=request.json.get('name'))
    db.session.add(new_group)
    db.session.commit()
    return jsonify({"status": "success", "group_id": new_group.id})

@app.route('/api/groups/assign', methods=['POST'])
def assign_friend_group():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid, target_uid, group_id = session['uid'], request.json.get('target_id'), request.json.get('group_id')
    FriendMapping.query.filter_by(uid=uid, target_uid=target_uid).delete()
    if group_id != 0: db.session.add(FriendMapping(uid=uid, target_uid=target_uid, group_id=group_id))
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/groups/rename', methods=['POST'])
def rename_friend_group():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    group = FriendGroup.query.filter_by(id=request.json.get('group_id'), uid=session['uid']).first()
    if group:
        group.name = request.json.get('name')
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error"}), 404

@app.route('/api/groups/delete', methods=['POST'])
def delete_friend_group():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    group_id = request.json.get('group_id')
    FriendGroup.query.filter_by(id=group_id, uid=session['uid']).delete()
    FriendMapping.query.filter_by(group_id=group_id, uid=session['uid']).delete()
    db.session.commit()
    return jsonify({"status": "success"})

# ==========================================
# 每日定时 T+1 重训任务
# ==========================================
def daily_retrain_task():
    print(f"\n[Scheduler] === 开始执行每日定时 T+1 重训任务 ===")
    global user_info_map, follow_dict
    try:
        result = run_pipeline()
        if result.get('status') != 'success': return
        with app.app_context():
            step3_recommend.embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
            step3_recommend.load_embedding_uid_order()
            step3_recommend.follow_dict = step3_recommend.load_social_data()
            follow_dict = step3_recommend.follow_dict
            users_list = UserInfo.query.all()
            user_info_map = {u.uid: u.info for u in users_list}
            step3_recommend.user_info_map = dict(user_info_map)
        print(f"[Scheduler] === 每日定时 T+1 重训任务执行成功！ ===")
    except Exception as e:
        print(f"[Scheduler] 异常: {e}")

@app.route('/api/graph/dynamic_data')
def get_dynamic_graph_data():
    """Merge the last GNN graph with live DB nodes/edges."""
    import json
    from sqlalchemy import text
    from models import Account, Activity, UserInfo, UserVisitLog

    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(current_dir, 'static', 'graph.json')

    graph_data = {"nodes": [], "links": []}
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            graph_data = json.load(f)
    graph_data.setdefault("nodes", [])
    graph_data.setdefault("links", [])

    def normalize_graph_id(value):
        if isinstance(value, dict):
            value = value.get("id")
        if value is None:
            return None
        return str(value)

    accounts = Account.query.all()
    users = UserInfo.query.all()
    acc_map = {acc.uid: acc for acc in accounts}
    info_map = {user.uid: user.info for user in users}

    node_map = {}
    deduped_nodes = []
    for node in graph_data["nodes"]:
        node_id = normalize_graph_id(node.get("id"))
        if not node_id or node_id in node_map:
            continue
        node["id"] = node_id
        node_map[node_id] = node
        deduped_nodes.append(node)
    graph_data["nodes"] = deduped_nodes

    def infer_semantic_community(info_str):
        best_comm = ""
        max_matches = 0
        for comm, keywords in COMMUNITY_RULES.items():
            matches = sum(1 for kw in keywords if kw in str(info_str))
            if matches > max_matches:
                max_matches = matches
                best_comm = comm
        return best_comm

    live_uids = sorted(uid for uid in (set(acc_map) | set(info_map)) if uid and uid > 0)
    for uid in live_uids:
        node_id = str(uid)
        node = node_map.get(node_id)
        if node is None:
            node = {"id": node_id, "group": 0, "val": 5}
            node_map[node_id] = node
            graph_data["nodes"].append(node)

        acc = acc_map.get(uid)
        info = info_map.get(uid, node.get("info", ""))
        node["username"] = acc.username if acc else node.get("username", f"User_{uid}")
        node["avatar"] = acc.avatar if acc else node.get("avatar")
        node["signature"] = acc.signature if acc else node.get("signature", "")
        node["status"] = acc.status if acc else node.get("status", "")
        node["info"] = info
        node["community"] = infer_semantic_community(info) or node.get("community", "")
        node.setdefault("group", 0)
        node.setdefault("val", 5)

    valid_node_ids = set(node_map)
    merged_links = []
    link_keys = set()

    def add_link(source, target):
        source_id = normalize_graph_id(source)
        target_id = normalize_graph_id(target)
        if not source_id or not target_id:
            return
        if source_id not in valid_node_ids or target_id not in valid_node_ids:
            return
        key = (source_id, target_id)
        if key in link_keys:
            return
        link_keys.add(key)
        merged_links.append({"source": source_id, "target": target_id})

    for link in graph_data["links"]:
        add_link(link.get("source"), link.get("target"))

    live_edges = db.session.execute(text(
        "SELECT source_id, target_id FROM edges_time "
        "WHERE source_id > 0 AND target_id > 0"
    )).fetchall()
    for source_id, target_id in live_edges:
        add_link(source_id, target_id)

    graph_data["links"] = merged_links

    degrees = {}
    for link in graph_data["links"]:
        source_id = normalize_graph_id(link.get("source"))
        target_id = normalize_graph_id(link.get("target"))
        degrees[source_id] = degrees.get(source_id, 0) + 1
        degrees[target_id] = degrees.get(target_id, 0) + 1
    for node in graph_data["nodes"]:
        node_id = normalize_graph_id(node.get("id"))
        try:
            current_val = float(node.get("val", 5) or 5)
        except (TypeError, ValueError):
            current_val = 5
        node["val"] = max(current_val, degrees.get(node_id, 0) * 2 + 5)

    my_uid = session.get('uid')
    latest_activity_at = {}
    visit_at = {}
    if my_uid:
        for activity in Activity.query.order_by(Activity.created_at.desc()).all():
            latest_activity_at.setdefault(activity.publisher_uid, activity.created_at)
        visit_at = {
            log.target_uid: log.last_visit_at
            for log in UserVisitLog.query.filter_by(viewer_uid=my_uid).all()
        }

    for node in graph_data['nodes']:
        try:
            uid_int = int(node['id'])
        except (TypeError, ValueError):
            node['hasPulse'] = False
            continue
        last_activity_at = latest_activity_at.get(uid_int)
        last_visit_at = visit_at.get(uid_int)
        node['hasPulse'] = bool(
            my_uid and uid_int != my_uid and last_activity_at and
            (not last_visit_at or last_activity_at > last_visit_at)
        )

    return jsonify(graph_data)
#私聊接口
# ── 私聊接口 ──────────────────────────────
@app.route('/api/message/send', methods=['POST'])
def send_message():
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "请先登录"}), 401
    from datetime import datetime
    data = request.get_json() or {}
    receiver_id = data.get('receiver_id')
    content = (data.get('content') or '').strip()

    if not receiver_id or not content:
        return jsonify({"status": "error", "message": "参数不完整"}), 400
    if len(content) > 500:
        return jsonify({"status": "error", "message": "消息不能超过500字"}), 400

    sender_id = session['uid']
    if sender_id == int(receiver_id):
        return jsonify({"status": "error", "message": "不能给自己发消息"}), 400

    try:
        msg = Message(sender_id=sender_id, receiver_id=int(receiver_id),
                      content=content, created_at=datetime.utcnow())
        db.session.add(msg)
        db.session.commit()
        return jsonify({"status": "success", "message": "消息发送成功", "data": {
            "id": msg.id,
            "content": msg.content,
            "created_at": msg.created_at.strftime('%Y-%m-%d %H:%M')
        }}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/message/inbox', methods=['GET'])
def get_inbox():
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "请先登录"}), 401
    my_uid = session['uid']

    # 查询所有与我相关的消息（我发的 + 我收的）
    from sqlalchemy import or_, and_
    all_msgs = Message.query.filter(
        or_(Message.sender_id == my_uid, Message.receiver_id == my_uid)
    ).order_by(Message.created_at.asc()).all()

    # 按对话伙伴分组
    conversations = {}  # key: partner_uid
    for m in all_msgs:
        partner_id = m.receiver_id if m.sender_id == my_uid else m.sender_id
        if partner_id not in conversations:
            conversations[partner_id] = {
                "partner_id": partner_id,
                "last_message": m.content,
                "last_time": m.created_at.strftime('%Y-%m-%d %H:%M') if m.created_at else "",
                "unread_count": 0,
            }
        else:
            conversations[partner_id]["last_message"] = m.content
            conversations[partner_id]["last_time"] = m.created_at.strftime('%Y-%m-%d %H:%M') if m.created_at else ""

        # 统计对方发来且未读的消息数
        if m.sender_id == partner_id and not m.is_read:
            conversations[partner_id]["unread_count"] += 1

    # 转换为列表，按最后消息时间倒序
    result = []
    for partner_id, conv in conversations.items():
        partner_acc = Account.query.get(partner_id)
        result.append({
            "partner_id": partner_id,
            "partner_name": partner_acc.username if partner_acc else f"用户{partner_id}",
            "avatar": f'/api/user/avatar/{partner_id}' if (partner_acc and partner_acc.avatar) else None,
            "last_message": conv["last_message"][:50] + ("..." if len(conv["last_message"]) > 50 else ""),
            "last_time": conv["last_time"],
            "unread_count": conv["unread_count"],
        })

    result.sort(key=lambda x: x["last_time"], reverse=True)
    return jsonify({"status": "success", "data": result}), 200

@app.route('/api/message/conversation', methods=['GET'])
def get_conversation():
    """获取当前用户与指定用户的完整对话记录"""
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "请先登录"}), 401
    my_uid = session['uid']
    partner_id = request.args.get('with', type=int)
    if not partner_id:
        return jsonify({"status": "error", "message": "缺少对话伙伴ID"}), 400

    from sqlalchemy import or_
    msgs = Message.query.filter(
        or_(
            (Message.sender_id == my_uid) & (Message.receiver_id == partner_id),
            (Message.sender_id == partner_id) & (Message.receiver_id == my_uid)
        )
    ).order_by(Message.created_at.asc()).all()

    # 将对方发来的消息标记为已读
    unread_ids = [m.id for m in msgs if m.sender_id == partner_id and not m.is_read]
    if unread_ids:
        from sqlalchemy import update as sql_update
        db.session.execute(
            sql_update(Message).where(Message.id.in_(unread_ids)).values(is_read=True)
        )
        db.session.commit()

    partner_acc = Account.query.get(partner_id)
    messages = [{
        "id": m.id,
        "sender_id": m.sender_id,
        "content": m.content,
        "created_at": m.created_at.strftime('%Y-%m-%d %H:%M') if m.created_at else "",
        "is_mine": m.sender_id == my_uid,
    } for m in msgs]

    return jsonify({
        "status": "success",
        "data": {
            "partner_id": partner_id,
            "partner_name": partner_acc.username if partner_acc else f"用户{partner_id}",
            "avatar": f'/api/user/avatar/{partner_id}' if (partner_acc and partner_acc.avatar) else None,
            "messages": messages,
        }
    }), 200
# ─────────────────────────────────────────

if __name__ == "__main__":
    scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(func=daily_retrain_task, trigger="cron", hour=3, minute=0)
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        scheduler.start()
        print("[System] 后台定时重训系统已启动，每天凌晨 03:00 将自动执行。")
    app.run(host="0.0.0.0", port=5002, debug=True, use_reloader=False)
