# 学生交友推荐系统

基于 Flask + PyTorch 的学生交友推荐系统，结合向量相似度算法和社交网络分析为用户推荐好友。

## 功能特性

- **智能推荐** - 根据用户ID推荐相似度最高的好友，支持社交网络优化模式和纯相似度模式
- **社区推荐** - 支持考研圈、技术圈、运动圈、二次元、文艺圈等5大社区分类推荐
- **用户查询** - 查看所有用户信息或单个用户详情
- **关注关系查询** - 查看用户的关注列表和粉丝列表
- **社交网络分析** - 提供社交网络的统计信息（总用户数、关注数、平均关注数等）
- **社交诊断报告** - 为用户提供AI生成的社交诊断报告和行动建议
- **社区分类** - 提供5个预设社区的分类服务
- **RESTful API** - 简单易用的HTTP接口

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行服务

```bash
python app.py
```

服务将在 `http://0.0.0.0:5000` 启动（可以从其他机器访问）。

## 测试方法

### 方法一：浏览器直接访问

直接在浏览器中输入以下URL测试：

```
http://127.0.0.1:5000/community
http://127.0.0.1:5000/tuijian?id=1
http://127.0.0.1:5000/tuijian?id=1&community=技术圈
http://127.0.0.1:5000/user?id=1
http://127.0.0.1:5000/following?id=1
http://127.0.0.1:5000/followers?id=1
http://127.0.0.1:5000/social/stats
http://127.0.0.1:5000/social/report?id=1
```

### 方法二：使用 curl 命令

```bash
curl http://127.0.0.1:5000/community
curl http://127.0.0.1:5000/tuijian?id=1
curl "http://127.0.0.1:5000/tuijian?id=1&community=技术圈"
curl http://127.0.0.1:5000/social/report?id=1
```

### 方法三：使用 Python requests

```python
import requests

# 测试推荐接口
r = requests.get('http://127.0.0.1:5000/tuijian?id=1&community=技术圈')
print(r.json())

# 测试社交诊断报告
r = requests.get('http://127.0.0.1:5000/social/report?id=1')
print(r.json())
```

## API 接口

### 1. 社区列表

**接口:** `GET /community`

**返回:**
```json
{
  "status": "success",
  "communities": ["考研圈", "技术圈", "运动圈", "二次元", "文艺圈"]
}
```

### 2. 好友推荐

**接口:** `GET /tuijian?id={用户ID}[&mode={模式}][&community={社区}]`

**参数:**
- `id` (必填) - 用户ID
- `mode` (可选) - 推荐模式：`social` (社交优化, 默认) 或 `gnn` (纯相似度)
- `community` (可选) - 社区名称：`考研圈`、`技术圈`、`运动圈`、`二次元`、`文艺圈`

**示例:**
```
GET /tuijian?id=1
GET /tuijian?id=1&mode=social
GET /tuijian?id=1&community=技术圈
GET /tuijian?id=1&mode=gnn&community=技术圈
```

**返回:**
```json
{
  "student_id": 1,
  "mode": "social",
  "student_info": "性别:女,年级:研二,专业:通信,爱好:种植 羽毛球 舞蹈 天文 围棋,标签:社交普通型 高冷 作息规律",
  "recommend_friends": [
    "性别:女,年级:大一,专业:会计,爱好:音乐 动漫 羽毛球,标签:技术大牛 社恐星人 可爱 作息规律 镇圈大佬",
    ...
  ],
  "count": 5
}
```

### 3. 获取所有用户

**接口:** `GET /users`

**返回:** 所有用户的列表

### 4. 获取单个用户

**接口:** `GET /user?id={用户ID}`

**示例:**
```
GET /user?id=1
```

### 5. 获取关注列表

**接口:** `GET /following?id={用户ID}`

**示例:**
```
GET /following?id=1
```

**返回:**
```json
{
  "student_id": 1,
  "student_info": "性别:女,年级:研二,专业:通信,爱好:种植 羽毛球 舞蹈 天文 围棋,标签:社交普通型 高冷 作息规律",
  "count": 31,
  "following": [
    "性别:女,年级:大一,专业:会计,爱好:音乐 动漫 羽毛球,标签:技术大牛 社恐星人 可爱 作息规律 镇圈大佬",
    ...
  ]
}
```

