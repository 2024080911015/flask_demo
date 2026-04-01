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

# 定义用户信息模型
class UserInfo(db.Model):
    __tablename__ = 'users'
    uid = db.Column(db.Integer, primary_key=True)
    info = db.Column(db.Text, nullable=False)

# 初始化数据库表
with app.app_context():
    db.create_all()

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
    
    # 核心修改：返回带有 id 的字典
    rec_data_list =[{"id": rid, "info": user_info_map.get(rid, f"未知")} for rid in rec_ids]
    
    return jsonify({
        "student_id": sid,
        "mode": mode,
        "student_info": user_info_map.get(sid, f"ID:{sid}"),
        "recommend_friends": rec_data_list,  # 这里变成了字典数组
        "recommend_ids": rec_ids, # 留给星图用
        "count": len(rec_data_list)
    })

    sid=request.args.get('id',default=None, type=int)
    
    mode=request.args.get('mode',default='social', type=str) #新增 mode 参数，默认 social
    community_tag=request.args.get('community',default=None,type=str)
    if sid is None:
        return jsonify({"error": "Missing 'id' parameter"}), 400
    rec_ids=step3_recommend.recommend_friends(sid,top_k=5, mode=mode, community=community_tag) #具体的推荐算法，来自step3_recommend.py
    rec_info_list=[]         #根据ID来获取到信息（数据来源为users.csv）
    for rec_id in rec_ids:
        rec_info=user_info_map.get(rec_id,f"User {rec_id}")
        rec_info_list.append(rec_info)
    return jsonify({
            "student_id": sid,
            "mode": mode,
            "student_info": user_info_map.get(sid, f"ID:{sid}"),
            "recommend_friends": rec_info_list,
            "recommend_ids": rec_ids,
            "count": len(rec_info_list)
        }) #返回推荐结果的JSON格式
#返回所有用户信息的接口
@app.route('/users')
def get_users():
    users_list=[]
    for id,info in user_info_map.items():
        users_list.append({
            "student_id": id,
            "student_info": info
        })
    return jsonify(users_list)    
#根据ID返回用户信息的接口
@app.route('/user')
def get_user():
    sid=request.args.get('id',default=None, type=int)
    if sid is None:
        return jsonify({"error": "Missing 'id' parameter"}), 400
    user_info=user_info_map.get(sid,f"User {sid}")
    return jsonify({
        "student_id": sid,
        "student_info": user_info
    })
#获取用户的关注列表接口
# 修改 2：关注列表接口
@app.route('/following')
def get_following():
    sid = request.args.get('id', default=None, type=int)
    if sid is None: return jsonify({"error": "Missing id"}), 400
    
    following_list = follow_dict.get(sid,[])
    # 核心修改：返回带有 id 的字典
    following_data_list = [{"id": fid, "info": user_info_map.get(fid, f"未知")} for fid in following_list]
    
    return jsonify({
        "student_id": sid,
        "count": len(following_data_list),
        "following": following_data_list,
    })

    sid = request.args.get('id', default=None, type=int)
    if sid is None:
        return jsonify({"error": "Missing 'id' parameter"}), 400
    following_list = follow_dict.get(sid, [])
    following_list_info = []
    for fid in following_list:
        following_info = user_info_map.get(fid, f"User {fid}")
        following_list_info.append(following_info)
    return jsonify({
        "student_id": sid,
        "student_info": user_info_map.get(sid, f"ID:{sid}"),
        "count": len(following_list_info),
        "following": following_list_info,
    })
#获取用户的粉丝列表接口
# 修改 3：粉丝列表接口
@app.route('/followers')
def get_followers():
    sid = request.args.get('id', default=None, type=int)
    if sid is None: return jsonify({"error": "Missing id"}), 400

    followers_list =[uid for uid, following in follow_dict.items() if sid in following]
    # 核心修改：返回带有 id 的字典
    followers_data_list =[{"id": fid, "info": user_info_map.get(fid, f"未知")} for fid in followers_list]

    return jsonify({
        "student_id": sid,
        "followers_count": len(followers_data_list),
        "followers": followers_data_list
    })
    sid = request.args.get('id', default=None, type=int)
    if sid is None:
        return jsonify({"error": "Missing 'id' parameter"}), 400

    # 从 follow_dict 反向查找粉丝
    followers_list = []
    for user_id, following in follow_dict.items():
        if sid in following:
            followers_list.append(user_id)

    followers_info_list = []
    for fid in followers_list:
        follower_info = user_info_map.get(fid, f"User {fid}")
        followers_info_list.append(follower_info)

    return jsonify({
            "student_id": sid,
            "followers_count": len(followers_list),
            "followers": followers_info_list
        }) 
#返回整个社交网络的情况接口
@app.route('/social/stats')
def get_social_stats():
    total_users = len(user_info_map)
    total_follows = sum(len(following) for following in follow_dict.values())
    avg_follows = total_follows / total_users if total_users > 0 else 0

    # 计算关注最多的用户
    max_follows = 0
    most_popular = []
    for user_id, following in follow_dict.items():
        if len(following) > max_follows:
            max_follows = len(following)
            most_popular = [user_id]
        elif len(following) == max_follows:
            most_popular.append(user_id)
    most_popular_info=[]
    for uid in most_popular:
        info=user_info_map.get(uid,f"User {uid}")
        most_popular_info.append(info)
    return jsonify({
        "total_users": total_users,
        "total_follows": total_follows,
        "average_follows": round(avg_follows, 2),
        "max_follows": max_follows,
        "most_popular_users": most_popular_info
    })
#社交诊断报告接口
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

#T+1动态图模型重训-Loihan-注——只实现了手动重新训练，还没有定时重新训练的功能。重新训练的脚本是t_plus_1_scheduler.py
@app.route('/api/admin/retrain', methods=['POST'])
def admin_retrain():
    """答辩用，一键触发T+1动态图模型重训"""
    result = run_pipeline()
    if result['status'] == 'success':
        # 训练完成后，强制内存重新加载最新的 embedding 向量
        import torch
        step3_recommend.embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
    return jsonify(result)


if __name__ == "__main__":
    # host=127.0.0.1 表示只在本机访问；port=5000 是默认端口
    app.run(host="0.0.0.0", port=5001, debug=True)