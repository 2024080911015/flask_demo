from flask import Flask,request, jsonify,render_template
import os
import torch
import torch.nn.functional as F
import pandas as pd
import step3_recommend


app =Flask(__name__)
app.json.ensure_ascii = False
app.json.sort_keys = False

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
            # 将原来的那行替换成这行：
            user_info_map = pd.Series(df_users['info'].values, index=df_users['uid']).to_dict()
            print(f"Loaded user info for {len(user_info_map)} users.")
except Exception as e:
    print(f"Error loading user info: {e}")

# 加载社交网络数据 (来自 step3_recommend.py)
follow_dict = step3_recommend.follow_dict

#网页主页面
@app.route('/')
def home():
    return render_template('index.html')
#推荐接口
@app.route('/tuijian')
def tuijian():
    sid=request.args.get('id',default=None, type=int)
    if sid is None:
        return jsonify({"error": "Missing 'id' parameter"}), 400
    rec_ids=step3_recommend.recommend_friends(sid,top_k=5) #具体的推荐算法，来自step3_recommend.py
    rec_info_list=[]         #根据ID来获取到信息（数据来源为users.csv）
    for rec_id in rec_ids:
        rec_info=user_info_map.get(rec_id,f"User {rec_id}")
        rec_info_list.append(rec_info)
    return jsonify({
            "student_id": sid,
            "student_info": user_info_map.get(sid, f"ID:{sid}"),
            "recommend_friends": rec_info_list,
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
@app.route('/following')
def get_following():
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
@app.route('/followers')
def get_followers():
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


if __name__ == "__main__":
    # host=127.0.0.1 表示只在本机访问；port=5000 是默认端口
    app.run(host="127.0.0.1", port=5000, debug=True)