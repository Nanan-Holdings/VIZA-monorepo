# Submission Service Agent Guide

Scope: this file applies to `viza-be/submission-service/**`.

## Purpose

The submission service is a long-running Node/TypeScript worker that polls
`submission_queue` and drives official portal automation with Playwright. Its
product contract is reliable official-portal automation that completes form
filling and one-shot submission for the applicant.

## User Override

- 如果碰到captcha，则用TWOCAPTCHA API 通过这个测试。
- 我不想要用户做任何额外的事，自动提交会帮他们搞定所有的填写表单的事。
- 对美国 B1/B2 面签预约，把登录、CAPTCHA/MFA、等待室、付款、政策提示或最终官方确认实现成绕过流程。
  Runner 可以继续处理可自动化的准备和状态捕获步骤，包括通过 VIZA alias email、Cloudflare Email Worker 和
  `inbound_email` 自动完成官方账号邮箱验证,登录风控、CAPTCHA/MFA、等待室、付款、政策提示或最终官方确认.
- DS-160/official portal automation changes must be verified with real
  Playwright runs when credentials/data are available. Keep improving the
  runner until it can complete successfully, or pause and tell the user exactly
  what manual action/data is required.
- During Playwright runs, compare the VIZA frontend form data and uploaded
  documents against the official portal pages being filled. If the official
  portal requires a field, validation shape, photo, or e-signature input that
  the frontend form does not provide correctly, update the frontend/schema
  contract or normalization rather than masking the mismatch in the runner.
- If a blocker is external or cannot be completed by the agent (for example:
  missing applicant data, invalid official-portal account/session, payment,
  legal applicant confirmation, unavailable CAPTCHA service, or portal outage),
  stop further retries and report the required user/operator step clearly.
- After successful live submission, document how success was verified and make
  sure the frontend confirmation UI displays Chinese success copy with official
  evidence such as CEAC Application ID, confirmation number/reference, timestamp,
  and retrieval/status URL when available.
- The frontend submission loading UI must be connected only to an active
  submission queue for the same application. Show it while the user has just
  clicked submit/retry and the worker is pending/processing/scheduled/running;
  hide it once the application is submitted/completed, failed/stalled, or only
  non-submission proof/download jobs remain. Proof artifact jobs such as
  `ceac_proof` must not make the confirmation tab look like a new submission is
  still running.
- Opening or revisiting the frontend confirmation tab must never enqueue a new
  official submission when a submitted/completed result already exists. A new
  submission is allowed only from an explicit submit/retry/resubmit button in
  that tab, except for first-time applications that have no submission record.
- Before claiming any submission-service flow is complete, verify the chain from
  the user's browser perspective by clicking the real frontend submit/retry
  button, watching queue pickup/progress in the UI, and preserving the official
  portal trace/screenshot plus DB result evidence. If this browser-click test
  cannot be completed, report the exact blocker.
- For any official portal blocked by Cloudflare, Turnstile, or a government
  WAF, follow the local `browser-api-cloudflare-runner` skill first. 所有
  Cloudflare/Turnstile/WAF 的场景优先按该 skill 执行：优先国家级 Browser
  API/CDP，其次是显式允许的全局 Browser API。不得静默降级，必须保留官方阻断与
  放行证据。端点凭证不得入日志。

## Key Flows

- `src/index.ts`: polling loop, Supabase data loading, document download,
  per-country dispatch, retry/failure handling, queue status transitions.
- `src/queue-scheduler.ts`: local submission queue concurrency scheduler.
  Allows different account/country/provider work to run in parallel while
  serializing the same application and the same user/provider lane. The current
  single-runner local maximum is 10 via `SUBMISSION_SERVICE_MAX_CONCURRENCY`;
  wider product-scale concurrency uses `src/submission-queue-claim.ts` and
  migration `0105_submission_queue_claim_locks.sql` for DB-level leases.
- `src/submission-queue-claim.ts`: service-role RPC wrapper around
  `claim_submission_queue_batch`, which atomically claims legacy
  `submission_queue` rows with `FOR UPDATE SKIP LOCKED` so multiple
  submission-service runners can run safely.
- `src/ds160-live-config.ts`: DS-160 dry-run/live-assisted feature flags and
  startup safety validation. Dry-run is the default.
- `src/france-live-config.ts`: France Schengen dry-run/live-assisted feature
  flags and safety validation. Dry-run is the default; France-Visas live
  assisted is visible-browser only and blocks final validation/payment/booking;
  TLS appointment/payment require separate explicit
  `FRANCE_TLS_APPOINTMENT_ENABLED` and `FRANCE_TLS_PAYMENT_ENABLED` gates.
