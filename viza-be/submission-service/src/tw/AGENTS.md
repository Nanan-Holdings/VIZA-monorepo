# Taiwan Online Entry Permit Runner

Scope: Taiwan `TW_ENTRY_PERMIT` (旅居海外大陸地區人民申請來臺觀光入境許可) — the
official National Immigration Agency online entry-permit application at
coa.immigration.gov.tw only.

- **No CAPTCHA solving.** Fill every field, then stop at the CAPTCHA image
  (`/coa-frontend/captcha`) + "請輸入驗證碼" input. Never attempt OCR, a
  slider solve, or a third-party CAPTCHA service for this country.
- **No final submit.** Never click "確認資料" (or any equivalent submit
  control). The country-level halt status is `stopped_at_captcha`; at the
  shared `DispatchOutcome` layer this maps to `halted_before_pay` (the same
  generic bucket UK/France/Australia use, even though their real halt
  reasons differ — see src/queue/types.ts).
- **No persistent account.** Unlike UK/France (`uk_accounts`/`fv_accounts`),
  the official portal has no account/password/resume-link model. Every run
  is a single continuous browser session: terms modal → delivery location →
  application form tab → one-time email OTP verification (not a
  registration) → every field → CAPTCHA. Do not add a `tw_accounts` table or
  any equivalent — see docs/tw-entry-permit-auto-submit-plan.md "架构修正"
  for the full reasoning.
- Field/value contract lives in
  `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts` —
  `src/tw/normalize.ts`'s output keys/enum values must match it exactly.
- If the official portal blocks access, changes layout, or the CAPTCHA
  boundary can't be confirmed, return a precise `{ status: "failed" }`
  result with the error and current URL. Do not fake reaching the CAPTCHA
  boundary.
- Label-based Playwright locators in `fillers.ts`/`apply.ts` are provisional
  (no concrete DOM ids/names were captured during the live walkthrough) —
  see the TODOs in those files. Verify against the live site before trusting
  this for a real application.
