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

## 下一步容量验收

1. 通过现有发布流程上线这些代码，先观察错误率、缓存首读、DB 等待、事件循环和内存。
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
- [RLS InitPlan advisor](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [外键索引 advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [PostgreSQL 17 CTE 与物化](https://www.postgresql.org/docs/17/queries-with.html)
- [PostgreSQL 17 执行计划与 BUFFERS](https://www.postgresql.org/docs/17/using-explain.html)
- [PostgreSQL Windows 二进制入口](https://www.postgresql.org/download/windows/)
- [EDB PostgreSQL 二进制下载](https://www.enterprisedb.com/download-postgresql-binaries?lang=en)
- 仓库：`docs/infra/1000-user-concurrency-roadmap.md`、
  `viza-be/agent-backend/AGENTS.md`、`viza-be/submission-service/AGENTS.md`。
