# Vietnam Submission Runner Agent Guide

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
  versioned PDF delivery, and notifications.
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
  personal profile records. Never handle OTP/3DS as stored data; stop at a
  manual checkpoint when the gateway asks for them.
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
