# U.S. Appointment Module Guide

Scope: this file applies to `src/us-appointment/**`.

`dispatch.ts` owns exact-job admission and the per-worker execution queue.
`claim-repository.ts` calls the service-role-only RPCs in migration 0193;
claims are independent of the shared `runner_job` strict-cutover contract.
Duplicate wakes await the same admission result. Only a durable claim permits
HTTP acceptance, and queued jobs recheck ownership, account and state before
opening a browser. Never release or automatically take over an ambiguous
started claim. Shutdown cancels unstarted work; deadlines abort browser work.
Unresponsive cleanup makes the worker unhealthy and terminates it, retaining
the ambiguous claim for reconciliation. Browserbase sessions have a 15-minute
provider TTL and an explicit release independent of Playwright cleanup.
`__tests__/dispatch.spec.ts`, `claim-repository.spec.ts`, and `wake-http.spec.ts`
cover admission, duplicate exclusion, cancellation, timeout and authenticated
HTTP transport. Loopback tests are not production execution evidence.

The `PlaywrightUSVisaSchedulingPortalClient` owns the provider page session.
`prepareAppointmentFlow` must establish the authenticated, provider-specific
page before slot observation or booking. `observeSlots`, `captureConfirmation`,
and `captureStatusCheck` operate on that same prepared page; they must not
navigate back to the portal root. A missing, closed, redirected, gated, or
expired page session fails closed and must not be converted into an empty slot
list or a successful result.
Calendar readiness triggers slot observation on that same session; it never
constitutes payment evidence or writes `appointment_payment_completed`.
Status checks may instead prepare a page with explicit `[data-appointment-status]`
or `.appointment-status` evidence through `readyForStatusCapture`; they do not
require a calendar. Generic Appointment headings are unknown, and explicit
absence is checked before scheduled/confirmed wording. The contract is covered
by `__tests__/portal-status.spec.ts`. Missing status evidence must never trigger
Start Application or Applicant Details submission during a status read.

Only the exact persisted job and applicant-selected slot may reach booking.
Final booking remains gated by the persisted VIZA final approval checked by the
caller. Official confirmation requires a provider-visible reference. Fixture
clients and loopback browser tests are validation aids and never official
evidence.

Keep selector/page interaction code in `usvisascheduling-portal.ts`; keep pure
date/time/confirmation parsing in `portal-observation.ts`. Do not log portal
credentials, CAPTCHA tokens, CDP/Browser API endpoints, applicant data, or raw
official page text.

The official B2C username input is `signInName`. Login detection must check
visible matches and ignore hidden email/password templates. Submit each visible
security-question checkpoint at most once per page; visible validation errors
stop the attempt. When OAuth reaches TermsAndConditions before its controls
render, keep a bounded wait in that same tab and classify only a consistent
URL/DOM snapshot; never retry login or Create to resolve a loading race.
Browserbase owns its native Turnstile lifecycle and must not
receive VIZA's custom render interception hook. Classify page text with only
credential-free URL paths, never OAuth query/fragment tokens.

Persisted live jobs cannot select the fixture client, even when a fixture is
stored in preferences. Tests inject it explicitly. Status reads must establish
the official session first. Missing real applicant names remain null.

Registration uses the existing encrypted, application-bound account. Newly
provisioned accounts enter `appointment_account_required`; created, active, or
email-verified accounts must take the login path. Never overwrite credentials
or create a replacement account after rejected login. Validate actual separated
given/surname fields before sending a verification email; never guess their
order from a full name.

`AppointmentPreparationResult.verificationRequestedAt` records the current
send-code action. `inbox.ts` reads the immutable account alias through
`waitForAppointmentAccountMessage`, requires matching recipient/provider and
fresh mail, and accepts B2C verification codes. Link-only messages cannot drive
navigation. `completeUSAppointmentAccountRegistration` requires explicit
`emailVerified` and `accountCreated` evidence before saving the account as
active. Database writes match account ID, application, user, portal, and email,
and zero affected rows are an error. Failed persistence after official creation
is a reconciliation checkpoint, never a reason to generate new credentials.

