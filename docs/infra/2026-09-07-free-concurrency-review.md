# 2026-09-07 并发架构检查与免费优化

本次完成代码优化与本地验证，没有部署生产、修改生产数据库、增加实例、
购买服务或对生产执行并发压测。目标是在现有资源上减少重复工作，保护普通
页面请求；整站 1,000 人容量仍需按实际业务负载验收。

## 当前架构和容量边界

| 路径 | 当前实现/配置 | 对并发的影响 |
| --- | --- | --- |
| 浏览器 → Next.js / Vercel → Supabase | 前端函数区域已配置 `bom1`，生产 Supabase 已核实为 Mumbai `ap-south-1` | 旧路线图中 Vercel `iad1` 的观察不能继续当作当前配置；本轮没有迁移区域 |
| Next.js → Express + Socket.IO `/visa` | Render 配置 Singapore、单副本；Drizzle 使用事务池，每实例 `DB_POOL_MAX=3` | 3 个连接可以周转服务多个用户，不等于只能 3 人在线；Supabase REST、Auth 另有连接预算 |
| 签证 AI、OCR、字段指导 | chat 默认 16 个执行中、64 个排队；非 chat provider 默认 8 个执行中、32 个排队 | 这是代码默认值，未核实所有线上覆盖值；重操作需要单独预算，不能用浏览人数直接推算 |
| Travel AI / 航班酒店 | 独立 FastAPI；已有异步 HTTP 连接复用、请求限额和 endpoint deadline | 本轮补共享 AI 调用限额，避免不同 endpoint 同时耗尽上游配额 |
| 浏览器提交任务 | SQL 原子领取、租约与 owner fencing；Fly 按需启动、空闲 120 秒退出 | 共享池配置最多 10 台、每台一次执行 1 个任务；sticky/legacy slot 会占用全局预算。排队任务数可以高于执行中任务数 |

来源为当前仓库配置与源码。只有下面列明的 Supabase 读数来自本轮线上检查；
没有将配置文件当成线上所有运行实例的完整证明。

## 线上只读观察

检查仅查询系统统计和公共状态，不读取申请人资料：

- `max_connections=60`，当时客户端连接 15，active 1（包括诊断活动），
  `idle in transaction=0`，被阻塞 session 为 0。
- `pg_stat_statements` 中匹配公共状态 RPC 的 6 次调用累计约 14.72 秒，
  加权平均 2.45 秒。样本小，不能代表高峰 p95。
- 公共状态 RPC 每次聚合最多 90 天观察记录；原先每个直达后端的请求都会查库。
- 性能 advisor 仍报告 60 项未覆盖外键索引、64 项 RLS InitPlan 建议、
  45 项多重 permissive policy、3 项重复索引。它们是待分析建议，不能仅凭
  advisor 数量批量增删索引或改访问策略。未使用索引也不能据此直接删除。

这一时点没有连接耗尽，不等于高峰不会耗尽。优先降低查询次数，保留 Auth、
PostgREST 等服务的连接余量，而不是直接调高连接池。

## 第一轮落地

### 公共服务状态

`viza-be/agent-backend/src/services/portal-health.service.ts`：

- 同一进程的公共状态读取共享一个正在执行的 RPC，成功结果缓存 10 秒。
- 只缓存现有脱敏公共 RPC 的输出；不缓存申请人、会话或凭据。
- 上游 HTTP 读取在 8 秒后中止，失败返回原有不可缓存 503，下一次请求可重试。
- 探测批次结束后失效缓存；修复通用缓存 `clear()` 后旧请求完成又写回旧值的竞态。
- 失效时未完成的旧 RPC 可与一次新 RPC 短暂重叠，旧结果不再写入缓存；
  两者都有读取超时。多个进程各自维护缓存，不是跨副本的全局合并。
- 原有 HTTP/CDN 缓存仍存在，进程缓存额外最多贡献 10 秒源站数据年龄。

### 公共产品目录

`viza-fe/internal-website/app/api/public/catalogue/route.ts`：

- 使用单键、60 秒、进程内缓存合并发布目录读取。
- 只保留 `isPublicCataloguePayload` 验证通过的已发布目录。
- 读取超时 4 秒，不做隐藏重试；数据库失败不写入缓存。
- 保留原来的 CDN 300 秒缓存及 600 秒 stale-while-revalidate；因此发布更新
  仍有原先的 CDN 传播延迟，进程缓存会额外贡献最多 60 秒源站数据年龄。

### Travel 服务

`tools/openai_client.py` 为 chat、行程生成、修订以及需要生成行程的导出路径
提供共享 AI 并发预算，默认 `TRAVEL_OPENAI_CONCURRENCY=8`。等待和执行仍由
现有 endpoint deadline 约束；另外最多允许 32 个等待者，等待 5 秒仍未获准
执行或队列已满时，进入现有 fallback。取消后释放执行位置。这里只控制本进程，
不能代替多个实例之间或整个 OpenAI 账户的全局配额。

航班/酒店的相同地点 ID 查询也合并执行：分别最多 64 个不同查询执行中，
成功地点缓存分别最多 256 条。共享查询有独立的 10 秒总 deadline，包括等待
上游 semaphore 的时间；某个调用者取消不会取消其他调用者的共享读取，所有
调用者离开后剩余工作也会在 deadline 结束。错误/超时清理后可以再次查询。

## 第一轮验证证据与限制

