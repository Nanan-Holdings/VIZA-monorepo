# RAG 参数实验 — 2026-09-14

本实验使用仓库公开 country seeds 和真实 `text-embedding-3-small` 1536 维向量，比较 top-k、cosine similarity threshold、分块大小与 overlap。评测问题是 agent 策划并核对原文的合成数据，不是生产用户日志或人工用户标注。这里的最佳配置仅指给定测试集、候选网格和评分规则中的结果。

## 最终决定

**三轮候选都未通过独立验证，未找到足够可靠的新默认值。** 当前继续使用 `top-k=5`、`minSimilarity=0.03`、原始语义 chunk；这些是保留的基线，不能写成“已证明的最佳参数”。两轮 945 组联合比较和最后 135 组保守比较，共使用 122 条合成问题和 4,911 个真实 embedding 输入，累计成功 API receipt 为 998,260 tokens。离线缓存重跑不增加 API 调用。

本次采用的代码改动是修复阈值被 REST fallback 绕过、集中校验可配置参数、共享运行时与评测过滤规则、建立可复现的实验，以及增加显式 staged chunking 入口。没有发布应用、改写线上索引或推广失败候选。

随后按“证明最优”的要求，另做了[穷尽最优性分析](rag-retrieval-optimality.md)：将全部 122 条已见题合并，覆盖 7 种分块、k=1～12 与 `[0,1]` 内全部阈值状态，共 122,064 个组合。要求所有标注证据完整召回后，主目标最优是 `400/80、k=7`，阈值的主目标并列区间约为 `(0.29411,0.30352]`。这是有明确范围的经验最优证明，不是新的独立验证，运行时决定保持不变。[独立证书](rag-retrieval-optimality-certificate.json)保留各方案最优值、并列区间和复现指纹。

## 第一轮：拒绝开发集最高分配置

[原始数据](rag-retrieval-queries.json) 有 72 条中英文问题，42 条用于开发、30 条保留验证。正例都包含可核查的原始 chunk ID 和连续证据原文；正例来源在两个 split 之间隔离。

开发集选出 `k=4 / threshold=0.55 / 400 字符 / overlap=0`。保持已有索引时，开发集候选是 `k=3 / threshold=0.55 / 原始语义 chunk`。两者在保留集都漏掉了 3 个可回答问题，因此均未采用。

| 第一轮保留集（21 正例、9 负例） | 原始 5 / 0.03 | 400 字符候选 | 原始 chunk 候选 |
| --- | ---: | ---: | ---: |
| 证据召回率 | 100% | 85.71% | 85.71% |
| source precision | 25.08% | 40.48% | 41.27% |
| 正例 macro F2 | 0.6168 | 0.6791 | 0.6757 |
| 无答案问题误召回率 | 77.78% | 44.44% | 44.44% |
| 平均取回上下文字符数 | 3,328.8 | 1,417.6 | 1,260.0 |

减少上下文和误召回不能抵消这些漏答。完整失败记录保留在 [round-one results](rag-retrieval-results.json)，没有用后续结果覆盖它。

## 第二轮：较低阈值仍有漏答

第一轮失败后，原来的全部 72 条问题转为开发数据。另行编写、未参与此前选参的 [confirmation queries](rag-retrieval-confirmation-queries.json) 才是第二轮保留集；其正例来源与原数据隔离。新的准入标准要求保留集证据召回率不低于基线，F2 不降低，无答案误召回率不增加。不能把第一轮原保留集继续称为未见数据。

第二轮结果和最终代码决定见 [confirmation results](rag-retrieval-confirmation-results.json)。

| 第二轮新保留集（20 正例、10 负例） | 原始 5 / 0.03 | 400 字符、overlap 80、4 / 0.45 | 原始 chunk、3 / 0.45 |
| --- | ---: | ---: | ---: |
| 证据召回率 | 100% | 90% | 97.5% |
| source precision | 40.33% | 49.17% | 45% |
| 正例 macro F2 | 0.7544 | 0.7564 | 0.7708 |
| 无答案问题误召回率 | 100% | 50% | 50% |
| 平均上下文字符数 | 2,403.9 | 1,770.5 | 1,631.9 |

