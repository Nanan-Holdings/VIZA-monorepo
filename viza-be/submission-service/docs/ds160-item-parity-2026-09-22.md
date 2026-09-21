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

## 证据边界

逐项结果保存在 [字段检查表 CSV](./ds160-field-control-checklist-2026-09-22.csv)、
[字段/控件审计 JSON](./ds160-field-control-audit-2026-09-22.json) 和
[条件/重复行审计 JSON](./ds160-branch-control-audit-2026-09-22.json)。
字段审计快照共 337 项模型字段，排除 6 项兼容字段后逐项列出 331 项：
187 项能直接解析到控件，143 项仅能通过控件目录或页面证据关联，0 项完全缺失，
1 项性别控件类型差异。最后一项在此轮追加修正，审计快照保留修正前状态。
143 项关联证据不能冒充直接 selector 命中，更不能冒充独立服务器验证。

原始官网采集仍是 832 控件、365 状态、31 组选项、211 个主国籍门控结果和 27 个安全问题。
83 个 schema 条件中，81 个有对应正反侧状态关联，2 个仅用于历史兼容；这不代表所有条件交叉组合都独立提交过。
此次审计确认 20 个真实重复组的增删观察、2 个单项说明框不适用增删，并纠正 1 个把具体行程误算成重复组的契约。

最终签名和新 QA 草稿最终递交未使用合成资料执行。需要继续进入官网补测时，当前停在取回草稿的验证码入口；浏览器工具要求当次确认，已发出请求但尚未得到答复。
不能据当前证据声明“所有字段与所有服务器行为 100% 一模一样”。

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

Runner 最终镜像：`registry.fly.io/viza-prod-runner-pool:ds160-1f9e0377`，digest
`sha256:28fc411b54e7162fc08ca702e836af28afc2f29dd1c21236630e572d43f4192c`。
10 台 pool 和 1 台 legacy 均已更新至该不可变镜像并保持 stopped；
排除 image 和 Fly 平台 release metadata 后，11 台配置差异为 0。
资源、环境、服务、重启和停止策略未变，远程 builder 保持 stopped；未启动或重放旧任务。
代码构建和定向回归通过，未用合成申请执行官方最终签名，也未声称新镜像跑过新的真实递交。

所有字段迁移完成后，再次刷新生产真实申请：性别已加载为下拉控件，209 个表单控件全部禁用或只读，
已提交状态及确认页 PDF 入口正常，浏览器 error 为空。字段定义由服务器读取最新数据库元数据；
前端部署仍为照片修复版本，后续前端源文件变更仅为兼容注释、测试和迁移文件。
