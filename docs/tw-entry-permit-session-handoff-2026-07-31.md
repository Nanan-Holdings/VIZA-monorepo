# TW_ENTRY_PERMIT（台湾落地证）— 会话交接文档

**日期：** 2026-07-31
**分支：** `main`（本次改动全部未提交，见文末"Git 状态"）
**目标：** 让台湾 Online Entry Permit 表单在正式做自动化提交测试前，做到"全部简体中文、无中英对照、字段能正确显示/联动"。

---

## 1. 关键架构认知（新会话必须先知道）

台湾表单实际生效的渲染路径是：

```
app/client/application/long-form/page.tsx
  → components/dynamic-step-form.tsx
    → components/dynamic-form-field.tsx
```

字段定义来自 Supabase 的 `visa_form_fields` 表（由 `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts` 灌入）。

`components/client/wizards/shell/wizard-shell.tsx`（`WizardShell`）是**死代码**——全项目除了它自己的 registry 文件外，没有任何地方引用它。本会话早期误以为它是生效系统，对 `components/client/wizards/tw/config.ts` 做了繁转简（这个文件依然保留了这些修改，但对线上界面**没有任何实际效果**）。后来定位到真正生效的是上面那条路径，后续所有修复都改在这条路径上。

双语标签系统：`lib/bilingual-schema-contract.ts` 里的 `FIELD_NAME_ZH_OVERRIDES` 字典，各国有自己的子字典（如 `UK_FIELD_NAME_ZH`、现在的 `TW_FIELD_NAME_ZH`），按 spread 顺序合并，后 spread 的赢。

---

## 2. 本次会话做的修改（按文件）

| 文件 | 改动 |
|---|---|
| `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts` | 所有下拉选项文本繁体→简体；删除了 7 个死的 `field_type: "file"` 字段行（照片、各类证件扫描件——这些字段在所有国家都只渲染一个不能点的占位框，真正的上传走独立的 Documents 步骤/`document_requirements` 表） |
| `viza-fe/internal-website/components/client/wizards/tw/config.ts` | 繁转简（**死代码，无实际效果**，未删除，是否清理留给你决定） |
| `viza-fe/internal-website/lib/bilingual-schema-contract.ts` | 新增 `TW_FIELD_NAME_ZH` 字典（~90条字段中文标签）。修复过程中发现并修掉了 4 个跨国字段名冲突（`passport_number`/`passport_expiry_date`/`other_passport_number`/`other_passport_expiry_date` 这几个字段名被其他国家共用，已从 TW 专属字典里移除，靠通用标签兜底） |
| `viza-fe/internal-website/components/dynamic-step-form.tsx` | 新增 `CHINESE_ONLY_VISA_TYPES = new Set(["TW_ENTRY_PERMIT"])`，台湾表单只渲染单列中文，不再显示中英对照 |
| `viza-fe/internal-website/components/dynamic-form-field.tsx` | 新增两个台湾专属输入转换：`name_english`（英文姓名）打字时自动转大写；`name_chinese`（中文姓名）失去焦点时自动简转繁（避免在拼音输入法组字过程中转换） |
| `viza-fe/internal-website/lib/chinese-conversion.ts` | **新文件**，用 `opencc-js`（新装依赖，按需懒加载 `opencc-js/cn2t` 子包）做简转繁 |
| `viza-fe/internal-website/lib/form-utils.ts` | 修复条件显示逻辑 bug：勾选框未勾选时存的是空字符串 `""` 而不是字符串 `"false"`，导致所有 `"xxx === false"` 类型的显示条件永远判断不成立。这个 bug 同时影响了大陆身份证号码字段（`mainland_id_number`）、亲属现居地址字段（`kin_*_current_address`）、台湾联系电话字段（`tw_contact_mobile`）三处——已在共享逻辑里统一修好 |
| `viza-be/submission-service/src/queue/halt-runners.ts` | `runTwHalt` 改为按申请人实际选择的 `eligibility_category` 动态解析对应的证明文件 key，而不是写死一个通用 key |
| `viza-fe/internal-website/app/client/documents/actions.ts` | 新增 `applyTwEligibilityDocumentFilter()`：读取申请人的 `eligibility_category` 答案，只展示与之匹配的那一份资格证明文件要求，隐藏另外 3 份不相关的 |
| `viza-fe/internal-website/package.json` / `package-lock.json` | 新增依赖 `opencc-js@1.4.1` |
| `viza-be/submission-service/package.json` | 顺手清理了一个指向已删除脚本的失效 script 条目 |

新建但**尚未确认执行成功**的数据库迁移：

`viza-be/agent-backend/drizzle/0123_tw_entry_permit_document_requirements_zh_and_eligibility_split.sql`
- 把 `document_requirements` 表里 6 个字段的 `label_zh`/`description` 繁转简
- 把原来合并在一起的 `eligibility_supporting_document` 一条记录拆成 `eligibility_supporting_document_1..4`，对应四种资格类别

