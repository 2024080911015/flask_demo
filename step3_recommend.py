import torch
import torch.nn.functional as F
import pandas as pd
import os

print("🚀 启动时序图推荐推理引擎...")

# 1. 加载模型产出的嵌入向量
try:
    embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
except FileNotFoundError:
    print("❌ 找不到 user_embeddings.pt")
    exit()

# 2. 安全加载用户信息
try:
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.csv')
    df_users = pd.read_csv(csv_path, encoding='utf-8')
except UnicodeDecodeError:
    df_users = pd.read_csv(csv_path, encoding='gbk')

user_info_map = pd.Series(df_users['info'].values, index=df_users['uid']).to_dict()
#加载用户关注列表的函数
def load_social_data():
    """加载社交网络数据"""
    try:
        # 加载 edges.csv (关注关系)
        edges_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'edges.csv')
        df_edges = pd.read_csv(edges_path)
        # 构建关注字典: {user_id: [following_ids]}
        follow_dict = {}
        for idx, row in df_edges.iterrows():
            user_id = row['source']
            # 将target列按|分割成列表
            following_ids = list(map(int, str(row['target']).split('|')))
            follow_dict[user_id] = following_ids

        print(f"✅ 加载了 {len(follow_dict)} 个用户的关注关系")

        return follow_dict

    except Exception as e:
        print(f"⚠️  加载社交网络数据失败: {e}")
        return {}
# 3. 核心推荐算法
def recommend_friends(user_id, top_k=5):
    u_idx = user_id - 1
    if u_idx < 0 or u_idx >= embeddings.shape[0]: return[]
    
    target_emb = embeddings[u_idx].unsqueeze(0)
    similarity = F.cosine_similarity(target_emb, embeddings)
    
    # 获取最高分的几个人
    scores, indices = torch.topk(similarity, k=top_k + 1)
    recommend_ids = (indices + 1).tolist()
    
    if user_id in recommend_ids:
        recommend_ids.remove(user_id)
        
    return recommend_ids[:top_k]

# 4. 测试
if __name__ == "__main__":
    while True:
        try:
            val = input("\n👉 请输入学生ID (1-1000) (输入 q 退出): ")
            if val.lower() == 'q': break
            uid = int(val)
            
            print(f"\n🔍 [学生 {uid}] 的档案: {user_info_map.get(uid, '未知')}")
            recs = recommend_friends(uid)
            print("✨ 依据最新时间演化图，为您推荐：")
            for rid in recs:
                print(f"   ➤ ID: {rid:03d} | {user_info_map.get(rid, '未知')}")
        except Exception as e:
            print("❌ 输入有误或用户不存在。")