### 6. 获取粉丝列表

**接口:** `GET /followers?id={用户ID}`

**示例:**
```
GET /followers?id=1
```

**返回:**
```json
{
  "student_id": 1,
  "followers_count": 5,
  "followers": [
    "性别:男,年级:大三,专业:会计,爱好:围棋 骑行 足球 音乐,标签:可爱",
    ...
  ]
}
```

### 7. 社交网络统计

**接口:** `GET /social/stats`

**返回:**
```json
{
  "total_users": 1000,
  "total_follows": 31415,
  "average_follows": 31.42,
  "max_follows": 98,
  "most_popular_users": [
    "性别:女,年级:大一,专业:计算机,爱好:音乐 羽毛球 舞蹈 足球 骑行,标签:宅属性 高冷 运动达人 镇圈大佬 吃货",
    ...
  ]
}
```

### 8. 社交诊断报告

**接口:** `GET /social/report?id={用户ID}`

**示例:**
```
GET /social/report?id=1
```

**返回:**
```json
{
  "student_id": 1,
  "status": {
    "title": "核心枢纽",
    "description": "你是名副其实的社交达人，网络连通性极强，是信息传播的重要枢纽。",
    "total_connections": 35
  },
  "distribution": [
    {"name": "技术圈", "percent": 40, "count": 14},
    {"name": "运动圈", "percent": 30, "count": 10},
    {"name": "文艺圈", "percent": 20, "count": 7},
    {"name": "考研圈", "percent": 10, "count": 4}
  ],
  "advice": "系统建议：你在【技术圈】有很好的人脉基础。保持优势的同时，可以主动去探索你不熟悉的领域，让校园生活更多元。"
}
```

## 项目结构

```
flask_demo/
├── app.py                 # Flask 应用主入口
├── step3_recommend.py     # 推荐算法核心
├── users.csv              # 用户数据
├── user_embeddings.pt     # 用户向量嵌入
├── edges.csv              # 关注关系数据
├── edges_ID.csv           # 关注关系时序记录
├── edges_time.csv         # 关注关系带时间戳
├── docs/                  # 文档目录
├── templates/             # 前端模板目录
│   └── index.html         # 主页面
└── requirements.txt       # 依赖包
```

## 数据说明

- [users.csv](users.csv) - 包含学生的年级、专业、爱好、标签等信息
- [user_embeddings.pt](user_embeddings.pt) - PyTorch 格式的预训练用户向量
- [edges.csv](edges.csv) - 用户关注关系（邻接表格式）
- [edges_ID.csv](edges_ID.csv) - 关注关系的时序记录
- [edges_time.csv](edges_time.csv) - 关注关系带时间戳

## 算法原理

### 推荐算法

推荐算法结合了**向量相似度**和**社交网络分析**，支持多种模式：

1. **向量相似度**：使用余弦相似度计算用户之间的相似性
2. **社交网络优化模式（默认）**：
   - 从相似度高的候选用户中筛选
   - 优先推荐与目标用户有共同关注的用户
   - 不推荐已关注的用户
3. **纯相似度模式**：直接返回相似度最高的用户
4. **社区筛选**：可指定社区（考研圈、技术圈、运动圈、二次元、文艺圈）进行精准推荐

### 社区分类

系统内置了5个社区分类，通过关键词匹配识别用户所属的社区：

- **考研圈**：考研、保研、复习、图书馆、英语六级、自习
- **技术圈**：编程、代码、算法、开发、极客、C++、Python、Java
- **运动圈**：篮球、足球、羽毛球、跑步、健身、体育、游泳
- **二次元**：动漫、二次元、游戏、原神、漫画、Cosplay、ACG
- **文艺圈**：音乐、吉他、摄影、画画、电影、阅读、钢琴

### 社交诊断报告

通过分析用户的社交网络，提供以下诊断：

1. **网络地位**：根据连接数判断用户在网络中的位置
   - 潜水节点（0连接）
   - 萌新节点（<3连接）
   - 活跃节点（<10连接）
   - 核心枢纽（>=10连接）
2. **圈层分布**：统计好友在各社区的占比
3. **AI行动建议**：根据用户的社交网络特点给出专属建议
