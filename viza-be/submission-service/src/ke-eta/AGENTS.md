# Kenya eTA Runner

Product policy (2026-09-15): payment execution has been removed.
`src/payment-removed.ts` defines the unconditional retirement boundary.
Card-session HTTP routes return 410; issuer and portal payment functions cannot
spend or acquire cards, regardless of environment flags. Official fee checkpoints
remain needs-attention states, never fabricated paid/submitted outcomes.
Existing form filling, ownership/lease fences, consent, and browser cleanup remain.
This supersedes historical payment pilot instructions below.

Scope: `KE_ETA` official Kenya eTA automation only. F88 and paper arrival
declarations are outside this package.

- The live gate is `KE_ETA_LIVE_ENABLED=true`; the default is fail-closed.
- The form runner preserves normalized application prefill through the official
  fee checkpoint, then returns `payment_removed` without requiring, acquiring,
  or finalizing a card. A caller-supplied card handoff cannot bypass this
  checkpoint.
- `submitted` requires an official eTA reference on the official host;
  `approved` additionally requires a valid official PDF beginning with `%PDF-`.
- Retry/restart must look up the existing application result before opening the
  portal or advancing to the official fee checkpoint.
- Use the VIZA-managed alias for email verification and preserve OTP secrecy.
- CAPTCHA solving uses the shared TWOCAPTCHA integration only when the official
  page exposes a site key. Unknown selectors, WAF pages, and missing artifacts
  are structured failures, never successful submissions.
- `__tests__/runner-safety.spec.ts` proves that normalized prefill reaches the
  fee checkpoint, that the checkpoint reports `payment_removed`, and that an
  externally supplied card cannot produce a submitted result.
