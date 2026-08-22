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

`residence-region-translations.zh.json` contains Chinese display labels for
every official residence-region option. Regenerate it with
`generate-residence-region-translations.ts`; the generator prefers pinned
Unicode CLDR subdivision names and uses an explicit online Simplified Chinese
fallback only where TDAC returns settlements or non-standard administrative
names that CLDR does not cover. Never alter the official English option values.

`administrative-translations.zh.json` is the checked-in, no-network Chinese
cache for all 77 provinces, 927 districts, and 7,439 subdistrict options in
the official TDAC administrative snapshot. Regenerate it with
`generate-administrative-translations.ts` after a new sanitized official
snapshot is captured. District and subdistrict cache keys include the parent
province/district (and a postcode/ordinal when the official snapshot contains
duplicate names), so equal names in different branches cannot reuse a label.
The generator keeps the verified common Chinese names and applies a
deterministic local phonetic transliteration with a Chinese administrative
suffix for lower-level names without a separately verified Chinese name. It
never calls the network at runtime and must not change `value`, `label_en`, or
`official_label`.
