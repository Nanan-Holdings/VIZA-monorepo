# VIZA Travel Agent Development Guide (DG)

## 1. 目标与范围

本指南用于在 `VIZA-monorepo` 内开发与维护 Travel AI 模块（前端对话 + 地图 + 行程生成 + 航班/酒店候选 + 导出文档）。

当前 Travel 能力主要由以下三块组成：

1. `viza-fe/internal-website`：用户可见的 Travel Chat UI 与 API 代理层  
2. `viza-be/travel-service`：Python FastAPI 旅行规划后端  
3. `viza-be/agent-backend` / `viza-be/submission-service`：同一套本地开发常用依赖服务（非 Travel 核心逻辑，但通常一起启动）

---

## 2. 高层架构（请求链路）

1. 用户在 `/client/travel-chat` 或聊天页中的 `Travel AI` 标签发起输入  
2. 前端根据表单状态构造结构化 payload（国家/城市/天数/预算/航班/酒店等）  
3. 前端 API 路由（`/api/travel/*`）转发到 Python `travel-service`  
4. `travel-service` 调用：
   - `itinerary.py`（OpenAI 生成行程，失败时 fallback）
   - `tools/flights.py`（RapidAPI 航班）
   - `tools/hotels.py`（RapidAPI 酒店）
5. 前端渲染：
   - 聊天与选择流程
   - 行程卡片与导出按钮
   - Google Maps 地图与路线/热点标记

---

## 3. 关键文件地图（路径 + 作用）

### 3.1 Frontend（Next.js）

#### 页面入口与整合点

- `viza-fe/internal-website/app/client/travel-chat/page.tsx`  
  Travel 页面路由入口；做登录态检查并加载当前用户最新 application id。

- `viza-fe/internal-website/app/client/travel-chat/travel-chat-client.tsx`  
  Travel 主容器；组织左侧聊天/表单、右侧地图、热点卡片、进度状态。

- `viza-fe/internal-website/app/client/chat/chat-client.tsx`  
  主聊天页中 `VIZA AI / Travel AI` 切换入口；`Travel AI` 标签会渲染 `TravelChatClient`。

#### Travel UI 组件

- `viza-fe/internal-website/components/client/travel/travel-planner-form.tsx`  
  分步骤收集旅行参数（国家、城市、天数、人数、预算、往返、航班/酒店选择、备注）。

- `viza-fe/internal-website/components/client/travel/travel-itinerary-panel.tsx`  
  行程展示与导出（Word/PDF）面板。

- `viza-fe/internal-website/components/client/travel/trip-route-map.tsx`  
  Google Maps 地图渲染（中文地图、地点 marker、路线 polyline、点击联动）。

#### 前端业务逻辑与类型

- `viza-fe/internal-website/lib/travel/planner.ts`  
  Travel 的核心状态机与数据标准化规则（deterministic transform，不依赖 AI 猜测）。

- `viza-fe/internal-website/lib/travel/chat-types.ts`  
  聊天消息类型定义。

- `viza-fe/internal-website/lib/travel/backend.ts`  
  到 `travel-service` 的转发基础函数；读取 `TRAVEL_BACKEND_URL`。

- `viza-fe/internal-website/lib/travel/locations-provider.ts`  
  国家/城市选项 provider，含缓存与外部数据拉取。

- `viza-fe/internal-website/lib/travel/locations.ts`  
  手工维护的常用国家城市映射（中英文、别名）。

#### 前端 API 代理（Next Route Handlers）

- `viza-fe/internal-website/app/api/travel/itinerary/route.ts`  
  转发行程生成请求（支持候选后端路径 fallback）。

- `viza-fe/internal-website/app/api/travel/flights/route.ts`  
  转发航班候选查询。

- `viza-fe/internal-website/app/api/travel/hotels/route.ts`  
  转发酒店候选查询。

- `viza-fe/internal-website/app/api/travel/download-word/route.ts`  
  转发并回传 `.docx` 文件流。

- `viza-fe/internal-website/app/api/travel/download-pdf/route.ts`  
  转发并回传 `.pdf` 文件流。

- `viza-fe/internal-website/app/api/travel/locations/countries/route.ts`  
  国家选项 API。

- `viza-fe/internal-website/app/api/travel/locations/cities/route.ts`  
  城市选项 API（按国家）。

#### 前端静态资源与环境变量

- `viza-fe/internal-website/public/globe/*`  
  地图 marker 与热点卡片所用图片资源。

- `viza-fe/internal-website/.env.local`  
  前端运行配置（Supabase、Agent Backend、Travel Backend、Google Maps key）。

---

### 3.2 Travel 后端（Python FastAPI）

- `viza-be/travel-service/main.py`  
  FastAPI 入口；定义以下核心接口：  
  `POST /generate`、`POST /flight-options`、`POST /hotel-options`、`POST /download-word`、`POST /download-pdf`。

- `viza-be/travel-service/itinerary.py`  
  行程生成逻辑；优先调用 OpenAI，失败时使用 deterministic fallback itinerary。

- `viza-be/travel-service/tools/flights.py`  
  航班搜索工具；通过 RapidAPI 查询，失败时返回 mock 数据。

