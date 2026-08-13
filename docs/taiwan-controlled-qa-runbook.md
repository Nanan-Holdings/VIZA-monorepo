# Taiwan Entry Permit Controlled QA Runbook

更新时间：2026-08-01

## 范围

本 runbook 只适用于台湾 `TW_ENTRY_PERMIT` 的受控 QA。当前阶段只验证：

- 授权官网登录与必要 OTP。
- 官网自动填写。
- 官网文件上传。
- 自动校验已填写字段和已挂载文件。
- 在部署环境已配置获授权 CAPTCHA 服务时，完成 CAPTCHA、点击「确认资料」、保存官方回执并查询状态。

禁止事项：

- 不在未确认授权服务和部署配置时处理 CAPTCHA 或点击最终提交。
- 不把一次受控 smoke 误称为公开上线；提交会产生真实政府申请，须使用已同意的真实申请人和正确资料，不能使用虚构资料。
- 不自动付款；若官方提交后要求支付，停止并由申请人通过官方页面完成。
- 不把账号、密码、OTP、Cookie、storage state、申请人资料、原始官网错误或未脱敏截图写入工单、聊天、Git、日志或 worklog。

## 状态观察

运营只按前端结果卡和提交状态页显示的台湾状态判断进度：

| 状态 | 含义 | 运营动作 |
|---|---|---|
| `queued` | 台湾官网自动填写任务已排队，尚未开始。 | 等待 worker 开始；若长期不动，检查队列/worker 健康，不要重复提交多份申请。 |
| `logging_in` | 正在进行授权官网登录。 | 确认授权账号通道可用；不要在工单中记录账号或登录 OTP。 |
| `otp_required` | 等待官网邮箱 OTP 或授权登录 OTP。 | 让授权操作员在安全渠道处理 OTP；若超时，按“OTP 超时”处理。 |
| `filling` | 正在填写官网表单字段。 | 观察进度即可；不要打开普通官网尝试接续。 |
| `uploading` | 正在上传台湾申请文件。 | 若失败，按前端显示的 document key 定位材料。 |
| `validating` | 正在核对官网字段和上传控件实际状态。 | 等待校验结束；若失败，按错误类别处理。 |
| `stopped_at_captcha` | 已停在官方 CAPTCHA 前，尚未提交。 | 记录 QA 通过至 CAPTCHA 前；除非已有批准的人工同会话交接流程，否则到此停止。 |
| `submitted` | CAPTCHA、官方「确认资料」均已完成，已取得官网提交结果。 | 核对官方回执/申请编号已存在；不自动付款；继续状态追踪。 |
| `failed` | 自动填写或上传未完成。 | 只依据前端显示的安全类别和 field/document key 处理，不索取敏感资料。 |

## 失败处理

### 缺必填字段

前端只应显示类别和 `field:<key>`，例如 `field:household_revoked`。

处理步骤：

1. 打开 VIZA 申请表，不打开台湾普通官网接续。
2. 用 field key 定位内部字段配置或动态表单字段。
3. 请申请人补充该字段；不要在工单中复制完整申请答案。
4. 补齐后可重新排队一次。

禁止重试：

- 同一个 field key 连续失败两次，且申请表已确认有值。
- field key 不存在于当前表单配置，疑似 schema/runner 合同不一致。

### 缺文件或文件不合格

前端只应显示类别和 `doc:<key>`，例如 `doc:eligibility_supporting_document_3`。

处理步骤：

1. 在 Documents 页面按 document key 定位材料。
2. 只确认文件是否存在、格式是否符合要求、是否属于正确资格类别。
3. 请申请人重新上传合格文件；不要把证件图像复制到工单或聊天。
4. 补齐后可重新排队一次。

禁止重试：

- document key 对应的材料在 Documents 页面不可见。
- 资格类别与材料 key 不匹配，例如资格 2 却要求 `eligibility_supporting_document_3`。
- 文件已确认合格但 runner 仍报上传失败两次，疑似官网上传控件变化。

### OTP 超时

处理步骤：

1. 确认授权邮箱/OTP 接收通道在线。
2. 确认没有把 OTP 发到工单、日志或公开聊天。
3. 若只是一次性邮件延迟，可重新排队一次。

禁止重试：

- OTP 通道不可用或没人值守。
- 同一申请连续两次 OTP 超时。
- 官方页面提示账号、权限或安全验证异常。

### 官网字段变化

处理步骤：

1. 记录前端显示的 field key 或安全类别。
2. 暂停该申请重试。
3. 交给 runner/schema 负责人用安全测试资料复核官方 DOM 或选项变化。

禁止重试：

- 前端显示“官网字段变化”。
- 同一字段验证失败，且 VIZA 表单答案和文件已确认完整。
- 官方页面出现新弹窗、新强制步骤、新条款或新上传规则。

### 网络失败

处理步骤：

1. 检查 worker 网络、台湾官网可达性和队列健康。
2. 如果是短时网络波动，可重新排队一次。
3. 如果同时多个申请失败，暂停台湾队列并升级给值班工程。

禁止重试：

- 台湾官网不可达。
- worker 网络或代理不稳定。
- 同一申请连续两次网络失败。

## 提交与状态追踪记录

授权服务未配置或 CAPTCHA 失败时，到达 `stopped_at_captcha`；QA 记录只写：

- application id 或内部测试编号。
- run id 或队列 id。
- 前端状态 `stopped_at_captcha`。
- 已确认文案包含“尚未提交”。
- 未显示普通官网接续链接。
- 未做 CAPTCHA，未点击官方最终提交。

成功 `submitted` 时，记录只写：

- application id 或内部测试编号。
- run id 或队列 id。
- 前端状态 `submitted`。
- 官方回执/申请编号**存在**（不把编号全文复制到公开聊天或 Git）。
- 是否进入付款步骤；若进入，状态应显示「等待申请人官方付款」。

不要保存或提交：

- 官方页面可读截图。
- CAPTCHA 图片或文本。
- OTP、Cookie、storage state。
- 申请人证件、姓名、邮箱、电话、地址或文件名。

## Documents QA

台湾 Documents 需要逐一验证四种资格类别：

| `eligibility_category` | 必须显示 | 不应显示 |
|---|---|---|
| `1` | `eligibility_supporting_document_1` | `_2`、`_3`、`_4` |
| `2` | `eligibility_supporting_document_2` | `_1`、`_3`、`_4` |
| `3` | `eligibility_supporting_document_3` | `_1`、`_2`、`_4` |
| `4` | `eligibility_supporting_document_4` | `_1`、`_2`、`_3` |

每个类别仍应显示共同材料：

- `photo`
- `mainland_travel_document`

条件材料在答案命中条件时仍应显示：

- `hk_macau_id_scan`
- `other_nationality_passport_scan`
- `mainland_id_card_scan`

如果资格证明材料显示不匹配，不要重试官网自动填写；先升级给 Documents/schema 负责人。