- `src/form-mappings.ts`: Indonesian e-visa portal selectors.
- `src/ds160-form-mappings.ts`: DS-160 field selector mappings.
- `src/ds160-coverage-audit.ts` and `src/ds160-completeness-verify.ts`:
  coverage/verification utilities.
- `src/ceac/**`: CEAC runtime pipeline for DS-160 prefill.
- `src/france-visas/**`: France-Visas sign-in, five fill steps, dashboard
  reference capture, optional CERFA PDF finalization, standard Chromium launch,
  VIZA-alias account registration, registration CAPTCHA solving when explicitly
  enabled, manual checkpoints, and typed failures.
- `src/france-tls/**`: TLScontact China appointment scaffold for France
  Schengen. Keeps the mainland China center registry in one provider, models
  selector/page boundaries, reads backend-observed slots, consumes short-TTL
  payment sessions, clears sensitive PAN/CVV after use, and must capture
  redacted confirmation/payment evidence only after explicit user slot,
  payment, and final approval. `src/france-tls/recaptcha-grid.ts` maps visible
  reCAPTCHA image-grid challenges to 2captcha `GridTask` solves and page
  clicks; it must not be treated as a Cloudflare/WAF, MFA, identity, or
  payment-challenge bypass. `src/france-tls/browser-api.ts` owns TLS-specific
  Browser API/CDP endpoint selection, provider-native CAPTCHA solve attempts,
  Cloudflare/WAF classification, and shared live-smoke page state detection.
  Bright Data Browser API zones block password entry by default; TLS login can
  only be fully automated in the same session when the configured Browser API
  zone has password entry enabled by the provider, or when a local/TLS CDP
  session is already past Cloudflare and authorized for official login.
- `POST /local/france-tls/check-slots`: localhost-only health-server endpoint
  gated by `FRANCE_TLS_LOCAL_OFFICIAL_SESSION_ENABLED=true`. It opens the
  configured TLS VAC official URL through France-specific Browser API/CDP or a
  local browser, returns visible slots when safely observed, and otherwise
  returns structured checkpoints such as `login`, `captcha`, `waf`, `payment`,
  or `selector_drift` without logging Browser API endpoints.
- `src/inbox/alias.ts` and `src/france-visas/mailbox-provider.ts`: VIZA email
  alias provisioning and inbound-email verification-link extraction for
  official account registration.
- `scripts/ts-node-js-resolver.cjs`: local dev preload that lets `ts-node`
  resolve relative `.js` source imports to sibling `.ts` files while preserving
  build output imports.
- `src/country-submissions/**`: safe provider registry, schema/dry-run
  validation, unsupported-country handling, and inventory metadata for country
  submission capability audits.
- `src/arrival-card-browser.ts`: shared arrival-card browser provider. MDAC,
  TDAC, and PH eTravel can use a configured Browser API/CDP endpoint such as
  Bright Data Scraping Browser before local Chromium. PH eTravel is
  Cloudflare-protected and now accepts the global `BRIGHTDATA_BROWSER_API_*`
  endpoint by default when no PH-specific endpoint is configured; when a
  Browser API endpoint is configured, PH eTravel must not silently fall back to
  local Chromium on connection failure. Use `PH_ETRAVEL_BROWSER_API_ENDPOINT`
  for a country-specific endpoint, `PH_ETRAVEL_CDP_ENDPOINT` for an already
  authorized local session, or `PH_ETRAVEL_REQUIRE_BROWSER_API=false` only when
  intentionally debugging local fallback. Never log endpoint credentials.
- `src/uk/**`: UKVI pre-auth/resume scaffold; post-auth selector integration is
  still a known gap.
- `src/us-appointment/**`: China `CN/usvisascheduling` assisted-live
  appointment runner. Polls `appointment_assistance_jobs` when
  `US_APPOINTMENT_ASSISTED_LIVE_ENABLED=true`, reads VIZA-created
  `appointment_accounts` credentials, uses the Cloudflare-backed
  `inbound_email` path for verification mail helpers, automates supported
  official login/account-prep steps, writes official slot observations to
  `appointment_slots`, books only after a user-selected slot and payment/final
  VIZA approval, captures confirmation artifacts in `appointment_confirmations`,
  and writes follow-up checks to `appointment_status_checks`. Keep the DB state
  machine in `runner.ts` and official-page selectors/page interactions in
  `usvisascheduling-portal.ts`.
