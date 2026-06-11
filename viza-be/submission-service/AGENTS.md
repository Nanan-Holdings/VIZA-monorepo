# Submission Service Agent Guide

Scope: this file applies to `viza-be/submission-service/**`.

## Purpose

The submission service is a long-running Node/TypeScript worker that polls
`submission_queue` and drives official portal automation with Playwright. Its
product contract is reliable official-portal handoff/reference generation, not
clicking irreversible final sign, final submit, or payment actions on behalf of
the applicant.

## Key Flows

- `src/index.ts`: polling loop, Supabase data loading, document download,
  per-country dispatch, retry/failure handling, queue status transitions.
- `src/ds160-live-config.ts`: DS-160 dry-run/live-assisted feature flags and
  startup safety validation. Dry-run is the default.
- `src/france-live-config.ts`: France Schengen dry-run/live-assisted feature
  flags and safety validation. Dry-run is the default; live assisted is visible
  browser only and blocks final validation, payment, and appointment booking.
- `src/form-mappings.ts`: Indonesian e-visa portal selectors.
- `src/ds160-form-mappings.ts`: DS-160 field selector mappings.
- `src/ds160-coverage-audit.ts` and `src/ds160-completeness-verify.ts`:
  coverage/verification utilities.
- `src/ceac/**`: CEAC runtime pipeline for DS-160 prefill.
- `src/france-visas/**`: France-Visas sign-in, five fill steps, dashboard
  reference capture, optional CERFA PDF finalization, standard Chromium launch,
  VIZA-alias account registration, registration CAPTCHA solving when explicitly
  enabled, manual checkpoints, and typed failures.
- `src/inbox/alias.ts` and `src/france-visas/mailbox-provider.ts`: VIZA email
  alias provisioning and inbound-email verification-link extraction for
  official account registration.
- `src/country-submissions/**`: safe provider registry, schema/dry-run
  validation, unsupported-country handling, and inventory metadata for country
  submission capability audits.
- `src/uk/**`: UKVI pre-auth/resume scaffold; post-auth selector integration is
  still a known gap.
- `src/us-appointment/**`: China `CN/usvisascheduling` assisted-live handoff
  runner. Polls `appointment_assistance_jobs` when
  `US_APPOINTMENT_ASSISTED_LIVE_ENABLED=true`, uses the Cloudflare-backed
  `inbound_email` path for verification mail helpers, and pauses at login,
  CAPTCHA, payment, policy warnings, and final confirmation.
- `src/au-visitor/**`: ImmiAccount Subclass 600 runner; walks to Review and
  stops before applicant-controlled submit.
- `src/vietnam/**`: Vietnam e-Visa runner; uses a portal state machine for
  landing/NOTE/CAPTCHA/form/payment/white-screen checkpoints, fills the SPA
  when the official form is reached, and stops before payment/submission.
- `src/in/**`, `src/lk/**`, `src/kh/**`, `src/la/**`, `src/za/**`,
  `src/italy-vfs-cn/**`, `src/egypt/**`: smoke/recon/scaffold modules at
  varying maturity. Check `docs/visa-packages-status.md` before extending.
- `scripts/run-fv-smoke.ts`, `scripts/run-au-smoke.ts`,
  `scripts/run-vn-smoke.ts`: local live smoke entry points for official portal
  reach/fill validation.
- `src/alert.ts`: Resend failure alerts.
- `src/supabase.ts`: Supabase service client.

## Data Contract

- Runners read applicant answers from `visa_application_answers` first and use
  `applicant_profiles` only as a fallback or for ownership/user metadata.
- The frontend bilingual flows must materialize shared fields into
  `visa_application_answers`; do not add runner-only UI state.
- Keep per-country normalization in the runner module (`normalize.ts`,
  `field-mappings.ts`, or equivalent) so the stored answer keys stay portable.

## Current Package Progress

| Country/package | Status | Stop point / result |
| --- | --- | --- |
| US DS-160 / CEAC | Live assisted gated | Dry-run by default; live assisted requires explicit env enablement, never solves CAPTCHA APIs, and stops before applicant Sign/Submit. |
| US B1/B2 appointment / China USVisaScheduling | Assisted-live handoff gated | Requires `US_APPOINTMENT_ASSISTED_LIVE_ENABLED=true`, `US_APPOINTMENT_PROVIDER_ALLOWLIST=usvisascheduling`, and `US_APPOINTMENT_SUPPORTED_COUNTRIES=CN`; creates manual checkpoints and never bypasses CAPTCHA, waiting rooms, payment, policy warnings, or final confirmation. |
| France Schengen | Live assisted gated | Dry-run by default; live assisted requires explicit env enablement, can register a France-Visas account with a VIZA alias and 2captcha for the registration image CAPTCHA only, captures encrypted/redacted official references where available, and stops before final validation, payment, or appointment booking. |
| Australia Subclass 600 | Phase 3 | Walks ImmiAccount form to Review, captures TRN/review artifact; user submits. |
| Vietnam e-Visa | Phase 3 | Fills form and stops before Pay/Submit; captures registration code when portal review is reached. |
| UK Standard Visitor | Phase 2 | Pre-auth/register/resume scaffold only; post-auth full form selectors remain unmapped. |
| India/Sri Lanka/Cambodia/Laos/South Africa | Smoke/scaffold | Use per-country smoke scripts and status docs before promoting. |
| Italy/Egypt/Indonesia/Japan/Korea/Canada | Recon/docs or document renderer scope | Requires official-form recon and schema/runner acceptance before queue enablement. |

