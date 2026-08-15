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
- Reuse the shared `src/captcha` Turnstile solve path for eTravel account login,
  account registration, and any Turnstile surface visible immediately before
  the final Review submit. Do not add a PH-only captcha network client.
- eGovPH may deliver a generic registration-attempt notice before the actionable OTP. Keep a short grace window so the OTP or verification link wins instead of prematurely switching to existing-account login.
- On personal-information onboarding, explicitly verify the Foreign Passport Holder radio state and treat visible upload/network errors as failed profile-photo uploads; the page's default avatar is not upload evidence.
- Do not infer authentication from the absence of login fields while the landing page is still loading. Wait for explicit login-form or authenticated-dashboard evidence and retry the sign-in transition with a bounded loop.
- `form-filler.ts` owns the post-authenticated official page state machine and field plan. It must fill all visible steps, capture per-step evidence, stop on Review when requested, and click final Submit only when the caller explicitly disables `stopBeforeSubmit`.
- `submission-state-sync.ts` owns the feature-gated application-side adapter for the future atomic PH submission-state RPC. It must remain fail-closed until the DB RPC returns a complete idempotent outcome; it never drives browser or official final-submit actions.
- `submission-state-cutover.ts` owns the v2 cutover dry-run decision. It has no database writer or portal dependency, must stop before account/browser work when preflight blocks, and must prohibit fallback to legacy sequential writes on every outcome.
- `launch-preflight-envelope.ts` owns the versioned PH-D-facing preflight envelope. It may only emit the v1 safe fields, must normalize legacy `missingKeys` into sorted unique canonical keys, and must fail closed without starting queue, browser, account, RPC, or final-submit work.
- `profile-owned-preflight.ts` owns the E21 profile photo/mobile/residence client-only boundary. It must leave photo upload, phone presets, and residence cascades action-required until live/server evidence exists; generic 5 MB widget defaults are never a profile server rule.
- `residence-address.ts` owns canonical permanent-residence normalization and browser action planning. Philippine addresses require official region/province/municipality/barangay codes and select in dependency order; foreign addresses never infer or emit Philippine hierarchy actions.
- `air-destination-preflight.ts` owns the E22 AIR/Special Flight/transit/return/accommodation client-only boundary. It must keep all S2 gaps action-required, treat `is_special_flight` only as derived UI state, and never let dynamic hotel/port metadata choose an AIR customs flow by itself.
- `health-preflight.ts` owns the E23 Health client-only boundary. It must keep the five S3 gaps action-required, treat bats/animals as translation-only rather than a control, and never infer a payload or enable a Health browser action from static handler wiring.
- `sea-flow-preflight.ts` owns the E24 SEA explicit-false, port-key, and route boundary. It must keep both port keys distinct and treat `with_custom_declaration` only as a dynamic-page gate, never as a manual/electronic port mapping or a payload field.
- `attachment-owner-contract.ts` owns the E14 metadata-only attachment precheck and Owner N/A normalization boundary. It must never upload a file, use a guessed Owner N/A selector, create a signature, or infer live/server attachment rules.
- `wizard-semantics.ts` owns E15 route and post-signature semantic guards. It must treat `wizard_page` only as incidental route state, never auto-accept the Family/no-companion flow, and never enable final Submit.
- `result-evidence.ts` owns E16 authoritative-result and reference-derived QR gates. It must never treat final-POST HTTP status, a local reference-shaped string, or a local QR file as submitted evidence, and it must never resubmit an ambiguous final POST.
- `runner-job.ts` owns the canonical PH arrival `runner_job` boundary. It must run stored-result recovery, 72-hour scheduling, and launch preflight before any account/browser call; its default path stops locally and can only synchronize an already-authoritative result through the feature-gated state-sync adapter.
- `sea-port-flow.ts` owns the runtime public-option boundary for SEA `destination_port_code` customs-flow metadata. It must never use `disembarking_port_code`, persist a permanent port snapshot, or allow electronic controls without both current metadata and matching visible page content.
- Browserbase is selected with `PH_ETRAVEL_BROWSERBASE_ENABLED=true`; the default managed proxy country is `PH`. Never log its connect URL, API key, or replay-session credentials.
- `scripts/run-ph-etravel-departure-smoke.ts` is the safe-by-default departure parity entry point. It accepts `--transport air|sea`, `--passport-holder filipino|foreigner`, and `--use-imap-mailbox` and must return nonzero when Review is not reached.
