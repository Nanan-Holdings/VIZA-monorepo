# Malaysia MDAC Runner

Scope: Malaysia `MY_MDAC_ARRIVAL_CARD` official MDAC portal automation only.

- Keep MDAC separate from Malaysia eVisa packages.
- Use official Malaysian Immigration MDAC portal URLs only.
- Preserve official English payload values for submission; Chinese labels are display-only.
- Save screenshots/PDFs/logs to Supabase Storage through the submission-service artifact helpers.
- If the official portal blocks access, changes layout, or disables submission, return a precise structured failure with artifacts. Do not fake a successful MDAC submission.
- `connectivity-smoke.ts` is a read-only cloud diagnostic: it may open the landing page and detect the registration entry, but must never fill applicant fields, solve CAPTCHA, or submit.
