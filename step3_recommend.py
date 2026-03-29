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

follow_dict=load_social_data()

# 获取用户关注列表的接口函数
def get_following(user_id):
    """获取用户的关注列表"""
    return follow_dict.get(user_id, [])

# 3. 核心推荐算法
# 终极优化版社区规则：100% 覆盖所有爱好、标签和专业
COMMUNITY_RULES = {
    "运动健将圈": [
        "足球", "羽毛球", "跑步", "骑行",
        "运动达人",
        "体育"
    ],
    "文艺手作圈": [
        "音乐", "舞蹈", "绘画", "剪纸", "缝纫",
        "美术"
    ],
    "硬核技术圈": [
        "编程", "机械",
        "技术大牛", "高冷",
        "计算机", "电气", "通信", "土木"
    ],
    "二次元宅圈": [
        "动漫",
        "宅属性", "熬夜的神", "社恐星人", "可爱"
    ],
    "佛系养生圈": [
        "种植", "围棋", "天文",
        "吃货", "早睡早起", "作息规律", "温和", "社交普通型",
        "生物", "医学", "会计", "英语"
    ],
    "社交风云圈": [
        "社交牛逼症", "镇圈大佬", "段子手",
        "新闻", "法学"
    ]
}
def recommend_friends(user_id, top_k=5, mode="social", community=None):
    u_idx = user_id - 1
    if u_idx < 0 or u_idx >= embeddings.shape[0]:
        return []

    target_emb = embeddings[u_idx].unsqueeze(0)
    similarity = F.cosine_similarity(target_emb, embeddings)

    # 【关键修改】：因为要过滤特定圈子的人，不能只取 top_k 了，
    # 必须把所有人的相似度降序排个名，然后从高到低往下找，直到凑齐符合圈子条件的 top_k
    sorted_scores, sorted_indices = torch.sort(similarity, descending=True)
    
    candidate_ids = []
    
    for idx in sorted_indices.tolist():
        rid = idx + 1
        if rid == user_id: 
            continue
            
        # ================= 社区过滤逻辑 =================
        if community and community in COMMUNITY_RULES:
            keywords = COMMUNITY_RULES[community]
            user_info_str = str(user_info_map.get(rid, ""))
            # 只要该用户的 info 中包含任意一个该圈子的关键词，就认为他属于这个圈子
            if not any(kw in user_info_str for kw in keywords):
                continue # 不属于该圈子，直接跳过，看下一个相似度高的人
        # ================================================
        
        candidate_ids.append(rid)
        
        # 取足够多的候选人用于后续社交网络模式的过滤，避免过滤完数量不够
        if len(candidate_ids) >= top_k + 20: 
            break

    # ================= 模式分支逻辑 =================
    if mode == "gnn":
        return candidate_ids[:top_k]

    # 模式 B: 社交网络优化模式
    final_rec = []
    user_following = follow_dict.get(user_id, [])

    for rid in candidate_ids:
        if rid in user_following:
            continue
        rid_following = follow_dict.get(rid, [])
        common_following = set(user_following) & set(rid_following)
        
        if len(common_following) > 0:
            final_rec.append(rid)
            if len(final_rec) >= top_k:
                return final_rec

    # 补充剩余的
    remaining = [rid for rid in candidate_ids if rid not in final_rec and rid not in user_following]
    final_rec.extend(remaining)
    return final_rec[:top_k]
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