原始 chunk 候选漏掉一条联合问题的一项必要证据；全局分块候选的漏答更多。两个候选均未满足零召回损失条件。

## 第三轮：保守余量也未通过

前两份共 102 条数据全部转为开发集，使用新编写的 [20 条问题](rag-retrieval-robust-queries.json) 做最后一次独立确认。保留语义分块，仅比较 135 个 k/threshold 组合；开发集还要求在 `k-1、threshold+0.05` 下仍能完整召回全部正例证据，避免选择紧贴开发集边界的参数。这是明确的保守策略，不是测得的通用常数。

它选出 `k=6 / threshold=0.40`，但 [最终验证](rag-retrieval-robust-results.json) 仍失败：

| 第三轮新保留集（14 正例、6 负例） | 原始 5 / 0.03 | 候选 6 / 0.40 |
| --- | ---: | ---: |
| 证据召回率 | 100% | 78.57% |
| source precision | 44.76% | 35% |
| 正例 macro F2 | 0.7783 | 0.6247 |
| 无答案问题误召回率 | 100% | 50% |
| 平均上下文字符数 | 2,844.6 | 1,620.2 |

三个漏答是保加利亚申根路线、爱沙尼亚受理渠道、马尔代夫旅游入境范围的中文提问。前两题在 0.40 下返回空集，第三题只取回了另一条入境材料信息。来源原文确实在语料中，原配置能覆盖 gold。这个结果说明较高的统一绝对阈值无法可靠保留这批跨语言、跨国家的相关证据；本次不再重用验证集挑选“通过”的数字。

14 条正例、6 条负例的最终样本仍很小。报告中的 bootstrap 区间、平均分和拒绝决定应一起阅读，不能将一次通过或失败扩展成生产用户总体结论。

## 实验方法

- 语料：61 个 country seed 文件、159 个 documents、559 个原始 chunks；这是文件快照，不是线上 active release 计数。
- 网格：`k ∈ {1,2,3,4,5,6,8,10,12}`；threshold 为 `0,0.03,0.1,0.15,...,0.7`，共 15 个值。
- 分块：保留原有语义边界；或按 400 / 800 / 1600 个 Unicode code points 分块，分别测试 0% 和 20% overlap。七种分块方案共 945 组配置。这里不是 tokenizer token 数。
- 不跨原始 seed chunk 合并。优先段落和句子边界；每个片段保留生产摄入所使用的 title、country、visa type、source、URL 和 tags，因此测量的是带实际 metadata 的完整摄入方案。分块后 metadata 重复带来的相似度与上下文成本也计入结果。
- 与运行时共用 country/product alias 和 intent filters。显式 document-type filter 不放宽；隐式 intent 无匹配时允许原有 broad retry。使用 exact cosine 排序，模拟 SQL `1 - cosine_distance >= threshold`；不模拟 ANN 索引近似误差。
- 证据召回要求取回片段的原文区间并集完整覆盖证据，不能用 parent ID 命中代替文本覆盖。相邻片段可共同覆盖，存在缺口则不算。source precision 按去重后的国家/parent source 计算，防止 overlap 片段重复加分。F2 更重视召回；MRR 使用证据来源的首次出现位置。
- 选参只看开发集：满足召回下限后，最大化 `0.7 × 正例 macro F2 + 0.3 × 负例拒答率`。同分按更少上下文、更小 k、更低 threshold 排序。权重是显式产品取舍，不是测得的自然常数。
- 第一轮允许开发/保留集最多 2 个百分点召回下降；第二轮收紧为不允许下降。全局分块候选和兼容现有索引的候选都在读取保留集分数前选定，保留集只决定是否准入，不能用于重新挑参数。
- 第三轮沿用零召回损失要求并增加上述参数余量，只评估语义 chunk。跨 split 同时检查原始 source parent 和规范化 query 文本重复；最后两条日常负例在跑分前替换了与旧数据重复的提问。
- 报告记录数据、语料和实际向量的 SHA-256，以及成对 query bootstrap 区间。区间只反映该小型合成样本的波动，不是对生产用户总体的统计保证。

## 实现与运行边界

