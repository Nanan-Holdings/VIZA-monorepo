# VIZA Submission Service

Node/TypeScript workers that drive country-specific official-portal flows. The
current service has two queue transports: the shared `runner_job` pool, which is
drained at startup and after an authenticated enqueue wake, and explicitly
enabled legacy/country `submission_queue` workers. There is no fixed 30-second
polling contract. The queue claim RPC, worker lease, persisted status, and
official evidence are authoritative for a run.

## Current lifecycle

1. A frontend or backend action creates or reuses one persisted job for the
   application. Generic retry enqueue is serialized per application by
   `enqueue_submission_retry`; an active processing or leased row is reused and
   stale retryable rows may be superseded.
2. A retained Fly worker starts its health endpoints before queue startup. The
   shared `runner_job` consumer performs one startup drain. The dedicated pool
   endpoint is `/internal/runner-job/wake`; the compatibility endpoint
   `/internal/submission-queue/wake` invokes both configured drain callbacks.
   Legacy `submission_queue` consumers are opt-in for dedicated workers.
3. An atomic service-role claim attaches the worker and lease. The runner keeps
   ownership while reading answers, opening a browser, saving artifacts, and
   writing a result. Ownership loss, cancellation, or an expired lease must
   abort the portal work and must not be converted into an ordinary portal
   failure.
4. The worker implements cleanup/shutdown paths for browsers, temporary files,
   queue leases and Fly slots. Verify terminal, cancellation and lease-loss
   paths for the product being released. Conditional idle exit checks for
   authoritative work, browser sessions and protected handoffs first.
5. Report success only after the provider-specific official reference and
   required evidence are persisted. A page that merely looks complete, a
   fixture confirmation, or an unverified external status is not success. The
   real USVisaScheduling client currently extracts a confirmation number but
   returns null PDF/screenshot fields; treat that as an evidence gap, not proof
   that an artifact exists.

The old description of an Indonesian-only worker, a permanent headless browser,
Railway deployment, and a 30-second `status='pending'` poll is historical and
does not describe this implementation.

## Important repository defaults

These are code defaults or `.env.example` examples. They do not prove that a
production worker has these values; production flags and secrets must be
verified in the deployment environment without copying them into this repo.

| Flow or control | Default / gate |
| --- | --- |
| Global submission mode | `VIZA_SUBMISSION_DRY_RUN=1` in the example environment |
| DS-160 | mode `dry_run`; `DS160_LIVE_SUBMISSION_ENABLED=false`; live requires `DS160_SUBMISSION_MODE=live_assisted`, the official CEAC origin, review-diff approval, a result secret, and applicant data/photo/passport prerequisites |
| DS-160 duration/evidence | `DS160_LIVE_MAX_DURATION_SECONDS=1800`; trace/screenshot config flags default on, but a flag alone does not establish that every path captures that artifact |
| US appointment runner | enabled only when `US_APPOINTMENT_ASSISTED_LIVE_ENABLED=true`; default provider `usvisascheduling`, country `CN`, batch size `3` |
| US real browser | `US_APPOINTMENT_PLAYWRIGHT_ENABLED=true` is required; default is false. Disabled browsers or persisted fixture data stop live jobs with a configuration checkpoint. Local tests inject their fixture client explicitly |
| US CAPTCHA | solving is opt-in and requires `US_APPOINTMENT_CAPTCHA_SOLVING_ENABLED=true` plus `TWOCAPTCHA_API_KEY`; unsupported MFA/WAF/policy gates remain manual checkpoints |
| France-Visas | mode `dry_run`, live submission false by default; France-Visas/TLS browser paths are Browserbase-only and fail closed when their required Browserbase configuration is unavailable |
| Queue consumers | `runner_job` consumer defaults on; legacy `submission_queue`, Vietnam cloud, and Indonesia queue consumers are separately enabled by environment. The code default for legacy polling is false even though the example file contains a legacy-worker value |

The effective values are loaded by `src/ds160-live-config.ts`,
`src/france-live-config.ts`, `src/us-appointment/runner.ts`, and
`src/index.ts`. The startup log is diagnostic only; it is not deployment
evidence.

## Queue, leases, and cold start

