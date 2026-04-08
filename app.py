from flask import Flask, request, jsonify, render_template, session
import os
import torch
import pandas as pd
import csv
from werkzeug.security import generate_password_hash, check_password_hash
from apscheduler.schedulers.background import BackgroundScheduler

import step3_recommend
from step3_recommend import COMMUNITY_RULES
from t_plus_1_scheduler import run_pipeline

# 🚀 引入我们刚刚拆分出来的模块
from models import db, Account, UserInfo, FriendGroup, FriendMapping
from agent_api import agent_bp

app = Flask(__name__)
app.json.ensure_ascii = False
app.json.sort_keys = False

# 数据库配置
app.secret_key = 'genshin_impact_nb'
current_dir = os.path.dirname(os.path.abspath(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(current_dir, "campus_social.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 🚀 初始化抽离出去的 DB
db.init_app(app)

# 🚀 注册 AI Agent 蓝图接口 (挂载黑盒)
app.register_blueprint(agent_bp)

# ==========================================
# 初始化系统全局变量与内存数据
# ==========================================
user_name_map = {} 
with app.app_context():
    db.create_all()
    # 启动时，把数据库里的所有用户名加载进内存，极速响应前端
    accounts = Account.query.all()
    for acc in accounts:
        user_name_map[acc.uid] = acc.username

print("Loading GNN model...")
try:
    embeddings = torch.load("user_embeddings.pt", map_location='cpu', weights_only=False)
    print("Model loaded successfully. The number of students is:", embeddings.shape[0])
except FileNotFoundError:
    print("Model file not found. Please ensure 'user_embeddings.pt' is in the same directory.")

user_info_map = {}
try:
    users_csv_path = os.path.join(current_dir, "users.csv")
    if os.path.exists(users_csv_path):
        try:
            df_users = pd.read_csv(users_csv_path, encoding='utf-8')
        except UnicodeDecodeError:
            df_users = pd.read_csv(users_csv_path, encoding='gbk')
        if 'uid' in df_users.columns and 'info' in df_users.columns:
            temp_dict = pd.Series(df_users['info'].values, index=df_users['uid']).to_dict()
            user_info_map = {int(k): str(v) for k, v in temp_dict.items()}
            print(f"✅ Loaded user info for {len(user_info_map)} users.")
except Exception as e:
    print(f"Error loading user info: {e}")

# 获取 users.csv 中最大的 uid
next_uid = 1001
try:
    with open(users_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                uid = int(row.get('uid', 0))
                if uid >= next_uid: next_uid = uid + 1
            except: pass
except Exception:
    pass

follow_dict = step3_recommend.follow_dict

# ==========================================
#  页面路由
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
#  推荐与查询 API
# ==========================================
@app.route('/community')
def get_community():
    return jsonify({"status": "success", "communities": list(COMMUNITY_RULES.keys())})

@app.route('/tuijian')
# 修改 1：推荐接口 (加入冷启动双路降级召回策略)
@app.route('/tuijian')
def tuijian():
    sid = request.args.get('id', default=None, type=int)
    mode = request.args.get('mode', default='social', type=str)
    community_tag = request.args.get('community', default=None, type=str)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    
    # ==================================================
    # 🚀 核心学术创新：冷启动双路降级召回 (Dual-path Fallback)
    # ==================================================
    is_cold_start = False
    try:
        import step3_recommend
        # 假设 embeddings 里只有 1000 个人，新注册的 sid=1001 就会越界
        if sid > step3_recommend.embeddings.shape[0]:
            is_cold_start = True
    except:
        is_cold_start = True

    rec_ids =[]
    
    if is_cold_start:
        # 新用户没有图节点，改用纯特征文本重合度匹配 (Content-based)
        import re
        target_info = user_info_map.get(sid, "")
        # 提取当前新用户的特征词汇 (专业、标签、爱好等)
        target_words = set(re.findall(r'[\u4e00-\u9fa5]+', target_info))
        
        scores =[]
        for uid, info in user_info_map.items():
            if uid == sid: continue # 不推荐自己
            
            # 如果指定了圈层，先过滤圈层
            if community_tag:
                comm_keywords = COMMUNITY_RULES.get(community_tag,[])
                if not any(kw in info for kw in comm_keywords):
                    continue
                    
            # 计算该老用户和新用户的“特征重合词数量”
            words = set(re.findall(r'[\u4e00-\u9fa5]+', info))
            overlap = len(target_words & words) # 计算交集
            scores.append((uid, overlap))
            
        # 按特征重合度从大到小排序，取前 5 名
        scores.sort(key=lambda x: x[1], reverse=True)
        rec_ids = [u for u, score in scores[:5]]
        mode = "content_based (冷启动降级)" # 改变标识，方便排查
    else:
        # 💡 老用户：正常走 GNN 时序图网络高级推荐
        rec_ids = step3_recommend.recommend_friends(sid, top_k=5, mode=mode, community=community_tag)

    # ==================================================

    # 返回带有 username 的字典
    rec_data_list =[{"id": rid, "username": user_name_map.get(rid, f"User_{rid}"), "info": user_info_map.get(rid, f"未知")} for rid in rec_ids]
    
    return jsonify({
        "student_id": sid,
        "mode": mode,
        "student_info": user_info_map.get(sid, f"ID:{sid}"),
        "recommend_friends": rec_data_list,
        "recommend_ids": rec_ids,
        "count": len(rec_data_list)
    })

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
    avatar = account.avatar if account else None
    return jsonify({"student_id": sid, "username": user_name_map.get(sid, f"User_{sid}"), "student_info": user_info_map.get(sid,f"未知"), "avatar": avatar})

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
        for fid in following:
            follower_counts[fid] = follower_counts.get(fid, 0) + 1
            
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
    if total_connections == 0:
        advice = "系统建议：不妨先在上方【AI 智能推荐】里逛逛，试着关注几个带有相似标签的同学破冰吧！"
    elif total_connections <= 20:
        advice = "系统建议：作为萌新节点，多与现有好友互动，通过他们的朋友圈子发现更多志同道合的同学。"
    elif dominant_comm == "运动健将圈":
        advice = "系统建议：你的运动氛围浓厚，活力满满！可以尝试组织一些户外活动，让更多同学感受到运动的魅力。"
    elif dominant_comm == "文艺星人圈":
        advice = "系统建议：你身边聚集了不少文艺爱好者，可以尝试一起组织艺术展览或小型演出，展示才华的同时增进感情。"
    elif dominant_comm == "硬核极客圈":
        advice = "系统建议：你的技术交流圈子已经初步成型。可以多参加线下的黑客松或开源项目，将线上好友转化为线下的合伙人。"
    elif dominant_comm == "二次元宅圈":
        advice = "系统建议：你们有着共同的二次元文化，可以一起参加漫展或组织观影会，在虚拟世界中找到现实友谊。"
    elif dominant_comm == "社牛风云圈":
        advice = "系统建议：你的社交能力很强，是圈子里的人气担当！可以尝试组织一些社交活动，帮助大家更好地认识彼此。"
    elif dominant_comm == "佛系养生圈":
        advice = "系统建议：你们追求慢节奏的生活，这种态度很珍贵。可以一起尝试一些养生活动，如冥想、茶道等。"
    elif dominant_comm == "爆肝修仙圈":
        advice = "系统建议：大家都在为了目标努力奋斗，彼此是最好的陪伴。记得互相提醒休息，劳逸结合才能走得更远。"

    return jsonify({"student_id": sid, "status": {"title": status_title, "description": status_desc, "total_connections": total_connections}, "distribution": distribution, "advice": advice})

# ==========================================
#  认证与用户管理 API
# ==========================================
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    info = data.get('info', f"性别:{data.get('gender', '未知')},年级:{data.get('grade', '大一')},专业:{data.get('major', '未知')},爱好:{data.get('hobbies', '无')},标签:{data.get('tags', '萌新')}")

    if not username or not password: return jsonify({"status": "error", "message": "用户名和密码不能为空"}), 400
    if Account.query.filter_by(username=username).first(): return jsonify({"status": "error", "message": "用户名已存在"}), 409

    try:
        global next_uid
        new_uid = next_uid
        next_uid += 1

        db.session.add(Account(uid=new_uid, username=username, password_hash=generate_password_hash(password)))
        db.session.add(UserInfo(uid=new_uid, info=info))
        db.session.commit()

        with open(users_csv_path, mode='a', encoding='utf-8', newline='') as f:
            csv.writer(f).writerow([new_uid, info])

        user_info_map[new_uid] = info
        user_name_map[new_uid] = username

        return jsonify({"status": "success", "message": "注册成功", "data": {"uid": new_uid, "username": username, "info": info}}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"注册失败: {str(e)}"}), 500

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json()
    account = Account.query.filter_by(username=data.get('username')).first()
    if not account or not check_password_hash(account.password_hash, data.get('password')):
        return jsonify({"status": "error", "message": "用户名或密码错误"}), 401

    session['uid'] = account.uid
    session['username'] = account.username
    return jsonify({"status": "success", "message": "登录成功", "data": {"uid": account.uid, "username": account.username}}), 200

@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"status": "success", "message": "已退出登录"}), 200

@app.route('/api/auth/me', methods=['GET'])
def api_current_user():
    if 'uid' in session: return jsonify({"status": "success", "logged_in": True, "data": {"uid": session['uid'], "username": session['username']}}), 200
    return jsonify({"status": "success", "logged_in": False}), 200

# ── 破冰留言 ──────────────────────────────
@app.route('/api/message/send', methods=['POST'])
def send_message():
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "请先登录"}), 401
    from models import Message
    from datetime import datetime
    data = request.get_json() or {}
    receiver_id = data.get('receiver_id')
    content = (data.get('content') or '').strip()
    if not receiver_id or not content:
        return jsonify({"status": "error", "message": "参数不完整"}), 400
    if len(content) > 500:
        return jsonify({"status": "error", "message": "留言不能超过500字"}), 400
    sender_id = session['uid']
    if sender_id == int(receiver_id):
        return jsonify({"status": "error", "message": "不能给自己留言"}), 400
    # 检查是否已留言过
    exists = Message.query.filter_by(sender_id=sender_id, receiver_id=int(receiver_id)).first()
    if exists:
        return jsonify({"status": "error", "error": "你已经给该用户留过言了"}), 403
    try:
        msg = Message(sender_id=sender_id, receiver_id=int(receiver_id),
                      content=content, created_at=datetime.utcnow())
        db.session.add(msg)
        db.session.commit()
        return jsonify({"status": "success", "message": "留言发送成功"}), 200
    except Exception as e:
        db.session.rollback()
        # 唯一约束触发时也视为已留言
        if 'UNIQUE' in str(e).upper():
            return jsonify({"status": "error", "error": "你已经给该用户留过言了"}), 403
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/message/inbox', methods=['GET'])
def get_inbox():
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "请先登录"}), 401
    from models import Message
    receiver_id = session['uid']
    msgs = Message.query.filter_by(receiver_id=receiver_id).order_by(Message.created_at.desc()).all()
    result = []
    for m in msgs:
        sender_acc = Account.query.get(m.sender_id)
        avatar_url = f'/api/user/avatar/{m.sender_id}' if (sender_acc and sender_acc.avatar) else None
        result.append({
            "message_id": m.id,
            "sender_id": m.sender_id,
            "sender_name": sender_acc.username if sender_acc else f"用户{m.sender_id}",
            "avatar": avatar_url,
            "content": m.content,
            "created_at": m.created_at.strftime('%Y-%m-%d %H:%M'),
            "is_read": m.is_read
        })
        # 标记为已读
        if not m.is_read:
            m.is_read = True
    db.session.commit()
    return jsonify({"status": "success", "data": result}), 200
