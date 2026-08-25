# Singapore SG Arrival Card

`SG_ARRIVAL_CARD` is the single Singapore Arrival Card product and is isolated
from `SG_VISITOR_VISA`, which is a separate entry-visa product. ICA's SGAC
e-service starts with one residency selector and three routes; VIZA models the
same selection inside the SGAC form:

- Singapore Citizen / Permanent Resident (`scpr`);
- Long-Term Pass Holder (`ltp`); and
- Foreign Visitor / In-Principle Approval Holder (`fvipa`).

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

Foreign Visitor / IPA Holder applicants provide only values requested by the
ICA foreign-visitor flow:

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
and confirmation/submission status. Both ICA routes are dispatched through the
shared `sgac` runner pool flow; the worker selects the typed portal payload
from the saved applicant type.

The last step contains ICA's required declaration acceptance: “I have read and
agreed to the declaration.” It is persisted as an official-form answer and is
required before any submission attempt or resident-route handoff.

Singapore Citizens and Permanent Residents provide an NRIC; Long-Term Pass
Holders provide a FIN. Both resident routes collect arrival, identity, contact,
and active ICA health-declaration details. The health branch asks about current
symptoms and then shows the applicable six-day or 21-day travel-history
follow-up. Resident applicants must not be asked for the foreign visitor's
Place of Residence city, passport, onward travel, or accommodation fields.
The worker maps the saved residency type to ICA's `scpr`, `ltp`, or `fvipa`
route; these are routes within one SGAC product, not separate arrival cards.

## Result Boundary

The applicant result card shows only success/failure, DE/reference number,
arrival date, confirmation PDF, submit-another action, and the official ICA
link. Raw portal text, payload summaries, storage paths, logs, screenshots, and
queue internals remain available to staff/debug surfaces only.
