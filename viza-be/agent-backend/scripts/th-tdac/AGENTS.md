# Thailand TDAC Seed Agent Guide

Scope: Thailand `TH_TDAC_ARRIVAL_CARD` form schema only.

Keep this package separate from Thai tourist visa and e-Visa workflows. Fields
should come from the official TDAC portal/manual, and official portal automation
should live in `viza-be/submission-service` only after the field and option
inventory is verified.

`tdac-official-dropdowns.generated.ts` is the sanitized source snapshot for
official TDAC nationality, country, transport, residence-region, province,
district, and subdistrict contracts. Regenerate it only from a read-only
`run-tdac-smoke.ts --audit-api=...` capture via
`generate-residence-region-map.ts`; never commit the raw audit because it
contains session-scoped encrypted IDs.
Do not restore the former `tdac-residence-regions.generated.ts` snapshot from
CountriesNow; residence regions must come from the official TDAC API audit.
