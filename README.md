# 学生交友推荐系统

基于 Flask + PyTorch 的学生交友推荐系统，结合向量相似度算法和社交网络分析为用户推荐好友。

## 功能特性

- **用户认证** - 完整的注册、登录、登出功能，支持 Session 会话管理
- **智能推荐** - 根据用户ID推荐相似度最高的好友，支持社交网络优化模式和纯相似度模式
- **社区推荐** - 支持7大社区分类推荐（运动健将圈、文艺星人圈、硬核极客圈、二次元宅圈、社牛风云圈、佛系养生圈、爆肝修仙圈）
- **用户查询** - 查看所有用户信息或单个用户详情
- **关注关系查询** - 查看用户的关注列表和粉丝列表
- **社交网络分析** - 提供社交网络的统计信息（总用户数、关注数、平均关注数等）
- **社交诊断报告** - 为用户提供AI生成的社交诊断报告和行动建议
- **时序图神经网络** - 基于时间衰减机制的 GNN 训练，支持动态预测未来社交关系
- **数据库支持** - SQLite 数据库存储用户信息和社交关系
- **RESTful API** - 简单易用的HTTP接口

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库（首次运行）

```bash
python trans.py
```

这会将 CSV 数据迁移到数据库，并创建 1000 个测试账号：
- uid: 1-1000
- username: test1-test1000
- password: 114514

### 3. 运行 GNN 模型训练（可选）

```bash
# 训练模型（包含数据预处理和 GCN 训练）
python t_plus_1_scheduler.py
```

或单独运行：
```bash
python step1_full_process.py  # 数据预处理
python step2_train_full.py    # GCN 训练
```

### 4. 运行服务

```bash
python app.py
```

服务将在 `http://0.0.0.0:5001` 启动（可以从其他机器访问）。

## 测试方法

### 方法一：浏览器直接访问

直接在浏览器中输入以下URL测试：

```
http://127.0.0.1:5001/community
http://127.0.0.1:5001/tuijian?id=1
http://127.0.0.1:5001/tuijian?id=1&community=硬核极客圈
http://127.0.0.1:5001/user?id=1
http://127.0.0.1:5001/following?id=1
http://127.0.0.1:5001/followers?id=1
http://127.0.0.1:5001/social/stats
http://127.0.0.1:5001/social/report?id=1
```

### 方法二：使用 curl 命令

**注册：**
```bash
curl -X POST http://127.0.0.1:5001/api/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"testuser\",\"password\":\"123456\",\"info\":\"性别:男,年级:大二,专业:计算机,爱好:编程,标签:萌新\"}"
```

**登录：**
```bash
curl -X POST http://127.0.0.1:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{\"username\":\"test1\",\"password\":\"114514\"}"
```

**推荐接口：**
```bash
curl http://127.0.0.1:5001/tuijian?id=1
curl "http://127.0.0.1:5001/tuijian?id=1&community=硬核极客圈"
curl http://127.0.0.1:5001/social/report?id=1
```

### 方法三：使用测试脚本

```bash
python test_auth.py
```

这会自动测试注册、登录、检查登录状态、登出等完整流程。

## API 接口

### 用户认证

#### 注册

**接口:** `POST /api/register`

**请求体 (方式一 - 传完整 info):**
```json
{
  "username": "testuser",
  "password": "123456",
  "info": "性别:男,年级:大二,专业:计算机,爱好:编程,标签:萌新"
}
```

**请求体 (方式二 - 分别传字段):**
```json
{
  "username": "testuser",
  "password": "123456",
  "gender": "男",
  "grade": "大二",
  "major": "计算机",
  "hobbies": "编程 游戏",
  "tags": "萌新"
}
```

**返回:**
```json
{
  "status": "success",
  "message": "注册成功",
  "data": {
    "uid": 1001,
    "username": "testuser",
    "info": "性别:男,年级:大二,专业:计算机,爱好:编程,标签:萌新"
  }
}
```

#### 登录

**接口:** `POST /api/auth/login`

**请求体:**
```json
{
  "username": "test1",
  "password": "114514"
}
```

**返回:**
```json
{
  "status": "success",
  "message": "登录成功",
  "data": {
    "uid": 1,
    "username": "test1"
  }
}
```

#### 登出

**接口:** `POST /api/auth/logout`

**返回:**
```json
{
  "status": "success",
  "message": "已退出登录"
}
```

