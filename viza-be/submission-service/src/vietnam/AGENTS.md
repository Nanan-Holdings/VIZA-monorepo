# Vietnam Submission Runner Agent Guide

Product policy (2026-11): the applicant submits and pays on the official site.
This supersedes every instruction below about solving the review CAPTCHA,
capturing the registration code, or continuing to payment in a live run.

- Live runs (`processVnItem`, `applicantHandoff: true`) fill the form in a
  keepAlive Browserbase session (`OFFICIAL_HANDOFF_SESSION_TIMEOUT_SECONDS`,
  VN proxy) and stop as soon as the review action reaches an official
  checkpoint (`isVietnamApplicantHandoffState`). They must not solve the
  review CAPTCHA, click Next/Submit/Confirm after it, or open payment. The
  landing-page CAPTCHA before the form is an access gate and may still be
  solved.
- The run returns `awaiting_applicant_official_submit` with `applicantHandoff`;
  `processVnItem` registers it through `open_official_applicant_handoff`
  (0209 + 0211, prefix `vn_`). Never put the live-view URL in
  `submission_result`, queue payloads, or logs. Any run that does not hand off
  releases its keepAlive session; a handed-off run only disconnects CDP and
  never closes the context.
- `vietnam/handoff.ts` watches read-only: an electronic document code
  (`E` + 6 digits + 8+ characters, or an explicitly labelled registration
  code) is the submit evidence; payment success text closes the handoff. The
  portal has no login, so there is no `lost` detection; unsubmitted handoffs
  expire. On submit the watcher writes a VN `submitted_pending_email` result
  with `registrationCode` and starts the usual status tracking.
- Applicant cancellation raises `ApplicantCancelledError` from `onProgress`;
  `run.ts` rethrows it instead of reporting a portal failure, and the row
  becomes `vn_live_assisted_cancelled`.

- Slow remote sessions: required field actions in `fillers.ts` use
  `ACTION_TIMEOUT` (default 20s, `VN_FIELD_ACTION_TIMEOUT_MS`, 2s-60s);
  best-effort `.catch` actions keep the 5s `SHORT_TIMEOUT`. `run.ts` wraps each
  non-upload field in `fillVietnamFieldWithTimeoutRetry`, which retries once
  only on a Playwright timeout, never on a portal rejection or upload. Do not
  shorten these bounds: on 2026-11-21 a 5s bound half-typed the date of birth
  on a slow VN-proxy session and failed the run. Tests: `step-fill.spec.ts`.
- Every field attempt (uploads included) also runs under
  `withVietnamFieldDeadline` (default 150s, `VN_FIELD_DEADLINE_MS`, 30s-300s).
  Some steps, such as the in-browser photo compression `page.evaluate`, have no
  Playwright timeout; after a network drop on 2026-11-21 a dead CDP connection
  hung a run for 40+ minutes at `portrait_photo`. A deadline error is not
  retried; the run fails closed and releases its Browserbase session.
- Progress watchdog (`fillVietnamApplicationOnce`, `VN_RUN_STALL_TIMEOUT_MS`,
  default 10 min, above the 8-min CAPTCHA budget): the queue heartbeat is a
  timer and only proves the process is alive, so the attempt itself tracks the
  last stage/field progress and closes its browser when nothing moves, returning
  a retryable `vietnam_run_stalled` failure. When every field failure is a
  slow-session error (`isVietnamSlowSessionValidationError`) the attempt returns
  retryable `vietnam_slow_session` instead of a terminal `form_validation_failed`,
  so `isRetryableVietnamResult` retries it in a fresh browser. Retry messages
  must contain "timeout" (the retry rule matches on it). Real portal rejections
  stay terminal. Not covered yet: a killed/crashed worker process still leaves
  its row `vn_live_assisted_processing` until stale maintenance (45 min).

Product policy (2026-09-15): payment execution has been removed.
`src/payment-removed.ts` defines the unconditional retirement boundary.
Card-session HTTP routes return 410; issuer and portal payment functions cannot
spend or acquire cards, regardless of environment flags. Official fee checkpoints
remain needs-attention states, never fabricated paid/submitted outcomes.
Existing form filling, ownership/lease fences, consent, and browser cleanup remain.
This supersedes historical payment pilot instructions below.

Scope: this file applies to `viza-be/submission-service/src/vietnam/**`.

## Reference Implementation

When debugging official Vietnam e-Visa form location, dropdown selection, or
autofill behavior, first compare against the local Chrome extension reference:

```text
D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\vietnam-visa-helper-v1
```

Key files:

- `apply-entry.ts`: chooses the visible official Apply control before falling
  back to direct route navigation so Vue initialization handlers are preserved.
