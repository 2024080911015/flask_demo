# 🤖 OpenClaw AI 社交顾问 — 集成配置指南

> 本文档面向项目组成员，说明如何在本地配置和启动 OpenClaw AI Agent，使校园社交平台的"AI 社交助手"功能正常运行。

---

## 一、架构概览

```
┌──────────────┐     POST /api/agent/chat     ┌──────────────┐    POST /v1/chat/completions    ┌──────────────────┐
│   前端浏览器   │  ──────────────────────────► │  Flask 后端   │  ────────────────────────────►  │  OpenClaw Gateway │
│  (dashboard)  │  ◄──────────────────────────  │  (app.py)    │  ◄────────────────────────────  │  (port 18789)    │
└──────────────┘     { reply: "..." }          └──────────────┘    OpenAI 兼容格式响应            └──────────────────┘
                                                    │                                                    │
                                               Session 鉴权                                        Agent 模型推理
                                               动态注入用户画像                                  (如 doubao / deepseek)
```

**安全设计**：前端不直接访问 OpenClaw，API Token 仅存于 Flask 后端，防止泄露。

---

## 二、前置条件

| 依赖项 | 版本要求 | 检查命令 |
|--------|---------|---------|
| Python | 3.9+ | `python --version` |
| OpenClaw | 2026.2.x+ | `openclaw --version` |
| requests (Python) | 任意 | `pip show requests` |

如果还没安装 OpenClaw，参考官方文档安装：
```bash
# Windows (PowerShell)
winget install openclaw

# macOS
brew install openclaw

# Linux
curl -fsSL https://get.openclaw.dev | sh
```

---

## 三、配置步骤（⚠️ 必须按顺序执行）

### 步骤 1：启用 OpenClaw HTTP API

OpenClaw 默认只开启 WebSocket 接口，**HTTP Chat API 需要手动启用**，否则会返回 `405 Method Not Allowed`。

```bash
openclaw config set gateway.http.endpoints.chatCompletions.enabled true
```

### 步骤 2：设置 Gateway Token

Token 需要和 Flask 后端代码（`app.py` 第 479 行）中的 `OPENCLAW_API_KEY` 保持一致。

```bash
openclaw config set gateway.auth.token flask-social-2026
```

> **注意**：如果提示 `use gateway.auth.token instead`，说明你的 OpenClaw 版本较新，已将 `gateway.token` 迁移到了 `gateway.auth.token`。

### 步骤 3：启动 OpenClaw Gateway

```bash
openclaw gateway --port 18789 --verbose
```

启动成功后，你应该能在日志中看到：
```
[gateway] listening on ws://127.0.0.1:18789 (PID xxxx)
```

### 步骤 4：验证 HTTP API 是否可用

打开一个新终端，运行：

```bash
python -c "import requests; r = requests.post('http://127.0.0.1:18789/v1/chat/completions', json={'model':'','messages':[{'role':'user','content':'你好'}],'stream':False}, headers={'Authorization':'Bearer flask-social-2026','Content-Type':'application/json'}, timeout=30); print(r.status_code, r.text[:200])"
```

- ✅ 返回 `200` + JSON 内容 → 配置成功
- ❌ 返回 `405 Method Not Allowed` → 步骤 1 未生效，请重启 Gateway
- ❌ 返回 `401 Unauthorized` → Token 不匹配，检查步骤 2
- ❌ 连接拒绝 → Gateway 未启动，检查步骤 3

### 步骤 5：启动 Flask 后端

```bash
cd d:\flask_demo
python app.py
```

访问 `http://127.0.0.1:5001`，登录后点击右下角 **✨ 按钮** 即可打开 AI 社交助手。

---

## 四、配置项速查

以下配置都在 `app.py` 中，支持环境变量覆盖：

| 配置项 | 默认值 | 说明 |
|--------|-------|------|
| `OPENCLAW_API_URL` | `http://127.0.0.1:18789/v1/chat/completions` | OpenClaw Gateway 地址 |
| `OPENCLAW_API_KEY` | `flask-social-2026` | Gateway Token（需与 OpenClaw 配置一致） |

如果想通过环境变量配置（而不是改代码），可以在启动 Flask 前设置：

```bash
# Windows PowerShell
$env:OPENCLAW_API_URL = "http://127.0.0.1:18789/v1/chat/completions"
$env:OPENCLAW_API_KEY = "your-custom-token"
python app.py

# Linux / macOS
export OPENCLAW_API_URL="http://127.0.0.1:18789/v1/chat/completions"
export OPENCLAW_API_KEY="your-custom-token"
python app.py
```

---

## 五、常见问题排查

### Q1: 聊天窗口显示"OpenClaw 服务未连通"
**原因**：Flask 无法连接到 OpenClaw Gateway。
**解决**：
1. 确认 OpenClaw 已启动：`openclaw gateway --port 18789 --verbose`
2. 确认端口一致（Flask 的 `OPENCLAW_API_URL` 端口 = Gateway 的 `--port` 端口）

### Q2: 聊天窗口显示"OpenClaw 返回错误"
**原因**：Gateway 连通但返回了错误。
**解决**：
1. 检查 OpenClaw 日志里是否有 Agent 模型相关的报错
2. 确认 Agent 模型配置正确：`openclaw config get gateway.agent.model`

### Q3: 返回 401 Unauthorized
**原因**：Token 不匹配。
**解决**：
```bash
# 查看当前 OpenClaw 的 Token
openclaw config get gateway.auth.token

# 确保和 app.py 中的 OPENCLAW_API_KEY 一致
```

### Q4: 返回 405 Method Not Allowed
**原因**：HTTP Chat API 未启用。
**解决**：
```bash
openclaw config set gateway.http.endpoints.chatCompletions.enabled true
# 然后重启 Gateway！
```

### Q5: WSL 里运行 OpenClaw，Windows 里运行 Flask，连不通？
**原因**：WSL2 NAT 模式下 `127.0.0.1` 互不可达。
**解决方案（任选一个）**：

**方案 A**：让 OpenClaw 绑定 `0.0.0.0`
```bash
openclaw config set gateway.host 0.0.0.0
openclaw gateway --port 18789 --verbose
```
然后在 `app.py` 中把 URL 改为 WSL 的 IP：
```bash
# 查看 WSL IP
wsl -e hostname -I
# 假设是 172.27.x.x，则 URL 改为 http://172.27.x.x:18789/v1/chat/completions
```

**方案 B（推荐）**：直接在 Windows 里运行 OpenClaw，避免跨网络问题。

---

## 六、涉及的代码文件

| 文件 | 改动说明 |
|------|---------|
| `app.py` | 新增 `/api/agent/chat` 路由（第 471~540 行），代理转发请求到 OpenClaw |
| `templates/dashboard.html` | 新增浮动 AI 助手聊天窗口 + FAB 按钮 |
| `static/js/app.js` | 新增 `toggleAgent()` / `sendToAgent()` 等聊天交互函数 |

> 即使 OpenClaw 服务未启动，主站的所有功能（GNN 推荐、关系管理、个人空间等）**完全不受影响**，聊天窗口会优雅降级显示错误提示。