---

## 3. ⚠️ 最重要的未完成事项：迁移 0123 还没跑

上次尝试 `npm run db:migrate` 报错：
```
❌ Migration failed: Error: getaddrinfo ENOTFOUND db.oyjxdzsoejraedqghndi.supabase.co
```
原因：Supabase 直连域名只有 IPv6 记录，很多网络环境连不上。两个解决办法，你选了"办法二"但还没确认跑成功：

- **办法一**：把 `drizzle/0123_...sql` 文件内容直接复制粘贴到 Supabase Dashboard → SQL Editor 里执行。
- **办法二**：把 `viza-be/agent-backend/.env` 和 `.env.local` 里的 `DATABASE_URL` 换成 Supabase 的 "Transaction pooler" 连接字符串（Dashboard → Settings → Database → Connection string，域名形如 `aws-0-<region>.pooler.supabase.com`，用户名形如 `postgres.<project-ref>`），然后重新跑：
  ```bash
  cd viza-be/agent-backend && npm run db:migrate
  ```

**规则提醒（给下一个 Claude 账号）：** 数据库写操作（迁移、种子脚本等）必须由你自己手动执行，不能让 Claude 直接对共享数据库写入——这是本会话里明确定下的规矩，因为数据库是团队共享的，Claude 自己悄悄跑迁移出了问题没法追责。Supabase MCP 本身也是只读的。

---

## 4. 如何本地跑起来测试

**前端网站：**
```bash
cd "/Users/mmmytooo/Github/VIZA-monorepo-git/viza-fe/internal-website"
npm run dev
```
默认 `http://localhost:3000`。`opencc-js` 依赖已经装好，不用再装。

**自动提交服务（测试端到端自动提交时才需要）：**
```bash
cd "/Users/mmmytooo/Github/VIZA-monorepo-git/viza-be/submission-service"
npm run dev
```

**agent-backend：** 不需要常驻运行，只有需要重新跑种子脚本时才用：
```bash
cd "/Users/mmmytooo/Github/VIZA-monorepo-git/viza-be/agent-backend"
npx tsx scripts/seed-tw-entry-permit-form-fields.ts
```
（这个已经在本次会话里成功跑过一次，繁转简的选项文本已经在数据库里了。）

---

## 5. Git 状态（截至交接时）

分支 `main`，**以上所有改动都还没有 commit**：

```
 M docs/ph-etravel-auto-submit-audit.md   ← 与本次台湾工作无关，早于本会话
 M viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts
 M viza-be/submission-service/package.json
 M viza-be/submission-service/src/queue/halt-runners.ts
 M viza-fe/internal-website/app/client/documents/actions.ts
 M viza-fe/internal-website/components/client/wizards/tw/config.ts
 M viza-fe/internal-website/components/dynamic-form-field.tsx
 M viza-fe/internal-website/components/dynamic-step-form.tsx
 M viza-fe/internal-website/lib/bilingual-schema-contract.ts
 M viza-fe/internal-website/lib/form-utils.ts
 M viza-fe/internal-website/package-lock.json
 M viza-fe/internal-website/package.json
?? viza-be/agent-backend/drizzle/0123_tw_entry_permit_document_requirements_zh_and_eligibility_split.sql
?? viza-fe/internal-website/lib/chinese-conversion.ts
```

建议先在本地测试确认没问题、迁移 0123 也跑成功之后，再一次性 commit。

---

## 6. 还没做 / 还没验证的事

1. 迁移 0123 是否已在线上数据库成功执行 —— **未确认**。
2. `components/client/wizards/tw/config.ts` 这个死代码文件要不要清理/删除 —— 你还没决定，先留着。
3. 完整的自动提交端到端流程（从填表到 Playwright 真正提交到台湾官网）还没有真正跑通验证过，本次会话修的都是"填表阶段"会挡住测试的 bug（上传占位框、简繁转换、大写转换、勾选框联动、资格文件个性化）。
4. 本次改动尚未 commit，也尚未跑 typecheck/lint 之外的完整测试（如 e2e）。

---

## 7. 本次会话解决的问题清单（供快速回顾）

1. 台湾表单文字繁体→简体（下拉选项、字段标签）
2. 去掉台湾专属的中英对照，只显示中文
3. 修复"改了但界面没变"——根因是死代码 wizard-shell，改到了真正生效的 DynamicStepForm 系统
4. 修复字段中文标签跨国冲突（4 个字段名被其他国家共用）
5. 修复照片/证件上传显示但点不了的问题（去掉重复的死字段定义）
6. 资格证明文件按申请人实际选择的资格类别个性化展示（而不是 4 种都堆在一起）
7. 英文姓名字段自动转大写
8. 中文姓名字段失焦自动简转繁
9. 修复勾选框未勾选时显示条件判断失效的 bug（影响大陆身份证号码、亲属地址、台湾联系电话三处字段的显示）
