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

# 引入拆分出来的模块
from models import db, Account, UserInfo, FriendGroup, FriendMapping, ChatHistory, Message
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
with app.app_context():
    db.create_all()
    accounts = Account.query.all()
    for acc in accounts:
        user_name_map[acc.uid] = acc.username

print("Loading GNN model...")
try:
    embeddings = torch.load("user_embeddings.pt", map_location='cpu', weights_only=False)
except FileNotFoundError:
    pass

user_info_map = {}
try:
    users_csv_path = os.path.join(current_dir, "users.csv")
    if os.path.exists(users_csv_path):
        try: df_users = pd.read_csv(users_csv_path, encoding='utf-8')
        except UnicodeDecodeError: df_users = pd.read_csv(users_csv_path, encoding='gbk')
        if 'uid' in df_users.columns and 'info' in df_users.columns:
            temp_dict = pd.Series(df_users['info'].values, index=df_users['uid']).to_dict()
            user_info_map = {int(k): str(v) for k, v in temp_dict.items()}
except Exception as e:
    pass

next_uid = 1001
try:
    with open(users_csv_path, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            try:
                uid = int(row.get('uid', 0))
                if uid >= next_uid: next_uid = uid + 1
            except: pass
except Exception:
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
        if sid > step3_recommend.embeddings.shape[0]: is_cold_start = True
    except: is_cold_start = True

    rec_ids =[]
    if is_cold_start:
        import re
        target_info = user_info_map.get(sid, "")
        target_words = set(re.findall(r'[\u4e00-\u9fa5]+', target_info))
        scores =[]
        for uid, info in user_info_map.items():
            if uid == sid: continue 
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
@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    info = data.get('info', f"性别:{data.get('gender', '未知')},年级:{data.get('grade', '大一')},专业:{data.get('major', '未知')},爱好:{data.get('hobbies', '无')},标签:{data.get('tags', '萌新')}")
    if not username or not password: return jsonify({"status": "error", "message": "不能为空"}), 400
    if Account.query.filter_by(username=username).first(): return jsonify({"status": "error", "message": "已存在"}), 409
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

        # 4. 核心：个人标签资料更新（涉及 CSV 同步）
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
            
            # 🚀 同步更新 users.csv (关键：保证 T+1 重训能读到新特征)
            users_csv_path = os.path.join(current_dir, "users.csv")
            if os.path.exists(users_csv_path):
                try:
                    df = pd.read_csv(users_csv_path)
                    # 定位 uid 并更新 info 这一列
                    df.loc[df['uid'] == uid, 'info'] = new_info
                    # 保存，使用 utf-8-sig 确保 Windows 下 Excel 打开不乱码
                    df.to_csv(users_csv_path, index=False, encoding='utf-8-sig')
                except Exception as csv_e:
                    print(f"[Warning] CSV 同步失败: {csv_e}")

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
# 🚀 核心修复：这个就是之前消失的星图实时头像接口！
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
# 管理员 API & 社交互动 API
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
        edges_path = os.path.join(current_dir, 'edges_time.csv')
        df = pd.read_csv(edges_path)
        if action == 'follow':
            df = pd.concat([df, pd.DataFrame({'timestamp':[datetime.now().strftime("%Y-%m-%d %H:%M:%S")], 'source_id':[current_uid], 'target_id':[target_uid]})], ignore_index=True)
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
    try:
        result = run_pipeline()
        if result.get('status') != 'success': return
        with app.app_context():
            step3_recommend.embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
            step3_recommend.follow_dict = step3_recommend.load_social_data()
            global user_info_map
            try: df_users = pd.read_csv(users_csv_path, encoding='utf-8')
            except UnicodeDecodeError: df_users = pd.read_csv(users_csv_path, encoding='gbk')
            user_info_map = {int(k): str(v) for k, v in pd.Series(df_users['info'].values, index=df_users['uid']).to_dict().items()}
        print(f"[Scheduler] === 每日定时 T+1 重训任务执行成功！ ===")
    except Exception as e:
        print(f"[Scheduler] 异常: {e}")

#破冰留言接口
# ── 破冰留言接口 ──────────────────────────────
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
        return jsonify({"status": "error", "message": "留言不能超过500字"}), 400
        
    sender_id = session['uid']
    if sender_id == int(receiver_id):
        return jsonify({"status": "error", "message": "不能给自己留言"}), 400
        
    # 检查是否已留言过
    exists = Message.query.filter_by(sender_id=sender_id, receiver_id=int(receiver_id)).first()
    if exists:
        return jsonify({"status": "error", "message": "你已经给该用户留过言了"}), 403
        
    try:
        msg = Message(sender_id=sender_id, receiver_id=int(receiver_id),
                      content=content, created_at=datetime.utcnow())
        db.session.add(msg)
        db.session.commit()
        return jsonify({"status": "success", "message": "留言发送成功"}), 200
    except Exception as e:
        db.session.rollback()
        if 'UNIQUE' in str(e).upper():
            return jsonify({"status": "error", "message": "你已经给该用户留过言了"}), 403
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/message/inbox', methods=['GET'])
def get_inbox():
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "请先登录"}), 401
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
            "created_at": m.created_at.strftime('%Y-%m-%d %H:%M') if m.created_at else "",
            "is_read": m.is_read
        })
        # 标记为已读
        if not m.is_read:
            m.is_read = True
    db.session.commit()
    return jsonify({"status": "success", "data": result}), 200
# ─────────────────────────────────────────

if __name__ == "__main__":
    scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(func=daily_retrain_task, trigger="cron", hour=3, minute=0)
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        scheduler.start()
        print("[System] ⏰ 后台定时重训系统已启动，每天凌晨 03:00 将自动执行。")
    app.run(host="0.0.0.0", port=5001, debug=True)