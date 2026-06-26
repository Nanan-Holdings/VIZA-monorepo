---
name: browser-api-cloudflare-runner
description: Use when building, debugging, or reviewing VIZA Playwright runners for official portals protected by Cloudflare, Turnstile, or government WAFs where an authorized Browser API/CDP endpoint such as Bright Data Scraping Browser is available. Covers endpoint selection, safe logging, Playwright connection, evidence capture, fallback behavior, and validation.
---

# Browser API Cloudflare Runner

Use this skill when a VIZA official-portal runner needs an authorized remote
browser session to pass Cloudflare/Turnstile/WAF checks that block local
Playwright. It is a runner engineering pattern, not a bypass recipe.

## Rules

- Use only authorized Browser API/CDP access provided by the user or VIZA.
- Never log endpoint URLs, embedded usernames, passwords, tokens, or session
  identifiers. Log only provider labels and connection status.
- Keep country runners package-specific. Do not route arrival cards or visas
  through a generic fallback schema to make the runner pass.
- Do not fake clearance, success, references, PDFs, or screenshots.
- Preserve official portal errors exactly enough to debug, without exposing
  secrets or applicant documents.

## Endpoint Selection

1. Prefer a country-specific endpoint before global settings:
   - `TDAC_BROWSER_API_ENDPOINT`
   - `TDAC_BRIGHTDATA_BROWSER_API_ENDPOINT`
   - `MDAC_BROWSER_API_ENDPOINT`
   - `MDAC_BRIGHTDATA_BROWSER_API_ENDPOINT`
2. Use global endpoints only for countries explicitly allowed by the helper:
   - `BRIGHTDATA_BROWSER_API_ENDPOINT`
   - `BRIGHTDATA_BROWSER_WS`
   - `SBR_WS_ENDPOINT`
3. If a provider blocks a government site, fall back to local Chrome or a
   country-specific endpoint instead of retrying the blocked global endpoint.
4. Keep this logic in shared helpers such as
   `viza-be/submission-service/src/arrival-card-browser.ts`.

## Playwright Pattern

- Connect with `chromium.connectOverCDP(endpoint, { timeout })`.
- Set a realistic viewport and user agent only when the portal requires it.
- Enable provider-native Cloudflare handling when the Browser API supports it.
- Retry connection a small number of times with short backoff.
- On failure, return a clear message such as `remote browser endpoint was not
  reachable`; do not print the endpoint.

## Runner Pattern

1. Normalize VIZA answers into a typed country payload.
2. Validate official dropdown values before navigating when possible.
3. Open the official portal through the selected browser session.
4. Wait for Cloudflare/Turnstile clearance as an observable page state.
5. Fill the official form with exact official values.
6. Stop and surface precise errors for missing data, schema mismatch, disabled
   controls, or official validation messages.
7. Submit only when the user requested real submission.
8. Confirm success only after the official success page/reference is visible.

## Evidence

- Save screenshots at landing, after form steps, before final submit, after
  success, and after official errors.
- Download the official PDF if the portal offers one.
- If remote download artifacts cannot be saved, generate a nonblank PDF from
  the official success page and log it as a fallback confirmation-page PDF.
- Upload evidence through the existing submission artifact path; do not store
  evidence in the repo.

## Validation

- Run `cd viza-be/submission-service && npm run type-check`.
- Run the country smoke with real submission only when authorized, for example:
  `npm run tdac:smoke -- --submit`.
- Verify the frontend by clicking the real VIZA submit button, watching the
  loading/progress UI, and confirming the result shows `submitted: true`,
  official reference number, and downloadable evidence.
