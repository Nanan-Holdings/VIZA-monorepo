# Vietnam Pre-Arrival Seed Agent Guide

Scope: Vietnam `VN_PREARRIVAL_DECLARATION` form schema only.

- Keep this package separate from `VN_E_VISA`; Vietnam Pre-Arrival Information
  is an immigration arrival declaration, not a visa.
- Fields should be based on the official Immigration Department portal at
  `prearrival.immigration.gov.vn` and current official/public guidance.
- Do not add health, fee, timing, group, or explanatory acknowledgement
  questions unless they appear as questions in the official pre-arrival portal.
- `form-fields.test.ts` guards parity-critical schema behavior, including the
  official purpose dropdown and the flight-number-to-airport lock.
- Official portal automation belongs in `viza-be/submission-service/src/vn-prearrival`.
