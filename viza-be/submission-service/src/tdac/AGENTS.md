# Thailand TDAC Runner

Scope: Thailand `TH_TDAC_ARRIVAL_CARD` official TDAC portal automation only.

- Keep TDAC separate from Thailand tourist eVisa packages.
- Use `tdac.immigration.go.th` official Thai Immigration URLs only.
- Preserve official English payload values for submission; Chinese labels are display-only.
- Save screenshots/PDFs/logs to Supabase Storage through the submission-service artifact helpers.
- If the official portal blocks access, changes layout, disables submission, or cannot reach final confirmation, return a precise structured failure with artifacts. Do not fake a successful TDAC submission.
