# Thailand TDAC Runner

Scope: Thailand `TH_TDAC_ARRIVAL_CARD` official TDAC portal automation only.

- Keep TDAC separate from Thailand tourist eVisa packages.
- Use `tdac.immigration.go.th` official Thai Immigration URLs only.
- Preserve official English payload values for submission; Chinese labels are display-only.
- Save screenshots/PDFs/logs to Supabase Storage through the submission-service artifact helpers.
- Use Browserbase as the default TDAC provider with a Thailand-targeted managed
  proxy. Do not inherit global Bright Data Browser API endpoints because that
  provider rejects this government portal by policy.
- `browser-selection.spec.ts` locks the provider default and prevents legacy
  Bright Data endpoint variables from silently taking control of TDAC again.
- `normalize.spec.ts` locks the current official purpose dropdown contract and
  keeps legacy `transit` answers compatible by sending official `OTHERS
  (PLEASE SPECIFY)` with `TRANSIT`; the separate transit-passenger checkbox
  remains the source of truth for no-stay transit.
- If the official portal blocks access, changes layout, disables submission, or cannot reach final confirmation, return a precise structured failure with artifacts. Do not fake a successful TDAC submission.
