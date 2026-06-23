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
