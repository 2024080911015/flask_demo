# 🌟 校园社交平台 — 学生交友推荐系统

基于 **Flask + PyTorch (GNN)** 的全功能校园社交平台，融合了 AI 智能推荐、3D 社交图谱、组队大厅、私聊、竞赛经历管理等模块。

> 服务端口: `5002` | 数据库: SQLite | 前端: 原生 JS + Tailwind CSS

---

## 📋 功能总览

| 模块 | 功能 | 说明 |
|------|------|------|
| 🤖 AI 推荐 | 智能好友推荐 | GNN 向量推荐 + 社交优化 + 社区筛选 |
| 🌌 社交星系 | 3D 力导向图谱 | 个人星系、全校星系、实时红点脉冲 |
| 🤝 关系管理 | 关注/粉丝/分组 | 关注取关、好友分组管理、批量分配 |
| 🚩 组队大厅 | 竞赛/科研组队 | 发布招募、GNN匹配排序、岗位管理、审核 |
| 📨 组队邀请 | 队长邀请制 | 邀请加入、接受/拒绝、自动清理冲突 |
| 💬 私聊 | 即时消息 | 会话列表、未读计数、聊天记录 |
| 🧠 AI 助手 | 社交顾问 | DeepSeek 大模型驱动的社交建议 |
| 👤 个人空间 | 资料管理 | 头像上传、签名、状态、竞赛经历、技能标签 |
| 📊 全校生态 | 数据大盘 | 全局统计指标、风云人物 Top10 |
| 🔍 找朋友 | 用户搜索 | 按用户名/ID 模糊检索 |
| 📋 画像问卷 | 注册问卷 | 社交画像打分、衍生标签、向量化 |

---

## 🚀 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库（首次运行）

```bash
python trans.py
```

这会迁移 CSV 数据到 SQLite，并创建 1000 个测试账号：
- uid: 1 ~ 1000
- 用户名: test1 ~ test1000
- 密码: `114514`

### 3. 训练 GNN 模型（可选，推荐运行以获得更好的推荐效果）

```bash
python t_plus_1_scheduler.py
```

或分步运行：
```bash
python step1_full_process.py    # 数据预处理
python step2_train_full.py      # GCN 模型训练
```

### 4. 启动服务

```bash
python app.py
```

访问 **http://localhost:5002** 即可使用。

---

## 🎮 功能用法详解

---

### 1. 🤖 AI 智能推荐交友

**位置：** 登录后 → 左侧导航栏「✨ 推荐交友」

这是系统的首页，基于 GNN 模型为用户推荐志同道合的朋友。

**用法：**
1. 顶部信息卡片显示当前账号的基本信息
2. 左侧「推荐引擎配置」面板：
   - **推荐模式**：`社交优化`（默认，优先推荐有共同好友的人） / `纯相似度`（直接按兴趣相似度）
   - **社区筛选**：下拉选择指定社区（如"硬核极客圈"），仅推荐该社区的人
   - 点击「应用配置并重新计算」刷新推荐结果
3. 右侧「AI 为您精选的相似灵魂」展示推荐结果卡片
4. 每个卡片上可操作：
   - **关注/取消关注**：一键关注
   - **点击姓名**：打开个人详情弹窗
   - **推荐来源**：显示"直接人脉"或"经 XX 引荐"
5. 左侧「社交雷达诊断」面板：
   - 显示社交网络地位（如"活跃节点"、"核心节点"）
   - 圈层分布雷达图（使用 Chart.js）
   - AI 专属社交建议

**API 调用：**
```
GET /tuijian?id=1&mode=social&community=硬核极客圈
GET /social/report?id=1          # 社交诊断报告
```

---

### 2. 🌌 社交星系图谱（3D 可视化）

**位置：** 左侧导航栏「🌌 我的社交星系」

基于 3D-force-graph 构建的力导向社交关系图，展示用户之间的关注关系网络。

