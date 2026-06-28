# Bug 修复记录与原因说明

日期：2026-06-28

本文记录本轮排查并修复的问题、根因、修复方法和验证方式。涉及模块主要包括推荐接口、个人星系图、用户画像数据、用户资料表约束和头像 fallback 展示。

## 1. 新用户冷启动没有推荐列表

### 现象

新注册用户进入推荐页后，推荐列表为空。理论上新用户还没有 GNN embedding 时，应当退化为基于基础资料、爱好、标签和画像字段的内容推荐。

### 根因

`/tuijian` 的冷启动逻辑仍然存在，但它依赖 `app.py` 中的 `user_info_map` 遍历候选用户。此前 `user_info_map = UserInfo.query.all()` 在 Flask `app_context` 外执行，异常被 `except` 吞掉，导致启动后的 `app.user_info_map` 实际为空。

因此新用户进入冷启动分支时：

- 能判断为冷启动；
- 但候选用户集合为空；
- 最终返回空推荐列表。

另外，`step3_recommend.user_info_map` 是模块加载时的快照，注册、问卷更新、资料更新后如果不同步，也会导致推荐模块读到旧资料。

### 修复方法

在 `app.py` 中：

- 将 `users_list = UserInfo.query.all()` 移入 `with app.app_context()` 内。
- 启动时同步：
  - `app.user_info_map`
  - `step3_recommend.user_info_map`
- 注册成功后同步新用户资料到两个 map。
- 问卷更新、资料更新后同步两个 map。
- 手动重训和定时重训后重新加载并同步用户资料。
- 冷启动判断改为 `step3_recommend.has_embedding(sid)`，适配非连续 UID 与 `embedding_uid_order.pt`。

### 验证方式

使用 Flask test client 模拟无 embedding 的新用户访问：

```text
/tuijian?id=<fake_uid>&mode=social
```

验证结果：

```text
status = 200
mode = content_based (冷启动降级)
count = 5
recommend_ids 非空
```

## 2. 新用户个人星系图没有自己的节点，好友节点重合

### 现象

新注册用户进入个人星系图时没有自己的中心节点。加了好友后，好友节点可能挤在一起或重合，表现为个人星系结构异常。

### 根因

个人星系页读取 `/api/graph/dynamic_data`。此前该接口只读取旧的 `static/graph.json`，再覆盖头像、签名、状态等实时属性。

`static/graph.json` 是 GNN 重训或图谱构建时生成的静态文件。新注册用户如果还没有经过重训，就不会出现在该 JSON 的 `nodes` 中。此时前端拿不到中心用户节点，却又可能拿到推荐边或关注边，导致力导向图缺少中心锚点，节点布局异常。

### 修复方法

在 `app.py` 的 `/api/graph/dynamic_data` 中改为动态合并：

- 读取旧 `static/graph.json`，保留已有 GNN 图结构。
- 从数据库 `accounts` 和 `users` 实时补齐所有用户节点。
- 从 `edges_time` 实时补齐最新关注边。
- 对新增节点补充：
  - `username`
  - `avatar`
  - `signature`
  - `status`
  - `info`
  - `community`
  - `val`
  - `hasPulse`
- 对 link 去重，并过滤不存在端点的边。
- 对非数字节点 ID 做容错，避免接口整体报错。

### 验证方式

修复前：

```text
static/graph.json nodes = 1021
database users = 1022
missing user = 1022
```

修复后：

```text
/api/graph/dynamic_data nodes = 1022
db_users_missing_from_api = 0
latest_uid exists in API graph = True
```

## 3. 中期前注册用户和测试用户没有画像分

### 现象

老用户和部分测试用户的 `users.info` 中没有 `画像分:` 字段。推荐算法中的画像相似度无法读取这些用户的画像向量。

### 根因

早期注册逻辑只写入基础资料、爱好和标签，没有把问卷画像分写入数据库。后续问卷功能上线后，新用户可生成画像，但旧数据没有迁移。

推荐算法读取画像时依赖如下格式：

```text
画像分:社交63|协作47|学习67|开放63|沟通49|作息63
```

没有该字段时，`parse_profile_scores()` 会返回 `None`。

### 修复方法

新增脚本：

```text
backfill_profile_scores.py
```

脚本逻辑：