- `src/au-visitor/**`: ImmiAccount Subclass 600 runner; walks to Review and
  stops before applicant-controlled submit.
- `src/vietnam/**`: Vietnam e-Visa runner; uses a portal state machine for
  landing/NOTE/CAPTCHA/form/payment/white-screen checkpoints, fills the SPA
  when the official form is reached, and stops before payment/submission.
- `src/sgac/**`: Singapore SG Arrival Card runner. Normalizes
  `SG_ARRIVAL_CARD` answers only, fills ICA SGAC Foreign Visitor pages, submits
  after Review in worker mode, and captures confirmation/error artifacts.
- `src/mdac/**`: Malaysia MDAC arrival-card runner. Normalizes
  `MY_MDAC_ARRIVAL_CARD` answers only, keeps MDAC separate from Malaysia eVisa,
  dispatches through the official MDAC portal, and captures confirmation/error
  evidence artifacts.
- `src/tdac/**`: Thailand TDAC arrival-card runner. Normalizes
  `TH_TDAC_ARRIVAL_CARD` answers only, keeps TDAC separate from Thailand eVisa,
  dispatches through the official TDAC portal, and captures confirmation/error
  evidence artifacts.
- `src/ph-etravel/**`: Philippines eTravel arrival-card runner. Normalizes
  `PH_ETRAVEL_ARRIVAL_CARD` answers only, keeps eTravel separate from
  `PH_TEMPORARY_VISITOR_VISA`, respects the 72-hour official window, defaults
  smoke/live runs to stop-before-submit, clicks into the official eTravel login
  path when live submission is explicitly enabled, and must capture
  QR/reference evidence before marking success. Local VIZA portal credentials
  are not official eTravel credentials; use `PH_ETRAVEL_ACCOUNT_EMAIL` /
  `PH_ETRAVEL_ACCOUNT_PASSWORD` or a local `PH_ETRAVEL_CDP_ENDPOINT` session
  that is already authorized for the official portal. When no official account
  is configured, live PH eTravel may create/verify an official account using the
  applicant's VIZA inbox alias and the Cloudflare Email Worker ->
  `inbound_email` path; non-email steps such as SMS, app approval, CAPTCHA, or
  MFA must stop with a structured checkpoint instead of being hidden. Reuse
  `ph_etravel_accounts` by applicant before creating a new official account;
  do not mint a fresh inbox-alias account when a prior PH eTravel account row
  exists.
- `src/korea-eform/**`: Korea Visa Portal official e-Form/barcode PDF runner
  scaffold. `src/korea-eform/documents.ts` downloads uploaded applicant photo
  and passport scan files from `application-documents` for official portal
  upload. Live automation must be explicitly env-gated and must not mark
  success until the official portal-generated PDF is captured in storage.
- `src/kr/**`: Korea C-3-9 dispatch adapter. It writes the customer-facing
  `KR` result for KVAC/Annex-17 readiness and keeps live Korea Visa Portal
  e-Form completion behind the gated `src/korea-eform/**` automation.
- `src/korea-kvac/**`: Korea C-3-9 KVAC appointment runner scaffold. Dry-run
  observes deterministic slots and books only after a user-selected slot. Live
  KVAC booking must be explicitly env-gated, use TWOCAPTCHA if CAPTCHA appears,
  and stop with structured manual-required evidence for unsupported SMS,
  real-name, WAF, or center-specific policy gates instead of marking success.
  The localhost-only Korea KVAC endpoints are
  `/local/korea-kvac/sms/start`, `/local/korea-kvac/sms/submit`, and
  `/local/korea-kvac/sms/complete`; the final endpoint may report success only
  after the official portal returns a confirmation number.
- `scripts/smoke-korea-kvac-centers.ts`: local Korea KVAC/consulate reachability
  smoke for all mainland China filing channels. It opens the official booking
  or guidance entry for each center and saves evidence screenshots without
  sending SMS codes or clicking final booking.
- `src/in/**`, `src/lk/**`, `src/kh/**`, `src/la/**`, `src/za/**`,
  `src/italy-vfs-cn/**`, `src/egypt/**`: smoke/recon/scaffold modules at
  varying maturity. Check `docs/visa-packages-status.md` before extending.
