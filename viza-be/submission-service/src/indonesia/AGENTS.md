# Indonesia submission runners

Scope: `viza-be/submission-service/src/indonesia/**`.

This module owns Indonesia C1 Tourist eVisa and B1 e-VoA live-assisted queue
normalization and official-portal orchestration through the Indonesia
Directorate General of Immigration eVisa portal.

- Keep C1 (`indonesia_c1_live`) and B1 e-VoA (`indonesia_b1_evoa_live`)
  separate at provider/status boundaries.
- Route both C1 and B1 to `https://evisa.imigrasi.go.id/` by default. Treat
  VFS Indonesia e-VoA as fallback recon only, not the primary B1 runner.
- Keep portal probing/classification in `runner.ts` and `portal-state.ts`.
- Never log official account passwords, portal OTPs, card data, CAPTCHA tokens,
  or full applicant document paths.
- Use VIZA-managed inbox aliases through `ensureApplicantInboxAlias`; do not
  block the applicant on manual account email verification when the email worker
  can consume the official verification email.
- Stop with `action_required` for real payment authorization, 3DS/OTP, unknown
  portal gates, or official portal layout drift. Do not fabricate a submitted
  status.
- Preserve screenshots/PDF/evidence artifacts outside Git.
- `card-session.ts` owns the local-only one-time card handoff for Indonesia
  official-fee payment continuation. It must stay in process memory, consume
  PAN/CVV once, return only redacted metadata, and never persist card data to
  DB, logs, traces, env files, or applicant vault records.
