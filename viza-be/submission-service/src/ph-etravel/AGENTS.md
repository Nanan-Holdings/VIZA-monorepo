# Philippines eTravel Runner

Scope: Philippines `PH_ETRAVEL_ARRIVAL_CARD` and independent `PH_ETRAVEL_DEPARTURE_CARD` official eTravel portal automation.

- Keep eTravel separate from `PH_TEMPORARY_VISITOR_VISA`; it is an arrival/departure declaration, not a 9(a) visa.
- Use `https://etravel.gov.ph` as the official portal entry point.
- Respect the official 72-hour submission window before arrival/departure. Future-dated rows should stay scheduled until the window opens.
- Arrival uses its arrival date; departure uses its Philippines departure date. Never schedule departure from the destination arrival date.
- Departure plans branch for AIR/SEA and FILIPINO/FOREIGNER and exclude arrival accommodation and health fields.
- Default smoke and local runs must stop before final submit unless `--submit` is explicitly passed with real applicant data.
- Before creating an official eTravel/eGovPH account, load `ph_etravel_accounts` for the applicant and reuse the prior account email/password/session when present. Create a new VIZA inbox-alias official account when no PH account row exists or when the official portal explicitly rejects the stored MPIN.
- A successful run must include official QR/reference evidence from the final eTravel confirmation page. Do not treat a generic screenshot or landing page as success.
- If the portal blocks access, requires CAPTCHA/WAF handling, changes layout, or lacks QR/reference evidence, return a structured failure with screenshots and summary.
- Treat a non-2xx registration API response as a registration failure and retry the email/Turnstile step; never wait for an inbox message after the official API rejected the request.
- eGovPH may deliver a generic registration-attempt notice before the actionable OTP. Keep a short grace window so the OTP or verification link wins instead of prematurely switching to existing-account login.
- On personal-information onboarding, explicitly verify the Foreign Passport Holder radio state and treat visible upload/network errors as failed profile-photo uploads; the page's default avatar is not upload evidence.
- Do not infer authentication from the absence of login fields while the landing page is still loading. Wait for explicit login-form or authenticated-dashboard evidence and retry the sign-in transition with a bounded loop.
- `form-filler.ts` owns the post-authenticated official page state machine and field plan. It must fill all visible steps, capture per-step evidence, stop on Review when requested, and click final Submit only when the caller explicitly disables `stopBeforeSubmit`.
- Browserbase is selected with `PH_ETRAVEL_BROWSERBASE_ENABLED=true`; the default managed proxy country is `PH`. Never log its connect URL, API key, or replay-session credentials.
- `scripts/run-ph-etravel-departure-smoke.ts` is the safe-by-default departure parity entry point. It accepts `--transport air|sea`, `--passport-holder filipino|foreigner`, and `--use-imap-mailbox` and must return nonzero when Review is not reached.