- 扫描 `users` 表中 `uid > 0` 的用户。
- 默认只处理没有 `画像分:` 的用户。
- 为缺失用户生成随机 6 维画像分。
- 写入 `画像分:` 和 `社交倾向:`。
- 将衍生标签合并进原有 `标签:` 字段。
- 默认 dry-run，只有带 `--apply` 才写库。
- 写库前自动备份数据库。

执行命令：

```text
python backfill_profile_scores.py --seed 20260628 --apply
```

备份文件：

```text
D:\flask_demo\campus_social.profile_backfill_20260628_185904.bak
```

### 验证方式

执行前：

```text
total users = 1025
missing_profile = 1021
existing_profile = 4
```

执行后：

```text
total users = 1025
missing_profile = 0
existing_profile = 1025
```

并抽样调用 `step3_recommend.parse_profile_scores(info)`，确认可以解析为 6 维向量。

### 注意

本修复解决的是字段完整性问题。随机画像不等价于真实用户问卷，后续如果追求更科学的推荐，应改为基于用户专业、爱好、标签和行为数据的规则生成，或引导用户重做问卷。

## 4. `users` 表出现重复 UID

### 现象

数据库浏览器中看到多个相同 `uid` 的用户资料，例如：

```text
uid = 1001 出现 2 次
uid = 1002 出现 2 次
```

截图左侧的 `1,001 / 1,002 / 1,003` 是 SQLite 的物理行号 `rowid`，中间列才是业务 `uid`。

### 根因

`accounts` 表中 `uid` 是主键，没有重复；但 `users` 表实际结构是：

```sql
CREATE TABLE "users" (
  "uid" INTEGER,
  "info" TEXT
)
```

也就是说数据库里的 `users.uid` 没有主键或唯一约束。虽然 SQLAlchemy 模型里写了 `primary_key=True`，但数据库表很可能早期由 `pandas.to_sql(..., if_exists='replace')` 创建，导致真实表结构没有保留主键约束。

因此后续注册或迁移时，数据库不会阻止重复 `uid` 写入。

### 修复方法

对当前数据库：

- 保留每个 `uid` 第一次出现的记录，也就是最小 `rowid`。
- 删除后续重复行。
- 创建唯一索引 `ux_users_uid`。

备份文件：

```text
D:\flask_demo\campus_social.dedupe_users_20260628_190739.bak
```

删除结果：

```text
uid=1001: 删除第二次出现的 rowid=1004
uid=1002: 删除第二次出现的 rowid=1005
deleted_rows = 2
```

在 `app.py` 启动迁移中增加防护：

```sql
DELETE FROM users
WHERE uid IS NOT NULL
  AND rowid NOT IN (
    SELECT MIN(rowid)
    FROM users
    WHERE uid IS NOT NULL
    GROUP BY uid
  );

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_uid ON users(uid);
```

### 验证方式

```text
duplicate_users = 0
users index = ux_users_uid
accounts_without_userinfo = []
userinfo_without_account = []
```

## 5. 个人主页头像默认显示问号，不显示用户名首字母

### 现象

左侧栏头像在没有上传图片时会显示用户名首字母，但个人空间、个人主页弹窗和星图右侧抽屉中仍显示 `?`。

### 根因

模板里这些头像容器默认写死为 `?`。通用的 `State.loadAvatar()` 在没有头像时只会清掉背景图，不会填回 fallback 文本。

因此侧边栏能显示首字母，是因为登录时单独执行了：

```javascript
u.username.charAt(0).toUpperCase()
```

其他头像位置没有同样逻辑。

### 修复方法

在前端中统一头像 fallback：

- `static/js/core.js`
  - `State.loadAvatar(uid, elementId, isBg, fallbackText)` 支持 fallback 文本。
  - 无真实头像时显示 fallback 文本。
- `static/js/panels/profile.js`
  - 个人空间头像先写入用户名首字母，再尝试加载真实头像。
- `static/js/modals.js`
  - 个人主页弹窗头像显示用户名首字母。
  - 星图右侧抽屉头像显示用户名首字母。

### 验证方式

运行：

```text
node --check static/js/core.js
node --check static/js/panels/profile.js
node --check static/js/modals.js
```

结果均通过。

## 6. 头像 fallback 背景色与侧边栏不一致

### 现象

