# Taiwan Online Entry Permit Runner

Scope: Taiwan `TW_ENTRY_PERMIT` (旅居海外大陸地區人民申請來臺觀光入境許可) — the
official National Immigration Agency online entry-permit application at
coa.immigration.gov.tw only.

- **Background formal submit is the canonical runner path.** After the
  applicant completes VIZA's final confirmation and separately authorizes the
  official entry prompt plus terms modal, fill every field, verify every
  required field/file, solve the final image CAPTCHA
  (`/coa-frontend/captcha`) via `src/captcha`, and click the official
  "確認資料" button. Do not add a Taiwan-only network client.
- **Final submit is allowed only after verification passes.** The final submit
  control is a real NIA POST, so it may be clicked only after the authorized
  login hook, terms modal, delivery location, email OTP, field verification,
  file verification, and official validation gate have all succeeded. Persist
  `submitted` only after the runner captures official success-page evidence
  with an application/receipt number.
- **Two official terms authorizations are mandatory and auditable.** The
  `runner_job.metadata.taiwanOfficialTermsConsent` record must confirm the
  official entry prompt and official terms modal separately. If an expected
  Agree-first alert already exists, accept it; then check the official terms
  checkbox, verify `checked=true`, and only then click the modal's confirm
  button. Unknown alerts and unchecked controls fail closed.
- **No VIZA-created persistent account.** Taiwan may use an authorized
  official login through the replaceable `TwOfficialLoginProvider`, but this
  runner must not create, store, fixture, log, or document any real official
  username, password, OTP, cookie, or storage state. Every application fill
  remains a single continuous browser session: authorized login hook → terms
  modal → delivery location → application form tab → one-time email OTP
  verification → every field/file verified → CAPTCHA solve → official final
  confirmation → official receipt capture.
- **Verify after every field/file.** Required fields, enum values, and uploads
  must fail immediately when the official page's actual value/file input does
  not match the normalized VIZA contract. Successful CAPTCHA-boundary metadata
  may include field names, control names, counts, page fingerprint, and masked
  screenshot references only; never persist applicant values or OTPs there.
- Field/value contract lives in
  `viza-be/agent-backend/scripts/seed-tw-entry-permit-form-fields.ts` —
  `src/tw/normalize.ts`'s output keys/enum values must match it exactly.
- If the official portal blocks access, changes layout, the CAPTCHA boundary
  can't be confirmed, or 2captcha fails, return a precise `{ status: "failed" }`
  result with the error and current URL. Do not fake official submission.
- `src/tw/captcha.ts` owns the Taiwan CAPTCHA selectors, screenshot solve,
  retry/report-bad flow, and submit click. Persist solve telemetry only; never
  persist the solved CAPTCHA text.
- Label-based Playwright locators in `fillers.ts`/`apply.ts` are provisional
  (no concrete DOM ids/names were captured during the live walkthrough) —
  see the TODOs in those files. Verify against the live site before trusting
  this for a real application.
