# B1/B2 DS-160 逐项复核（2026-09-22）

范围为 B1/B2。此轮把“页面控件组已覆盖”进一步拆成字段、具体控件 ID、条件正反侧和重复行证据。
整页被访问不等于其中每个字段的 selector、答案限制和服务器校验均已证明一致。
`officialParityVerified` 仍为 `false`，不以一份真实申请成功替代所有分支的验证。

## 本轮确认并修复的差异

| 项目 | 原实现 | 官网证据 / 修复 |
| --- | --- | --- |
| 照片上传 | 当前长表单使用 DocumentCenterClient；旧 PhotoUploadStep 的限制未覆盖实际入口 | 当前入口、服务端上传、复用私人资料文件统一检查 JPEG、≤240 KiB、600–1200 像素正方形、8-bit/3-component JPEG frame |
| 具体行程 | 六个抵达/离境字段在 seed、数据库和 runner 中仍是 repeat；前端用 max=1 暂时限制 | 当前 CEAC DOM 仅一组抵达/离境控件；移除 active repeat metadata，保留旅行目的及计划地点重复组。历史后缀答案保留，不作为额外官网行提交 |
| 前配偶数量 | select 仅允许 1 / 2 | `tbxNumberOfPrevSpouses` 为 maxlength=2 的文本输入；改用两位正整数输入。DOM 长度并非全部服务器合法范围的证明 |
| 婚姻如何结束 | 单行 text | `DListSpouse_ctl00_tbxHowMarriageEnded` 为 4000 字符 textarea；改为多行说明框 |
| 当前工作头衔 | 旧证据索引称其为兼容字段，但 seed 与生产库没有隐藏标记 | 添加 `legacy_compatibility_only`；保留已保存答案及兼容别名。以往工作的 Job Title 独立保留 |
| 性别控件 | radio | `ddlAPP_GENDER` 为 select；同步控件类型，保留男女值和现有答案 |
| 条件说明框 | 三个条件说明字段按单行 text 建模 | CEAC fresh DOM 将婚姻状态 OTHER、护照类型 OTHER、当前职业说明显示为 `textarea`，最大长度均为 4000；同步 seed、contract、runner mapping 和 0205 元数据迁移 |
| 配偶出生日期 | Family2 配偶日期按单一值映射 | CEAC Family2 使用独立的日、月、年控件；runner 与日期派生改为拆分写入，并用年-only 与完整日期路径在官网继续按钮验证 |

照片技术校验不认证人脸、构图、sRGB profile、压缩比或领馆最终接受性。
官方规范：[Digital Image Requirements](https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/digital-image-requirements.html)。

## 本轮浏览器观察

- CEAC → Test Photo → Identix：使用用户此前已授权并已提交的同一照片，质量结果为 **Photo passed quality standards**，随后可 Continue 返回 CEAC。
  观察时间 `2026-09-21T22:15:02.884Z`（本地 2026-09-22），结果页路径 `https://identix.state.gov/qotw/Result.aspx`。
  不保存结果页带会话参数的 URL、不公开照片。这补上独立照片成功路径；旧报告的 HTTP 503 是历史故障，不是当前状态。
- 实际 DocumentCenterClient 的 production build，上传 action 使用本地 mock：错误格式、超 240 KiB、600×601 文件均显示中文错误且 upload 调用数保持 0；600×600 JPEG 进入 upload 恰好 1 次，locale 为 zh，控制台 error 为空。
  技术测试 JPEG 仅在本地使用，没有向 CEAC 提交合成照片。
- 实际长表单 production build，后端用本地合成数据：具体计划 No→Yes 显示一组到达/离开字段；地点可新增第二行；Yes→No 隐藏实际行程并显示预计停留；再切 Yes 仍只有一组。
- 离婚分支：人数可输入 3，新增到三位前配偶后每行有独立 textarea；填入三行测试姓氏后，人数与已填写行数不一致提示消失。
- 性别控件：已有 male 答案在下拉框显示“男”，女→男切换与回切正确；官方 M/F 提交映射保留。
- 照片发布后，生产真实申请页面加载正常，212 个表单控件均处于禁用或只读状态（包括祖先 fieldset 的 disabled），确认页 PDF 下载入口可用，浏览器 error 为空。
  生产部署最近十分钟 error 请求日志查询为空。本轮不改写已提交申请、不重复递交。

## 2026-09-22 fresh browser 增量证据

