# VIZA Travel AI Development Guide

本指南只描述当前 VIZA Travel AI 的实际代码路径。实现事实以源码为准；
旧的根目录 travel-agent/ 说明见该目录自己的历史文档，不应当被当作当前
Web 产品入口。

## 1. 当前运行边界

当前用户入口是 /client/travel-chat。页面入口
viza-fe/internal-website/app/client/travel-chat/page.tsx:12-20 负责登录态
和 application id，主容器是
viza-fe/internal-website/app/client/travel-chat/travel-chat-client.tsx。
统一聊天页的 Travel 标签在
viza-fe/internal-website/app/client/chat/chat-client.tsx:188-192,1985-1987
嵌入同一个主容器。

浏览器的真实对话调用是：

~~~text
/client/travel-chat
  -> POST /api/travel/chat
  -> POST /api/travel/itinerary（生成时）
     或 POST /api/travel/itinerary/revise（修改时）
  -> viza-be/travel-service 的生成、provider、导出接口
~~~

浏览器不把对话 turn 转发到 Python POST /chat。Python /chat 是可直接调用的
独立接口，返回协议也不同；它不是当前 Next Travel UI 的对话入口。
旧 travel-agent/agent/graph.py 是历史 LangGraph CLI，当前 VIZA 启动脚本
不会启动它。

## 2. 当前对话协调器

当前协调器是 Next route handler，不是 LangGraph、LangChain graph，也不是
带函数工具循环的 Agent SDK。实现位于
viza-fe/internal-website/app/api/travel/chat/route.ts。

浏览器在 travel-chat-client.tsx:5616-5874 提交
sessionId、messageId、可见文本、locale、expectedStateVersion 和
applicationId。服务端先鉴权和检查请求，随后读取 canonical session、最近
历史与偏好，再调用 Responses API。

模型协议和限制如下：

- route.ts:37-42 的首选模型是 gpt-5.6-luna；一次请求的默认 OpenAI
  超时是 60,000 ms，可由 TRAVEL_AGENT_OPENAI_TIMEOUT_MS 覆盖。
- route.ts:881-894 使用 Responses API Structured Outputs，schema 名称为
  travel_agent_turn，strict 为 true；reasoning effort 固定为 medium。
- route.ts:901-916 仅在首选模型返回 403/404 且内容含 model_not_found 时
  重试一次备用模型。备用模型是 TRAVEL_AGENT_OPENAI_FALLBACK_MODEL 或
  gpt-5.5。进程级 activeTravelAgentModel 一旦切换到备用模型，后续请求
  不会自动切回首选。
- route.ts:869-872 没有 previous_response_id 时最多附加最近 12 条历史；
  有该 id 时由 Responses API 继续上下文。请求最后总会追加当前用户输入。
- 输入文本上限是 8,000 字符；session/message id 的解析也有长度和非空
  校验。没有 max_steps 配置；正常一轮为一次模型请求，符合上述模型权限
  错误时最多两次模型请求。
- request body 没有 tools 或 tool_choice。当前 LLM function-tool 数量是
  0；航班、酒店、Google Places 和本地 destination resolver 都由普通服务
  代码调用，不由模型选择工具。

模型返回 10 类 intent（回答、推荐、记录事实、选择/删除目的地、确认/拒绝、
生成、修改、澄清）和 4 类 UI action（none、collect_field、
generate_itinerary、revise_itinerary），定义在 route.ts:45-79。

## 3. State、版本、恢复和确认门

viza-fe/internal-website/lib/travel/planner.ts:120-142 的 TravelState
包含 countries/cities、city days、目的地确认、日期/灵活性、天数、人数、
预算、起点/返程、travel order、selected flights/hotels、final note 和
文件等。planner.ts:8-23 固定 TravelField 顺序；DEFAULT_CITY_DAYS 为 2；
flexible departure 默认约为当前日期后 2 个日历月。

lib/travel/conversation-state.ts:14-47 只允许 14 个 state path 和
set/add/remove/unset/reset 五类 operation。:289-520 验证正数、ISO 日期、
城市、完整 travel order、explicit/evidence，并在目的地、日期或起终点变化时
清掉依赖性的航班/酒店选择。

服务端 session row 在 route.ts:81-97 中包含 state_json、state_version、
memory_summary、openai_previous_response_id 和 pending_actions_json。
ensureSession 在 route.ts:2147-2182 创建 version 0 的 session。

幂等和并发保护的真实顺序是：

1. route.ts:2426-2435 先按 external messageId 查询已保存 response；只有请求
   到达时已有已完成、已持久化的结果，才直接 replay 并避免再次调用模型。
2. route.ts:2436-2448 比较 expectedStateVersion；过期请求返回 409，在
   模型调用前停止。
3. 模型成功后，deterministic operation validation 产生新 state。
4. route.ts:2661-2695 将新 version、用户/assistant 内容、state、memory、
   Responses id、pending actions 和 response 传入
   commit_travel_agent_turn；RPC conflict 在 :2698-2710 返回 409。

