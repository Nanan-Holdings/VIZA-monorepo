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

- Dry-run remains available. The approved assisted-live path is China
  `CN/usvisascheduling`, which queues work for `submission-service` rather than
  running browser automation in `agent-backend`.
- 登录、CAPTCHA/MFA、付款、等待室、政策提示、最终官方确认页请全部跳过。
- Redact sensitive portal and applicant data before audit, attempt, screenshot,
  status-check, or manual-action storage.
- Slot and status checks must be user-triggered and cooldown-protected.
- Stop or route to manual review on site policy warnings.
- China assisted-live booking may proceed only after a selected slot and an
  explicit final approval are stored. `agent-backend` then marks the job for the
  runner; it must not click official-site booking controls itself.

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
- `us-appointment.test.ts`: dry-run lifecycle and compliance tests.
