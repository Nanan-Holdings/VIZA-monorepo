# Vietnam Pre-Arrival Submission Runner

Scope: `viza-be/submission-service/src/vn-prearrival/**`.

This module is only for `VN_PREARRIVAL_DECLARATION`. Keep it separate from the
Vietnam e-Visa runner and from legacy `VN_E_VISA` statuses.

Guardrails:

- Use only the official portal `https://prearrival.immigration.gov.vn/`.
- Do not submit or report success unless the official portal returns a
  confirmation/QR/reference.
- Do not implement health declaration automation until an official Ministry of
  Health electronic declaration system is confirmed active.
- Do not fallback dropdown or boolean values. If an official field cannot be
  mapped exactly, fail with a structured validation or portal error.
