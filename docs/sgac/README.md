# Singapore SG Arrival Card

`SG_ARRIVAL_CARD` is isolated from `SG_VISITOR_VISA` and uses the ICA Foreign
Visitor / IPA Holder form as its field baseline.

## Module Map

- `viza-be/agent-backend/scripts/sgac/form-fields.ts`: official applicant field inventory.
- `viza-be/agent-backend/scripts/sgac/seed-form-fields.ts`: DB seed implementation.
- `viza-be/agent-backend/scripts/seed-sg-arrival-card-form-fields.ts`: compatible command entry.
- `viza-be/submission-service/src/sgac/`: ICA payload normalization and Playwright runner.
- `viza-fe/internal-website/features/sgac/`: applicant result UI and submit-another business logic.
- `viza-fe/internal-website/app/client/arrival-cards/singapore/`: SGAC entry route.

Next.js API route files remain under `app/api` because the framework requires
that location, but they delegate SGAC business behavior to `features/sgac`.

## Form Boundary

The applicant form contains only values requested by the ICA flow:

- arrival date, passport identity and contact details;
- different-name passport and health declarations;
- embarkation/disembarkation cities, purpose and transport;
- Singapore accommodation and departure details.

The form does not contain separate VIZA acknowledgements, visa disclaimers,
timing acknowledgements, authorization checklists, internal payload fields, or
artifact/debug information. Informational requirements belong in page copy or
RAG, not as required applicant answers.

The applicant wizard also omits the shared supporting-documents and team steps.
SGAC requires only the ICA-aligned traveller/trip questions, a read-only review,
and confirmation/submission status.

## Result Boundary

The applicant result card shows only success/failure, DE/reference number,
arrival date, confirmation PDF, submit-another action, and the official ICA
link. Raw portal text, payload summaries, storage paths, logs, screenshots, and
queue internals remain available to staff/debug surfaces only.