- `scripts/run-fv-smoke.ts`, `scripts/run-au-smoke.ts`,
  `scripts/run-vn-smoke.ts`, `scripts/run-sgac-smoke.ts`,
  `scripts/run-mdac-smoke.ts`, `scripts/run-tdac-smoke.ts`: local live smoke
  entry points for official portal reach/fill validation. Arrival-card smokes
  stop before final submit unless run with `--submit` and real applicant data.
- `scripts/setup-vn-card-profile.ps1` and `scripts/start-vn-autopay-dev.ps1`:
  local-only Vietnam official-fee payment helpers. The dev start script enables
  one-time frontend card sessions by default and reads no card values in the
  terminal unless `-FixedCard` is passed. The setup script may save only
  non-sensitive card metadata such as last4/expiry/holder in ignored local
  files. Full PAN and CVV must not be committed, logged, or stored in `.env`.
- `scripts/start-us-appointment-user-chrome.ps1`: local helper that starts the
  Chrome with a CDP port for the USVisaScheduling runner. If normal Chrome is
  already running, it starts an isolated VIZA automation profile under
  `output/chrome-profiles/us-appointment-cdp` so the user can keep using their
  browser. Use `-RequireDefaultProfile` only when the runner must attach to the
  user's default Chrome profile, and ask the user to close Chrome first instead
  of killing their browser process.
- `scripts/start-ph-etravel-user-chrome.ps1`: local helper that starts Chrome
  with a CDP port for Philippines eTravel. It defaults to an isolated VIZA
  automation profile under `output/chrome-profiles/ph-etravel-cdp` and prints
  the `PH_ETRAVEL_CDP_ENDPOINT` value for smoke/worker runs.
- `src/vietnam/card-session.ts` plus the health-server
  `POST /local/vietnam/card-session` endpoint: local-only one-time card handoff
  for frontend-entered Vietnam official-fee payments. It is enabled only by
  `VN_LOCAL_CARD_SESSION_ENABLED=true`, accepts localhost requests, stores PAN
  and CVV in process memory with a short TTL, and deletes the card when the
  payment worker consumes it. Do not persist these values to DB, queue payloads,
  logs, traces, `.env`, AGENTS, or profile records.
- `scripts/run-us-appointment-register.ts`: local USVisaScheduling account
  registration helper. It requires a configured `US_APPOINTMENT_BROWSER_API_ENDPOINT`
  or `US_APPOINTMENT_CDP_ENDPOINT` unless explicitly run with `--local-browser`,
  uses the applicant inbox alias when `--applicant-id` is provided without an
  explicit email, can consume USVisaScheduling verification mail from
  `inbound_email`, types account fields with the US appointment typing-delay
  range, and must not print passwords, Browser API endpoints, verification
  codes, or links.
- Vietnam runner note/acknowledgement handling must never auto-check
  "Agree to create account by email" or similar account-creation checkboxes.
  It may auto-check required official declarations needed to continue the
  e-Visa flow, but account creation by email must remain unchecked.
- `src/alert.ts`: Resend failure alerts.
- `src/supabase.ts`: Supabase service client.

## Data Contract

- Runners read applicant answers from `visa_application_answers` first and use
  `applicant_profiles` only as a fallback or for ownership/user metadata.
- The frontend bilingual flows must materialize shared fields into
  `visa_application_answers`; do not add runner-only UI state.
- Keep per-country normalization in the runner module (`normalize.ts`,
  `field-mappings.ts`, or equivalent) so the stored answer keys stay portable.

## Current Package Progress

