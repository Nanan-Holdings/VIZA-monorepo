# Vietnam Pre-Arrival Submission Runner

Scope: `viza-be/submission-service/src/vn-prearrival/**`.

This module is only for `VN_PREARRIVAL_DECLARATION`. Keep it separate from the
Vietnam e-Visa runner and from legacy `VN_E_VISA` statuses.

Guardrails:

- Use only the official portal `https://prearrival.immigration.gov.vn/`.
- Do not submit or report success unless the official portal returns a
  confirmation/QR/reference.
- Use the VIZA-managed alias email for official OTP and confirmation delivery;
  keep the traveller's real email only as the forwarding target.
- Download the official PDF when available and save the QR code as evidence so
  the frontend can surface official artifacts from Supabase Storage.
- Do not implement health declaration automation until an official Ministry of
  Health electronic declaration system is confirmed active.
- Do not fallback dropdown or boolean values. If an official field cannot be
  mapped exactly, fail with a structured validation or portal error.
- Flight option labels must follow the official autocomplete formatter,
  including its unpadded/padded alias such as `MH746 (MH0746) - DAD`; verify
  that selecting the option auto-populates the locked airport field. Keep this
  pure formatting contract in `flight-label.ts`.
- Final success requires the official success heading plus a QR or confirmation
  reference. Keep strict result-page matching in `result-page.ts`; processing
  or Finalizing copy must never be reported as completed.
