# U.S. Appointment Services Guide

Scope: this file applies to
`viza-be/agent-backend/src/services/us-appointment/**`.

## Purpose

State orchestration for U.S. B1/B2 appointment assistance after DS-160 capture.
It records consent, provider metadata, state transitions, manual actions,
observed slots, explicit slot selection, final approval, confirmation/status
snapshots, and redacted audit events. Real China USVisaScheduling browser work
is handed to `viza-be/submission-service`; this service owns API access control
and DB state transitions.

## Guardrails

- Do not ask the applicant to re-enter the DS-160 appointment post or preferred
  timing fields when creating a job. The DS-160-derived post must come from
  stored application/answer data, and available timings should be observed by
  the backend before the user chooses a slot.
- Do implement state transitions for gated assisted-live handling of official
  login, supported CAPTCHA/MFA, waiting rooms, policy prompts, payment controls,
  rate limits, and final confirmation pages. Unsupported gates must be recorded
  as manual-required states with redacted diagnostics, not hidden as success.
- VIZA alias email automation is allowed for account creation and email
  verification when it uses the Cloudflare Email Worker -> `inbound_email`
  path and records only redacted checkpoint/audit metadata.

## Key Files

- `USAppointmentOrchestrator.ts`: state machine and public operations.
- `worker-wake.ts`: explicit CN assisted-live dispatch to the token-protected
  submission-service `/internal/us-appointment/wake` endpoint. It requires
  `US_APPOINTMENT_SUBMISSION_SERVICE_URL` and prefers the dedicated
  `US_APPOINTMENT_INTERNAL_TOKEN`; when unset or blank, it falls back to
  `SUBMISSION_QUEUE_INTERNAL_TOKEN` for compatibility. Configure the same US
  token on the worker without rotating other countries' shared credentials.
  Optional on-demand Fly startup requires `US_APPOINTMENT_FLY_APP`,
  `US_APPOINTMENT_FLY_MACHINE_ID`, and `FLY_SUBMISSION_ORG_TOKEN`; the worker URL
  must be that exact app's HTTPS `fly.dev` origin. Only the named existing
  stopped/suspended machine can be started, with bounded readiness and forced
  instance routing. It never creates/clones/scales machines.
  Before startup, the Machines API configuration must prove
  `RUNNER_MACHINE_KIND=pool` and a finite positive
  `SUBMISSION_SERVICE_IDLE_EXIT_MS` no greater than 3,600,000. Missing or invalid
  lifecycle protection produces the fixed `machine_lifecycle_unverified` error.
  A shared Fly token
  alone does not select a target. Without a selected Fly target, the existing
  worker must already be reachable; cold start is explicitly not configured.
  Submission-service owns its idle shutdown and browser/session cleanup.
  Wake only after explicit run/resume, completed checkpoint, slot refresh,
  approved booking, or status-check actions. Page/status reads never wake.
  Pending login and account-email-verification checkpoints may be dispatched
  only with the corresponding supported current action in a runnable state;
  the worker owns their completion. Every other pending checkpoint still blocks.
  Failures retain the saved job stage, persist fixed-code error/audit metadata,
  and return a retryable service error rather than claiming acceptance.
- `worker-wake.test.ts`: exact-machine cold start, configuration/acknowledgment
  rejection, bounded readiness, redaction, and real loopback HTTP handoff smoke.
- `repository.ts`: Supabase service-role persistence adapter.
- `providers.ts`: provider registry and country/post metadata detection.
- `DryRunUSAppointmentProvider.ts`: deterministic mock lifecycle.
- `AssistedLiveDisabledProvider.ts`: disabled live-mode scaffold.
- `AppointmentCheckpointService.ts`: human-in-the-loop checkpoints.
- `AppointmentSlotService.ts`: observed/selected slot persistence.
- `AppointmentStatusService.ts`: user-triggered status check cooldown.
- `redaction.ts`: recursive sensitive-field redaction.
- `playwright/**`: non-operational scaffolds and checkpoint classification only.
- `us-appointment.test.ts`: dry-run, assisted-live lifecycle, and compliance tests.
