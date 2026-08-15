# Taiwan Online Entry Permit Runner

Scope: Taiwan `TW_ENTRY_PERMIT` (旅居海外大陸地區人民申請來臺觀光入境許可) — the
official National Immigration Agency online entry-permit application at
coa.immigration.gov.tw only.

- **Applicant final-submit handoff is the canonical runner path.** Fill every
  field, verify every required field/file, solve the final image CAPTCHA
  (`/coa-frontend/captcha`) via `src/captcha`, then expose the same short-lived
  Browserbase session to the owning applicant. Only the applicant clicks the
  official "確認資料" button. Do not add a Taiwan-only network client.
- **Final submit is allowed only after verification passes.** The final submit
  control is a real NIA POST, so the applicant handoff must be created only after the
  authorized login hook, terms modal, delivery location, email OTP, field
  verification, and file verification have all succeeded. While the live
  handoff is active, persist `stopped_at_captcha` plus an opaque handoff id;
  persist `submitted` only after the runner captures official receipt evidence.
- **No VIZA-created persistent account.** Taiwan may use an authorized
  official login through the replaceable `TwOfficialLoginProvider`, but this
  runner must not create, store, fixture, log, or document any real official
  username, password, OTP, cookie, or storage state. Every application fill
  remains a single continuous Browserbase session: authorized login hook → terms
  modal → delivery location → application form tab → one-time email OTP
  verification → every field/file verified → CAPTCHA solve → applicant live
  handoff → official receipt capture.
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
- `src/tw/applicant-handoff.ts` is the only handoff lifecycle boundary. Open,
  poll, and settle through the typed `open_tw_applicant_handoff`,
  `claim_tw_applicant_handoff` (frontend), and
  `settle_tw_applicant_handoff` RPC contracts. Require the exact runner job,
  worker, application, applicant, takeover, and expiry identity at every
  checkpoint; a zero or malformed row is a typed conflict and must not fall
  back to direct `takeover_session`, `applications`, or audit-log writes.
- Label-based Playwright locators in `fillers.ts`/`apply.ts` are provisional
  (no concrete DOM ids/names were captured during the live walkthrough) —
  see the TODOs in those files. Verify against the live site before trusting
  this for a real application.