| 验证 | 结果 | 能证明什么 |
| --- | --- | --- |
| 后端公共状态：100 个同时到达的真实 loopback HTTP 请求，数据库替身 | 全部 200，仅 1 次 RPC | HTTP 路由与请求合并有效，不代表真实数据库承受 100 个独立查询 |
| 后端公共状态：1,000 个同时调用 | 1 次 RPC | 同一实例缓存未命中时消除了相同查询的放大 |
| 后端缓存、状态、readiness 回归 | 24 项通过 | 包括失效竞态、过期刷新、故障恢复、真实 abort signal 和 `/health`、`/ready` 合约 |
| 公共目录回归 | 3 项通过 | 100 个请求 → 1 次读取、错误恢复、60 秒过期刷新 |
| 公共目录浏览器 smoke | 本地接口 200，`entries: []` | 实际 Next.js 路由可访问；未验证真实有内容目录的浏览器展示 |
| Travel 单元回归与编译 | 14 项 unittest、`compileall` 通过 | 请求合并、取消释放、全部等待者取消后的清理、超时后重试、队列饱和与等待 deadline |
| Travel 无凭据本地 HTTP smoke | `/health`、`/ready` 正常；`/generate`、`/flight-options`、`/hotel-options` 返回 fallback | FastAPI 请求路径与现有降级结构兼容；没有发送计费 AI / 搜索请求 |
| 生产公共状态单次只读 smoke | 两次独立首读约 2,740 / 3,606 ms，各自紧随其后的缓存读取低于 1 ms | 真实 RPC 与进程缓存兼容；这是小样本，首读仍较慢，冷请求曾触及较短的试验超时 |

合计 41 项相关回归通过。前端和 agent-backend 类型检查通过，lint 无 error，有原有 warning。
并发用例使用替身，不调用计费 AI、不写业务数据、不触发政府门户。

可重复运行：

```powershell
# 在 viza-be/agent-backend
npm test -- --run src/services/portal-health.service.test.ts src/db/successful-probe-cache.test.ts src/db/supabase-client.test.ts src/app.ready.test.ts
npm run type-check
npm run lint

# 在 viza-fe/internal-website
npx --no-install vitest run app/api/public/catalogue/route.test.ts
npm run type-check
npm run lint

# 在 viza-be/travel-service，使用项目 Python 环境
python -m unittest discover -s tests -p test_concurrency.py
python -m unittest discover -s tests -p test_flights.py
```

## 第二轮：继续优化

第二轮继续沿用现有实例与数据库，不增加付费服务。代码和 SQL 迁移已准备，
以下 SQL 性能数字来自生产库上的只读 `EXPLAIN (ANALYZE, BUFFERS)`，
不是已经替换生产函数后的收益，也不是并发压测结果。

### 公共状态聚合减少重复扫描

当时有 29 个公开监控项、约 16 万条历史观察。原函数的执行计划会分别为
每个监控项计算滚动可用率和每日统计，重复访问历史表。新增迁移
`0190_public_status_aggregate_once.sql` 先按监控项、日期和状态聚合观察，
再生成每日数据、各项可用率和总体可用率；最终计划只扫描一次历史观察。

| 同一生产库，90 天查询的小样本 | 原查询 | 最终候选查询 |
| --- | ---: | ---: |
| 执行时间 | 2,836.089 ms | 2,116.177 ms |
| shared buffer hits | 266,201 | 4,157 |

本次候选用时减少约 25%，共享缓冲区命中次数减少约 98.4%。buffer hits
是累计逻辑页访问次数，不是独立磁盘读取量。采样先后不同、观察记录持续增加，
耗时还受缓存和其他负载影响；这些数字不能外推为整站容量提升比例。

生产只读查询在同一快照中比较旧、新 SQL，返回 `identical_public_snapshot=true`。
迁移保留 1–90 天参数限制、数据库时区的每日边界、滚动可用率时间窗、加权
总体可用率、不可见监控过滤、事故展示与计数窗口，以及原公共 JSON 字段。
没有新增索引或改变表、任务队列及 RLS。

迁移先校验已知函数体哈希、空 `search_path`、返回类型、稳定性和执行权限，
遇到未知版本或权限漂移会拒绝执行。`CREATE OR REPLACE` 保留函数身份和 ACL。
对应 Supabase 镜像为
`20260907001027_public_status_aggregate_once.sql`，两份文件字节一致，已登记
到迁移治理清单；SHA-256：
`5e1f5cf6cbf9e17df73d409e900b56440ad6ed95f9d610e3508ca8b067d64de1`。

### 登录后状态页减少支付读取

`app/client/status/status-data.ts` 将最多三次 `payment_records` 查询合为一次，
按当前会话解析出的 applicant/application UUID 过滤。移除只按共享套餐 ID
读取支付记录的路径，避免相同套餐的其他申请人记录进入 service-role 查询结果。
空范围不查询，非法 UUID 不会进入 PostgREST 过滤表达式。

### Word / PDF 导出限制资源占用

`tools/export_admission.py` 为两种导出共享执行预算：每进程默认同时 2 个，
最多 16 个等待者，等待上限 5 秒。饱和时返回本地化 503 和 `Retry-After: 5`。
生成工作在线程中执行；请求取消后，直到实际线程完成才释放位置，并清理晚到的
临时文件，避免取消请求使实际执行数突破限制。多 worker 的预算分别计数。

### 第二轮验证

- 前端状态相关 15 项回归通过，类型检查通过，lint 只有原有 warnings。
  浏览器访问 `/client/status` 正确跳转登录；尚未完成有登录会话的真实支付展示验收。
- Travel 相关 18 项回归通过（包含第一轮用例）、`compileall` 通过。
  真实线程用例验证取消后位置仍被占用；无 provider 的本地 HTTP 导出 Word/PDF
  均返回 200，产物分别为 37,128 / 13,814 bytes。