# ─────────────────────────────────────────

@app.route('/api/user/update', methods=['POST'])
def update_user_profile():
    if 'uid' not in session: return jsonify({"status": "error", "message": "未登录"}), 401
    uid = session['uid']
    data = request.json
    try:
        acc = Account.query.get(uid)
        if data.get('username') and data.get('username') != acc.username:
            if Account.query.filter_by(username=data.get('username')).first(): return jsonify({"status": "error", "message": "用户名已被占用"}), 400
            acc.username = data.get('username')
            session['username'] = acc.username
            user_name_map[uid] = acc.username
            
        if data.get('info'):
            UserInfo.query.get(uid).info = data.get('info')
            global user_info_map
            user_info_map[uid] = data.get('info')
            df = pd.read_csv(users_csv_path)
            df.loc[df['uid'] == uid, 'info'] = data.get('info')
            df.to_csv(users_csv_path, index=False, encoding='utf-8-sig')

        db.session.commit()
        return jsonify({"status": "success", "message": "个人信息修改成功！下次模型重训后生效。"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
#  管理员 API
# ==========================================
@app.route('/api/admin/retrain', methods=['POST'])
def admin_retrain():
    try:
        result = run_pipeline()
        if result.get('status') != 'success': raise Exception(result.get('message', '未知错误'))

        step3_recommend.embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
        step3_recommend.follow_dict = step3_recommend.load_social_data()

        global user_info_map
        try: df_users = pd.read_csv(users_csv_path, encoding='utf-8')
        except UnicodeDecodeError: df_users = pd.read_csv(users_csv_path, encoding='gbk')
        user_info_map = {int(k): str(v) for k, v in pd.Series(df_users['info'].values, index=df_users['uid']).to_dict().items()}

        return jsonify({"status": "success", "message": "模型重训完毕！已成功吸收新增的社交关系与新用户！"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

# ==========================================
#  社交与分组 API
# ==========================================
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
        if current_uid not in step3_recommend.follow_dict: step3_recommend.follow_dict[current_uid] = []
            
        if action == 'follow' and target_uid not in step3_recommend.follow_dict[current_uid]:
            step3_recommend.follow_dict[current_uid].append(target_uid)
            db.session.execute(text("INSERT INTO edges_time (timestamp, source_id, target_id) VALUES (:ts, :s, :t)"), {'ts': datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 's': current_uid, 't': target_uid})
        elif action == 'unfollow' and target_uid in step3_recommend.follow_dict[current_uid]:
            step3_recommend.follow_dict[current_uid].remove(target_uid)
            db.session.execute(text("DELETE FROM edges_time WHERE source_id = :s AND target_id = :t"), {'s': current_uid, 't': target_uid})
            
        edges_path = os.path.join(current_dir, 'edges_time.csv')
        df = pd.read_csv(edges_path)
        if action == 'follow':
            df = pd.concat([df, pd.DataFrame({'timestamp':[datetime.now().strftime("%Y-%m-%d %H:%M:%S")], 'source_id':[current_uid], 'target_id': [target_uid]})], ignore_index=True)
        elif action == 'unfollow':
            df = df[~((df['source_id'] == current_uid) & (df['target_id'] == target_uid))]
        df.to_csv(edges_path, index=False)
        db.session.commit()
        return jsonify({"status": "success", "message": f"已{'关注' if action=='follow' else '取消关注'}"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

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
    if not request.json.get('name'): return jsonify({"status": "error", "message": "组名不能为空"}), 400
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
    if not request.json.get('name'): return jsonify({"status": "error", "message": "组名不能为空"}), 400
    group = FriendGroup.query.filter_by(id=request.json.get('group_id'), uid=session['uid']).first()
    if group:
        group.name = request.json.get('name')
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "分组不存在"}), 404

@app.route('/api/groups/delete', methods=['POST'])
def delete_friend_group():
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    group_id = request.json.get('group_id')
    FriendGroup.query.filter_by(id=group_id, uid=session['uid']).delete()
    FriendMapping.query.filter_by(group_id=group_id, uid=session['uid']).delete()
    db.session.commit()
    return jsonify({"status": "success"})

# ==========================================
# 头像上传与访问
# ==========================================
@app.route('/api/user/upload_avatar', methods=['POST'])
def upload_avatar():
    if 'uid' not in session: return jsonify({"status": "error", "message": "未登录"}), 401
    file = request.files.get('avatar')
    if not file or file.filename == '': return jsonify({"status": "error", "message": "未选择文件"}), 400
    if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in {'png', 'jpg', 'jpeg', 'gif', 'webp'}):
        return jsonify({"status": "error", "message": "不支持的文件格式"}), 400
    
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
# 每日定时 T+1 重训任务
# ==========================================
def daily_retrain_task():
    print(f"\n[Scheduler] === 开始执行每日定时 T+1 重训任务 ===")
    try:
        result = run_pipeline()
        if result.get('status') != 'success':
            print(f"[Scheduler] 定时任务重训失败: {result.get('message')}")
            return
        
        with app.app_context():
            step3_recommend.embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
            step3_recommend.follow_dict = step3_recommend.load_social_data()
            global user_info_map
            try: df_users = pd.read_csv(users_csv_path, encoding='utf-8')
            except UnicodeDecodeError: df_users = pd.read_csv(users_csv_path, encoding='gbk')
            user_info_map = {int(k): str(v) for k, v in pd.Series(df_users['info'].values, index=df_users['uid']).to_dict().items()}
        print(f"[Scheduler] === 每日定时 T+1 重训任务执行成功！ ===")
    except Exception as e:
        print(f"[Scheduler] 定时任务执行发生异常: {e}")

if __name__ == "__main__":
    scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(func=daily_retrain_task, trigger="cron", hour=3, minute=0)
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        scheduler.start()
        print("[System] ⏰ 后台定时重训系统已启动，每天凌晨 03:00 将自动执行。")
    app.run(host="0.0.0.0", port=5001, debug=True)
    # 配置并启动定时器
    # 使用 BackgroundScheduler 不会阻塞主线程，Flask 可以照常运行
    scheduler = BackgroundScheduler(timezone="Asia/Shanghai") # 强制指定中国时区
    
    # trigger="cron" 表示使用类似 Linux crontab 的定时方式
    # 这里设置为每天凌晨 3点 00分 自动执行一次
    scheduler.add_job(func=daily_retrain_task, trigger="cron", hour=3, minute=0)
    
    # 如果你想测试一下是否生效，可以先把上面那行注释掉，用下面这行每分钟执行一次看看效果：
    # scheduler.add_job(func=daily_retrain_task, trigger="interval", minutes=1)
    
    # 启动调度器
    # 注意：在 Flask debug=True 模式下，代码会被执行两次（Werkzeug的重启机制），
    # 加上 os.environ.get('WERKZEUG_RUN_MAIN') == 'true' 可以防止定时器被启动两次。
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        scheduler.start()
        print("[System] ⏰ 后台定时重训系统已启动，每天凌晨 03:00 将自动执行。")

    # 启动 Flask
    app.run(host="0.0.0.0", port=5001, debug=True)