The normal queue claim path is an atomic service-role RPC using a worker id and
lease. The current code defaults the submission queue lease to 900 seconds with
a 60-second minimum, generic stale maintenance to 10 minutes, and the DS-160
live processing cutoff to `(1800 + 300)` seconds when its duration is not
overridden. Stale maintenance runs every 30 minutes by default, with a batch
size of 100 capped at 500. Ordinary queue failures use a maximum of 3 attempts;
manual, CAPTCHA/WAF, policy, and other external gates are persisted as blocked
or action-required instead of blindly consuming retry budget.

The shared Fly pool is configured for on-demand capacity in `deploy/fly/` and is
woken by the authenticated endpoint. A worker with `FLY_MACHINE_ID` and
`SUBMISSION_SERVICE_IDLE_EXIT_MS` set uses a 120-second idle default. Runner
machine slot leases are valid for 30 minutes and renew every 60 seconds; a lost
slot causes shutdown. The TOML files are deployment templates, not proof that a
particular Fly app is currently deployed or running. Keep production endpoints,
tokens, and provider credentials in the deployment secret store.

## DS-160 / CEAC

`src/ceac/orchestrator.ts` maps stored answers deterministically to the CEAC
personal, travel, passport, contact, family, work/education, and security pages.
It validates page identity before transitions, records section checkpoints, and
captures the CEAC `.dat` Save-to-File artifact at strategic boundaries. The
browser session uses a CEAC Browserbase session when enabled and otherwise a
local Chromium context. It accepts downloads and can solve the existing CEAC
image-CAPTCHA flow through the configured TWOCAPTCHA integration.

An expired CEAC session is resumed by creating a fresh browser context and using
the persisted Application ID, surname prefix, year of birth, and security
answer to retrieve the application. The runner does not replay `.dat` files into
a new CEAC session; captured `.dat`, screenshots, checkpoints and redacted
result metadata support an operator-driven resume. Trace collection is
runner-specific, not guaranteed by the DS-160 config flag. Temporary data is removed in
`finally` unless `DS160_KEEP_TEMP=1` is explicitly set for diagnostics.

`validateDs160LiveStart` checks mode, live enablement, official URL, review-diff
configuration, duration and result-secret presence. It does not itself check the
loaded `liveAssistedOnly` or `requireFinalUserConfirmation` booleans. Frontend
submit/retry gates are separate; do not infer an additional final-click approval
implementation from those field names.

In live-assisted mode, the runner fills the form, uploads the applicant photo,
reaches Sign and Submit, and performs the one logical final action when the
final passport value is available. Prefill mode intentionally stops at the
applicant handoff point. `enqueue_submission_retry` serializes retries for the
application and reuses eligible queue rows; an already completed official result
blocks an ordinary retry. The CEAC final click itself has no database idempotency key: if the
official server accepted a click but the confirmation page is delayed, the
bounded CAPTCHA retry loop can make another final-click attempt. Treat an
ambiguous post-click result as an operator review boundary rather than assuming
it is safe to submit again.

The browser runner does not call an LLM. Answer normalization, selector mapping,
conditional page detection, postback waits, retries, and success classification
are deterministic. Missing applicant data or a portal validation mismatch must
be surfaced to the owning form/schema rather than filled with invented values.
One current limitation is the fixed security-answer fallback in
`processDs160Item` when neither the supplied answer nor its profile fallback is
available; do not claim every retrieval credential is necessarily user-supplied.

## USVisaScheduling appointment runner

Explicit VIZA appointment actions wake `POST /internal/us-appointment/wake`
with `Authorization: Bearer <US_APPOINTMENT_INTERNAL_TOKEN>` and a JSON
`jobId`. The endpoint accepts one persisted live China USVisaScheduling job,
after startup and capacity-lease readiness, using migration 0193's atomic claim.
HTTP 202 means admission succeeded; it is not an official appointment result.
Duplicate calls share admission. Worker shutdown cancels queued claims;
ambiguous started claims remain held instead of replaying an official action.
The execution deadline includes queue wait. A browser that cannot stop within
the cleanup deadline makes the worker unhealthy and exits the machine.