- 后端类型检查通过，lint 无 error，只有原有 sentry warning。
- SQL 静态验证 2 项、本地数据库集成 3 项通过。集成覆盖两种时区和七种参数、
  精确日期边界、未来观察、不可见/空/unknown/混合状态、长期未解决事故，
  以及函数 OID/owner/ACL 保留、匿名和普通用户拒绝、service-role 可执行、
  迁移重复执行及权限漂移拒绝。只提供全局 `DATABASE_URL` 时测试会跳过。
  测试使用独立 loopback、显式非生产确认及数据库环境标记，结束后清理测试表。
  本地引擎为临时内存 PGlite PostgreSQL 18.3；未完成原生 PostgreSQL 17 迁移演练。
  生产 PostgreSQL 17.6 上仅执行了只读结果对比与执行计划分析。
- 迁移治理使用工作区文件和两条显式新增记录验证，通过并识别出 2 个新增迁移；
  治理脚本自身 14 项回归通过。直接使用 `--base-ref HEAD` 无法覆盖未提交的新文件，
  不能把该命令的空 diff 当作新迁移通过的证据。

数据库测试入口为
`src/tests/public-status-aggregate-db.integration.test.ts`；需显式设置
`PUBLIC_STATUS_AGGREGATE_DATABASE_URL` 指向空白本地测试库、
`PUBLIC_STATUS_AGGREGATE_DB_CONFIRM=local-test` 和
`PUBLIC_STATUS_AGGREGATE_DB_NONPRODUCTION=true`，数据库还需设置
`app.viza_environment=local-test`。不要将生产连接写入这些变量。

上线前仍需走现有发布流程。生产 SQL 尚未应用，生产代码尚未部署；不能把
本地测试或只读候选计划当作已经在线生效。

## 第三轮：本地容量验证（2026-09-08 继续）

用户确认没有独立测试环境，先完成本地验证。当前连接仅列出生产 Supabase；
本机 Docker daemon 不可用。没有移除压测脚本的环境绑定、生产 URL 拒绝、
synthetic account 校验或持续时间门槛，也没有对生产发送压测请求。

先运行了五组相关本地回归，共 49 项通过：公共状态、探测缓存、readiness、
压测目标标记和在线容量脚本。脚本用例使用本地 HTTP fixture，覆盖 100 个并发
模拟调用、鉴权 Cookie 发送范围、依赖失败、遥测异常、
生产目标拒绝与不完整验收矩阵拒绝。它验证压测工具和现有保护的行为，不能
作为实际 Next.js/Supabase 登录会话容量证明。

```powershell
# 在 viza-be/agent-backend
npm test -- --run src/tests/online-capacity-load.test.ts src/online-capacity-target.test.ts src/services/portal-health.service.test.ts src/db/successful-probe-cache.test.ts src/app.ready.test.ts
```

### 首页按选中申请读取详情

原首页在加载简要 dashboard 的同时，提前读取全部申请的完整状态，随后只显示
其中一个申请的时间线。现在先用 dashboard 确定选中的申请，再调用
`getClientApplicationStatus(applicationId)`；没有申请、没有 profile 或未登录时，
不启动完整状态读取。

`getClientStatusData({ applicationId })` 在已有所有权查询上追加精确 ID 过滤。
它保留本人 profile、本人套餐关联和已提交 SGAC 的邮箱关联兼容路径，后续
八类详情表及实时队列摘要只处理解析出的目标申请；签名下载链接也只为该申请
构建。无合法目标时提前返回，不读取支付或详情。全列表入口继续服务状态选择器
和历史记录；支付与套餐兼容查找仍以当前用户为范围，没有新增用户数据缓存。

首页仍会及时显示简要 dashboard，时间线独立加载；目标消失时清空旧时间线，
迟到的旧请求不能覆盖较新的选择。非法或空申请 ID 不会降级为全量读取。

本地类型检查通过，lint 无 error（原有 62 项 warning）。既有首页、状态选择器、
profile 查询和支付查询相关 27 项回归通过。新增 19 项针对性回归分别验证
所有权和目标读取范围、单应用 action、以及实际 Home 组件的空选择、精确选中
ID 和“先显示旧状态、刷新得到 null 后清空”场景。查询测试使用可执行过滤的
Supabase 替身，包括多 ID 的 OR 过滤以及历史关联付款的兼容结果。

Playwright 验证本地首页及移动宽度状态页都跳转登录页，登录页正常渲染；
本地服务使用 loopback Supabase 配置和合成 key，没有真实已登录数据库展示
验收。浏览器和临时 Next 服务已停止。

### 原生 PostgreSQL 17 验证限制

通过 PostgreSQL 官方 Windows 页面指向的 EDB 下载并解压 17.11 x86-64
二进制；`postgres`、`pg_ctl` 和 `psql` 版本输出均为 17.11。但 Windows
应用控制策略拒绝运行 `initdb.exe`，无法创建测试 cluster。因此本轮没有执行
原生 `public-status-aggregate-db.integration` 或 `online-capacity-db.integration`，
没有原生连接池 p95/等待量可报告。没有安装系统服务、修改全局 PATH 或安全策略，
没有残留数据库进程。第二轮的 PGlite 测试结果仍有效，但不替代此项验证。
续做时尝试删除此次下载的临时目录，自动审批返回 `blocked by policy`；
文件仍保留在 ignored `.dev-logs/concurrency-pg17/`，没有绕过该拒绝。

## 第四轮：申请列表只加载列表数据（2026-09-08 继续）

`/client/status` 原本直接使用完整详情 loader：虽然页面只展示申请选择、状态、
进度和链接，每次访问仍读取所有历史申请的事件、通知和官方追踪详情，并逐个
生成文件下载签名。现在页面调用 `getClientStatusIndexData()`，在相同登录与
所有权检查下构建窄列表结果。

