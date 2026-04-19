import pandas as pd
import networkx as nx
import community.community_louvain as community_louvain
import json
import os
import sqlite3

COMMUNITY_RULES = {
    "运动健将圈":["足球", "羽毛球", "跑步", "骑行", "运动达人", "体育"],
    "文艺星人圈":["音乐", "舞蹈", "绘画", "剪纸", "缝纫", "温和", "可爱", "美术", "英语"],
    "硬核极客圈":["编程", "机械", "技术大牛", "计算机", "电气", "通信", "土木"],
    "二次元宅圈":["动漫", "宅属性", "社恐星人"],
    "社牛风云圈":["社交牛逼症", "镇圈大佬", "段子手", "新闻", "法学"],
    "佛系养生圈":["种植", "围棋", "天文", "早睡早起", "作息规律", "吃货", "社交普通型"],
    "爆肝修仙圈":["熬夜的神", "高冷", "生物", "会计"]
}

def get_semantic_community(info_str):
    best_comm = "综合跨界圈"
    max_matches = 0
    for comm, keywords in COMMUNITY_RULES.items():
        matches = sum(1 for kw in keywords if kw in str(info_str))
        if matches > max_matches:
            max_matches = matches
            best_comm = comm
    return best_comm

def generate_graph_json():
    print("🌌 正在构建包含签名与状态的神经图谱...")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(current_dir, 'campus_social.db')
    
    account_dict = {}
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        # 🚀 核心修复：查询语句必须包含 signature 和 status
        cursor.execute("SELECT uid, username, avatar, signature, status FROM accounts")
        for row in cursor.fetchall():
            account_dict[row[0]] = {
                'username': row[1], 
                'avatar': row[2],
                'signature': row[3], # 索引 3
                'status': row[4]      # 索引 4
            }
        conn.close()
    except Exception as e:
        print(f"⚠️ 读取数据库信息失败: {e}")

    users_csv = os.path.join(current_dir, 'users.csv')
    edges_csv = os.path.join(current_dir, 'edges_time.csv')
    output_json = os.path.join(current_dir, 'static', 'graph.json')

    try:
        df_users = pd.read_csv(users_csv, encoding='utf-8')
    except:
        df_users = pd.read_csv(users_csv, encoding='gbk')
        
    df_edges = pd.read_csv(edges_csv)
    df_edges = df_edges[(df_edges['source_id'] > 0) & (df_edges['target_id'] > 0)]

    G = nx.Graph()
    for _, row in df_users.iterrows():
        G.add_node(int(row['uid']), info=row['info'])
    for _, row in df_edges.iterrows():
        G.add_edge(int(row['source_id']), int(row['target_id']))

    partition = community_louvain.best_partition(G)
    degrees = dict(G.degree())

    nodes_data = []
    for node_id in G.nodes():
        info_str = G.nodes[node_id].get('info', '无标签')
        semantic_comm = get_semantic_community(info_str)
        
        acc = account_dict.get(int(node_id), {})
        
        # 🚀 核心修复：将新字段压入 JSON 节点
        nodes_data.append({
            "id": str(node_id),
            "username": acc.get('username', f"User_{node_id}"),
            "avatar": acc.get('avatar', None),
            "signature": acc.get('signature', ""), 
            "status": acc.get('status', ""),       
            "info": info_str,
            "val": degrees.get(node_id, 0) * 2 + 5,
            "group": partition.get(node_id, 0),
            "community": semantic_comm
        })

    links_data = [{"source": str(int(row['source_id'])), "target": str(int(row['target_id']))} for _, row in df_edges.iterrows()]

    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump({"nodes": nodes_data, "links": links_data}, f, ensure_ascii=False, indent=2)

    print(f"✅ 包含签名与状态的 graph.json 生成完毕！")
    return True

if __name__ == "__main__":
    generate_graph_json()