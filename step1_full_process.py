import pandas as pd
import torch
from torch_geometric.data import Data
import numpy as np
import sqlite3

print(" 正在重构数据工程: [52维特征 + 指数时间衰减机制]...")

# 1. 字典定义
GENDERS, GRADES = ["男", "女"],["大一","大二","大三","大四","研一","研二","研三","博士"]
MAJORS =["计算机","新闻","会计","美术","通信","医学","法学","土木","英语","生物","电气","体育"]
INTERESTS =["绘画","编程","动漫","足球","羽毛球","音乐","天文","围棋","缝纫","骑行","剪纸","种植","机械","舞蹈","跑步"]
LABELS =["社恐星人", "社交牛逼症", "社交普通型", "熬夜的神", "早睡早起", 
          "作息规律", "高冷", "可爱", "温和", "吃货", "宅属性", 
          "镇圈大佬", "段子手", "技术大牛", "运动达人"]#标签

map_g, map_gr = {k:v for v,k in enumerate(GENDERS)}, {k:v for v,k in enumerate(GRADES)}
map_m, map_i = {k:v for v,k in enumerate(MAJORS)}, {k:v for v,k in enumerate(INTERESTS)}
map_l = {k:v for v,k in enumerate(LABELS)}

# 2. 节点特征编码
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

print(" 处理用户节点...")
conn = sqlite3.connect('campus_social.db')
df_users = pd.read_sql_query("SELECT uid, info FROM users", conn)
x = torch.tensor(np.array([encode_user(row['info']) for _, row in df_users.iterrows()]), dtype=torch.float)

# 3. 边处理与指数时间衰减 (Exponential Decay)
print(" 处理时间序列边...")
df_edges = pd.read_sql_query("SELECT timestamp, source_id, target_id FROM edges_time", conn)
conn.close()
# 获取有效的用户ID集合
valid_uids = set(df_users['uid'].values)
# 核心防弹补丁 2：清洗掉所有 uid <= 0 的幽灵边（比如 manager），以及不在 users 表中的节点
df_edges = df_edges[(df_edges['source_id'] > 0) & (df_edges['target_id'] > 0)]
df_edges = df_edges[df_edges['source_id'].isin(valid_uids) & df_edges['target_id'].isin(valid_uids)]
# 严格按时间先后排序，确保因果性
df_edges = df_edges.sort_values(by='timestamp').reset_index(drop=True)

# 将时间戳转换为秒
timestamps = pd.to_datetime(df_edges['timestamp']).astype('int64') // 10**9
t_max, t_min = timestamps.max(), timestamps.min()

# 标准化时间到[0, 1] 之间（0是最早，1是最新）
norm_t = (timestamps - t_min) / (t_max - t_min + 1e-8)

# 核心学术公式：指数衰减 (Exponential Decay)
# lambda_decay 控制遗忘速度，0.5 意味着早期的边权重会平滑降到 0.6 左右
lambda_decay = 0.5 
edge_weight = np.exp(-lambda_decay * (1.0 - norm_t))

src = (df_edges['source_id'] - 1).tolist()
dst = (df_edges['target_id'] - 1).tolist()
edge_index = torch.tensor([src, dst], dtype=torch.long)
edge_weight = torch.tensor(edge_weight.values, dtype=torch.float)

# 4. 保存
data = Data(x=x, edge_index=edge_index, edge_weight=edge_weight)
torch.save(data, 'campus_graph_full.pt')
print(f" 数据重构完毕！包含 {data.num_nodes} 节点, {data.num_edges} 条动态边。")