- 有申请时少读 `application_events`、`notification_events` 和
  `official_application_tracking` 三张表；列表页的 Storage 签名调用为零。
- 保留支付、同意、签名、材料、答案、文件包及实时队列摘要，因为它们参与状态
  和进度计算。本人套餐关联、已提交 SGAC 邮箱关联及 package-only 历史仍保留。
- 文件 key 和时间仍在服务端参与状态与排序，避免有确认文件的到达卡被显示为
  未提交；列表返回值不带文件存储路径、官方 reference 或完整详情对象。
- 有结果文件的继续入口指向带 applicationId、country、visaType 和 step=status
  的申请详情页，再由原有鉴权详情流程提供下载。具体详情 loader 默认行为不变。
- applicationId/packageId 查询参数的跳转及未知 ID 时回到完整列表的行为不变。
  没有引入跨请求用户数据缓存，也没有数据库迁移或新增依赖。

这是减少单次页面访问的工作量，不能直接换算为生产可承载人数。浏览器已验证
桌面申请链接和移动宽度国家链接均在未登录时跳转登录页，页面正常渲染。
本地 Next 使用 loopback Supabase URL 和合成 key；浏览器与服务已停止。
已登录列表数据通过本地可执行过滤的 Supabase 替身验证，仍无真实数据库会话
持续压测结果。

本轮相关回归共 56 项通过：36 项首页/列表组件/action/profile/支付既有回归，
13 项共享 loader 回归（其中 3 项新增 index 测试），以及 7 项新增页面测试。
有确认 PDF 但缺少 submitted/reference 的旧 SGAC 记录仍显示为已提交；测试
还核对普通签证的付款、同意、材料、答案、文件包、状态与 71% 进度，批准/拒绝
结果文件、package-only 历史、外部用户和 QA 排除、核心查询失败标记及未登录
无 admin 读取。相同 fixture 下 index 确实少三次表查询，Storage 签名为零；
full detail 仍生成原有签名。类型检查通过，完整 lint 无 error（原有 62 项
warning），两份新增/扩展测试另行用 `eslint --no-ignore` 检查通过。

## 第五轮：超时任务结束后再归还 AI 并发额度（2026-09-08 继续）

发现 `ProviderConcurrencyGate.run()` 原先在请求超时/取消后立即归还额度。
底层 provider 如果尚未响应取消，实际请求会继续运行，后续重试却能使用刚归还
的额度，从而让真实运行任务数超过配置上限。OCR、字段指导、校验和 embedding
调用都已传递取消信号，但取消信号本身不代表底层任务已经结束。

现在调用方仍按原有超时及时收到错误；运行额度、完成计数和执行耗时等到底层
Promise 实际结束才更新。迟到的成功/失败都会被观察并只释放一次，排队者按
先后顺序继续。已获得额度、但执行前被取消的请求不再启动新的 provider 调用。
请求监听器及 gate 自身的 abort 监听器会清理。没有提高 8 个运行/32 个排队的
默认额度，也没有新增服务、依赖或跨请求用户数据缓存。

若某底层操作永久不结束，它会持续占用额度，后续排队者按原有上限和超时收到
拒绝；不能一边释放仍在使用的额度，一边保证真实并发不超限。因此监控的 active
和 execution latency 现在反映实际占用，包括请求已经结束后的清理阶段。

本地五组回归共 19 项通过：gate 12 项、调用接线 2 项、HTTP 请求取消 2 项、
OCR 错误响应 2 项，以及新增真实 OCR HTTP 路由 + 真实 gate 的恢复测试 1 项。
新增 gate 回归包含延迟 resolve/reject、超时后等待、执行前取消和队列交接取消；
50ms 请求超时、底层在 150ms 结束时，执行与排队耗时仍记录完整 150ms。
HTTP 用模拟 provider 验证超时返回 503、排队重试仍为 503 且不启动新任务，
旧任务结束后新请求恢复 200。没有实际 AI 调用、数据库操作或生产流量。
类型检查通过，lint 无 error（原有 1 项 warning）；未部署。

## 第六轮：在解析 OCR 大请求体之前限制并发（2026-09-08 继续）

后端 `/api/passport-scan/extract` 原有 provider gate 在 JSON 解析之后才运行。
突发请求即使最终排队失败，仍可能先解析并保留大块 base64 数据。现在
`src/routes/passport-scan-admission.ts` 在 `src/app.ts` 的两个 OCR 专用解析器
之前执行：每个进程默认允许 4 个 OCR HTTP 请求，环境变量
`PASSPORT_SCAN_MAX_IN_FLIGHT` 可调整，硬上限为 16；非法值使用默认值。

满额直接返回 503、`Retry-After: 2`、`Cache-Control: no-store` 和
`Connection: close`，不进入大请求体解析器，也不增加另一层等待队列。
普通路由不使用这个额度；原有普通 API 1 MiB、OCR 解析器 15 MiB、OCR 路由
base64 字段 8 MiB 限制不变。请求处理完、连接提前关闭或上传中断时只释放一次。
完整上传后的 request `close` 不能提前释放仍在处理的 OCR 请求。
慢速上传仍会占用额度直到连接结束或服务的请求接收超时；本轮没有新增 OCR
专属上传超时。多副本各自持有额度，不形成集群共享上限。

这里的 4 个额度限制 HTTP 请求的解析和处理阶段；响应结束后仍未清理完的
provider 操作继续占用第五轮修复的独立 provider gate。它不是每秒请求额度，
也不是全站用户人数上限，不会让单次 OCR 变快。预期收益是限制突发大请求的
解析和持有数量，减少它们挤占其他功能资源的机会；未测量实际堆内存节省值。

