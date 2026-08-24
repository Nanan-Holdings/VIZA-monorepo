# Japan Visit Japan Web Runner

Scope: `JP_VISIT_JAPAN_WEB` only. Keep this package separate from the Japan
visa/paper-form runner.

- The live gate is `JP_VJW_LIVE_ENABLED=true`; the default is fail-closed.
- The separate compliance gate `JP_VJW_DELEGATED_OPERATION_APPROVED=true` is
  also mandatory before account creation, CAPTCHA, or final official actions.
  The live flag alone never authorizes delegated operation.
- `qr_ready` is valid only when the official `vjw.digital.go.jp` page exposes
  a visible QR element and the runner saves that element as evidence.
- A local QR image, a screenshot from another host, or an HTTP success response
  is never sufficient evidence.
- Use the VIZA-managed alias for portal email verification. Never log OTPs,
  verification links, passwords, or applicant documents.
- CAPTCHA solving is delegated to the shared TWOCAPTCHA integration only after
  the official page exposes a site key; WAF/Cloudflare clearance is not faked.
- Selector recon is intentionally fail-closed until a controlled live smoke
  confirms the current official form steps.
- `account.ts` owns the application-scoped VJW email/password vault contract.
  Persist only the managed alias, generated password, and registration state;
  never log those values or substitute environment-wide credentials.
- `errors.ts` owns the runner error type so browser state-machine helpers can
  fail closed without introducing import cycles.
- `live-adapter.ts` owns the current official Angular route/control state
  machine, including hCaptcha callback delivery, email-code verification,
  profile/trip registration, final ownership check, and QR element capture.
- The normalized required-answer contract contains only controls used by the
  current official flow. Managed account email may come from the application
  alias/profile, postal code is optional, and the single official
  `confirmChk` confirmation covers the combined immigration/customs entry.
  Do not reintroduce airport, last-embarkation-country, passport-type, issuing-
  country, general-phone, or a second visible declaration gate.
- `verification.ts` owns redaction-safe parsing of the six-digit official
  registration email code. Callers may return it to the browser adapter but
  must never log it.