**用法：**
1. 进入页面后，自动加载该用户的**个人社交星系图**（以当前用户为中心，展示其关注的人、粉丝、以及推荐的好友）
2. 节点操作：
   - **点击节点**：弹出右侧抽屉栏（Social Drawer），显示该用户详情和正在参与的组队项目
   - **红点脉冲**：好友发布了新活动但你还未查看时，节点上会显示红色脉冲光晕
   - **头像显示**：已上传头像的用户会实时显示头像
3. 图谱功能按钮：
   - **🔄 重新渲染**：刷新图谱数据
4. 个人名片 → 「进入星系全景模式」按钮也可进入此页面

**全校星系图：**
- 在「全校生态大盘」页面点击「🌌 查看全校 3D 星系图」
- 展示全校所有用户的完整社交网络

**相关 API：**
```
GET /api/graph/dynamic_data       # 动态合并图谱数据（含头像、签名、红点）
GET /api/users/avatars            # 实时头像映射表
GET /api/social/pulse             # 好友红点脉冲状态
POST /api/social/mark_read        # 标记已读（消灭红点）
```

---

### 3. 🤝 关系管理

**位置：** 左侧导航栏「🤝 关系管理」

管理关注关系和好友分组。

**用法：**
1. **我的关注** — 展示所有已关注的用户列表，按分组折叠展示
   - 每个用户卡片显示头像、用户名、信息标签
   - 鼠标悬停可点击「取消关注」
   - 可拖拽或通过「分配成员」按钮将好友分组
2. **我的粉丝** — 展示关注了你的人，可点击「回关」
3. **好友分组管理**：
   - 顶部输入框输入分组名称，点击「+ 新建分组」创建
   - 分组可重命名、删除
   - 点击「分配成员」打开批量管理弹窗，可搜索并勾选好友加入分组

**相关 API：**
```
POST /api/social/toggle_follow     # 关注/取关
GET  /api/groups                   # 获取分组列表
POST /api/groups/create            # 创建分组
POST /api/groups/assign            # 分配好友到分组
POST /api/groups/rename            # 重命名分组
POST /api/groups/delete            # 删除分组
```

---

### 4. 🚩 组队大厅

**位置：** 左侧导航栏「🚩 组队大厅」

竞赛和科研项目的组队平台，支持岗位职能匹配、GNN 排序推荐。

#### 4a. 发现项目（🏠 发现项目标签页）

- 展示所有正在招募的项目卡片，默认按 GNN 匹配度从高到低排序
- **过滤条件**：
  - 🔍 搜索框：按比赛名称、队长、队伍名、岗位技能搜索
  - 🏆 组队模式：竞赛组队 / 科研项目组队
  - 📚 学科门类：12 大学科门类 + 全学科通用顶级赛事
  - 🎯 具体赛事：选择学科门类后，筛选具体比赛
  - 点击「筛选」按钮应用条件
- 卡片显示信息：比赛名称、队伍名、队长名、招募人数、截止日期、匹配度评分、人脉关系
- 点击卡片查看详情弹窗：
  - 项目描述、当前阵容、岗位列表
  - 队长可看到「待审核申请」列表
  - 普通用户可填写申请留言并提交申请
  - **同比赛互斥**：已加入某比赛后，无法再申请同一比赛的其他队伍

#### 4b. 发起招募（🚀 发起招募标签页）

创建新组队项目：

1. 填写**队伍名称**（选填，不填则直接展示比赛名）
2. 选择**组队模式**：竞赛组队 / 科研项目组队
3. 选择**所属学科门类**（12 大门类 + 全学科通用）
4. 选择**具体竞赛/科研赛事**（二级联动数据字典）
5. 填写**队伍介绍**
6. 设置**招募岗位**：
   - 指定需要招募的人数（1-20人）
   - 每个岗位填写：岗位名称、所需技能标签、需求人数
7. 选择**招募截止日期**
8. 点击「立即启动招募」

*发起人自己默认成为队伍成员（is_initiator=true）。*

#### 4c. 我的管理（📋 我的管理标签页）

- **置顶：收到的组队邀请**（见下方第5节）
- **我发起的项目**：展示所有创建的项目
  - 查看待审核的申请者列表（显示申请留言和申请岗位）
  - **通过/拒绝**申请者
  - 手动调整分配岗位（如岗位被占用可更换）
  - 撤回项目（删除）