本地新增 8 项回归通过。真实 Express app、解析器和 loopback HTTP 使用模拟
OCR handler，保留 4 个大于 1 MiB 的请求，再发送 96 个重叠请求，验证后者
即使 JSON 无效也直接收到 503，只有前 4 个进入 handler，`/live` 同时返回
200。前 4 个完成后均返回 200，新请求也恢复 200。另验证 4 个未传完的上传
占满额度，中断一个后可进入新请求；格式错误和超限请求不会泄漏额度。
单元测试覆盖配置、重复完成事件、正常上传完成与响应关闭的区别。

与已有 provider gate、调用接线、取消、OCR 错误响应/延迟清理和 readiness
回归合并运行，共 8 个文件、30 项测试通过。类型检查通过，完整 lint 无 error
（原有 1 项 warning）。没有调用真实 AI、数据库或生产接口，没有新增依赖或
付费资源，代码尚未部署。这是过载保护验证，不能当作 100 个 OCR 请求全部
成功或 100 个真实登录用户持续访问的容量证明。

```powershell
# 在 viza-be/agent-backend
npm test -- --run src/app.passport-admission.test.ts src/routes/passport-scan-admission.test.ts src/routes/passport-scan-capacity.test.ts src/routes/passport-scan-draining.test.ts src/routes/request-abort.test.ts src/utils/provider-capacity.test.ts src/app.ready.test.ts src/utils/provider-capacity-wiring.test.ts
npm run type-check
npm run lint
```

调用链核对发现营销网站申请页的 `/api/passport-scan/extract` 代理会调用这个
后端接口；该代理目前不转发 `Retry-After`。内部网站当前组件主要使用独立的
`/api/passport-ocr`，直接读取 Storage 并调用 OpenAI，不经过本轮后端准入层。
后续应单独优化这条活跃路径，并保持文件所有权验证、取消和本地模拟验证；
不能把本轮成果描述为所有 OCR 入口都已受保护。

## 第七轮：内部网站 OCR 并发与取消（2026-09-08）

内部网站当前使用的 `/api/passport-ocr` 现在也有独立准入保护。完成登录和
基本参数验证后，每个 warm function instance 默认允许 4 个请求进入后续
数据库校验、Storage 下载、provider 和审计更新，配置
`PASSPORT_OCR_MAX_CONCURRENCY` 的硬上限为 16。满额不创建 admin client、
不下载文件、不创建提取记录、不启动 AI 调用；直接返回现有错误码
`provider_unavailable`、503 和 `Retry-After: 2`，保留客户端现有重试/翻译
兼容性。忙碌和取消的新文案按 `NEXT_LOCALE` 返回中英文。

准入层没有等待队列或用户数据缓存。所有权条件仍同时限制当前用户的申请和
该申请的证件。下载得到 Blob 后先验证大小和类型，再分配用于 provider 的
Buffer，避免为不支持或超限文件多复制一次数据；Storage 已下载的 Blob 本身
仍占内存，因此这不是流式文件大小硬限制。

请求取消会阻止下一阶段和后续 AI 重试；provider 的单次请求期限覆盖响应体
读取。名额在真实操作和审计清理结束后才归还，不以发出 abort 信号作为完成
证据。当前 Storage SDK 下载接口没有请求级 signal 参数，取消期间的下载仍
等待实际结束并继续占用名额，随后不启动 AI。多实例各自计数，不构成整个
Vercel 项目的共享请求上限，也不保证生产在线人数。

本地 25 项回归通过：provider 19 项、真实 POST handler + 实际 gate 4 项、
上传组件 2 项。合成 100 个重叠调用时只有 4 个进入后续处理，96 个在任何
admin client/DB/Storage/provider 工作前收到 503；已进入的 4 个结束后全部
200，新请求恢复。取消中的 provider 延迟结束时仍占用额度，跨用户申请拒绝、
超限/不支持文件不分配 ArrayBuffer、成功仍需用户确认都已验证。provider
覆盖响应头之后的读取超时、取消后无重试、迟到结果丢弃和无效 JSON 不重复
收费调用。所有数据和外部依赖均为本地替身。

前端类型检查通过（检查进程临时使用 4 GiB Node 堆），完整 lint 无 error
（原有 62 项 warning），新增/扩展测试用 `eslint --no-ignore` 检查通过。
真实 Next.js 本地 `/api/passport-ocr` 未登录 POST 返回 401/private no-store，
浏览器 `/client/application` 跳转并正常渲染登录页；本地服务使用 loopback
Supabase 和合成 key，OCR provider 关闭，随后停止。后端生产 build 通过，
第五、六轮对应的 30 项测试和类型/lint 证据见上文。未执行真实登录持续压测。

### 发布准备

本轮用户已明确要求部署。只读核验确认 Vercel CLI 使用 VIZA 组织账号，目标
为 `viza-internal`、team `team_pC3NgoVZbeD6QxTuS1o2E6Hg`，项目根目录
`viza-fe/internal-website`，生产函数区域仍为 `bom1`。发布前的生产 deployment
为 `dpl_jL72fmuhv27xjEeqo4HeWbgBLS1p`，别名 `app.viza.it.com`。
Render `/health` 已报告 `7fc62a9e2c7b0e6320ceacc42d4be6382e8bc23a`，证明前四轮
已提交的后端版本已上线；第五、六轮后端改动仍需本次发布。

CLI dry run 发现原上传清单包含本地浏览器测试产物、临时文件和旧 `.next`
缓存。根 `.vercelignore` 现已排除这些目录及 MCP 配置，在任何层级排除
`.dev-logs`、`.playwright-cli`、`output`、`.next*`；再次 dry run 验证相关
本地产物和环境文件在清单中为零。没有删除这些本地文件。