两个相同 messageId 的并发首次请求仍可能都在结果保存前进入模型调用；当前
没有覆盖这段区间的 in-flight lock。RPC 保护最终状态提交，但不能据此声称
并发重复请求只消耗一次 LLM 调用或费用。RPC 实现见
viza-be/agent-backend/drizzle/0158_database_access_baseline.sql 的
commit_travel_agent_turn。

这套机制是数据库版本/idempotency/Responses continuity，不是 LangGraph
MemorySaver。前端还会在 travel-chat-client.tsx:5247-5515 使用 localStorage、
/api/travel/sessions archive 和 /api/travel/chat?sessionId=... canonical
state 做跨页恢复。

Human gate 是显式用户确认门，没有独立人工 staff 审核：

- route.ts:817-840 要求建议和推断事实不能直接变更状态，事实必须有用户
  本轮 evidence；模型猜测会成为 pending action preview。
- route.ts:1379-1402 用确定性确认/拒绝解析；只有用户确认后 pending
  operation 才会进入 applyTravelStateOperations。
- 推荐卡只展示，不自动选择目的地；不完整的生成请求被改为 deterministic
  collect-field 回复。
- 没有独立 human approval API、max-step runner、checkpoint worker 或自动
  resume loop。

## 4. 前端 planner 和 API 代理

lib/travel/planner.ts:1270-1400 做 deterministic state completeness、
city-day 总和、日期、人数、预算、起终点和 travel order 校验。表单组件
components/client/travel/travel-planner-form.tsx:1202,1380,1465,1511,1563
分别调用城市、国家、IP location、航班和酒店 API。表单结构化消息由
planner.ts:703-750 解析，而不是让模型猜测字段格式。

lib/travel/backend.ts:1-30 的 Python backend 默认是
http://127.0.0.1:8000，proxy timeout 默认 35,000 ms，由
TRAVEL_BACKEND_TIMEOUT_MS 覆盖。该 timeout 比 Python itinerary endpoint
的 50 秒 deadline 短，慢的生成请求可能先被 Next proxy 取消。

当前 Next Travel route 主要包括：

- /api/travel/chat：唯一当前 Web 对话协调器。
- /api/travel/itinerary：调用 generateItineraryWithFallback。
- /api/travel/itinerary/revise：澄清或修改现有行程。
- /api/travel/flights、/api/travel/hotels：Python provider proxy。
- /api/travel/download-word、/api/travel/download-pdf：文件流 proxy。
- /api/travel/locations/countries、/api/travel/locations/cities、
  /api/travel/ip-location、/api/travel/geocode：选项和地图辅助 API。

## 5. Python FastAPI 服务的真实接口

viza-be/travel-service/main.py:387-612 当前定义九个接口：

| Method | Path | 实际行为 |
| --- | --- | --- |
| GET | /health | 固定 liveness response，不验证所有 provider。 |
| GET | /ready | 初始化/检查共享 HTTP client。 |
| POST | /generate | 生成结构化 itinerary。 |
| POST | /revise-itinerary | 修改 itinerary；不可用时保留原 itinerary。 |
| POST | /chat | 独立 Python chat；当前 Web 不调用。 |
| POST | /download-word | 生成或导出 Word。 |
| POST | /download-pdf | 生成或导出 PDF。 |
| POST | /flight-options | RapidAPI 航班查询和估算 fallback。 |
| POST | /hotel-options | RapidAPI 酒店查询和 deterministic fallback。 |

main.py:87-201 的 TravelRequest 接收国家、城市、city_days、日期、天数、
人数、预算、起终点、travel order、航班/酒店选择、备注和 locale；这些请求
本身没有 Python 持久化 session 或 state version。

agent.py:60-96,605-868 的 Python /chat 使用 Chat Completions 的
gpt-4o-mini，temperature 0.2，client timeout 45 秒，最多携带最近 8 条消息；
OpenAI 失败后走 welcome/inspiration/destination/detail/collect-slots 等
deterministic fallback。它不是当前 Responses coordinator 的兼容实现。

## 6. 行程生成、修改和 provider fallback

lib/travel/itinerary-fallback.ts:296-401,432-520,522-717 的当前 Next
生成管线会检查本地 destination 数据；本地完整性要求坐标、真实 cover image、
至少 5 个 attractions、至少 5 个带坐标和描述的 attraction、至少 3 张非占位
照片以及 completeness score 至少 85。不足时可调用 Google Places enrichment，
将事实 context 传给主生成流程。

主 Python backend 候选路径是 /generate、/generate-itinerary、
/api/generate；只有 404 才尝试下一个候选，其他错误直接进入失败处理。
主结果规范化时每一天最多 4 个 activities 和 3 个 food。主服务失败后才使用
text-only LLM fallback；该 fallback 使用 gpt-4o-mini 或
OPENAI_TRAVEL_ITINERARY_MODEL，temperature 0.25，要求只使用请求城市，并
禁止虚构营业时间、价格和预约。所有路径失败则返回带 debug id 的 retryable
structured error。

