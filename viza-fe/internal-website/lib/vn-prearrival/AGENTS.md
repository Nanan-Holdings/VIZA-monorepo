# Vietnam Pre-Arrival Frontend Option Data

Scope: applies to `viza-fe/internal-website/lib/vn-prearrival/**`.

This module stores frontend-consumable Vietnam Pre-Arrival official option
snapshots and mappers shared by the client form and local API route.

Keep option `value` fields aligned with the official portal payload values.
Chinese labels are display-only and must not replace official submission codes.
Hotel labels must use Chinese in the Chinese column, including a
deterministic Chinese transliteration fallback for newly added official hotel
and address tokens. Prefer a verified Chinese hotel name from the property's
own site or a Chinese booking page when one exists; established brand marks
such as `ATC` may remain intact. Keep English labels and option values unchanged
for search and official submission.
When refreshing `official-static-options.json`, verify the source counts and
run the VN Pre-Arrival option route tests plus a browser smoke on the long-form
route.