- **我参与的项目**：展示已成功加入的队伍
  - 可点击「退出队伍」

**相关 API：**
```
GET    /api/activity/list            # 获取活动列表（支持关键词/性质/分类筛选）
POST   /api/activity/create          # 创建活动
POST   /api/activity/join            # 申请加入
GET    /api/activity/my              # 我发起的/我参与的
POST   /api/activity/audit           # 审核申请（通过/拒绝）
POST   /api/activity/delete          # 撤回项目
POST   /api/activity/quit            # 退出队伍
```

---

### 5. 📨 组队邀请（队长邀请制）

作为组队功能的补充，允许队长主动邀请用户加入队伍。

**用法：**

**队长发送邀请：**
1. 在首页/搜索等位置找到目标用户
2. 点击打开该用户的**个人详情弹窗**
3. 如果当前登录用户有已发布的活动，会显示「📨 邀请组队」按钮
4. 点击后弹出邀请弹窗，选择：
   - 要邀请加入的活动
   - 具体岗位
   - 邀请留言（选填）
5. 发送邀请
6. 被邀请人会收到站内通知消息

**被邀请人处理：**
1. 进入「组队大厅 → 我的管理」
2. 顶部「📨 收到的组队邀请」区域会列出所有待处理的邀请
3. 每个邀请卡片显示：邀请人、比赛名称、队伍名、岗位、留言
4. 点击「接受」或「拒绝」
   - **接受**：自动加入队伍，清理同比赛其他队伍的待处理记录
   - **拒绝**：邀请状态变为已拒绝

**互斥规则：**
- 被邀请人已加入同一比赛的其他队伍 → 邀请失败
- 接受时目标岗位已被占用 → 自动分配到最近的空位
- 队伍已满 → 无法加入

**相关 API：**
```
POST   /api/activity/invite              # 发送邀请
GET    /api/activity/my_invitations      # 查看收到的邀请
POST   /api/activity/invitation/respond  # 接受/拒绝邀请
```

---

### 6. 💬 私聊系统

**位置：** 左侧导航栏「💬 私聊」

支持无限次私聊的即时消息系统。

**用法：**
1. **会话列表**：显示所有私聊过的用户，按最后消息时间倒序
   - 显示对方头像、用户名、最后一条消息摘要、时间
   - **未读消息数**：红色角标显示
2. **进入聊天**：点击任一会话进入聊天窗口
   - 消息按时间顺序排列，自己的消息居右（蓝色）、对方消息居左（灰色）
   - 时间戳显示
   - 打开会话时会自动将未读消息标记为已读
3. **发送消息**：
   - 在底部输入框输入内容（Enter 发送）
   - 最长 500 字
   - 不能给自己发消息
4. **返回**：点击「返回」回到会话列表

**相关 API：**
```
POST /api/message/send              # 发送消息
GET  /api/message/inbox             # 获取会话列表
GET  /api/message/conversation?with=用户ID  # 获取聊天记录
```

---

### 7. 🧠 AI 社交助手（Claw）

**位置：** 右下角 ✨ 浮动按钮

基于 DeepSeek 大语言模型的 AI 社交顾问，提供社交建议和破冰策略。

**用法：**
1. 点击右下角 ✨ 按钮打开聊天浮窗
2. 系统提示当前用户的个人信息（关注数、粉丝数、标签）
3. 输入问题，例如：
   - "怎么和二次元圈的同学搭讪？"
   - "分析一下我的交友圈子"
   - "帮我给新认识的朋友写一段自我介绍"
4. AI 会根据当前用户的社交画像给出个性化建议
5. 支持聊天历史记录（保留最近 50 条）
6. 点击「清空」可清除聊天历史

**配置：**
- 在 `agent_api.py` 中设置 `DEEPSEEK_API_KEY`
- 默认模型: `deepseek-chat`

**相关 API：**
```
POST /api/agent/chat       # AI 对话
GET  /api/agent/history    # 获取聊天历史
DELETE /api/agent/history  # 清空历史
```

---

### 8. 👤 个人空间