本节只引用 [fresh point-check delta JSON](./ds160-live-evidence-delta-2026-09-22.json) 和它的 [字段 CSV](./ds160-live-evidence-delta-2026-09-22.csv)。对应的 143 行 selector reconciliation 另存为 [JSON](./ds160-live-reconciliation-delta-2026-09-22.json) 和 [CSV](./ds160-live-reconciliation-delta-2026-09-22.csv)。当前快照共 126 个状态，SHA-256 为 `b79fe2241f1ed3059b759d2591d6c14105549fb86e69b78709bbb969de1900a7`；mapping worker 修复后 143 行均有 direct-ID candidate、0 行 label-only、0 行缺少 runtime binding。输出只保留公开控件元数据、状态名、路径、错误计数和控件 ID；不含答案、申请人标识或选项值。后续新的官网点检若追加状态，应生成新的快照，不静默改写本次计数。
Part 5 另有独立 6-state 补充 artifact [JSON](./ds160-security5-navigation-proof-2026-09-22.json)，原始 SHA-256 为 `5adaee423d64cc5d6fecd10e3ec45559665a02c354bb45b70b6ebe1b15ad4d07`；它补充导航边界，不覆盖 126-state raw 快照。

为便于逐项复核，另有 [331 行 consolidated checklist JSON](./ds160-consolidated-field-checklist-2026-09-22.json) 和 [CSV](./ds160-consolidated-field-checklist-2026-09-22.csv)。它是有效合并：历史快照中的 187 行 `exact`、取代历史 143 行 `aggregate-only` 分区的当前 143 行 finalized selector reconciliation，以及取代历史 `sex` mismatch 的 1 行控件类型修复。字段名集合无重复，历史审计文件保持不变；`countsFinalized=true` 仅表示当前 126-state selector snapshot 的计数已定稿，所有行仍为 `officialVerification=false`，所以该清单提供逐项追踪入口，不代表 331 条官网服务器规则均已独立证明。

- 3 个条件说明框在官网 DOM 中都是 `textarea`、`maxLength=4000`：婚姻状态 OTHER (`tbxOtherMaritalStatus`)、护照类型 OTHER (`tbxPptOtherExpl`) 和职业说明 (`tbxExplainOtherPresentOccupation`)。职业说明同一控件也被 NOT EMPLOYED 分支使用；OTHER 空提交返回 `Specify Other has not been completed.`，NOT EMPLOYED 空提交返回 `Explain has not been completed.`，填入说明后该 NOT EMPLOYED 路径无错误进入下一页。原始点检没有把 OTHER 的填充动作单独命名，因此没有把它标成完整的 OTHER 服务器成功证据。
- Family2 配偶出生日期显示独立的日、月、年控件。年-only 路径在日/月为空时进入 Work，完整日期路径也进入 Work；回读只用于确认拆分控件，答案值不写入证据文件。
- 安全背景 27 个 Yes 分支均逐项展开了 Explain textarea，控件最大长度为 4000。五组空说明均得到官网校验错误；第 1–4 组填入 `TEST DESCRIPTION` 后 Next 进入下一安全页。Part 5 的独立增量证据见 [security5 navigation proof](./ds160-security5-navigation-proof-2026-09-22.json)：3 个 Yes 说明组和全部 No 分支的 `Next: PHOTO` 按钮均保持 disabled，各分支通过 Back 保存无错误；随后点击官网顶部 `a#PHOTO` 成功进入 `photo_uploadthephoto.aspx`。这证明的是链接导航，不是 Next 按钮通过，也没有上传照片。
- Part 5 的保存读回补充见 [security5 saved readback](./ds160-security5-saved-readback-2026-09-22.json)：离开后重新进入时三个 Yes 控件仍为 checked，三个说明框均为 nonempty；证据只保留布尔状态，不含说明文本。人贩相关说明框的 selector 修复见 [exact ID proof](./ds160-security-exact-id-proof-2026-09-22.json)，旧前缀命中两个控件，修复后的 direct/related 后缀各唯一命中一个。职业 OTHER 的独立成功路径见 [occupation accepted](./ds160-other-occupation-accepted-2026-09-22.json)，填妥说明和单位资料后无错误进入 Previous Work。
- PHOTO fallback 修复已纳入代码 commit `c9371000`：当 Security Part 5 的同源 `Next: PHOTO` 控件明确 disabled 时，先 Back 保存并重新读取 Part 4，再沿唯一同源 PHOTO link 导航；lease、gate 和 readback 条件均保留，正常可用的 Next 路径不受影响。最终联合测试（全部 DS160 spec、security5-photo-navigation、navigator-page-complete）为 121 passed / 0 failed / 0 skipped，service build 通过；11 台 runner 的最终镜像与配置核验已完成，详见发布记录。
- 本地 production React harness 对 27 个安全条件逐一验证了 Yes 显示 `TEXTAREA/max4000`、No 移除控件，27/27 通过且 console errors 为 0。该结果属于本地 UI 条件渲染证据，与 CEAC DOM/服务器结果分开记录，不能替代官网行为。
- 前配偶重复规则：相同姓名和出生日期即使其他资料不同仍被 CEAC 拒绝；改变 given name 后进入 Work。三行控件和 row-0 的 4000 字符结束婚姻说明框均在同一状态中可见。
- 前配偶重复校验的根因是 CEAC 对重复身份键（姓、名、出生日期）做跨行唯一性检查，而不是比较婚姻结束日期、国籍或地址等其余资料；因此仅改变其它资料仍被拒，改变姓名或出生日期后才继续。该规则作为服务器行为证据独立保留，不能由前端行数校验代替。
- 付款人电话和配偶国籍均已纳入基础/扩展 mapping 的逐项 reconciliation：前者覆盖个人及公司付款人分支的同一官方电话控件，后者覆盖 Spouse/Partner 共用的国籍下拉控件。当前清单仍保留 `base`/`extended` 来源、候选 ID 和实际状态；这类 mapping 覆盖说明不等于已经证明每个交叉分支的服务器接受规则。
- 具体行程 Yes 显示拆分的离境日期控件；资料填妥后 Next 进入 companions。生产 QA 仍保持 unsigned，未执行最终签名或新的官网递交；此前已提交的真实申请未修改。
- 独立的本地 production React/mock 回归点击了真实“提交”按钮：保存两批、提交重试 POST 恰好一次、状态轮询两次，确认页显示 submitted 和 PDF 入口；刷新后没有新的 POST，已提交控件保持只读，控制台无错误。该结果只证明本地 UI/API 编排，不计作新的 CEAC 递交。
- 本地 UI 语义回归又发现两个按字段上下文修正的中文标签：passport document type 的官方值显示为“公务护照”，primary occupation 的 medical 显示为“医疗卫生”。根因是旧的通用中文值映射忽略字段上下文并持久化旧 label；已加入 field-specific override，29 个翻译聚焦测试通过，并在最新 READY deployment 中完成只读生产复核。