- `declaration.ts`: keeps NOTE declaration checkbox acknowledgement idempotent
  so each official input is checked exactly once before `Next`.
- `vietnam-visa-helper-v1/content.js`: production content script with robust
  field discovery, Ant Design Vue select handling, checkbox/radio filling, and
  upload helpers.
- `vietnam-visa-helper-v1/diagnose-failed-dropdowns.js`: dropdown ownership and
  visible-menu diagnostics.
- `vietnam-visa-helper-v1/dropdown-smoke-test.js`: focused dropdown smoke logic.
- `vietnam-visa-helper-v1/TESTING_GUIDE.md`: concise notes on staged autofill.
- `status-check.ts`: official lookup parsing, CAPTCHA-assisted search, and PDF capture.
- `status-tracking.ts`: daily/email/user checks, trusted status persistence,
  versioned PDF delivery, and notification settlement through the fenced
  Vietnam status RPCs. The 0140 worker claim carries `lease_generation` and
  `lease_expires_at`; heartbeats renew from the database expiry and abort
  portal work on ownership loss. Completion/failure/defer RPCs are the only
  application/tracking/document/notification/retry writers; callers stop and
  await heartbeat renewal before settlement, omit caller timestamps, and pass
  only full-SHA deterministic artifact keys plus validated status URLs.
- `status-tracking-schedule.ts`: deterministic daily window in `Asia/Ho_Chi_Minh`.
- `evisa-pdf.ts`: official PDF magic-byte, size, and SHA-256 validation.
- `official-email.ts`: payload-only VIZA alias override for the two official
  email fields.

Important patterns to mirror in the Playwright runner:

- Locate fields through their nearest `.ant-form-item` and associated visible
  labels before falling back to global selectors.
- For Ant Design Vue dropdowns, prefer the combobox input
  `.ant-select-selection-search-input, input[role="combobox"]`, inspect
  `aria-controls` / `aria-owns`, and choose from the visible owned dropdown
  before scanning global `.ant-select-dropdown` nodes.
- Dispatch real click/input/change events when direct DOM value assignment is
  used, because Vue state must receive the event.
- Keep a diagnostic artifact when a dropdown fails: selected field id, label,
  visible dropdown ids, candidate option text, and current displayed value.

## Runner Contract

- The worker may solve official Vietnam CAPTCHA with TWOCAPTCHA when the portal
  presents one and `TWOCAPTCHA_API_KEY` is configured.
- Newly paid live e-Visa submissions use the VIZA inbox alias only in the
  official email fields. Never overwrite the personal profile email or enable
  the portal's email-account checkbox.
- Email accelerates checking but never postpones the once-per-Vietnam-day
  check. Unknown/error pages must not overwrite the last trusted user status.
- Stop at the payment/checkpoint page after registration/reference capture by
  default. The only allowed exception is the Vietnam official-fee autopay pilot,
  and only when `VN_OFFICIAL_PAYMENT_AUTOPAY=true`, the user/admin
  authorization exists, and a one-time in-memory card session or explicitly
  enabled local fixed-card process env is available. Frontend-entered PAN/CVV
  must pass through `card-session.ts` only, be consumed once, and never be
  stored in DB, `.env`, queue payloads, logs, traces, screenshots, AGENTS, or
  personal profile records. Never handle OTP/3DS as stored data. For the
  explicitly authorized Vietnam autopay pilot, a Standard Chartered SC Mobile
  out-of-band challenge may keep the existing headless browser session alive
  for the issuer's short approval window and follow the issuer page's supported
  completion flow after the user approves in the banking app. Never read,
  request, persist, or log an OTP/3DS secret, and never mark payment successful
  without an official receipt/reference.
- Preserve `validationErrors`, `fieldFallbacks`, CAPTCHA telemetry, trace, and
  final screenshot in the queue payload for frontend evidence and schema tuning.
- `country-options.ts` contains the alpha-3 country-name index used to normalize
  Vietnam e-Visa nationality answers before Ant Select filling. Keep it aligned
  with captured official/standard country option text when nationality dropdown
  options are refreshed.
- Before marking the Vietnam flow verified, run the user-facing browser path:
  click the frontend submit/retry button, confirm the worker picks up the queue
  and the UI progresses, then preserve the official portal trace/screenshot and
  DB result. If the browser-click test is blocked, report the exact reason.
- Shared-pool runs receive a `RunnerExecutionContext`; abort the browser on
  lease loss and assert ownership before CAPTCHA/payment actions. The runner
  must propagate cancellation rather than mapping it to `RetryableRunnerError`.
