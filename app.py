from flask import Flask,request, jsonify,render_template,session
import os
import torch
import torch.nn.functional as F
import pandas as pd
import step3_recommend
from step3_recommend import COMMUNITY_RULES
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import csv
from t_plus_1_scheduler import run_pipeline


app =Flask(__name__)
app.json.ensure_ascii = False
app.json.sort_keys = False

#数据库配置
app.secret_key = 'genshin_impact_nb' # 用于加密 Session
current_dir=os.path.dirname(os.path.abspath(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(current_dir, "campus_social.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# 定义账号模型
class Account(db.Model):
    __tablename__ = 'accounts'
    uid = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True) # 加上索引加速登录查询
    password_hash = db.Column(db.String(255), nullable=False)
    avatar = db.Column(db.String(255), nullable=True)  # 头像文件名

# 定义用户信息模型
class UserInfo(db.Model):
    __tablename__ = 'users'
    uid = db.Column(db.Integer, primary_key=True)
    info = db.Column(db.Text, nullable=False)

# ================= 新增：好友分组模型 =================
class FriendGroup(db.Model):
    __tablename__ = 'friend_groups'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    uid = db.Column(db.Integer, nullable=False, index=True) # 谁创建的分组
    name = db.Column(db.String(50), nullable=False)         # 分组名称

class FriendMapping(db.Model):
    __tablename__ = 'friend_mappings'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    uid = db.Column(db.Integer, nullable=False, index=True) # 归属人
    target_uid = db.Column(db.Integer, nullable=False)      # 被分组的好友ID
    group_id = db.Column(db.Integer, nullable=False)        # 所属分组ID
# =====================================================

# 初始化数据库表
user_name_map = {} # 全局用户名映射字典
with app.app_context():
    db.create_all()
    # 启动时，把数据库里的所有用户名加载进内存，极速响应前端
    accounts = Account.query.all()
    for acc in accounts:
        user_name_map[acc.uid] = acc.username

print("Loading model...")       #加载user_embeddings.pt文件(好像没啥用，在step3_recommend.py里也加载了一次，暂时先放在这里，后续可以优化掉)   
try:
    embeddings = torch.load("user_embeddings.pt", map_location='cpu', weights_only=False)
    print("Model loaded successfully.The number of students is:",embeddings.shape[0])
except FileNotFoundError:
    print("Model file not found. Please ensure 'user_embeddings.pt' is in the same directory.")
    exit(1)

user_info_map={}#加载用户数据
try:
    current_dir=os.path.dirname(os.path.abspath(__file__))
    users_csv_path=os.path.join(current_dir,"users.csv")
    if os.path.exists(users_csv_path):
        try:
            df_users=pd.read_csv(users_csv_path,encoding='utf-8')
        except UnicodeDecodeError:
            df_users=pd.read_csv(users_csv_path,encoding='gbk')
        if 'uid' in df_users.columns and 'info' in df_users.columns:
            # 核心防弹补丁：强制把键转化为标准的 Python int，防止类型匹配失败！
            temp_dict = pd.Series(df_users['info'].values, index=df_users['uid']).to_dict()
            user_info_map = {int(k): str(v) for k, v in temp_dict.items()}
            print(f"✅ Loaded user info for {len(user_info_map)} users.")
except Exception as e:
    print(f"Error loading user info: {e}")

# 获取 users.csv 中最大的 uid，作为下一个 uid 的基准
next_uid = 1001  # 默认从 1001 开始（假设有 1000 条数据）
try:
    with open(users_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                uid = int(row.get('uid', 0))
                if uid >= next_uid:
                    next_uid = uid + 1
            except (ValueError, TypeError):
                continue
except UnicodeDecodeError:
    with open(users_csv_path, 'r', encoding='gbk') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                uid = int(row.get('uid', 0))
                if uid >= next_uid:
                    next_uid = uid + 1
            except (ValueError, TypeError):
                continue

print(f"下一个 uid 将从: {next_uid} 开始")

# 加载社交网络数据 (来自 step3_recommend.py)
follow_dict = step3_recommend.follow_dict

#网页主页面（catch-all：所有前端路由都返回同一个 index.html）
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def home(path):
    # API 路由不在这里处理，只处理前端页面路径
    if path.startswith('api/') or path.startswith('tuijian') or \
       path.startswith('community') or path.startswith('users') or \
       path.startswith('user') or path.startswith('following') or \
       path.startswith('followers') or path.startswith('social'):
        from flask import abort
        abort(404)
    return render_template('index.html')
#社区列表接口
@app.route('/community')
def get_community():
    return jsonify({
        "status": "success",
        "communities": list(COMMUNITY_RULES.keys())
    })
# 修改 1：推荐接口
@app.route('/tuijian')
def tuijian():
    sid = request.args.get('id', default=None, type=int)
    mode = request.args.get('mode', default='social', type=str)
    community_tag = request.args.get('community', default=None, type=str)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    
    rec_ids = step3_recommend.recommend_friends(sid, top_k=5, mode=mode, community=community_tag)
    
    # 核心修改：返回带有 username 的字典
    rec_data_list =[{"id": rid, "username": user_name_map.get(rid, f"User_{rid}"), "info": user_info_map.get(rid, f"未知")} for rid in rec_ids]
    
    return jsonify({
        "student_id": sid,
        "mode": mode,
        "student_info": user_info_map.get(sid, f"ID:{sid}"),
        "recommend_friends": rec_data_list,
        "recommend_ids": rec_ids,
        "count": len(rec_data_list)
    })

@app.route('/users')
def get_users():
    users_list=[{"student_id": id, "username": user_name_map.get(id, f"User_{id}"), "student_info": info} for id,info in user_info_map.items()]
    return jsonify(users_list)    

# ==========================================
# 智能模糊搜索引擎接口 (支持 ID 和 Username)
# ==========================================
@app.route('/api/search_users')
def search_users():
    """根据关键字(学号或用户名)模糊搜索用户"""
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify({"status": "success", "results": []})
    
    results =[]
    # 遍历内存中的全校用户字典
    for uid, username in user_name_map.items():
        # 如果输入的刚好是学号，或者用户名里包含了输入的字
        if query == str(uid) or query in username.lower():
            results.append({
                "id": uid,
                "username": username,
                "info": user_info_map.get(uid, "未知")
            })
            # 限制最多返回 50 条，防止搜个 'a' 把全校都拉出来卡死网页
            if len(results) >= 50:
                break
                
    return jsonify({"status": "success", "results": results})

@app.route('/user')
def get_user():
    sid=request.args.get('id',default=None, type=int)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    # 获取用户头像
    account = Account.query.get(sid)
    avatar = account.avatar if account else None
    return jsonify({
        "student_id": sid,
        "username": user_name_map.get(sid, f"User_{sid}"),
        "student_info": user_info_map.get(sid,f"未知"),
        "avatar": avatar
    })

@app.route('/following')
def get_following():
    sid = request.args.get('id', default=None, type=int)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    
    following_list = follow_dict.get(sid,[])
    following_data_list =[{"id": fid, "username": user_name_map.get(fid, f"User_{fid}"), "info": user_info_map.get(fid, f"未知")} for fid in following_list]
    return jsonify({"student_id": sid, "count": len(following_data_list), "following": following_data_list})

@app.route('/followers')
def get_followers():
    sid = request.args.get('id', default=None, type=int)
    if sid is None: return jsonify({"error": "Missing id"}), 400

    followers_list =[uid for uid, following in follow_dict.items() if sid in following]
    followers_data_list =[{"id": fid, "username": user_name_map.get(fid, f"User_{fid}"), "info": user_info_map.get(fid, f"未知")} for fid in followers_list]
    return jsonify({"student_id": sid, "followers_count": len(followers_data_list), "followers": followers_data_list})

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
    
    most_popular_info =[]
    for uid, count in top_users:
        most_popular_info.append({
            "id": uid, 
            "username": user_name_map.get(uid, f"User_{uid}"), # 核心新增
            "info": user_info_map.get(uid, f"未知"), 
            "followers_count": count
        })
        
    max_follows = max(follower_counts.values()) if follower_counts else 0

    return jsonify({
        "total_users": total_users,
        "total_follows": total_follows,
        "average_follows": round(avg_follows, 2),
        "max_follows": max_follows,
        "most_popular_users": most_popular_info
    })

# ================= 新增：AI 社交诊断报告接口 =================
@app.route('/social/report')
def get_social_report():
    sid = request.args.get('id', default=None, type=int)
    if sid is None:
        return jsonify({"error": "Missing 'id' parameter"}), 400

    # 为了使用圈子判断规则，引入上一轮在 step3_recommend 中定义的规则
    # 注意：确保 step3_recommend.py 里面已经定义了 COMMUNITY_RULES
    try:
        from step3_recommend import COMMUNITY_RULES
    except ImportError:
        # 如果还没定义，这里给个降级兜底的默认规则
        COMMUNITY_RULES = {
            "运动健将圈": [
                "足球", "羽毛球", "跑步", "骑行",      # 核心运动爱好
                "运动达人",                           # 专属标签
                "体育"                                # 对口专业
            ],
            "文艺星人圈": [
                "音乐", "舞蹈", "绘画", "剪纸", "缝纫", # 艺术与手工爱好
                "温和", "可爱",                       # 偏向内敛柔和的性格标签
                "美术", "英语"                        # 偏艺术与语言类的专业
            ],
            "硬核极客圈": [
                "编程", "机械",                       # 硬核爱好
                "技术大牛",                           # 极客专属标签
                "计算机", "电气", "通信", "土木"      # 纯粹的工科专业群
            ],
            "二次元宅圈": [
                "动漫",                               # 核心爱好
                "宅属性", "社恐星人"                  # 二次元群体高频标签
            ],
            "社牛风云圈": [
                "社交牛逼症", "镇圈大佬", "段子手",   # 极度活跃的社交标签
                "新闻", "法学"                        # 偏向表达与人际交往的文科专业
            ],
            "佛系养生圈": [
                "种植", "围棋", "天文",               # 慢节奏、偏静的爱好
                "早睡早起", "作息规律", "吃货", "社交普通型" # 佛系且人数最多的兜底标签
            ],
            "爆肝修仙圈": [
                "熬夜的神", "高冷",                   # 忙到没空社交的学霸标签
                "生物", "", "会计"                # 课业极度繁重、实验/考证压力大的高卷专业
            ]
        }

    # 1. 获取该用户的完整社交网络（关注 + 粉丝 去重）
    following_list = follow_dict.get(sid, [])
    followers_list = [uid for uid, following in follow_dict.items() if sid in following]
    all_friends = list(set(following_list) | set(followers_list))
    total_connections = len(all_friends)

    # 2. 诊断网络地位 (依据节点度数，基于实际数据分布调整)
    if total_connections == 0:
        status_title = "潜水节点"
        status_desc = "你的社交网络还是白纸一张，目前处于绝对。"
    elif total_connections <= 20:
        status_title = "萌新节点"
        status_desc = "你的社交圈较小，处于网络边缘，有很大拓展空间。"
    elif total_connections <= 35:
        status_title = "活跃节点"
        status_desc = "你的社交范围适中，在特定圈子内保持着良好连接。"
    elif total_connections <= 45:
        status_title = "核心节点"
        status_desc = "你是圈子里的活跃分子，社交网络已相当稳固。"
    else:
        status_title = "超级枢纽"
        status_desc = "你是校园社交网络的连接者，信息传播的关键节点。"

    # 3. 统计圈层分布
    community_counts = {}
    total_classified = 0

    for fid in all_friends:
        info_str = str(user_info_map.get(fid, ""))
        # 遍历所有圈子规则
        for comm, keywords in COMMUNITY_RULES.items():
            if any(kw in info_str for kw in keywords):
                community_counts[comm] = community_counts.get(comm, 0) + 1
                total_classified += 1
                # 移除 break，允许一个好友匹配多个圈子

    distribution = []
    dominant_comm = None # 占比最大的圈子
    max_count = 0

    if total_classified > 0:
        for comm, count in community_counts.items():
            percent = round((count / total_classified) * 100)
            distribution.append({"name": comm, "percent": percent, "count": count})
            if count > max_count:
                max_count = count
                dominant_comm = comm
        # 按比例从高到低排序
        distribution.sort(key=lambda x: x['percent'], reverse=True)

    # 4. 生成 AI 专属行动建议
    advice = ""
    if total_connections == 0:
        advice = "系统建议：不妨先在上方【AI 智能推荐】里逛逛，试着关注几个带有相似标签的同学破冰吧！"
    elif dominant_comm == "考研圈":
        advice = "系统建议：你的好友大部分都在为学业奋斗，学习氛围浓厚。但也请注意劳逸结合，建议尝试通过系统推荐结交一些【运动圈】的同学，一起跑个步。"
    elif dominant_comm == "技术圈":
        advice = "系统建议：你的技术交流圈子已经初步成型。可以多参加线下的黑客松或开源项目，将线上好友转化为线下的技术合伙人。"
    elif dominant_comm == "二次元":
        advice = "系统建议：找到同好一定很开心！不过你也可以偶尔看看【技术圈】或【文艺圈】的人，说不定能组队做一款独立游戏呢。"
    elif dominant_comm:
        advice = f"系统建议：你在【{dominant_comm}】有很好的人脉基础。保持优势的同时，可以主动去探索你不熟悉的领域，让校园生活更多元。"
    else:
        advice = "系统建议：你的圈层非常丰富多元！继续保持开放的社交态度，你是连接不同群体的重要桥梁。"

    # 返回组装好的报告 JSON
    return jsonify({
        "student_id": sid,
        "status": {
            "title": status_title,
            "description": status_desc,
            "total_connections": total_connections
        },
        "distribution": distribution,
        "advice": advice
    })
#后端注册接口
@app.route('/api/register', methods=['POST'])
def api_register():
    data=request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    username=data.get('username')
    password=data.get('password')

    # 支持分别接收字段或整体 info
    if 'info' in data:
        info = data.get('info')
    else:
        # 从各个字段拼接 info
        gender = data.get('gender', '未知')
        grade = data.get('grade', '未知')
        major = data.get('major', '未知')
        hobbies = data.get('hobbies', '无')
        tags = data.get('tags', '萌新')
        info = f"性别:{gender},年级:{grade},专业:{major},爱好:{hobbies},标签:{tags}"

    if not username or not password:
        return jsonify({"status": "error", "message": "用户名和密码不能为空"}), 400

    # 1. 检查数据库中是否已存在该用户名
    if Account.query.filter_by(username=username).first():
        return jsonify({"status": "error", "message": "用户名已存在"}), 409

    try:
        # 使用全局 next_uid（需声明为 global）
        global next_uid
        new_uid = next_uid
        next_uid += 1

        hashed_pw=generate_password_hash(password)
        new_account = Account(uid=new_uid, username=username, password_hash=hashed_pw)
        new_user_info = UserInfo(uid=new_uid, info=info)

        db.session.add(new_account)
        db.session.add(new_user_info)
        db.session.commit()

        # 同时写入 users.csv 保持兼容
        with open(users_csv_path, mode='a', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([new_uid, info])

        user_info_map[new_uid] = info
        user_name_map[new_uid] = username

        return jsonify({
            "status": "success",
            "message": "注册成功",
            "data": {"uid": new_uid, "username": username, "info": info}
        }), 201

    except Exception as e:
        db.session.rollback() # 发生异常时回滚数据库操作
        return jsonify({"status": "error", "message": f"注册失败: {str(e)}"}), 500

#后端登录接口
@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "Missing JSON body"}), 400

    username = data.get('username')
    password = data.get('password')

    # 从数据库检索用户
    account = Account.query.filter_by(username=username).first()

    if not account or not check_password_hash(account.password_hash, password):
        return jsonify({"status": "error", "message": "用户名或密码错误"}), 401

    # 写入 Session
    session['uid'] = account.uid
    session['username'] = account.username

    return jsonify({
        "status": "success", 
        "message": "登录成功", 
        "data": {
            "uid": account.uid,
            "username": account.username
        }
    }), 200
#后端登出接口
@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({"status": "success", "message": "已退出登录"}), 200

@app.route('/api/auth/me', methods=['GET'])
def api_current_user():
    """获取当前登录会话的状态，供前端校验"""
    if 'uid' in session:
        return jsonify({
            "status": "success",
            "logged_in": True, 
            "data": {
                "uid": session['uid'], 
                "username": session['username']
            }
        }), 200
    return jsonify({"status": "success", "logged_in": False}), 200

# ==========================================
#  (管理员专属)
# ==========================================
@app.route('/api/admin/retrain', methods=['POST'])
def admin_retrain():
    """超级管理员专用：手动触发 T+1 模型重训（吸收新注册用户和新关注关系）"""
    from t_plus_1_scheduler import run_pipeline
    import step3_recommend
    import torch
    import pandas as pd
    import os

    try:
        # 1. 运行流水线 (跑 step1, step2, build_visual_graph)
        result = run_pipeline()
        if result.get('status') != 'success':
            raise Exception(result.get('message', '未知错误'))

        # 2. 热更新内存数据，防止网页读到旧数据！
        # 重新加载模型向量
        step3_recommend.embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
        # 重新加载关注字典
        step3_recommend.follow_dict = step3_recommend.load_social_data()

        # 重新加载用户信息字典 (把新注册的用户加载进内存)
        global user_info_map
        users_csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.csv")
        try:
            df_users = pd.read_csv(users_csv_path, encoding='utf-8')
        except UnicodeDecodeError:
            df_users = pd.read_csv(users_csv_path, encoding='gbk')
        
        temp_dict = pd.Series(df_users['info'].values, index=df_users['uid']).to_dict()
        user_info_map = {int(k): str(v) for k, v in temp_dict.items()}

        return jsonify({"status": "success", "message": "模型重训完毕！已成功吸收新增的社交关系与新用户！"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

# ==========================================
# 社交互动功能区 (关注 / 取关 / 回关)
# ==========================================
@app.route('/api/social/toggle_follow', methods=['POST'])
def toggle_follow():
    """处理关注/取关逻辑，并更新底层 edges_time.csv 数据源"""
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "请先登录"}), 401
        
    current_uid = session['uid']

    # 🛡️ 核心防弹补丁 1：绝对禁止 manager (uid=0) 产生连边，防止 CUDA -1 越界崩溃！
    if current_uid == 0:
        return jsonify({"status": "error", "message": "管理员账号 (manager) 为上帝视角，不可参与社交连边！"}), 403
    
    data = request.get_json()
    target_uid = int(data.get('target_id'))
    action = data.get('action') # 'follow' 或 'unfollow'
    
    try:
        from datetime import datetime
        import step3_recommend
        
        # 1. 更新内存字典 (让前端刷新时能立刻读到最新状态，无需等凌晨重训)
        if current_uid not in step3_recommend.follow_dict:
            step3_recommend.follow_dict[current_uid] =[]
            
        if action == 'follow' and target_uid not in step3_recommend.follow_dict[current_uid]:
            step3_recommend.follow_dict[current_uid].append(target_uid)
        elif action == 'unfollow' and target_uid in step3_recommend.follow_dict[current_uid]:
            step3_recommend.follow_dict[current_uid].remove(target_uid)
            
        # 2. 更新底层数据源 edges_time.csv (为凌晨的 GNN 重训做准备)
        edges_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'edges_time.csv')
        df = pd.read_csv(edges_path)
        
        if action == 'follow':
            # 追加一条新边，带上最新时间戳 (触发 Hawkes 过程)
            new_row = pd.DataFrame({
                'timestamp':[datetime.now().strftime("%Y-%m-%d %H:%M:%S")],
                'source_id': [current_uid],
                'target_id': [target_uid]
            })
            df = pd.concat([df, new_row], ignore_index=True)
        elif action == 'unfollow':
            # 删除这条边
            df = df[~((df['source_id'] == current_uid) & (df['target_id'] == target_uid))]
            
        df.to_csv(edges_path, index=False)
        
        # 3. 同步到 SQLite 数据库 (保持全栈数据一致性)
        from sqlalchemy import text
        if action == 'follow':
            db.session.execute(text("INSERT INTO edges_time (timestamp, source_id, target_id) VALUES (:ts, :s, :t)"), 
                               {'ts': datetime.now().strftime("%Y-%m-%d %H:%M:%S"), 's': current_uid, 't': target_uid})
        else:
            db.session.execute(text("DELETE FROM edges_time WHERE source_id = :s AND target_id = :t"), 
                               {'s': current_uid, 't': target_uid})
        db.session.commit()
        
        return jsonify({"status": "success", "message": f"已{'关注' if action=='follow' else '取消关注'}"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 个人空间与好友分组 API (新增模块)
# ==========================================
@app.route('/api/user/update', methods=['POST'])
def update_user_profile():
    """个人空间：修改个人信息"""
    if 'uid' not in session: return jsonify({"status": "error", "message": "未登录"}), 401
    uid = session['uid']
    data = request.json
    
    new_username = data.get('username')
    new_info = data.get('info')
    
    try:
        acc = Account.query.get(uid)
        user_info = UserInfo.query.get(uid)
        
        # 1. 更新用户名
        if new_username and new_username != acc.username:
            if Account.query.filter_by(username=new_username).first():
                return jsonify({"status": "error", "message": "用户名已被占用"}), 400
            acc.username = new_username
            session['username'] = new_username
            user_name_map[uid] = new_username
            
        # 2. 更新个人信息标签
        if new_info:
            user_info.info = new_info
            global user_info_map
            user_info_map[uid] = new_info
            
            # 同步更新 users.csv (为了凌晨 GNN 重训)
            users_csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.csv")
            df = pd.read_csv(users_csv_path)
            df.loc[df['uid'] == uid, 'info'] = new_info
            df.to_csv(users_csv_path, index=False, encoding='utf-8-sig')

        db.session.commit()
        return jsonify({"status": "success", "message": "个人信息修改成功！下次模型重训后生效。"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/groups', methods=['GET'])
def get_friend_groups():
    """获取当前用户的所有分组及分组内的好友"""
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    
    # 获取自定义分组
    groups = FriendGroup.query.filter_by(uid=uid).all()
    group_list = [{"id": g.id, "name": g.name} for g in groups]
    
    # 获取映射关系
    mappings = FriendMapping.query.filter_by(uid=uid).all()
    mapping_dict = {m.target_uid: m.group_id for m in mappings}
    
    return jsonify({"status": "success", "groups": group_list, "mappings": mapping_dict})

@app.route('/api/groups/create', methods=['POST'])
def create_friend_group():
    """创建一个新分组"""
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    group_name = request.json.get('name')
    if not group_name: return jsonify({"status": "error", "message": "组名不能为空"}), 400
    
    new_group = FriendGroup(uid=uid, name=group_name)
    db.session.add(new_group)
    db.session.commit()
    return jsonify({"status": "success", "group_id": new_group.id})

@app.route('/api/groups/assign', methods=['POST'])
def assign_friend_group():
    """把好友移动到某个分组"""
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    uid = session['uid']
    target_uid = request.json.get('target_id')
    group_id = request.json.get('group_id') # 如果为 0，代表移回“默认分组”
    
    # 先删除旧的映射
    FriendMapping.query.filter_by(uid=uid, target_uid=target_uid).delete()
    
    if group_id != 0:
        new_mapping = FriendMapping(uid=uid, target_uid=target_uid, group_id=group_id)
        db.session.add(new_mapping)
        
    db.session.commit()
    return jsonify({"status": "success"})

@app.route('/api/groups/rename', methods=['POST'])
def rename_friend_group():
    """重命名分组"""
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    group_id = request.json.get('group_id')
    new_name = request.json.get('name')
    if not new_name: return jsonify({"status": "error", "message": "组名不能为空"}), 400
    
    group = FriendGroup.query.filter_by(id=group_id, uid=session['uid']).first()
    if group:
        group.name = new_name
        db.session.commit()
        return jsonify({"status": "success"})
    return jsonify({"status": "error", "message": "分组不存在"}), 404

@app.route('/api/groups/delete', methods=['POST'])
def delete_friend_group():
    """删除分组 (该组好友将自动回到默认分组)"""
    if 'uid' not in session: return jsonify({"status": "error"}), 401
    group_id = request.json.get('group_id')

    # 1. 删除分组
    FriendGroup.query.filter_by(id=group_id, uid=session['uid']).delete()
    # 2. 删除该组的映射关系 (没有映射，前端自动归入默认分组)
    FriendMapping.query.filter_by(group_id=group_id, uid=session['uid']).delete()

    db.session.commit()
    return jsonify({"status": "success"})

# ==========================================
# 头像上传与访问 API
# ==========================================
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/user/upload_avatar', methods=['POST'])
def upload_avatar():
    """上传用户头像"""
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401

    uid = session['uid']

    # 检查是否有文件
    if 'avatar' not in request.files:
        return jsonify({"status": "error", "message": "没有上传文件"}), 400

    file = request.files['avatar']

    # 检查文件名
    if file.filename == '':
        return jsonify({"status": "error", "message": "未选择文件"}), 400

    # 检查文件类型
    if not allowed_file(file.filename):
        return jsonify({"status": "error", "message": "不支持的文件格式，仅支持: png, jpg, jpeg, gif, webp"}), 400

    # 检查文件大小
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)

    if file_size > MAX_FILE_SIZE:
        return jsonify({"status": "error", "message": f"文件过大，最大支持 {MAX_FILE_SIZE // (1024*1024)}MB"}), 400

    try:
        # 生成文件名：uid_原文件名 (例如: 1001_avatar.jpg)
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uid}_avatar.{file_ext}"

        # 保存文件
        avatars_dir = os.path.join(current_dir, 'static', 'avatars')
        filepath = os.path.join(avatars_dir, filename)

        # 确保目录存在
        os.makedirs(avatars_dir, exist_ok=True)

        file.save(filepath)

        # 删除旧头像（如果存在且文件名不同）
        account = Account.query.get(uid)
        if account and account.avatar and account.avatar != filename:
            old_filepath = os.path.join(avatars_dir, account.avatar)
            if os.path.exists(old_filepath):
                try:
                    os.remove(old_filepath)
                except Exception as e:
                    print(f"删除旧头像失败: {e}")

        # 更新数据库
        if not account:
            account = Account(uid=uid, username=f"User_{uid}", password_hash=generate_password_hash("default"))
            db.session.add(account)

        account.avatar = filename
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "头像上传成功",
            "avatar": filename
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"status": "error", "message": f"上传失败: {str(e)}"}), 500

@app.route('/api/user/avatar', methods=['GET'])
def get_avatar():
    """获取当前用户的头像信息"""
    if 'uid' not in session:
        return jsonify({"status": "error", "message": "未登录"}), 401

    uid = session['uid']
    account = Account.query.get(uid)

    return jsonify({
        "status": "success",
        "avatar": account.avatar if account else None
    })

@app.route('/api/user/avatar/<int:uid>', methods=['GET'])
def get_user_avatar(uid):
    """获取指定用户的头像信息"""
    account = Account.query.get(uid)
    return jsonify({
        "status": "success",
        "avatar": account.avatar if account else None
    })

# ==========================================
# 每日定时 T+1 重训任务 (使用 APScheduler)
# ==========================================
def daily_retrain_task():
    """每天固定时间执行的自动重训任务"""
    print(f"\n[Scheduler] === 开始执行每日定时 T+1 重训任务 ===")
    from t_plus_1_scheduler import run_pipeline
    import step3_recommend
    import torch
    import pandas as pd
    import os

    try:
        # 1. 运行流水线 (跑 step1, step2, build_visual_graph)
        result = run_pipeline()
        if result.get('status') != 'success':
            print(f"[Scheduler] 定时任务重训失败: {result.get('message')}")
            return

        # 2. 热更新内存数据 (核心：防止网页读到旧数据！)
        print("[Scheduler] 正在将最新模型和关系加载到内存中...")
        
        # 重新加载模型向量
        step3_recommend.embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
        # 重新加载关注字典
        step3_recommend.follow_dict = step3_recommend.load_social_data()

        # 重新加载用户信息字典
        global user_info_map
        users_csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.csv")
        try:
            df_users = pd.read_csv(users_csv_path, encoding='utf-8')
        except UnicodeDecodeError:
            df_users = pd.read_csv(users_csv_path, encoding='gbk')
        
        temp_dict = pd.Series(df_users['info'].values, index=df_users['uid']).to_dict()
        user_info_map = {int(k): str(v) for k, v in temp_dict.items()}

        print(f"[Scheduler] === 每日定时 T+1 重训任务执行成功，内存已热更新！ ===")
    except Exception as e:
        print(f"[Scheduler] 定时任务执行发生异常: {e}")

# 引入 BackgroundScheduler
from apscheduler.schedulers.background import BackgroundScheduler

# ==========================================
# 星图专用：获取全校实时头像映射表
# ==========================================
@app.route('/api/users/avatars', methods=['GET'])
def get_all_avatars():
    """实时返回所有有头像的用户的映射表，用于星图截胡 graph.json 的延迟"""
    try:
        accounts = Account.query.all()
        avatar_map = {acc.uid: acc.avatar for acc in accounts if acc.avatar}
        return jsonify({"status": "success", "avatars": avatar_map})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


if __name__ == "__main__":
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