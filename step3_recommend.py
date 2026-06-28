import torch
import torch.nn.functional as F
import pandas as pd
import os
import sqlite3
import re

print(" 启动时序图推荐推理引擎...")

# 1. 加载模型产出的嵌入向量
try:
    embeddings = torch.load('user_embeddings.pt', map_location='cpu', weights_only=False)
except FileNotFoundError:
    print(" 找不到 user_embeddings.pt")
    exit()

uid_order = []
uid_to_embedding_index = {}
embedding_index_to_uid = {}

def load_embedding_uid_order():
    global uid_order, uid_to_embedding_index, embedding_index_to_uid
    order_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'embedding_uid_order.pt')
    try:
        loaded = torch.load(order_path, map_location='cpu', weights_only=False)
        uid_order = [int(uid) for uid in loaded.tolist()]
    except FileNotFoundError:
        uid_order = list(range(1, embeddings.shape[0] + 1))

    if len(uid_order) != embeddings.shape[0]:
        print(" embedding uid 映射长度与向量数量不一致，回退到连续 uid 映射。")
        uid_order = list(range(1, embeddings.shape[0] + 1))

    uid_to_embedding_index = {uid: idx for idx, uid in enumerate(uid_order)}
    embedding_index_to_uid = {idx: uid for idx, uid in enumerate(uid_order)}

def has_embedding(user_id):
    return int(user_id) in uid_to_embedding_index

def get_embedding_for_uid(user_id):
    idx = uid_to_embedding_index.get(int(user_id))
    if idx is None:
        return None
    return embeddings[idx]

load_embedding_uid_order()

# 2. 从数据库加载用户信息
db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'campus_social.db')
conn = sqlite3.connect(db_path)
df_users = pd.read_sql_query("SELECT uid, info FROM users", conn)
conn.close()

user_info_map = pd.Series(df_users['info'].values, index=df_users['uid']).to_dict()

#加载用户关注列表的函数
# ==========================================
# 修改版：加载最新的时间序列关注列表
# ==========================================
def load_social_data():
    """加载社交网络数据 (统一使用数据库中的 edges_time 表)"""
    try:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'campus_social.db')
        conn = sqlite3.connect(db_path)
        df_edges = pd.read_sql_query("SELECT source_id, target_id FROM edges_time", conn)
        conn.close()

        follow_dict = {}
        for idx, row in df_edges.iterrows():
            user_id = int(row['source_id'])
            target_id = int(row['target_id'])

            if user_id not in follow_dict:
                follow_dict[user_id] =[]

            if target_id not in follow_dict[user_id]:
                follow_dict[user_id].append(target_id)

        print(f" 成功从数据库加载了 {len(follow_dict)} 个用户的关注关系！")
        return follow_dict

    except Exception as e:
        print(f"  加载社交网络数据失败: {e}")
        return {}

follow_dict = load_social_data()


# 获取用户关注列表的接口函数
def get_following(user_id):
    """获取用户的关注列表"""
    return follow_dict.get(user_id, [])

PROFILE_SCORE_ORDER = ["社交", "协作", "学习", "开放", "沟通", "作息"]

def parse_profile_scores(info_str):
    """从 users.info 中解析问卷画像分，返回 6 维向量。缺失时返回 None。"""
    if not info_str or "画像分:" not in str(info_str):
        return None
    match = re.search(r"画像分:([^,]+)", str(info_str))
    if not match:
        return None
    score_map = {}
    for item in match.group(1).split("|"):
        m = re.match(r"([\u4e00-\u9fa5]+)(\d+)", item.strip())
        if m:
            score_map[m.group(1)] = float(m.group(2))
    if not all(key in score_map for key in PROFILE_SCORE_ORDER):
        return None
    return torch.tensor([score_map[key] for key in PROFILE_SCORE_ORDER], dtype=torch.float)

def get_profile_similarity(user_id, target_id):
    """计算两个用户的画像分余弦相似度，归一化到 0-100。"""
    source_vec = parse_profile_scores(user_info_map.get(user_id, ""))
    target_vec = parse_profile_scores(user_info_map.get(target_id, ""))
    if source_vec is None or target_vec is None:
        return 50.0
    sim = F.cosine_similarity(source_vec.unsqueeze(0), target_vec.unsqueeze(0)).item()
    return max(0.0, min(100.0, sim * 100))

def get_social_bonus(user_id, target_id):
    """基于社交图给候选人加成：共同关注越多，排序越靠前。"""
    user_following = set(follow_dict.get(user_id, []))
    target_following = set(follow_dict.get(target_id, []))
    common_count = len(user_following & target_following)
    if common_count <= 0:
        return 0.0
    return min(100.0, 40.0 + common_count * 15.0)

# 3. 核心推荐算法
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
        "生物", "医学", "会计"                # 课业极度繁重、实验/考证压力大的高卷专业
    ]
}
def recommend_friends(user_id, top_k=5, mode="social", community=None):
    u_idx = uid_to_embedding_index.get(int(user_id))
    if u_idx is None:
        return []

    target_emb = embeddings[u_idx].unsqueeze(0)
    similarity = F.cosine_similarity(target_emb, embeddings)

    # 【关键修改】：因为要过滤特定圈子的人，不能只取 top_k 了，
    # 必须把所有人的相似度降序排个名，然后从高到低往下找，直到凑齐符合圈子条件的 top_k
    sorted_scores, sorted_indices = torch.sort(similarity, descending=True)
    
    candidate_ids = []
    candidate_gnn_scores = {}
    
    for idx in sorted_indices.tolist():
        rid = embedding_index_to_uid.get(int(idx))
        if rid is None:
            continue
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
        candidate_gnn_scores[rid] = float(similarity[idx].item())
        
        # 取足够多的候选人用于后续社交网络模式的过滤，避免过滤完数量不够
        if len(candidate_ids) >= top_k + 80: 
            break

    # 获取当前用户的关注列表（两种模式都需要用来过滤）
    user_following = follow_dict.get(user_id, [])
    filtered_candidates = [rid for rid in candidate_ids if rid not in user_following]

    ranked_candidates = []
    for rid in filtered_candidates:
        # GNN cosine 范围约为 -1~1，转成 0~100 后便于和画像分合成。
        gnn_score = (candidate_gnn_scores.get(rid, 0.0) + 1.0) * 50.0
        profile_score = get_profile_similarity(user_id, rid)
        social_bonus = get_social_bonus(user_id, rid)

        if mode == "gnn":
            final_score = gnn_score * 0.80 + profile_score * 0.20
        else:
            final_score = gnn_score * 0.60 + profile_score * 0.25 + social_bonus * 0.15

        ranked_candidates.append((rid, final_score, gnn_score, profile_score, social_bonus))

    ranked_candidates.sort(key=lambda item: item[1], reverse=True)
    return [rid for rid, *_ in ranked_candidates[:top_k]]
# 4. 测试
if __name__ == "__main__":
    while True:
        try:
            val = input("\n 请输入学生ID (1-1000) (输入 q 退出): ")
            if val.lower() == 'q': break
            uid = int(val)
            
            print(f"\n🔍 [学生 {uid}] 的档案: {user_info_map.get(uid, '未知')}")
            recs = recommend_friends(uid)
            print(" 依据最新时间演化图，为您推荐：")
            for rid in recs:
                print(f"   ➤ ID: {rid:03d} | {user_info_map.get(rid, '未知')}")
        except Exception as e:
            print(" 输入有误或用户不存在。")
