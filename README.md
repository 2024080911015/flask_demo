# 学生交友推荐系统

基于 Flask + PyTorch 的学生交友推荐系统，使用向量相似度算法为用户推荐好友。

## 功能特性

- **好友推荐** - 根据用户ID推荐相似度最高的好友
- **用户查询** - 查看所有用户信息或单个用户详情
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
  "student_info": "年级:大二,专业:英语,爱好:足球 机械,标签:宅属性",
  "recommend_friends": [
    "年级:大一,专业:通信,爱好:骑行 动漫 绘画 足球,标签:宅属性",
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

## 项目结构

```
flask_demo/
├── app.py                 # Flask 应用主入口
├── step3_recommend.py     # 推荐算法核心
├── users.csv              # 用户数据
├── user_embeddings.pt     # 用户向量嵌入
└── requirements.txt       # 依赖包
```

## 数据说明

- [users.csv](users.csv) - 包含学生的年级、专业、爱好、标签等信息
- [user_embeddings.pt](user_embeddings.pt) - PyTorch 格式的预训练用户向量

## 算法原理

使用余弦相似度计算用户之间的相似性，推荐与目标用户最相似的Top 5用户。
