import pandas as pd
import networkx as nx
import community.community_louvain as community_louvain
import json
import os

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
    print(" 正在启动神经图谱构建与语义社区映射...")
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    users_csv = os.path.join(current_dir, 'users.csv')
    edges_csv = os.path.join(current_dir, 'edges_time.csv')
    output_json = os.path.join(current_dir, 'static', 'graph.json')

    os.makedirs(os.path.join(current_dir, 'static'), exist_ok=True)

    try:
        df_users = pd.read_csv(users_csv, encoding='utf-8')
    except UnicodeDecodeError:
        df_users = pd.read_csv(users_csv, encoding='gbk')
        
    df_edges = pd.read_csv(edges_csv)

    #  防弹 1：物理超度所有的“历史脏数据”和幽灵边 (比如 manager的记录)
    df_edges = df_edges[(df_edges['source_id'] > 0) & (df_edges['target_id'] > 0)]

    G = nx.Graph()
    for _, row in df_users.iterrows():
        G.add_node(int(row['uid']), info=row['info'])

    for _, row in df_edges.iterrows():
        G.add_edge(int(row['source_id']), int(row['target_id']))

    print("   -> 正在运行 Louvain 底层结构聚类...")
    partition = community_louvain.best_partition(G)
    degrees = dict(G.degree())

    nodes_data =[]
    for node_id in G.nodes():
        #  防弹 2：使用 .get() 安全读取，就算再有幽灵节点也绝对不崩溃！
        info_str = G.nodes[node_id].get('info', '性别:未知,标签:无标签')
        semantic_comm = get_semantic_community(info_str)
        
        nodes_data.append({
            "id": str(node_id),
            "name": f"User {node_id}",
            "info": info_str,
            "val": degrees.get(node_id, 0) * 2 + 5,
            "group": partition.get(node_id, 0),
            "community": semantic_comm
        })

    links_data =[{"source": str(u), "target": str(v)} for u, v in G.edges()]

    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump({"nodes": nodes_data, "links": links_data}, f, ensure_ascii=False, indent=2)

    print(f" 神经图谱生成完毕！已为所有节点打上专属中文圈层标签。")
    return True

if __name__ == "__main__":
    generate_graph_json()