**位置：** 左侧导航栏「👤 个人空间」

管理个人资料、头像、技能标签和竞赛经历。

#### 8a. 查看个人资料（展示视图）

默认进入展示模式，显示：
- 头像（圆形，可上传自定义图片）
- 用户名、校园 ID、个性签名、状态（如"找朋友"、"学习中"）
- 基础信息（性别、年级、专业）
- 爱好标签、个性标签
- **🛠 技能标签**（蓝色徽章样式，如 `🛠 Python`）
- **🏆 竞赛经历**（手动添加 + 正在参与的组队项目）

#### 8b. 编辑资料（编辑视图）

点击「修改个人资料」进入编辑模式：

- **用户名**：可修改（需唯一）
- **个性签名**：最多 30 字
- **状态**：下拉选择
- **性别/年级/专业**：下拉选择
- **爱好**：多选（15 种爱好）
- **标签**：多选（15 种个性标签）
- **🛠 技能标签**：多选（24 种技能，见下方列表）
- 点击「保存资料」提交

#### 8c. 头像上传

点击头像区域 → 选择图片文件：
- 支持格式：PNG、JPEG、GIF、WebP
- 最大 5MB
- 上传后自动替换旧头像文件

#### 8d. 竞赛经历管理

在编辑视图的「📋 竞赛经历」部分：
- **添加**：填写竞赛名称、年份、角色（队员/队长/核心成员/独立参赛）、描述
- **删除**：在展示视图的竞赛卡片上悬停出现「删除」按钮
- 竞赛经历同时包含**手动添加的经历**和**正在参与的组队项目**

#### 8e. 可用技能标签列表（24 种）

| 类别 | 技能 |
|------|------|
| 编程语言 | Python, Java, C++, JavaScript, TypeScript, Go, Rust |
| AI/数据 | 机器学习, 深度学习, NLP, 计算机视觉, 数据分析, 算法竞赛, 数学建模 |
| 开发方向 | 前端开发, 后端开发, 全栈开发, 移动开发 |
| 其他 | UI设计, 产品策划, 项目管理, 嵌入式开发, 网络安全, 单片机, 电路设计 |

**相关 API：**
```
GET    /api/user/profile           # 获取个人资料
POST   /api/user/update            # 更新个人资料
POST   /api/user/upload_avatar     # 上传头像
GET    /api/user/avatar/<uid>      # 获取头像
GET    /api/user/competitions?uid=  # 获取竞赛经历
POST   /api/user/competitions      # 添加竞赛经历
DELETE /api/user/competitions/<id>  # 删除竞赛经历
```

---

### 9. 📋 画像问卷（注册与重做）

**注册时：** 填写 7 个维度的问题，生成社交画像分和衍生标签。

**问卷维度：**

| 问题 | 选项 |
|------|------|
| 怎样认识新朋友？ | 一对一慢热 / 小群体活动 / 公开活动型 |
| 组队承担什么角色？ | 组织推进 / 专业攻坚 / 稳定补位 |
| 最想匹配哪类同伴？ | 竞赛科研 / 课程互助 / 生活兴趣 |
| 作息规律？ | 早睡早起 / 规律在线 / 夜间活跃 |
| 冲突处理方式？ | 直接沟通 / 协调折中 / 低冲突慢调 |
| 如何与内向者接触？ | 文字破冰 / 任务破冰 / 熟人介绍 |
| 活动偏好？ | 运动户外 / 技术共创 / 文艺兴趣 |

**画像分数维度：** 社交力、协作力、学习力、开放度、沟通力、作息的 6 维评分。

**衍生标签（自动计算）：**
- 社交：社交牛逼症 / 社恐星人 / 社交普通型
- 协作 ≥75：温和
- 学习 ≥75：技术大牛
- 作息 ≥80：早睡早起 / ≤45：熬夜的神
- 开放度 ≥75：镇圈大佬

**用法：**
1. 注册时自动填写（可选）
2. 在个人空间点击「重做画像问卷」可重新填写，更新画像分和标签

**相关 API：**
```
POST /api/register               # 注册（含问卷）
POST /api/questionnaire/update   # 更新画像问卷
```