## 证据边界

逐项结果保存在 [字段检查表 CSV](./ds160-field-control-checklist-2026-09-22.csv)、
[字段/控件审计 JSON](./ds160-field-control-audit-2026-09-22.json) 和
[条件/重复行审计 JSON](./ds160-branch-control-audit-2026-09-22.json)。
历史字段审计快照共 337 项模型字段，排除 6 项兼容字段后有 331 项：
187 项 `exact`、143 项 `aggregate-only`、0 项完全缺失、1 项性别控件类型差异。
该快照保留原始分类。当前 [consolidated checklist](./ds160-consolidated-field-checklist-2026-09-22.json) 对同一 331 个非兼容字段做有效合并：187 项沿用历史 direct-selector 基线，143 项由 mapping worker 修复后的 selector reconciliation 对应历史 aggregate 分区，`sex` 使用已观察的 `select` 修复行，因此不能把 187 与新 reconciliation 的任何候选命中累加为“已验证字段数”。
143 项 selector reconciliation 证明的是当前 mapping 与公开控件 ID 的对应关系，不能冒充独立服务器验证；当前计数已按 126-state snapshot 定稿，后续新增官网点检应以新快照追加证据。

此前 2026-09-21 的完整原始官网快照仍是 832 控件、365 状态、31 组选项、211 个主国籍门控结果和 27 个安全问题；本轮 2026-09-22 增量点检另见上节 JSON。
本轮另有 143 行 selector reconciliation；这些行由 mapping worker 修复后的当前 mapping 读取生成，`countsFinalized=true`，包含 140 个相对旧计划 selector 的 drift 记录（表示 mapping 修复后的 selector 与历史计划文本不同），不能把 direct-ID candidate 或 selector drift 分类当成官网服务器验证。consolidated checklist 与本快照同步定稿。21 个 ambiguous binding assessment 均来自可逐项解释的结构：4 个是官网二选一 radio 的两个实际控件，17 个是前配偶重复行的 `ctl00`/`ctl01`/`ctl02` 候选（日期拆分字段按映射键分别记录）；原先的人贩说明框相似 ID 歧义已由后缀 selector 修复并用真实 DOM 证据复核，当前未解释的 ambiguous 数为 0。
清单同时列出 `historicalSeedTypeInPlan` 与 `currentContractType`。例如三个条件说明框历史 seed 是 `text`，当前 contract 已是 `textarea`/4000；读者不应把历史 seed 类型当成当前修复后的类型。
83 个 schema 条件中，81 个有对应正反侧状态关联，2 个仅用于历史兼容；这不代表所有条件交叉组合都独立提交过。
此次审计确认 20 个真实重复组的增删观察、2 个单项说明框不适用增删，并纠正 1 个把具体行程误算成重复组的契约。

