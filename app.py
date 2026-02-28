from flask import Flask,request, jsonify
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

#网页主页面
@app.route('/')
def home():
    return "Flask is running. Try /tuijian?id=1"
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
if __name__ == "__main__":
    # host=127.0.0.1 表示只在本机访问；port=5000 是默认端口
    app.run(host="127.0.0.1", port=5000, debug=True)