`visa-knowledge.service.ts` 之前会在成功向量查询没有匹配时，继续返回未经相似度筛选的 REST rows，绕过 threshold。现在这种情况返回空集合和 `no_similarity_match`。仅 embedding 不可用或向量请求失败时保留原有 REST 降级；本实验不把这种未排序降级伪装成向量命中。

摄入和实验共用同一个 embedding 文本构造器，保持既有 8,000 UTF-16 字符截断行为。实验分块器不会自行更新任何数据库或发布知识版本。字段辅助会增补 query 并按卡片/回复截断 context，因此显式保留原有 `5 / 0.03`，等待该独立输入与上下文链路的评测；应用验证接口独立的 B211A RPC 也使用原有参数。本实验不宣称这两个独立调用链已经调优。

本轮没有评测生成答案的真实性、LLM 延迟、真实用户流量、线上 active release 或 pgvector ANN 的召回/延迟。无答案误召回率不是幻觉率。上下文长度包括 metadata，按 JavaScript UTF-16 长度计，是上下文用量的代理指标。API receipt 的延迟是 embedding 批请求延迟，不能作为聊天延迟。

source precision 不是逐片段 precision：同一来源只计一票，其完整证据以外的片段不会增加相关票数，但仍计入上下文成本。数据不是穷尽式相关性标注；没有标为 gold 的其它来源可能也能提供部分有用信息。负例中的实时信息缺失和无关问题也不能代表全部生产流量。

## 复现

从 `viza-be/agent-backend` 运行：

```powershell
npm run eval:rag-retrieval -- --live
npm run eval:rag-retrieval -- --cached
npm run eval:rag-retrieval -- --confirmation-live
npm run eval:rag-retrieval -- --confirmation-cached
npm run eval:rag-retrieval -- --robust-live
npm run eval:rag-retrieval -- --robust-cached
```

`--live` 系列只向 OpenAI embeddings API 发送公开 seed 文本和合成 query，不调用生成模型、不读写数据库。使用本地已有 `OPENAI_API_KEY`，不将密钥写入报告。每批 32 个输入、40 秒超时；HTTP 429/5xx 最多三次尝试。网络超时直接退出，已完成批次可从缓存恢复。单次缺失输入上限 10,000 条、8,000,000 UTF-16 字符。

向量缓存位于被 Git 忽略的 `.tmp/rag-eval/embeddings.json`，按模型和输入内容复用。`--cached` 不发起 provider 请求；缓存缺失会失败，不能用假向量替代。JSON 中的 provider usage 是该缓存累计真实 receipt，包含准备阶段，不应误读为每次重跑的成本。

CLI 用独占 `.tmp/rag-eval/run.lock` 拒绝并发读写实验。异常退出留下的 lock 只能在确认前一个进程停止后删除。`--prepare-live` 可预嵌入七种语料方案；第三轮本身只读取语义分块向量。

摄入分块预览示例（不发起 provider 请求或数据库写入）：

```powershell
npm run ingest:country-visa-rag -- --country japan --dry-run --chunking chars-400-overlap-0
```

默认 `seed-semantic` 保持原始内容和哈希；显式分块时内容哈希包含分块策略。实际摄入必须使用新 staged release，并单独验证/发布，不能从本次失败的离线候选直接推导发布决定。

## 验证记录

- 相关 41 个单测通过；覆盖阈值空集、真实请求失败降级、取消、配置范围、分块/overlap、证据区间并集和数据泄漏检查。
- backend type-check、实验/摄入脚本的单独 TypeScript 检查通过；lint 无错误，包内有一条既有 Sentry unused-disable warning。
- 现有 Visa Agent 规则评测 1,373 项通过。Field Guidance 9,216 项通过，但运行模式明确关闭生成 AI 和 retrieval，不能将它们计为检索准确率证据。
- `/client/chat` 本地 HTTP smoke 正常跳到 `/client/login`；本地 3002 后端没有运行，未完成在线 `/health` 或登录后的完整聊天测试。
- 本次所有向量比较在本地完成，没有改写知识库、发布 release、修改业务数据或部署应用。

检索语义参考：[Supabase semantic search](https://supabase.com/docs/guides/ai/semantic-search)；向量 API 参考：[OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings)。