本轮 fresh QA 已恢复为 unsigned 模式。最终签名、Part 5 到 Photo 的 Next 和新的官网递交没有在本轮执行；此前已提交的真实申请保持不变。不能据当前证据声明“所有字段与所有服务器行为 100% 一模一样”。

## 发布及回归

- 照片修复：`06d47a1c5f3d0d01d249a3668c830201f5e8c90b`。
  前端 `dpl_AUwZzHj4zNpbsycBj5dppfyFmBGh` 已 READY 并绑定 `app.viza.it.com`。
  组织 CLI 身份、团队、项目、提交作者及 dry-run 文件排除均已核验。
- 具体行程：`1be3cf46`；0203 / 前端镜像均为
  `E04F3E5BBE78D85575E12490E94EF6F519D56E8EDB2C8A7F281B8271E9D5A9E3`。
  生产库已应用并回读六字段，原有日期/长度/条件保留，两个实际重复组保留。
- 照片 11 项、提交服务定向 32 项、前端日期/单组行程 20 项回归通过。
  前后端及提交服务 type-check 通过；前端 lint 无 error（57 既有 warning），agent backend lint 无 error（1 既有 warning）。

- 四项控件/兼容修复：`1f9e0377`，提交服务聚焦 60 项回归通过。
  0204 / 前端镜像 SHA-256 均为 `1C68E2EF4DF9F5F044ADE00BBA87C4F486EBA7A7060A455BA6463F011E2D02DB`；
  生产回读确认 sex=select 且原选项保留、前配偶数量=text/maxLength2、婚姻结束=textarea/4000、job_title=legacy。
  正整数 pattern 是本地输入规则；官网 DOM 的两位限制没有证明 CEAC 接受所有 1–99 数值。

- 条件说明框与配偶日期拆分：`0205_ds160_explanation_textareas.sql` 已应用并回读三字段均为 textarea/maxLength=4000；原有答案未删除。提交服务 runner 的配偶日期派生与 Family2 映射同步为日/月/年控件，fresh 官网点检验证年-only 和完整日期路径均可继续。

- 最新已验证前端发布：commit `edc09b67` 的 deployment `dpl_Hyowdmy6desVUaGmzvi1WCdMYM3F` 已 READY 并绑定 `app.viza.it.com`。生产真实只读申请刷新后 209 个控件均不可编辑，已提交状态和确认 PDF 按钮存在，crash/console errors 均为 0，最近十分钟错误请求日志为空；这次检查未修改或重新递交真实申请。该发布包含字段上下文中文标签修复：passport document type 使用“公务护照”，primary occupation medical 使用“医疗卫生”。

安全说明 selector 与 PHOTO fallback 修复后的最终 runner 镜像已发布：
`registry.fly.io/viza-prod-runner-pool:ds160-c9371000@sha256:c2a4b37793ae6d8b4c387c56b9e29bbed9aa5b9704f9343597a6a91ed02b1bfd`。
10 台 pool 和 1 台 legacy 均已更新至该不可变镜像并保持 stopped。
逐台更新前的运行任务、队列深度、活跃租约检查均为 0；更新使用 `--skip-start` 并保持 HTTP autostart=false。
root 独立比较发布前后完整配置，排除 image 和四项 Fly release/platform metadata 后，11 台配置差异为 0。
资源、环境、服务、重启和停止策略未变，远程 builder 已确认 stopped；未启动或重放旧任务。
代码构建及最终 121 项回归通过。官网导航使用未签名 QA 草稿验证；本次没有新镜像执行新的真实递交记录。

所有字段迁移完成后，再次刷新生产真实申请：性别已加载为下拉控件，209 个表单控件全部禁用或只读，
已提交状态及确认页 PDF 入口正常，浏览器 error 为空。字段定义由服务器读取最新数据库元数据；
已验证的最终前端部署为 `dpl_Hyowdmy6desVUaGmzvi1WCdMYM3F`（commit `edc09b67`）；字段上下文中文标签修复已在该部署中完成。最终 runner 为 `c9371000`，11 台发布核验完成；签名与服务器行为证据仍按上文的 unsigned QA 边界记录。