The backend requires `US_APPOINTMENT_SUBMISSION_SERVICE_URL` and the matching
`US_APPOINTMENT_INTERNAL_TOKEN`; both sides also accept the existing shared
`SUBMISSION_QUEUE_INTERNAL_TOKEN` when no appointment-specific token is set.
For an existing on-demand Fly pool machine, configure
`US_APPOINTMENT_FLY_APP`, `US_APPOINTMENT_FLY_MACHINE_ID`, and the organization
`FLY_SUBMISSION_ORG_TOKEN`. The target URL must match that Fly app. The backend
verifies `RUNNER_MACHINE_KIND=pool` and a positive idle TTL no greater than one
hour before starting the exact existing machine and sending an instance-pinned
wake. It never creates or scales machines. Keep the existing pool sizing and
120-second idle setting. Enable the US live and Playwright flags on the worker
only after its secrets, claim RPCs, and portal configuration are verified.
Page/status reads do not wake or restart jobs.

`src/us-appointment/runner.ts` is restricted by default to `CN` and
`usvisascheduling`. It persists the review/consent, account or verification
checkpoint, current official slot observations, selected slot, final approval,
confirmation, and status-check states. Only an observed slot may be selected;
the final booking action requires a separately persisted final VIZA approval.
The frontend polls the persisted status, but opening or revisiting the page does
not create or rerun a job.

The real client chooses Browserbase, an authorized CDP endpoint, or local
Playwright. An explicit storage-state path can load and save cookies for a local
or connected context. Browser API session rotation is limited to retryable
Cloudflare gates. Persisted job fixtures and `playwrightEnabled=false` block
live processing; only a locally injected test client may simulate results.

To inspect an authorized existing China account without changing its job state:

```powershell
npm run us-appointment:login-smoke -- --application-id <authorized-application-uuid> --browserbase
```

This reads the saved encrypted credentials, attempts login once, and records a
redacted checkpoint report and masked screenshot in ignored `output/playwright`.
It stops before account creation, policy acceptance, application entry, payment,
or booking. Exit code 2 means the official session remains at a checkpoint.
If local services use different encryption keys, `--credential-config <env-file>`
explicitly loads only `SUBMISSION_RESULT_SECRET_KEY` from the account writer's
existing configuration into this diagnostic process. It never rewrites an env
file or changes the normal worker's key; align deployed writer/reader keys
through the existing secret-management process before enabling that account.

To register an authorized new account already provisioned by the appointment
orchestrator, use the application-bound command:

```powershell
npm run us-appointment:register -- --application-id <authorized-application-uuid> --browserbase
```

This command reads the saved encrypted password and actual applicant names. It
does not generate a replacement password or accept plaintext credentials on the
command line. Registration sends a verification code, reads new mail addressed
to that exact account, verifies the code, and clicks Create only after official
email verification succeeds. The account becomes active only when creation is
confirmed by the provider. Existing created/active/verified accounts are refused;
use the login diagnostic for those accounts. A paused or unconfirmed operation
returns a nonzero exit code. All browser sessions close on completion or error.
By default the command stops after account registration. Use
`--continue-to-appointment` to prepare the appointment flow in the same browser
after registration is confirmed. This does not select a slot or pay/book.
`--credential-config <env-file>` selects the existing account writer's encryption
key for this process, as in the login diagnostic.

Live validation (2026-09-14 UTC): after explicit user authorization, the selected
China application received a new application-scoped `viza.it.com` account while
the legacy `haggstorm.com` record and credentials were retained. Real official
verification mail arrived through the managed inbox, its code was verified,
and account creation plus subsequent login/security questions were confirmed.
The official authenticated profile and visible Sign out control were observed
before the account was saved as active. Privacy/confidentiality initialization,
contact email, China country and English portal language were completed. Profile
Update redirected to the official home; Start Application opened
`/en-US/applicant_details/`. No appointment, payment or confirmation was made.
The applicant-details adapter binds contact, address, passport and identity
fields from this application's owned answers/profile. It checks completeness
before filling and reports fields requiring review. The selected live application
needs a mobile calling code and reconciliation of conflicting passport number
and birth-date records before that official page can be submitted.

Live findings are reflected in code: the B2C password policy is 8–16 characters,
the send-code widget can appear after network idle, and Cloudflare waiting-room
admission must retain the same browser rather than reset its queue position.
Creation submissions whose login/evidence remains unresolved are persisted as
`registration_submitted` and cannot be registered again automatically.
Local Chromium tests cover these transitions and profile ownership/field guards.
Registration verifies bound-inbox routing before official browser work.

