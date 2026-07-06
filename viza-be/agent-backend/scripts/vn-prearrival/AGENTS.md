# Vietnam Pre-Arrival Seed Agent Guide

Scope: Vietnam `VN_PREARRIVAL_DECLARATION` form schema only.

- Keep this package separate from `VN_E_VISA`; Vietnam Pre-Arrival Information
  is an immigration arrival declaration, not a visa.
- Fields should be based on the official Immigration Department portal at
  `prearrival.immigration.gov.vn` and current official/public guidance.
- Health declaration copy must reflect the 2026 Ministry of Health
  clarification: health declarations are not routinely mandatory for all
  travellers, and the new system is not `tokhaiyte.vn`.
- Official portal automation belongs in `viza-be/submission-service/src/vn-prearrival`.