代码提交 `967f03251efff1a931120a72007fcdce4dc75e5d` 已推送 `main`。
首次 Vercel candidate `dpl_8qhvJJP4YzhUhmx1XTaw9wEP5xah` 被平台阻止：
本机原 Git 提交作者不是该项目允许的发布账号；其状态为 `BLOCKED`，未切换
域名。保留原作者及代码提交，以已经通过 Vercel `/v2/user` 验证的 VIZA
组织身份创建独立发布记录后再发布。该记录是自动化发布操作，不代表人工审阅；
不改写历史、不调整团队成员权限，也不修改本机持久 Git 身份设置。

### 发布完成与线上验证

- 实现提交：`967f03251efff1a931120a72007fcdce4dc75e5d`；组织身份发布记录：
  `f4092d24`。二者均已推送 `upstream/main`。
- Vercel candidate `dpl_8vmDESv87x64Ya9dgfDCWRfThsLL` 通过身份校验、生产
  构建和页面生成，达到 `READY`。切换前验证 `/client/login` 为 200，匿名
  `/api/passport-ocr` POST 为结构化 `unauthorized` 401。
- 已执行 `vercel promote`。再次从 `app.viza.it.com` 解析部署，确认目标就是
  `dpl_8vmDESv87x64Ya9dgfDCWRfThsLL`、`production`、`READY`；部署 URL 为
  `https://viza-internal-18ifyz7yj-viza-gmail-s-projects.vercel.app`。线上匿名
  登录页为 200，OCR POST 为 401，响应包含 `Cache-Control: private, no-store`。
- 浏览器现有登录会话访问生产登录页后转到 `/client/home`，首页完成加载，
  申请导航可见，无未处理错误页面。仅检查页面状态，没有输出用户资料、
  上传文件、启动 OCR 或修改申请；临时浏览器页已关闭。
- Render `/health` 报告实现 SHA `967f03251efff1a931120a72007fcdce4dc75e5d`；
  `/live`、`/ready` 均为 200，空 `/api/passport-scan/extract` POST 为 400。
  这确认第五、六轮后端改动已上线；文档提交不影响该服务的实现内容。
- 沿用已有套餐、实例和函数配置，没有新购资源或升级。没有应用数据库迁移，
  也没有执行生产并发压测或真实 provider 调用。当前上线证据仍不等于 100 个
  登录用户持续访问或大规模真实 OCR 的容量认证。

上一版前端 deployment `dpl_jL72fmuhv27xjEeqo4HeWbgBLS1p` 已记录，可用于
现有回滚流程。首次被阻止的 candidate 未进入生产。

## 第八轮：接通提交状态的稳定退避与页面可见性控制

本轮定位到一个实际调用缺口：`submission-status-poll.ts` 已定义成功快照稳定时
5/10/20/30 秒退避，但 `SubmissionStatusStep.tsx` 只传入失败次数，导致正常
等待中的页面一直每 5 秒调用一次状态接口。该接口每次仍需认证、读取申请与
队列，部分流程还需读取共享 runner 状态；没有文件签名或写操作可直接移除。

- 主轮询现在比较规范化后的状态、进度、消息、结果、错误及队列信息，连续
  不变时按现有规则退避，最大 30 秒。收到实际变化后恢复 5 秒间隔。
- 申请/队列更新时间和 worker heartbeat 时间变化不重置退避；仍将完整新
  快照交给现有展示逻辑。结果与二维码路径保留在比较范围，继续接收迟到结果。
- 页面隐藏时清除待执行计时器，已有请求可以完成但不再安排下一次请求；
  返回页面时立即刷新；旧请求未完成时合并为一次待刷新请求，等它结束后立即
  执行，避免并行请求或丢失返回前台的刷新。
- 保留认证失败停止、组件卸载取消、重试任务身份及终态规则。人工操作状态
  继续轮询，以免外部操作完成后无法更新。未修改官方 runner、状态接口、
  数据库、页面样式或用户操作入口。

稳定阶段从每个页面每分钟约 12 次状态请求降至 2 次，减少约 83%；隐藏页面
不再发起新状态请求。代价是持续前台等待时，状态变化可能在下一次最长 30 秒
的轮询才被发现（不含网络耗时）；切回页面会主动刷新。此数字仅描述该轮询
路径，不代表整个网站的数据库负载下降比例或生产可承载人数。

### 本地验证

现有轮询策略、入境卡、美签、英签与通用结果组件测试共 43 项通过，新增实际
组件时序测试 22 项通过（合计 65 项）：覆盖稳定退避、真实状态/结果/队列变化
重置、时间戳不重置、隐藏/恢复、慢请求合并、卸载取消及 401 停止。
新增测试单独使用 `eslint --no-ignore` 检查通过。
最终前端 `type-check` 通过（Node heap 4 GiB），`lint` 为 0 错误、62 项原有警告。

浏览器访问本地
`/client/application?country=germany&visaType=schengen_c` 正确跳到登录页，
匿名状态 API 返回 401。本地运行使用虚构凭据和本机服务地址，没有访问生产
数据库或官方提交服务。测试服务器与临时标签页已关闭。

### 第八轮发布完成

- 实现提交 `0e67800e1b0a544ab587c01d9478014cf31e21a8` 已推送 `upstream/main`。
  发布前再次通过 Vercel `/v2/user` 确认组织账号 `nanan.viza2016@gmail.com`，
  项目 `viza-internal`、团队 `team_pC3NgoVZbeD6QxTuS1o2E6Hg` 和 frontend
  rootDirectory 均与现有配置一致。自动化提交使用同一已验证组织发布身份。
- CLI 上传 dry run 共 1,980 个文件，受排除规则保护的环境文件、MCP 配置、
  本地浏览器产物、测试日志、临时目录和构建缓存均为零；实际组件已包含。