To exercise the entire placeholder scenario with the production Playwright client
and job runner, without using an official account:

```powershell
npm run us-appointment:placeholder-flow
# Optional visible browser:
npm run us-appointment:placeholder-flow -- --headed
```

The command covers registration/OTP, login, profile, Applicant Details, simulated
visa/delivery/payment pages, observed slots, separate selection and final approval,
confirmation capture, duplicate prevention, and status reading. Every browser HTTP
request is intercepted and fulfilled by a loopback fixture. Local redirects create
fresh intercepted navigations; a loopback-only proxy rejects escaped connections.
Separate negative controls verify both protections. The apparent official browser
URL is synthetic and never contacted. The command loads no environment file, credentials,
saved session or database repository. Screenshots and `result.json` are written to
ignored `output/playwright/us-appointment-placeholder/<timestamp>/`.

Visa options, delivery, payment, email delivery, VIZA user actions and persistence
are explicitly simulated. This is a runnable regression scenario, not evidence of
live payment/booking, frontend integration or parity with unobserved official pages.
The portal-to-worker wake integration is also incomplete: US jobs live in
`appointment_assistance_jobs`, and state updates alone do not wake the shared
`runner_job` consumer. The login diagnostic and local Chromium tests therefore
do not establish frontend-to-confirmation automation.

The runner may use the existing TWOCAPTCHA Turnstile/image integration only when
the corresponding flags and key are configured. MFA, identity, waiting-room,
rate-limit, policy, unsupported CAPTCHA/WAF, and ambiguous confirmation states
remain persisted manual checkpoints. The browser client closes its context in a
`finally` path and saves storage state only when an explicit path is configured.

## France-Visas and TLS

France-Visas live mode is disabled by default and has separate review, result
secret, account-registration, payment, and appointment gates. The ordinary
France-Visas runner signs in, fills steps 1–5, advances to the dashboard, and
can save the official reference/PDF. An explicit post-confirmation option may
continue the visa-center handoff, but the ordinary prefill flow does not infer
payment or appointment success. France-Visas and mainland-China TLScontact
browser sessions are Browserbase-only; a disabled or unavailable Browserbase
session is a structured blocker, not a silent local fallback.

## Evidence and logging

Use redacted run IDs, queue/application identifiers, page identity, checkpoint
state, duration, and provider labels in logs. Never log endpoint credentials,
cookies, passwords, CAPTCHA/API keys, applicant answer values, raw portal HTML,
or downloaded applicant documents. Preserve masked screenshots, traces, official
PDFs, `.dat` metadata, official references, and error checkpoints through the
existing private artifact/result paths. External-submission ingestion updates
application status and audit/notification records; it is not a browser dispatch
path.

## Running locally

Read the nearest `AGENTS.md` and use an ignored local environment file with
out-of-band credentials when a smoke requires them. Do not copy production
secrets into `.env`, this README, test fixtures, screenshots, or logs.

```powershell
npm run type-check
npm run build
npm test
```

For official-portal validation, follow the narrow smoke instructions in
`AGENTS.md` and `docs/ceac-smoke-test.md`. A real portal run requires
authorized data and credentials; a fixture or connectivity smoke is not a
submission. Do not run account creation, payment, slot booking, or official
submission as a side effect of opening a page or reading this documentation.

## Updating mappings

Keep selectors and answer normalization package-specific. DS-160 mappings live
under `src/ceac/` and `src/ds160-form-mappings.ts`; US appointment selectors and
page interactions live in `src/us-appointment/usvisascheduling-portal.ts`;
France-Visas/TLS mappings live under `src/france-visas/` and `src/france-tls/`.
The older `src/form-mappings.ts` remains an Indonesia-specific module and must
not be treated as the generic submission schema.

## Related files

```text
src/index.ts                         queue startup/wake, dispatch, cleanup
src/submission-queue-claim.ts         atomic legacy queue claim and lease
src/queue/worker.ts                   runner_job claim/renew/settlement
src/queue/poll-backoff.ts             bounded database-outage backoff
src/ceac/                             DS-160 session, mappings, recovery, proof
src/us-appointment/                   appointment state machine and portal client
src/france-visas/                     France-Visas Browserbase flow
src/france-tls/                       TLScontact Browserbase flow
src/result-writer.ts                  non-pool result writer
deploy/fly/                           credential-free deployment templates
```
