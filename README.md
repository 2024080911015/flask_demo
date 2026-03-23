# 学生交友推荐系统

基于 Flask + PyTorch 的学生交友推荐系统，结合向量相似度算法和社交网络分析为用户推荐好友。

## 功能特性

- **好友推荐** - 根据用户ID推荐相似度最高的好友，优先推荐有共同关注的用户
- **用户查询** - 查看所有用户信息或单个用户详情
- **关注关系查询** - 查看用户的关注列表和粉丝列表
- **社交网络分析** - 提供社交网络的统计信息（总用户数、关注数、平均关注数等）
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

服务将在 `http://127.0.0.1:5000` 启动。

## API 接口

### 1. 好友推荐

**接口:** `GET /tuijian?id={用户ID}`

**示例:**
```
GET /tuijian?id=1
```

**返回:**
```json
{
  "student_id": 1,
  "student_info": "性别:女,年级:研二,专业:通信,爱好:种植 羽毛球 舞蹈 天文 围棋,标签:社交普通型 高冷 作息规律",
  "recommend_friends": [
    "性别:女,年级:大一,专业:会计,爱好:音乐 动漫 羽毛球,标签:技术大牛 社恐星人 可爱 作息规律 镇圈大佬",
    ...
  ],
  "count": 5
}
```

### 2. 获取所有用户

**接口:** `GET /users`

**返回:** 所有用户的列表

### 3. 获取单个用户

**接口:** `GET /user?id={用户ID}`

**示例:**
```
GET /user?id=1
```

### 4. 获取关注列表

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

### 5. 获取粉丝列表

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

### 6. 社交网络统计

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
└── requirements.txt       # 依赖包
```

## 数据说明

- [users.csv](users.csv) - 包含学生的年级、专业、爱好、标签等信息
- [user_embeddings.pt](user_embeddings.pt) - PyTorch 格式的预训练用户向量
- [edges.csv](edges.csv) - 用户关注关系（邻接表格式）
- [edges_ID.csv](edges_ID.csv) - 关注关系的时序记录
- [edges_time.csv](edges_time.csv) - 关注关系带时间戳

## 算法原理

推荐算法结合了**向量相似度**和**社交网络分析**：

1. **向量相似度**：使用余弦相似度计算用户之间的相似性
2. **社交网络优化**：优先推荐与目标用户有共同关注的用户
3. **推荐策略**：
   - 从相似度高的候选用户中筛选
   - 有共同关注的用户优先推荐
   - 不推荐已关注的用户
4. **返回结果**：推荐与目标用户最相似的Top 5用户
