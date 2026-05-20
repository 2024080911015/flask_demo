import pandas as pd
import torch
from torch_geometric.data import Data
import numpy as np
import sqlite3
import os

print("🚀 [Step 1] 正在重构 GCN 数据工程: [52维特征 + 时序拓扑 + 指数衰减]...")

# 1. 特征编码字典定义 (保持与你之前逻辑一致)
GENDERS, GRADES = ["男", "女"], ["大一","大二","大三","大四","研一","研二","研三","博士"]
MAJORS = ["计算机","新闻","会计","美术","通信","医学","法学","土木","英语","生物","电气","体育"]
INTERESTS = ["绘画","编程","动漫","足球","羽毛球","音乐","天文","围棋","缝纫","骑行","剪纸","种植","机械","舞蹈","跑步"]
LABELS = ["社恐星人", "社交牛逼症", "社交普通型", "熬夜的神", "早睡早起", "作息规律", "高冷", "可爱", "温和", "吃货", "宅属性", "镇圈大佬", "段子手", "技术大牛", "运动达人"]

map_g, map_gr = {k:v for v,k in enumerate(GENDERS)}, {k:v for v,k in enumerate(GRADES)}
map_m, map_i = {k:v for v,k in enumerate(MAJORS)}, {k:v for v,k in enumerate(INTERESTS)}
map_l = {k:v for v,k in enumerate(LABELS)}

def encode_user(info_str):
    vec_g, vec_gr = np.zeros(len(GENDERS)), np.zeros(len(GRADES))
    vec_m, vec_i, vec_l = np.zeros(len(MAJORS)), np.zeros(len(INTERESTS)), np.zeros(len(LABELS))
    try:
        data_dict = dict(item.split(':', 1) for item in info_str.split(',') if ':' in item)
        if '性别' in data_dict and data_dict['性别'] in map_g: vec_g[map_g[data_dict['性别']]] = 1.0
        if '年级' in data_dict and data_dict['年级'] in map_gr: vec_gr[map_gr[data_dict['年级']]] = 1.0
        if '专业' in data_dict and data_dict['专业'] in map_m: vec_m[map_m[data_dict['专业']]] = 1.0
        if '爱好' in data_dict:
            for intr in data_dict['爱好'].split(): 
                if intr in map_i: vec_i[map_i[intr]] = 1.0
        if '标签' in data_dict and data_dict['标签'] != "无标签":
            for lbl in data_dict['标签'].split(): 
                if lbl in map_l: vec_l[map_l[lbl]] = 1.0
    except: pass
    return np.concatenate([vec_g, vec_gr, vec_m, vec_i, vec_l])

# 2. 从数据库读取实时数据
db_path = 'campus_social.db'
conn = sqlite3.connect(db_path)
df_users = pd.read_sql_query("SELECT uid, info FROM users ORDER BY uid ASC", conn)
df_edges = pd.read_sql_query("SELECT timestamp, source_id, target_id FROM edges_time", conn)
conn.close()

# 3. 构造节点特征矩阵 X
x = torch.tensor(np.array([encode_user(row['info']) for _, row in df_users.iterrows()]), dtype=torch.float)

# 4. 处理边与指数时间衰减 (Exponential Decay)
if not df_edges.empty:
    df_edges = df_edges.sort_values(by='timestamp').reset_index(drop=True)
    # 计算权重：越新产生的边权重越高 (0.6 ~ 1.0)
    df_edges['ts_dt'] = pd.to_datetime(df_edges['timestamp'])
    ts_max, ts_min = df_edges['ts_dt'].max(), df_edges['ts_dt'].min()
    diff = (ts_max - ts_min).total_seconds() + 1e-9
    norm_t = (df_edges['ts_dt'] - ts_min).dt.total_seconds() / diff
    
    lambda_decay = 0.5 
    weights = np.exp(-lambda_decay * (1.0 - norm_t))
    
    # 注意：PyG 的 edge_index 是从 0 开始的连续索引，如果 UID 是从 1 开始的，需要减 1
    edge_index = torch.tensor([df_edges['source_id'].values - 1, 
                                 df_edges['target_id'].values - 1], dtype=torch.long)
    edge_weight = torch.tensor(weights, dtype=torch.float)
else:
    edge_index = torch.empty((2, 0), dtype=torch.long)
    edge_weight = torch.empty((0,), dtype=torch.float)

# 5. 保存为 PyG 数据包
data = Data(x=x, edge_index=edge_index, edge_weight=edge_weight)
torch.save(data, 'campus_graph_full.pt')
print(f"✅ 数据包构建完毕: {data.num_nodes} 节点, {data.num_edges} 条边。")