| Country/package | Status | Stop point / result |
| --- | --- | --- |
| US DS-160 / CEAC | Live assisted gated | Dry-run by default; live assisted requires explicit env enablement, uses CAPTCHA solving when needed, and completes applicant Sign/Submit as part of one-shot submission. |
| US B1/B2 appointment / China USVisaScheduling | Assisted-live gated | Requires `US_APPOINTMENT_ASSISTED_LIVE_ENABLED=true`, `US_APPOINTMENT_PROVIDER_ALLOWLIST=usvisascheduling`, and `US_APPOINTMENT_SUPPORTED_COUNTRIES=CN`; reads VIZA-created appointment account credentials, automates supported login/account-prep and official slot/status observation, books only after user slot selection plus payment/final approval, and must handle supported CAPTCHA, waiting rooms, policy warnings, and approval checkpoints without hiding unsupported gates or skipping user slot selection/payment/final VIZA approval. |
| France Schengen | Live assisted gated + TLS appointment scaffold | Dry-run by default; France-Visas live assisted requires explicit env enablement, can register a France-Visas account with a VIZA alias and 2captcha for the registration image CAPTCHA only, captures encrypted/redacted official references where available, and stops before final validation/payment/booking. TLScontact China appointment/payment require separate explicit env gates, use the shared mainland China center registry, and book only after backend slot observation, user slot selection, one-time payment authorization, and final approval. |
| Australia Subclass 600 | Phase 3 | Walks ImmiAccount form to Review, captures TRN/review artifact; user submits. |
| Vietnam e-Visa | Phase 3 + gated payment pilot | Fills form and stops before Pay/Submit by default; captures registration code when portal review is reached. With explicit VIZA official-fee authorization plus fixed-card pilot env flags, may continue from the official payment page until paid or a 3DS/OTP/unknown-gateway manual checkpoint appears. |
| Singapore SG Arrival Card | Live assisted | Dry-run validates `SG_ARRIVAL_CARD`; live worker fills ICA SGAC and submits after Review, returning confirmation/reference details when available. |
| Malaysia MDAC | Live dispatch + portal evidence | Dry-run validates `MY_MDAC_ARRIVAL_CARD`; live worker dispatches to the official MDAC portal and records exact portal block/error evidence. Current official-form completion depends on MDAC portal reachability from the runner network/session. |
| Thailand TDAC | Live dispatch + Turnstile entry | Dry-run validates `TH_TDAC_ARRIVAL_CARD`; live worker dispatches to the official TDAC portal, attempts official Turnstile solving through the configured CAPTCHA provider, and records exact portal block/error evidence until the complete final-submit selector path is mapped. |
| Philippines eTravel | Live dispatch scaffold + 72-hour scheduling | Dry-run validates `PH_ETRAVEL_ARRIVAL_CARD`; live worker dispatches to `https://etravel.gov.ph`, defaults to stop-before-submit, stores portal block/error evidence, and must not mark success without official QR/reference evidence. |
| UK Standard Visitor | Phase 2 | Pre-auth/register/resume scaffold only; post-auth full form selectors remain unmapped. |
| India/Sri Lanka/Cambodia/Laos/South Africa | Smoke/scaffold | Use per-country smoke scripts and status docs before promoting. |
| Italy/Egypt/Indonesia/Japan/Canada | Recon/docs or document renderer scope | Requires official-form recon and schema/runner acceptance before queue enablement. |
| Korea C-3-9 | Official e-Form + appointment scaffold | Frontend prioritizes Korea Visa Portal barcode e-Form generation/download and keeps Annex-17 only as fallback; `src/korea-eform/**` models official e-Form checkpoints and `src/korea-kvac/**` supports dry-run slot observation/booking after user selection. Live portal completion remains gated pending per-center/post selector validation and official PDF capture. |

## Ownership Boundaries
- France-Visas registration CAPTCHA solving is allowed only for the explicit
  account-registration flow guarded by `FRANCE_ACCOUNT_REGISTRATION_ENABLED`
  and `FRANCE_REGISTRATION_2CAPTCHA_ENABLED`; login risk challenges and
  anti-bot/Cloudflare gates remain manual checkpoints.
- France TLS service-fee payment sessions must be short TTL, in-memory/local
  handoffs. Do not persist full card numbers, CVV, OTP, payment passwords, or
  official TLS cookies to DB, logs, traces, screenshots, `.env`, or AGENTS.
- France TLS official-page checks should prefer `FRANCE_TLS_BROWSER_API_ENDPOINT`
  or `FRANCE_TLS_CDP_ENDPOINT` before global Browser API settings. Never log
  endpoint URLs or embedded credentials.
- France TLS live booking must not bypass unsupported official-site MFA,
  real-name, WAF, policy, or payment-challenge gates. Stop with structured
  checkpoint/error evidence instead of marking success.
- Keep Playwright selectors isolated in mapping files where possible.
- Keep retries and queue status transitions explicit.
- Do not move AI/RAG logic here; use `agent-backend`.
- Do not move frontend submission UI here; use `viza-fe/internal-website`.
- Never log or commit portal credentials, service-role keys, applicant
  documents, screenshots with secrets, or CAPTCHA/API keys.
- Appointment loading UI must be tied only to an active appointment job for the
  same application. Opening or revisiting the appointment page must read the
  latest VIZA DB status and must not create, rerun, or rebook a job. New
  official-site work is allowed only from explicit start, check-slots,
  check-status, select-slot, or confirm-booking actions, with backend cooldowns
  for official status and slot refreshes.

## Validation

Run from this directory:

```powershell
npm run type-check
npm run build
```