- Vercel deployment `dpl_CUP7WmNVsGJqD4pyJMekfCSc8Jh7` 完成生产构建和
  127 个页面生成，达到 `READY`。切换前登录页为 200，匿名状态读取为 401。
  已执行 promote；从正式域名 `app.viza.it.com` 再次解析确认就是该 deployment，
  `target=production`、`readyState=READY`。
- 线上匿名登录页 200、状态接口结构化 401。浏览器现有登录会话成功转到
  `/client/home` 并完成加载，申请导航可见，没有未处理错误页面；没有创建申请、
  执行提交或读取/输出申请人资料。临时浏览器页已关闭。
- 本轮只改客户端轮询，后端服务没有代码变化；Render `/health` 为 `ok`，
  仍报告上轮实现 SHA `967f03251efff1a931120a72007fcdce4dc75e5d`。
- 沿用现有资源与套餐，没有数据库迁移、生产压测或真实 provider 调用。
  持续登录并发与真实在途提交的容量验收仍须隔离测试环境。

部署 URL：`https://viza-internal-gx6p4x83r-viza-gmail-s-projects.vercel.app`。
上一版 `dpl_8vmDESv87x64Ya9dgfDCWRfThsLL` 保留用于现有回滚流程。

## 第九轮：取消请求后的数据库恢复探测释放

本轮检查共享 Supabase fetch 包装层时发现：熔断保护在冷却结束后只允许一个
恢复探测，但原实现仅在成功或网络故障时释放探测标记。请求被取消、重试等待
被取消或发生其他异常时，标记可能永久占用，使同一进程/浏览器上下文后续请求
一直被拒绝，即使数据库已经恢复。

- 每次放行的请求现在持有独立 permit；fetch 包装层在所有退出路径中结算或
  释放，释放本身不宣告数据库恢复，也不增加数据库故障次数。
- 熔断周期隔离旧请求：故障前发出的请求，其迟到成功、失败和清理不能改变
  新一轮恢复探测的状态。重复结算只生效一次。
- 外部取消保留原始 reason，即使 reason 是 `TimeoutError` 或 `TypeError`，
  也不会触发网络故障统计、重试或被转换为可重试 503。
- 同时识别 `Request.signal` 与 `RequestInit.signal`；请求已经取消时不取得
  探测名额、不发 fetch。取消后等待实际 fetch 或重试等待结束再释放 permit。
- 保留原有故障阈值、20 秒冷却、只放行一个恢复探测及只重试幂等读取的规则。
  不增加正常请求的并发上限、不缓存用户资料，不改权限、数据库或套餐配置。

这修复的是故障恢复时的可用性和请求堆积风险，不是正常吞吐率的提升测量。
没有给状态 API 的所有服务端查询新增请求取消传递，也没有改变 fetch 收到
响应头后的 body 读取超时边界；这些不属于本轮完成内容。

### 第九轮本地验证

熔断器单测 9 项通过，包含 100 个恢复竞争请求中只放行 1 个、99 个被保护机制
拒绝，取消后允许新探测，以及旧请求迟到/重复结算的隔离。该测试只模拟保护
机制，不代表 100 个已登录用户的持续容量认证。

浏览器本地登录页正常显示，未登录访问 `/client/home` 正确跳回登录页。
本地运行使用本机服务地址和虚构凭据，没有修改或压测生产数据库；测试服务
与临时页面已关闭。

最终共享 Supabase 测试共 35 项通过（熔断 9、fetch 包装层 23、环境规范化 3）。
包含 fetch 进行中取消、503 重试等待中取消、任意取消 reason、非网络异常、
底层请求忽略取消时仍持有探测名额、100 个请求的恢复竞争和随后恢复成功。
所有依赖均使用本地 fake fetch，没有调用生产服务。前端 `type-check` 通过
（Node heap 4 GiB），全量 lint 为 0 错误、62 项原有警告，修改的 runtime 与
测试文件单独使用 `eslint --no-ignore` 检查通过。

### 第九轮发布完成

- 实现提交 `b51b20511a76c36fab748b57edc0acb7ce86988b` 已推送 `upstream/main`。
  已核验 Vercel 当前组织账号为 `nanan.viza2016@gmail.com`，项目仍是 VIZA
  团队下的 `viza-internal`，根目录仍为 `viza-fe/internal-website`。
- 上传前 dry run 共 1,980 个文件，两份修改的 runtime 均在清单中，环境文件、
  MCP 配置、本地测试产物、日志和构建缓存的泄漏项为零。
- Candidate `dpl_Hs1HUfPGisac6yZgRcA6nojcD2iB` 完成生产构建及 127 个页面
  生成，达到 `READY`。切换前登录页 200、匿名状态接口 401，随后完成 promote。
- 从正式域名 `app.viza.it.com` 重新解析确认 deployment 正是
  `dpl_Hs1HUfPGisac6yZgRcA6nojcD2iB`、`target=production`、`readyState=READY`。
  线上登录页 200、匿名状态读取仍为结构化 401。浏览器现有登录会话正常转到
  `/client/home`，数据加载结束、申请导航可见，没有未处理错误页面。没有输出
  申请人资料或触发提交/支付，临时浏览器页已关闭。
- 本轮没有修改 agent-backend；Render `/health` 为 `ok`，仍报告其当前实现
  `967f03251efff1a931120a72007fcdce4dc75e5d`。未新增付费资源或应用数据库迁移，
  未对生产注入故障、触发恢复竞争测试或执行持续压测。

部署 URL：`https://viza-internal-32eoioajp-viza-gmail-s-projects.vercel.app`。
上一版 `dpl_CUP7WmNVsGJqD4pyJMekfCSc8Jh7` 已记录供现有回滚流程使用。