Python /generate 在 main.py:401-412 有 50 秒 endpoint deadline；
itinerary.py:1686-1860 的 OpenAI generation 使用 gpt-4o-mini、
temperature 0.4、client timeout 45 秒，无 key、超时、异常、空结果或解析失败
时使用 deterministic _fallback_itinerary。

修改有两层：

1. 当前浏览器先调用 Next /api/travel/itinerary/revise。若 Next 能取得
   OpenAI key，revise/route.ts:346-391 直接使用 Chat Completions
   gpt-4o-mini、temperature 0.2；有歧义（例如“少一天”但未指明城市）时
   :114-200 先返回澄清。
2. 只有 Next revision route 没有 key 时才尝试 Python /revise-itinerary，
   候选为 /revise-itinerary 和 /api/revise-itinerary，只在 404 时换候选。
   Python itinerary.py:1419-1589 使用 gpt-4o-mini、temperature 0.2、
   timeout 45 秒；不可用时返回 unchanged itinerary 和
   _openai_revision_unavailable。

itinerary.py:1250 的 _fallback_revision 仍存在并被
tests/test_locale_alignment.py:32-35 直接导入，但 main.py 生产路径不调用
它；不能把它写成当前 revision fallback。

Provider boundary：

- main.py:48-65 将 provider search concurrency 默认限制为 4，每个 search
  deadline 为 30 秒。
- tools/http_client.py:18-128 的 connect/read/write/pool timeout 是
  5/15/5/5 秒；只对第一次 HTTP 429 按 Retry-After 重试，并将等待限制为
  0.1-2 秒；没有通用 5xx retry/backoff。
- tools/flights.py 和 tools/hotels.py 的 destination lookup cache TTL
  为 86,400 秒，lookup deadline 10 秒，max in-flight 64，cache max 256。
- 航班 provider 失败最多返回 2 条 estimated 选项并标出 unavailable；
  不伪造航空公司或 booking offer。酒店 provider 失败返回 2 条
  api-default 选项；它们是展示估算，不是已确认预订。

## 7. Reliability、health 和 observability

当前 chat 失败边界是：没有 OpenAI key 返回 503；OpenAI timeout/HTTP/结构化
输出失败返回 502，发生在 turn commit 之前。数据库 commit 错误返回 503，
但网络响应丢失可能使调用方无法判断事务是否已经提交；应使用同一 messageId
查询或重试来恢复已保存结果，不能把传输失败直接等同于数据库未变更。
状态版本冲突为 409，已完成的重复 messageId replay 已保存结果。

app/api/travel/health/route.ts:4-127 的 health timeout 为 2,500 ms；
session DB transient retry 延时为 150 ms、500 ms。passive probe 不访问
OpenAI，active probe 才 GET /v1/models。整体 ok 只依赖 OpenAI、session
database 和 client-session，虽然 response 同时报告 Python service 和 Places。
Python /health 固定返回 ok，因此不能单独证明 OpenAI、RapidAPI 或 Google
可用。

pipeline observability 主要是 structured diagnostics 和日志：

- lib/travel/travel-errors.ts:1-79 定义 parse_intent、resolve_destination、
  local lookup、Google search/details/photos、LLM itinerary、primary service、
  render/save 等 stage，并生成 retryable、fallback 和 debugId。
- itinerary-fallback.ts:30-74 返回 local/Google/primary/LLM 状态、warnings
  和 fallbackUsed。
- chat route 记录 [travel-chat] OpenAI failure 和 coordinator failure；
  开发环境才回传内部 debug 字段。
- tools/openai_client.py:25-111 有 bounded admission helper：concurrency
  默认 8、max waiters 32、acquire timeout 5 秒，上限为 64/256/30；它没有
  retry/backoff/circuit breaker。
- tools/export_admission.py:38-102 的导出 concurrency 默认 2、max waiters
  16、acquire timeout 5 秒，并处理取消和临时文件清理。

当前仓库没有发现 Travel load benchmark 或 production latency benchmark；
现有测试是 provider、状态协议、fallback、locale、export 和 concurrency
回归测试。

## 8. 测试与本地验证

前端 Travel 测试包括：
lib/travel/__tests__/travel-negative-command.spec.ts:594-1402 的推荐不自动
选择、state 恢复、显式 add/remove、多事实、pending confirm/reject、幂等、
409 和 OpenAI failure；travel-llm-connectivity.spec.ts:7-195 的 OpenAI、
Python、session DB、Places 独立 health 和 DB retry；
itinerary-fallback.test.ts:96-218,227-397 的本地/Google/LLM fallback、
规范化、缓存和地理边界。

Python 测试包括 tests/test_flights.py provider contract、
tests/test_locale_alignment.py locale/fallback、
tests/test_export_summary.py export，以及
tests/test_concurrency.py:36-486 single-flight、取消、bounded OpenAI/export
admission 和文件清理。

只启动当前 Travel service 时使用 uvicorn main:app；仓库一键脚本中的真实
Travel service 路径是 viza-be/travel-service，见
scripts/start-viza-dev.ps1:22,434-471 和 scripts/start-all.ps1:26,865-899。
不要把根目录 travel-agent/chat.py 当作当前 VIZA smoke entry。
