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