## 第十轮：状态读取的请求级取消与截止时间

状态轮询 API 原来用 `Promise.race` 在 8 秒后返回 503，但认证与数据库读取
仍可能继续运行。本轮将同一个取消信号传给整个只读请求：浏览器断开或总计
8 秒截止时间到达时，取消已发出的 Supabase Auth/REST 请求和重试等待，并在
profile、application、queue/runner 读取之间检查取消，防止启动后续查询。

- `createClient` 和 `createAdminClient` 可选接收 `requestSignal`；共享 fetch
  包装层将其与每次调用的 signal 合并，单次读取取消不会误取消同一客户端的
  其他请求。取消不计入数据库故障，也不触发重试；原有熔断 permit 清理保留。
- Node 原生 signal 合并保持取消信号与响应 body 相连，即使服务器已经返回
  headers，整体截止时间或浏览器取消仍可中止 body 读取。每次 fetch 的原有
  独立超时仍止于 headers；旧浏览器缺少 `AbortSignal.any` 时保留原有兼容路径。
- Vercel 只为 `app/api/applications/*/submission-status/route.ts` 开启
  `supportsCancellation`，该 glob 在当前仓库只匹配一个状态读取路由。
  Next `after()` 仅等待已经启动的请求完成取消清理，避免客户端断开后执行环境
  提前回收；它不会另起查询或后台任务。
- 客户端取消在应用侧返回 499；整体超时/上游不可用仍返回可重试 503 和
  `Retry-After: 3`。已取消请求等待实际操作结算，不用响应超时掩盖仍运行的
  操作。权限检查、状态映射与用户数据不缓存的规则保留。

这是减少无用请求占用的改动，没有提高机器或数据库额度；HTTP 取消不能证明
PostgreSQL 已经执行的语句立即终止。本地测试也不代表生产持续登录容量认证。

### 第十轮本地验证

相关测试 121 项通过：共享 fetch 30、熔断 9、环境解析 3、真实 SDK/本地 HTTP
集成 2、实际 GET 生命周期 8、状态映射 40、客户端轮询 29。

真实 SDK 集成测试只连接临时本机 HTTP 服务：服务器先返回 200 headers 和
部分 JSON，再保持连接；取消信号使单个及两个并行 REST 读取的连接都提前关闭，
没有继续重试。GET 测试覆盖预先取消、Auth fallback、读取阶段取消、8 秒截止
时间、并行 queue/runner、ownership 403、正常状态脱敏，以及底层模拟查询忽略
取消时等待其结算和 `after()` 清理。所有依赖均为虚构数据，无生产服务调用。

本地 Next 运行使用虚构凭据与本机服务地址。浏览器访问
`/client/application?country=germany&visaType=schengen_c` 正确跳到登录页，
匿名状态 API 返回结构化 401，验证实际 Next 请求上下文可执行新增的 `after()`。
临时服务与浏览器页已关闭。前端 `type-check` 通过（Node heap 4 GiB），全量
lint 为 0 错误、62 项原有警告；本轮修改的 runtime 与新增测试均单独通过
`eslint --no-ignore`。没有增加依赖或调用真实 provider。

## 下一步容量验收

1. 按每轮发布记录区分已上线实现与尚未应用的候选 SQL，观察错误率、缓存首读、
   DB 等待、事件循环和内存。
2. 在隔离环境执行已有 `npm run load:online-capacity`，先测 100 个在线会话；
   登录后的读路径使用 `authenticated_sustained_read_only` 场景，至少持续五分钟。
   不应移除该脚本的非生产标记和 synthetic account 检查来压测生产。
3. 单独验证 100/300/600/1,000 的 runner claim/settlement 场景
   `npm run load:concurrency`；这测试数据库队列，不等于有 1,000 个浏览器同时提交。
4. 第二轮已完成公共状态 90 天聚合的 `EXPLAIN` 分析与候选 SQL；迁移上线后
   观察真实 RPC 的耗时和缓存首读。针对热查询逐项验证 RLS InitPlan 建议及
   跨用户隔离，避免批量更改策略。
5. 核对共享 runner 的显式唤醒链路。恢复 workflow 每 30 分钟运行，正常入口
   的即时唤醒失效会放大排队时间。legacy 默认并发 10 在单机上可能造成浏览器
   内存竞争，应该先小规模测量，再设安全值；本轮未盲目调高或调低生产 cap。

只有普通页面、登录后数据读取、AI、导出与提交分别通过与预期流量匹配的
持续测试，才能给出可承诺的在线人数。当前证据不能作出千人生产容量保证。

## 参考

- [Supabase 连接预算](https://supabase.com/docs/guides/database/connection-management)
- [Supabase 请求取消](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal)
- [Vercel 函数取消与清理](https://vercel.com/docs/functions/functions-api-reference)
- [Next.js after](https://nextjs.org/docs/app/api-reference/functions/after)
- [RLS InitPlan advisor](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [外键索引 advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [PostgreSQL 17 CTE 与物化](https://www.postgresql.org/docs/17/queries-with.html)
- [PostgreSQL 17 执行计划与 BUFFERS](https://www.postgresql.org/docs/17/using-explain.html)
- [PostgreSQL Windows 二进制入口](https://www.postgresql.org/download/windows/)
- [EDB PostgreSQL 二进制下载](https://www.enterprisedb.com/download-postgresql-binaries?lang=en)
- [Node.js HTTP 请求与响应生命周期](https://nodejs.org/docs/latest-v24.x/api/http.html)
- 仓库：`docs/infra/1000-user-concurrency-roadmap.md`、
  `viza-be/agent-backend/AGENTS.md`、`viza-be/submission-service/AGENTS.md`。