`__tests__/portal-registration.spec.ts` exercises the production client against
a loopback B2C form; `inbox.spec.ts` covers fresh, correctly addressed mail;
`supabase-repository.spec.ts` checks credential ownership and scoped writes.
These are local fixtures and do not establish a real official account creation.
`registration-command.ts` owns CLI argument/preflight/result validation and
`__tests__/registration-command.spec.ts` covers consent, supported targets,
pending account states, browser configuration, and redacted failures. The CLI
reads completed application/user consent before any official browser session.
Before official registration, both the CLI and job runner must check the bound
account inbox's MX routing through `assertAccountRegistrationInboxRoutable`.
An unavailable mailbox is a checkpoint before opening a browser or sending OTP.
Never silently replace an existing official account's email to work around a
dead domain; an account/email recovery decision is required.

`profile-setup.ts` owns the exact authenticated `/en-US/profile/` field
contract observed for mainland China: it verifies the read-only primary
`mailto:` address, fills only the verified name/contact/language/country
controls, clicks `#UpdateButton` once, and requires a distinct success message
or the verified `/en-US/` home with its Start Application control.
`__tests__/profile-setup.spec.ts` runs
that helper against a loopback Chromium fixture; it never establishes or
modifies an official account.

`prepareAppointmentFlow` handles the exact first-login Privacy Act and
Confidentiality checkboxes, profile initialization, and `#start_application`.
Reaching `/en-US/applicant_details/` is an authenticated preparation checkpoint,
not a calendar, payment, or booking result. Applicant/contact/passport fields
must be bound from authoritative application data before that page is submitted.
`applicant-details-data.ts` builds the typed contact/passport payload from the
owned application answers and profile. Reuse home addresses only with explicit
mailing-same-as-home evidence; never infer a mobile calling code from the home
phone. An explicitly confirmed code may be stored at
`user_preferences_json.applicant_details.mobile_phone_country_code`.
`applicant-details.ts` fills only the observed Applicant Details controls.
After a complete fill, `usvisascheduling-portal.ts` submits only from the exact
official Applicant Details origin/path, requires one visible enabled
`input[type=button][value=Submit]`, clicks it once, and checks gates and login
state before accepting calendar evidence. An unobserved next step, redirect,
error, or ambiguous result is a checkpoint; missing data returns field keys
before any field mutation. `__tests__/applicant-details-submit.spec.ts` covers
the one-click, calendar-gate, unmapped-step, error/retry, missing-data, and
ambiguous-control cases with a loopback browser fixture.
The portal's B2C registration password accepts 8–16 characters; validate its
character policy before sending a code. Wait for the actual verification widget
after Send. Preserve one browser tab through Cloudflare waiting-room admission
with a bounded ten-minute wait. Do not turn a queue footer into a CAPTCHA gate.
After a Create attempt with unknown final evidence, persist
`registration_submitted` without downgrading an already active/verified account.
Only the normal double-proof path can mark that account active.

`testing/placeholder-data.ts` defines synthetic identities and references.
`testing/placeholder-portal.ts` serves a loopback simulation;
`testing/placeholder-repository.ts` implements isolated in-memory persistence.
`testing/placeholder-flow.ts` runs the production client and runner through the
scenario and emits labeled screenshots plus a state-transition report. Its
browser URL is intercepted, native redirects become local document navigations,
and a loopback-only proxy rejects escaped traffic; both layers have negative
controls. No request may reach that apparent official origin.
Do not import these adapters into the live worker or accept real credentials,
application IDs, arbitrary target URLs, CDP or storage state in this command.
Visa/delivery/payment pages and the VIZA user actions are simulation-only until
separate live/portal validation establishes their actual contracts.

Validation from `viza-be/submission-service`:

```powershell
npm run type-check
node --import tsx --test "src/us-appointment/__tests__/*.spec.ts"
npm run us-appointment:placeholder-flow
```