头像已经显示首字母后，个人主页或个人空间中的默认头像背景色仍和左侧栏不一致。

### 根因

不同模板使用了不同背景类：

- 左侧栏：`bg-amber-100 text-amber-700`
- 个人空间：渐变背景
- 个人主页弹窗：stone 灰色背景
- 星图抽屉：`bg-amber-50`

### 修复方法

统一所有无头像 fallback 的视觉样式：

```text
background = #fef3c7  (Tailwind amber-100)
text color = #b45309  (Tailwind amber-700)
```

涉及位置：

- `templates/panels/profile.html`
- `templates/index.html`
- `templates/dashboard.html`
- `static/js/core.js`
- `static/js/panels/profile.js`
- `static/js/modals.js`

### 验证方式

再次执行 JS 语法检查：

```text
node --check static/js/core.js
node --check static/js/panels/profile.js
node --check static/js/modals.js
```

结果均通过。刷新页面后，无头像用户在侧边栏、个人空间、个人主页弹窗和星图抽屉中都显示一致的浅琥珀底色和首字母。

## 7. 推荐算法现状评估

### 当前算法结构

当前推荐属于混合推荐：

- 有 GNN embedding 的用户：
  - 先用 GNN embedding 计算候选用户相似度。
  - 再融合画像相似度。
  - `social` 模式额外加入共同关注加成。
- 没有 GNN embedding 的新用户：
  - 使用 `users.info` 中的中文特征词做内容匹配冷启动推荐。

当前融合权重：

```text
gnn 模式:
final_score = 0.80 * gnn_score + 0.20 * profile_score

social 模式:
final_score = 0.60 * gnn_score + 0.25 * profile_score + 0.15 * social_bonus
```

### 科学性判断

该算法工程上可用，但更准确地说是启发式混合推荐，不宜描述为已经严格验证的科学推荐模型。

主要原因：

1. 画像分相似度区分度弱  
   当前 6 维正数向量用 cosine similarity，抽样显示大多数 `profile_score` 都在 90 分以上，排序贡献接近常数。

2. 老用户画像是随机补齐  
   本轮脚本解决了字段缺失，但随机画像不能代表真实偏好。

3. GNN 训练没有独立验证集  
   当前 AUC 是训练图上的负采样评估，不能证明线上推荐质量。

4. 关注关系有方向，但 GNN 打分近似对称  
   当前 embedding 相似度更像“相似的人”，不严格建模“我会关注谁”。

5. 融合权重为人工设定  
   目前没有用时间切分验证集或点击/关注转化数据调参。

### 建议后续优化

- 用 `edges_time` 做时间切分：旧边训练，新边测试。
- 用规则或行为数据替代随机画像回填。
- 将画像相似度改为标准化距离或分维度加权相似度。
- 对推荐结果记录曝光、点击、关注转化，后续用数据调权重。
- 对 `edges_time` 增加去重约束，避免重复关注边影响训练。

## 8. 本轮主要涉及文件

后端：

- `app.py`
- `step3_recommend.py`
- `step1_full_process.py`
- `step2_train_full.py`
- `build_visual_graph.py`
- `backfill_profile_scores.py`

前端：

- `static/js/core.js`
- `static/js/modals.js`
- `static/js/panels/profile.js`
- `templates/index.html`
- `templates/dashboard.html`
- `templates/panels/profile.html`

数据与模型：

- `campus_social.db`
- `static/graph.json`
- `campus_graph_full.pt`
- `user_embeddings.pt`
- `embedding_uid_order.pt`

备份：

- `campus_social.profile_backfill_20260628_185904.bak`
- `campus_social.dedupe_users_20260628_190739.bak`

## 9. 本轮验证命令

后端编译：

```text
python -m py_compile app.py step3_recommend.py activity_api.py agent_api.py models.py build_visual_graph.py
python -m py_compile backfill_profile_scores.py
```

前端语法：

```text
node --check static/js/core.js
node --check static/js/panels/profile.js
node --check static/js/modals.js
```

关键数据检查：

```text
duplicate_users = 0
missing_profile = 0
db_users_missing_from_api = 0
```

接口检查：

```text
/tuijian?id=<cold_start_uid>&mode=social -> count > 0
/api/graph/dynamic_data -> 包含数据库中所有 uid > 0 的用户节点
```