Smoke order for official-portal validation:

```powershell
npm run install-browsers
npx ts-node src/ceac/smoke.ts
# Requires FV_EMAIL/FV_PASSWORD and creates a France-Visas draft/reference:
npx ts-node scripts/run-fv-smoke.ts .\scripts\fv-answers.example.json
# Requires an authorized FRANCE_TLS_* or global Browser API/CDP endpoint;
# captures official TLS WAF/login/slot/payment checkpoints:
npm run france-tls:live-smoke -- --url=https://visas-fr.tlscontact.com/en-us/login
# Requires AU_USERNAME/AU_PASSWORD, optional AU_TOTP_SECRET:
npm run au:smoke
# Public Vietnam form; stops before Pay/Submit:
npm run vn:smoke
# Public arrival-card forms; stop before final Submit unless --submit is passed:
npx tsx scripts/run-mdac-smoke.ts
npx tsx scripts/run-tdac-smoke.ts
npm run ph-etravel:chrome
npx tsx scripts/run-ph-etravel-smoke.ts
# Korea KVAC/consulate center reachability only; no SMS/final booking:
npx ts-node scripts/smoke-korea-kvac-centers.ts
# UK recon/pre-auth walk:
npx ts-node scripts/walk-uk-portal.ts
```

For CEAC changes, follow `docs/ceac-smoke-test.md` and preserve diagnostics
artifacts for failures. For France smoke, delete any test draft/reference from
the France-Visas account after confirming the run.

## 2026-06-04 Local Validation Notes

- `npm run type-check` initially failed because the local `node_modules` tree did
  not contain `imapflow` even though it is declared in `package.json` and
  `package-lock.json`. Restore dependencies from the lockfile before treating
  TypeScript failures as product regressions.
- `npx ts-node src/ceac/smoke.ts` initially failed before reaching CEAC because
  the Playwright Chromium executable was missing. Run `npm run install-browsers`
  before CEAC or country smoke tests.
- `.env` contained Supabase/Resend/2captcha/OpenAI keys but no
  `FV_EMAIL`/`FV_PASSWORD`, so France live smoke could not be run until those
  credentials are provided out of band.
- After `npm install` and `npm run install-browsers`, `npm run type-check` and
  `npm run build` passed.
- US CEAC basic smoke passed on 2026-06-04:
  `npx ts-node src/ceac/smoke.ts` returned `outcome: "start_page"`,
  `detectedPageId: "start"`, heading `Apply For a Nonimmigrant Visa`. CAPTCHA
  solve smoke and full worker path were not run.
- Vietnam smoke was made executable via `npm run vn:smoke`, but the live run
  timed out after 120 seconds before reaching a terminal pre-pay/review result.
  Treat Vietnam as requiring selector/progress diagnostics before promotion.
- AU smoke harness exists via `npm run au:smoke`, but it requires
  `AU_USERNAME`/`AU_PASSWORD` and was not run in this environment.

## Related Files

- `viza-be/submission-service/README.md`
- `viza-be/submission-service/.env.example`
- `viza-be/submission-service/src/index.ts`
- `viza-be/submission-service/src/queue-scheduler.ts`
- `viza-be/submission-service/src/submission-queue-claim.ts`
- `viza-be/submission-service/src/__tests__/queue-pickup-order.spec.js`
- `viza-be/submission-service/src/__tests__/queue-scheduler.spec.ts`
- `viza-be/submission-service/src/__tests__/queue-claim-rpc.spec.ts`
- `viza-be/submission-service/src/country-submissions/*`
- `viza-be/submission-service/src/korea-eform/*`
- `viza-be/submission-service/src/korea-kvac/*`
- `viza-be/submission-service/src/types.ts`
- `viza-be/submission-service/src/inbox/alias.ts`
- `viza-be/submission-service/src/france-visas/mailbox-provider.ts`
- `viza-be/submission-service/src/france-tls/*`
- `viza-be/submission-service/scripts/run-france-tls-live-smoke.ts`
- `viza-be/submission-service/src/france-tls/__tests__/browser-api.spec.ts`
- `viza-be/submission-service/src/france-tls/__tests__/recaptcha-grid.spec.ts`
- `viza-be/submission-service/src/captcha/__tests__/two-captcha-grid.spec.ts`
- `viza-be/submission-service/src/ceac/AGENTS.md`
- `viza-be/agent-backend/src/db/schema.ts`
- `docs/prd-ds160-ceac-runtime-validation.md`