---

### 10. 📊 全校生态大盘

**位置：** 左侧导航栏「📊 全校生态大盘」

显示全校社交网络的统计数据。

**用法：**
1. 顶部显示五个核心指标卡片：
   - 👥 全校总用户数
   - 🔗 社交关系总数
   - 📊 人均关注数
   - ⭐ 最大粉丝数
   - 📈 数据更新时间
2. **🔥 校园风云人物 Top 10**：按粉丝数排行，展示用户名、ID、粉丝数和信息标签
3. 点击「🌌 查看全校 3D 星系图」查看完整社交网络可视化

**相关 API：**
```
GET /social/stats      # 全局社交统计
```

---

### 11. 🔍 找朋友

**位置：** 左侧导航栏「🔍 找朋友」

全校用户搜索功能。

**用法：**
1. 输入框中输入**用户名**或**学号 ID**（支持模糊搜索）
2. 点击「全校检索」
3. 搜索结果以卡片网格展示
4. 每个卡片可：
   - 点击查看个人详情弹窗
   - 点击关注按钮
   - 查看用户个人信息标签

**相关 API：**
```
GET /api/search_users?q=关键字    # 搜索用户
GET /user?id=用户ID              # 获取用户详情
```

---

### 12. 🔐 用户认证系统

**登录：** 输入用户名和密码
**注册：** 填写用户名、密码、性别、年级、专业、爱好、标签、问卷、技能
**登出：** 点击侧栏底部「退出登录」

**管理员账号：** 用户名为 `manager` 的用户登录后会在顶部显示管理员控制台

**管理员控制台：**
- 点击「🚀 重训 GNN」触发 T+1 离线重训
- 重训后吸收新增的社交关系和新用户数据

**相关 API：**
```
POST /api/auth/login         # 登录
POST /api/auth/logout        # 登出
GET  /api/auth/me            # 获取当前登录状态
POST /api/register           # 注册
POST /api/admin/retrain      # 管理员重训 GNN
```

---

### 13. 🕐 每日定时任务

系统每天凌晨 **03:00** 自动执行 T+1 重训：
- 重新执行数据预处理（step1）
- 重新训练 GCN 模型（step2）
- 更新用户向量嵌入
- 刷新社交推荐数据

---

## 🗂️ 数据库表结构

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `accounts` | 用户账号 | uid, username, password_hash, avatar, signature, status |
| `users` | 用户信息 | uid, info（逗号分隔的键值对字符串） |
| `messages` | 私聊消息 | id, sender_id, receiver_id, content, is_read, created_at |
| `chat_history` | AI 聊天历史 | uid, role, content, created_at |
| `activities` | 组队活动 | id, publisher_uid, title, nature, category, team_slots, deadline |
| `activity_participants` | 活动参与者 | id, activity_id, uid, is_initiator, status, applied_slot_index, invited_by |
| `competition_experiences` | 竞赛经历 | id, uid, competition_name, role, year, description |
| `friend_groups` | 好友分组 | id, uid, name |
| `friend_mappings` | 好友分组映射 | id, uid, target_uid, group_id |
| `user_visit_logs` | 用户访问日志 | id, viewer_uid, target_uid, last_visit_at |
| `edges` | 社交关系 | source, target |
| `edges_time` | 带时间戳的社交关系 | timestamp, source_id, target_id |

---

## 🧠 算法说明

### 推荐算法

系统使用 **两层 GCN（Graph Convolutional Network）** 生成用户嵌入向量：

1. **数据预处理** (`step1_full_process.py`)：特征编码 + 时间衰减
2. **GCN 训练** (`step2_train_full.py`)：两层图卷积，整合用户特征和社交关系
3. **推荐引擎** (`step3_recommend.py`)：
   - 计算余弦相似度
   - 社交优化：优先推荐有共同好友的人
   - 社区筛选：按 7 大社区分类过滤
4. **时序评估** (`step4_temporal_eval.py`)：时间序列预测评估

### 社区分类（7 大兴趣圈）

