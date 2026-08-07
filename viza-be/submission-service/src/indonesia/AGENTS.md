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
- `account-alias.ts` owns canonical alias v2 migration. B1 and C1 share the
  applicant's one VIZA-managed alias/account; prior credentials are archived
  read-only and must not be selected for new submissions.
- A saved official draft created before the alias-v2 migration may use the
  archived account credentials for a read-only login-resume attempt. This
  exception is allowed only when the same VIZA application has a reusable
  official URL; never write the archived credentials back as current, use them
  for a fresh application, or replace the canonical alias in application forms.
- If that archived-account resume fails, reopen a fresh official login page and
  try the canonical managed account once. If the reusable canonical account is
  also rejected, follow the visible official Forgot Password control, scope the
  reset email to the applicant alias and request timestamp, and persist a new
  12-character compliant password only after a successful reset and verified
  login. If the official reset endpoint returns its explicit missing-account
  response and no scoped reset email arrives, registration of that same
  canonical alias may resume with the new compliant password; persist it only
  after official email verification and a verified login. On any ambiguous recovery state, stop at
  `official_account_recovery_required`; do not fall through to duplicate
  registration or payment.
- A fresh login page may hydrate slowly through the remote browser. Wait for
  both username and password controls before classifying the canonical account
  retry as unavailable, and preserve a diagnostic artifact when they never
  become visible.
- The official portal can keep a rejected account in a pending OTP server
  session and redirect `/front/login` back to hidden OTP controls. Reset the
  official-portal cookie session before the one canonical-account retry, then
  return to the portal root and follow its visible Sign In link so the portal
  mints the required `menu-token` for a genuine login form. Do not guess or
  open a bare login URL after the reset.
- Never log official account passwords, portal OTPs, card data, CAPTCHA tokens,
  or full applicant document paths.
- Use VIZA-managed inbox aliases through `ensureApplicantInboxAlias`. Verify MX
  and forwarding consent before registration, and wait for verification/OTP by
  applicant plus alias. Never fall back to sender-only OTP matching.
- When a failed managed-account login opens the foreigner registration form,
  keep the browser on that form until it is filled, submitted, and email
  verified. Opening `/front/register/wna` is not a completed login and must not
  immediately resume a saved application URL.
- Saved-application recovery must ignore diagnostics that merely echo a URL
  selected by an earlier run. Only direct portal/application-list/payment
  evidence may promote a reusable URL, otherwise stale expired drafts can
  become self-reinforcing.
- Saved-application recovery must inspect enough queue history to survive
  repeated retries; a small fixed window can exclude the newest direct
  portal/payment evidence after echoed selections are ignored.
- Stop with `action_required` for real payment authorization, 3DS/OTP, unknown
  portal gates, or official portal layout drift. Do not fabricate a submitted
  status.
- On the official step 3 review page, verify the persisted passport number from
  the passport input value as well as visible body text. HTML input values are
  not represented in `innerText` and must not be treated as missing review data.
- Fly containers do not have an X server. Keep
  `INDONESIA_PLAYWRIGHT_HEADLESS=true` in cloud deployments even when a
  one-time payment card is attached; surface 3DS/OTP as a checkpoint instead
  of launching a headed browser.
- Preserve screenshots/PDF/evidence artifacts outside Git.
- Photo uploads must run the official portal's `onFileChange` face-validation handler before falling back to the raw `uploadPhoto` handler, then wait for the portal to populate `path_photo`.
  When the normal file-input event leaves it empty, give the portal's face
  handler a bounded wait, then invoke the portal's own `uploadPhoto` handler if
  face-api stalls. Always wait for the official AJAX response to populate the
  path. If the official endpoint returns a successful `files` path but the page
  callback misses it, synchronize that exact official response into
  `path_photo`; stop safely if the official endpoint does not return a path.
  If the page handler produces no observable response, POST the same CSRF form
  to the portal's own `/front/upload-photo` route and accept only the official
  JSON `files` path; never invent or locally derive a storage path.
- The current official `step_1` combines personal identity, passport, Indonesia
  stay/contact, return-ticket, and support-document fields. Fill those fields
  explicitly even when an MRZ payload was injected, because the portal's MRZ
  script may not propagate fallback values into the visible controls.
- `document-reuse.ts` allows sibling reuse only for universal passport/portrait
  files, ensures current valid Indonesia files win document-type selection,
  does not infer validity from non-official file-name or storage-path naming
  conventions, and assigns package requirements before card consumption: B1
  needs passport, photo, and return/onward ticket; C1 additionally needs a bank
  statement.
- `card-session.ts` owns the one-time card handoff for Indonesia official-fee
  payment continuation. Local development uses the localhost-only endpoint;
  production uses the bearer-token-protected internal endpoint on the retained
  sticky `viza-runner-indonesia` Machine. In both modes it must stay in process memory,
  consume PAN/CVV once, return only redacted metadata, and never persist card
  data. The runner may consume the card at job start or lazily when the official
  payment page is reached; the lazy consume closes the HTTP registration and
  queue-claim timing gap while preserving single-use semantics.
  data to DB, logs, traces, env files, or applicant vault records.
