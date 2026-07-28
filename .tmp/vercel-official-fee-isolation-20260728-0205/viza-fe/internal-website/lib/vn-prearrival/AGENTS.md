# Vietnam Pre-Arrival Frontend Option Data

Scope: applies to `viza-fe/internal-website/lib/vn-prearrival/**`.

This module stores frontend-consumable Vietnam Pre-Arrival official option
snapshots and mappers shared by the client form and local API route.

Keep option `value` fields aligned with the official portal payload values.
Chinese labels are display-only and must not replace official submission codes.
Administrative labels must use the complete code-keyed Chinese snapshot in
`official-administrative-names.zh-CN.json`. Refresh it with
`scripts/generate-vn-prearrival-administrative-zh.mjs`; the generator must fail
unless all 3321 official commune-level codes have one Chinese label.
Hotel labels must use the complete code-keyed Chinese-name snapshot in
`official-hotel-names.zh-CN.json`. Every active official hotel code must have
exactly one Chinese property name. Prefer a verified Chinese hotel name from
the property's own site or a Chinese booking page when one exists; otherwise
use a natural Chinese localization without spelling unknown words letter by
letter. Established brand marks such as `ATC` may remain intact. The Chinese
dropdown label must combine the property name with the code-keyed ward and
province names from `official-administrative-names.zh-CN.json`; do not append a
machine-transliterated street address. Keep the complete English address in
`label_en`, `official_label`, and search text, and keep option values unchanged
for official submission. The deterministic translator in
`hotel-localization.ts` is only a fallback for newly added official codes.
When refreshing `official-static-options.json`, verify the source counts and
run the VN Pre-Arrival option route tests plus a browser smoke on the long-form
route.