## Ownership Boundaries

- Do not click final DS-160 sign/submit or solve CAPTCHA gates. CEAC live
  assisted automation stops at applicant/operator handoff.
- Do not click final applicant declaration, final submit, irreversible payment,
  or appointment confirmation unless the user explicitly reopens that scope and
  the legal/product boundary has been updated.
- China US appointment assisted-live uses standard runner state and VIZA alias
  email helpers only. Do not use legacy IMAP for this flow, do not introduce
  stealth/proxy behavior, and keep slot/status checks user-triggered and
  cooldown-protected.
- France-Visas registration CAPTCHA solving is allowed only for the explicit
  account-registration flow guarded by `FRANCE_ACCOUNT_REGISTRATION_ENABLED`
  and `FRANCE_REGISTRATION_2CAPTCHA_ENABLED`; login risk challenges and
  anti-bot/Cloudflare gates remain manual checkpoints.
- Keep Playwright selectors isolated in mapping files where possible.
- Keep retries and queue status transitions explicit.
- Do not move AI/RAG logic here; use `agent-backend`.
- Do not move frontend submission UI here; use `viza-fe/internal-website`.
- Never log or commit portal credentials, service-role keys, applicant
  documents, screenshots with secrets, or CAPTCHA/API keys.

## Validation

Run from this directory:

```powershell
npm run type-check
npm run build
```

Smoke order for official-portal validation:

```powershell
npm run install-browsers
npx ts-node src/ceac/smoke.ts
# Do not use --solve-captcha for DS-160 live assisted validation.
# Requires FV_EMAIL/FV_PASSWORD and creates a France-Visas draft/reference:
npx ts-node scripts/run-fv-smoke.ts .\scripts\fv-answers.example.json
# Requires AU_USERNAME/AU_PASSWORD, optional AU_TOTP_SECRET:
npm run au:smoke
# Public Vietnam form; stops before Pay/Submit:
npm run vn:smoke
# UK recon/pre-auth walk:
npx ts-node scripts/walk-uk-portal.ts
```

For CEAC changes, follow `docs/ceac-smoke-test.md` and preserve diagnostics
artifacts for failures. For France smoke, delete any test draft/reference from
the France-Visas account after confirming the run.

## 2026-06-04 Local Validation Notes

- `npm run type-check` initially failed because the local `node_modules` tree did
  not contain `imapflow` even though it is declared in `package.json` and
  `package-lock.json`. Restore dependencies from the lockfile before treating
  TypeScript failures as product regressions.
- `npx ts-node src/ceac/smoke.ts` initially failed before reaching CEAC because
  the Playwright Chromium executable was missing. Run `npm run install-browsers`
  before CEAC or country smoke tests.
- `.env` contained Supabase/Resend/2captcha/OpenAI keys but no
  `FV_EMAIL`/`FV_PASSWORD`, so France live smoke could not be run until those
  credentials are provided out of band.
- After `npm install` and `npm run install-browsers`, `npm run type-check` and
  `npm run build` passed.
- US CEAC basic smoke passed on 2026-06-04:
  `npx ts-node src/ceac/smoke.ts` returned `outcome: "start_page"`,
  `detectedPageId: "start"`, heading `Apply For a Nonimmigrant Visa`. CAPTCHA
  solve smoke and full worker path were not run.
- Vietnam smoke was made executable via `npm run vn:smoke`, but the live run
  timed out after 120 seconds before reaching a terminal pre-pay/review result.
  Treat Vietnam as requiring selector/progress diagnostics before promotion.
- AU smoke harness exists via `npm run au:smoke`, but it requires
  `AU_USERNAME`/`AU_PASSWORD` and was not run in this environment.

## Related Files

- `viza-be/submission-service/README.md`
- `viza-be/submission-service/.env.example`
- `viza-be/submission-service/src/index.ts`
- `viza-be/submission-service/src/country-submissions/*`
- `viza-be/submission-service/src/types.ts`
- `viza-be/submission-service/src/inbox/alias.ts`
- `viza-be/submission-service/src/france-visas/mailbox-provider.ts`
- `viza-be/submission-service/src/ceac/AGENTS.md`
- `viza-be/agent-backend/src/db/schema.ts`
- `docs/prd-ds160-ceac-runtime-validation.md`
