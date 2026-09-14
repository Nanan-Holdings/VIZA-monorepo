# U.S. Appointment Module Guide

Scope: this file applies to `src/us-appointment/**`.

The `PlaywrightUSVisaSchedulingPortalClient` owns the provider page session.
`prepareAppointmentFlow` must establish the authenticated, provider-specific
page before slot observation or booking. `observeSlots`, `captureConfirmation`,
and `captureStatusCheck` operate on that same prepared page; they must not
navigate back to the portal root. A missing, closed, redirected, gated, or
expired page session fails closed and must not be converted into an empty slot
list or a successful result.

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
stop the attempt. Browserbase owns its native Turnstile lifecycle and must not
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

Validation from `viza-be/submission-service`:

```powershell
npm run type-check
node --import tsx --test "src/us-appointment/__tests__/*.spec.ts"
```