- `viza-be/travel-service/tools/hotels.py`  
  酒店搜索工具；通过 RapidAPI 查询，失败时返回 mock 数据。

- `viza-be/travel-service/export_doc.py`  
  Word 导出实现。

- `viza-be/travel-service/export_pdf.py`  
  PDF 导出实现。

- `viza-be/travel-service/.env.example`  
  后端环境变量模板（OpenAI + RapidAPI）。

- `viza-be/travel-service/requirements.txt`  
  Python 依赖列表。

---

### 3.3 常一起启动的服务（协作开发用）

#### Agent Backend（Socket + 主 AI）

- `viza-be/agent-backend/src/index.ts`  
  服务入口（默认 3002），挂载 Socket.IO 命名空间 `/visa`。

- `viza-be/agent-backend/src/socket/visa-namespace.ts`  
  处理 `visa_chat_message`、消息持久化、流式 token 返回、工具回调等。

#### Submission Service（自动化提交）

- `viza-be/submission-service/src/index.ts`  
  轮询 `submission_queue`、触发 Playwright 自动提交流程。

- `viza-be/submission-service/src/alert.ts`  
  失败告警邮件（Resend）；若未配置 key 会跳过并打印 warning。

---

## 4. 环境变量清单（开发常用）

> 不要把真实 key 提交到 git。建议仅在本地 `.env` / `.env.local` 保留。

### 4.1 Frontend `viza-fe/internal-website/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_AGENT_BACKEND_URL=http://localhost:3002
TRAVEL_BACKEND_URL=http://127.0.0.1:8000
GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

### 4.2 Travel Service `viza-be/travel-service/.env`

```env
OPENAI_API_KEY=
RAPIDAPI_KEY=
RAPIDAPI_BOOKING_HOST=booking-com15.p.rapidapi.com
RAPIDAPI_BOOKING_BASE_URL=https://booking-com15.p.rapidapi.com
```

### 4.3 Agent Backend `viza-be/agent-backend/.env`

至少保证 Supabase + 运行端口可用（其余按业务需要补齐）。

### 4.4 Submission Service `viza-be/submission-service/.env`

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
TWOCAPTCHA_API_KEY=
```

---

## 5. 启动与开发（可直接 copy & paste）

## 一次性初始化（每台机器只做一次）

```powershell
# 0) 进入仓库根目录
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo

# 1) Frontend
cd .\viza-fe\internal-website
npm install

# 2) Agent Backend
cd ..\..\viza-be\agent-backend
npm install

# 3) Submission Service
cd ..\submission-service
npm install
npm run install-browsers

# 4) Travel Service (Python)
cd ..\travel-service
if (!(Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\activate
pip install -r requirements.txt
deactivate
```

## 每次开发启动（开 4 个终端）

### 终端 1 - Frontend (Next.js)

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-fe\internal-website
npm run dev
```

### 终端 2 - Agent Backend (3002)

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\agent-backend
npm run dev
```

### 终端 3 - Travel Service (8000)

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\travel-service
.\.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 终端 4 - Submission Service（需要轮询自动提交时再开）

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\submission-service
npm run dev
```

## 一键启动脚本（已提供）

脚本位置：

- `scripts/start-travel-dev.ps1`

使用方式：

```powershell
# 默认启动：Frontend + Agent Backend + Travel Service
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo
powershell -ExecutionPolicy Bypass -File .\scripts\start-travel-dev.ps1

# 若你也要启动 submission-service
powershell -ExecutionPolicy Bypass -File .\scripts\start-travel-dev.ps1 -WithSubmissionService
```

---

## 6. 快速访问地址

```text
Frontend: http://localhost:3000
Agent Backend: http://localhost:3002
Travel Service: http://127.0.0.1:8000
Travel Chat 页面: http://localhost:3000/client/travel-chat
```

---

## 7. 日常开发建议

1. 只改 UI：优先改 `travel-chat-client.tsx` + `components/client/travel/*`。  
2. 改数据流程：优先改 `lib/travel/planner.ts`（确保 deterministic）。  
3. 改后端能力：改 `travel-service/main.py` 与 `tools/*`。  
4. 改接口转发：改 `app/api/travel/*/route.ts`。  
5. 改地图：改 `trip-route-map.tsx` + `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`。

---

## 8. 常见问题排查

1. 地图空白或灰块  
   检查 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`，重启前端，浏览器强刷（Ctrl+F5）。

2. `/api/travel/*` 返回 500  
   先确认 `travel-service` 是否在 `8000` 启动；再看 `TRAVEL_BACKEND_URL`。

3. 行程始终 fallback  
   说明 `OPENAI_API_KEY` 缺失或调用失败，检查 `viza-be/travel-service/.env`。

4. submission-service 启动报 `Missing API key`  
   检查 `RESEND_API_KEY`；若仅本地调 Travel，可暂不启动 submission-service。

5. agent-backend 连库失败（Supabase / DNS）  
   先排查网络，再确认 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`DATABASE_URL`。

---

## 9. 最小化 Travel-only 开发模式（更轻量）

如果只开发 travel 模块，通常只需开两个服务：

1. `viza-fe/internal-website`（3000）  
2. `viza-be/travel-service`（8000）

只有当你要联调主聊天 Socket 或自动化提交流程时，再启动 3002 / submission-service。