| 社区 | 关键词 |
|------|--------|
| 🏀 运动健将圈 | 足球、羽毛球、跑步、骑行、运动达人、体育 |
| 🎨 文艺星人圈 | 音乐、舞蹈、绘画、剪纸、缝纫、美术、英语 |
| 💻 硬核极客圈 | 编程、机械、技术大牛、计算机、电气、通信、土木 |
| 🎮 二次元宅圈 | 动漫、宅属性、社恐星人 |
| 🗣️ 社牛风云圈 | 社交牛逼症、镇圈大佬、段子手、新闻、法学 |
| 🧘 佛系养生圈 | 种植、围棋、天文、作息规律、吃货、社交普通型 |
| 🌙 爆肝修仙圈 | 熬夜的神、高冷、生物、会计 |

### 社交诊断等级

| 连接数 | 称号 | 特征 |
|--------|------|------|
| 0 | 潜水节点 | 社交网络空白 |
| ≤20 | 萌新节点 | 社交圈较小 |
| ≤35 | 活跃节点 | 范围适中 |
| ≤45 | 核心节点 | 圈子活跃分子 |
| >45 | 超级枢纽 | 信息传播关键节点 |

---

## 🗂️ 项目结构

```
flask_demo/
├── app.py                    # Flask 主应用（认证、推荐、社交、私聊、管理 API）
├── activity_api.py           # 组队大厅 + 组队邀请 蓝图 API
├── agent_api.py              # AI 社交助手（DeepSeek）蓝图 API
├── models.py                 # 所有数据库模型定义
├── step1_full_process.py     # GCN 数据预处理（特征编码 + 时间衰减）
├── step2_train_full.py       # GCN 模型训练
├── step3_recommend.py        # 推荐算法核心
├── step4_temporal_eval.py    # 时序预测评估
├── t_plus_1_scheduler.py     # 训练调度器
├── trans.py                  # CSV → 数据库迁移脚本
├── fix_db_activity.py        # 活动数据库初始化脚本
├── init_db_pulse.py          # 社交脉冲初始化
├── migrate_db.py             # 数据库迁移
├── update_db.py              # 数据库更新
├── build_visual_graph.py     # 社交图谱构建
├── test_auth.py              # 认证测试脚本
├── requirements.txt          # Python 依赖
│
├── templates/
│   ├── index.html            # 主页面（含图谱弹窗、组队详情弹窗、个人主页弹窗）
│   ├── base.html             # 基础模板
│   ├── dashboard.html        # 控制台容器（侧栏 + 所有面板 + AI 助手浮窗）
│   ├── landing.html          # 登录注册页面
│   ├── auth.html             # 认证表单
│   ├── questionnaire.html    # 调查问卷
│   └── panels/
│       ├── recommend.html    # 🤖 AI 推荐交友面板
│       ├── graph.html        # 🌌 社交星系图谱面板
│       ├── activity.html     # 🚩 组队大厅面板（含邀请管理）
│       ├── relations.html    # 🤝 关系管理面板
│       ├── profile.html      # 👤 个人空间面板
│       ├── search.html       # 🔍 找朋友面板
│       ├── inbox.html        # 💬 私聊面板
│       └── stats.html        # 📊 全校生态大盘面板
│
├── static/
│   ├── graph.json                # GNN 生成的社交图谱 JSON
│   ├── personal_graph.html       # 个人星系图 HTML
│   ├── public_graph.html         # 全校星系图 HTML
│   ├── avatars/                  # 用户头像目录
│   ├── js/
│   │   ├── core.js               # 全局状态管理、工具函数、关注操作
│   │   ├── auth.js               # 认证逻辑、常量定义（OPT_SKILLS等）
│   │   ├── modals.js             # 图谱弹窗、个人主页弹窗、邀请弹窗
│   │   └── panels/
│   │       ├── activity.js       # 组队大厅 + 邀请管理前端逻辑
│   │       ├── profile.js        # 个人空间（资料编辑、竞赛经历、头像上传）
│   │       ├── recommend.js      # AI 推荐前端逻辑
│   │       ├── relations.js      # 关系管理前端逻辑
│   │       ├── inbox.js          # 私聊前端逻辑
│   │       ├── search.js         # 搜索前端逻辑
│   │       └── stats.js          # 全校生态大盘前端逻辑
│
├── docs/
│   ├── 组队大厅功能说明           # 组队大厅功能文档
│   ├── 画像问卷功能修改说明.md    # 问卷功能文档
│   ├── 私聊功能修改说明.md        # 私聊功能文档
│   ├── 使用社交网络数据改进推荐算法.md  # 推荐算法文档
│   └── OpenClaw集成配置指南.md    # AI 助手配置文档
│
└── 3d-force-graph/               # 3D 社交图谱依赖库
    ├── README.md
    └── dist/                     # 构建后的图谱库文件
```

