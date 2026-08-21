# Kenya eTA Runner

Scope: `KE_ETA` official Kenya eTA automation only. F88 and paper arrival
declarations are outside this package.

- The live gate is `KE_ETA_LIVE_ENABLED=true`; the default is fail-closed.
- The standard official fee is represented as a USD payment handoff. A runner
  cannot proceed without an application-scoped, limited virtual-card session.
- `submitted` requires an official eTA reference on the official host;
  `approved` additionally requires a valid official PDF beginning with `%PDF-`.
- Retry/restart must look up the existing application result before opening the
  portal or issuing another payment session.
- Use the VIZA-managed alias for email verification and preserve OTP secrecy.
- CAPTCHA solving uses the shared TWOCAPTCHA integration only when the official
  page exposes a site key. Unknown selectors, WAF pages, and missing artifacts
  are structured failures, never successful submissions.
- `__tests__/runner-safety.spec.ts` proves that card material is acquired only
  from inside the evidenced payment adapter and that a result without payment
  consumption cannot become `submitted`.