#### 获取当前登录状态

**接口:** `GET /api/auth/me`

**返回:**
```json
{
  "status": "success",
  "logged_in": true,
  "data": {
    "uid": 1,
    "username": "test1"
  }
}
```

### 推荐接口

#### 1. 社区列表

**接口:** `GET /community`

**返回:**
```json
{
  "status": "success",
  "communities": ["运动健将圈", "文艺星人圈", "硬核极客圈", "二次元宅圈", "社牛风云圈", "佛系养生圈", "爆肝修仙圈"]
}
```

### 2. 好友推荐

**接口:** `GET /tuijian?id={用户ID}[&mode={模式}][&community={社区}]`

**参数:**
- `id` (必填) - 用户ID
- `mode` (可选) - 推荐模式：`social` (社交优化, 默认) 或 `gnn` (纯相似度)
- `community` (可选) - 社区名称：`运动健将圈`、`文艺星人圈`、`硬核极客圈`、`二次元宅圈`、`社牛风云圈`、`佛系养生圈`、`爆肝修仙圈`

**示例:**
```
GET /tuijian?id=1
GET /tuijian?id=1&mode=social
GET /tuijian?id=1&community=硬核极客圈
GET /tuijian?id=1&mode=gnn&community=二次元宅圈
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
    "title": "活跃节点",
    "description": "你的社交范围适中，在特定圈子内保持着良好连接。",
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
├── app.py                 # Flask 应用主入口（包含用户认证接口）
├── step1_full_process.py # 数据预处理：特征编码 + 时间衰减
├── step2_train_full.py   # GCN 模型训练
├── step3_recommend.py     # 推荐算法核心
├── step4_temporal_eval.py # 时序预测评估
├── t_plus_1_scheduler.py # 训练调度器（自动运行 step1 + step2）
├── trans.py              # 数据迁移脚本：CSV → 数据库
├── test_auth.py          # 认证接口测试脚本
├── campus_social.db       # SQLite 数据库（用户、社交关系、账号）
├── users.csv            # 用户数据（原始数据）
├── user_embeddings.pt    # 用户向量嵌入
├── edges.csv            # 关注关系数据
├── edges_time.csv       # 关注关系带时间戳
├── campus_graph_full.pt  # 预处理后的图数据
├── docs/               # 文档目录
├── templates/           # 前端模板目录
│   └── index.html      # 主页面
└── requirements.txt     # 依赖包
```

## 数据说明

### CSV 文件（原始数据）
- [users.csv](users.csv) - 包含学生的年级、专业、爱好、标签等信息
- [user_embeddings.pt](user_embeddings.pt) - PyTorch 格式的预训练用户向量
- [edges.csv](edges.csv) - 用户关注关系（邻接表格式）
- [edges_ID.csv](edges_ID.csv) - 关注关系的时序记录
- [edges_time.csv](edges_time.csv) - 关注关系带时间戳

### 数据库表（已迁移）
- **accounts** - 用户账号表（uid, username, password_hash）
- **users** - 用户信息表（uid, info）
- **edges** - 社交关系表（source, target）
- **edges_time** - 带时间戳的社交关系表（timestamp, source_id, target_id）

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

系统内置了7个社区分类，通过关键词匹配识别用户所属的社区：

- **运动健将圈**：足球、羽毛球、跑步、骑行、运动达人、体育
- **文艺星人圈**：音乐、舞蹈、绘画、剪纸、缝纫、温和、可爱、美术、英语
- **硬核极客圈**：编程、机械、技术大牛、计算机、电气、通信、土木
- **二次元宅圈**：动漫、宅属性、社恐星人
- **社牛风云圈**：社交牛逼症、镇圈大佬、段子手、新闻、法学
- **佛系养生圈**：种植、围棋、天文、作息规律、吃货、社交普通型
- **爆肝修仙圈**：熬夜的神、高冷、生物、会计

### 社交诊断报告

通过分析用户的社交网络，提供以下诊断：

1. **网络地位**：根据连接数判断用户在网络中的位置
   - 潜水节点（0连接）
   - 萌新节点（≤20连接）
   - 活跃节点（≤35连接）
   - 核心节点（≤45连接）
   - 超级枢纽（>45连接）
2. **圈层分布**：统计好友在各社区的占比
3. **AI行动建议**：根据用户的社交网络特点给出专属建议