---

## 📡 完整 API 接口索引

### 认证
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 注册（含问卷、技能） |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 当前登录状态 |

### 推荐与社交
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/community` | 社区列表 |
| GET | `/tuijian?id=&mode=&community=` | 好友推荐 |
| GET | `/user?id=` | 用户详情 |
| GET | `/following?id=` | 关注列表 |
| GET | `/followers?id=` | 粉丝列表 |
| GET | `/social/stats` | 全局社交统计 |
| GET | `/social/report?id=` | 社交诊断报告 |
| POST | `/api/social/toggle_follow` | 关注/取关 |
| GET | `/api/social/pulse` | 社交红点脉冲 |
| POST | `/api/social/mark_read` | 标记已读 |

### 搜索
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/search_users?q=` | 搜索用户 |

### 私聊
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/message/send` | 发送消息 |
| GET | `/api/message/inbox` | 会话列表 |
| GET | `/api/message/conversation?with=` | 聊天记录 |

### 组队大厅
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/activity/list` | 活动列表（支持筛选） |
| POST | `/api/activity/create` | 创建活动 |
| POST | `/api/activity/join` | 申请加入 |
| GET | `/api/activity/my` | 我发起的/我参与的 |
| POST | `/api/activity/audit` | 审核申请 |
| POST | `/api/activity/delete` | 撤回项目 |
| POST | `/api/activity/quit` | 退出队伍 |

### 组队邀请
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/activity/invite` | 发送邀请 |
| GET | `/api/activity/my_invitations` | 收到的邀请 |
| POST | `/api/activity/invitation/respond` | 接受/拒绝 |

### 个人资料
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/user/update` | 更新资料 |
| POST | `/api/user/upload_avatar` | 上传头像 |
| GET | `/api/user/avatar/<uid>` | 获取头像 |
| GET | `/api/users/avatars` | 所有用户头像映射 |
| POST | `/api/questionnaire/update` | 更新画像问卷 |

### 竞赛经历
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/competitions?uid=` | 获取竞赛经历 |
| POST | `/api/user/competitions` | 添加竞赛经历 |
| DELETE | `/api/user/competitions/<id>` | 删除竞赛经历 |

### AI 助手
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agent/chat` | AI 对话 |
| GET | `/api/agent/history` | 聊天历史 |
| DELETE | `/api/agent/history` | 清空历史 |

### 好友分组
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/groups` | 获取分组 |
| POST | `/api/groups/create` | 创建分组 |
| POST | `/api/groups/assign` | 分配好友 |
| POST | `/api/groups/rename` | 重命名分组 |
| POST | `/api/groups/delete` | 删除分组 |

### 图谱
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/graph/dynamic_data` | 动态图谱数据 |

### 管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/retrain` | 管理员重训 GNN |

---

## 🧪 测试账号

初始化 `trans.py` 后可使用以下账号：

| 用户名 | 密码 | UID |
|--------|------|-----|
| manager | 114514 | 管理员账号 |
| test1 ~ test1000 | 114514 | 1 ~ 1000 |

---

## ⚙️ 环境变量配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_URL` | DeepSeek API 地址 | `https://api.deepseek.com/chat/completions` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | 空（需自行填入） |
| `DEEPSEEK_MODEL` | DeepSeek 模型名 | `deepseek-chat` |

在 `agent_api.py` 中设置 DeepSeek API Key 后，AI 社交助手功能即可使用。
