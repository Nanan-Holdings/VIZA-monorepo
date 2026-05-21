# QA gates (QA-001 / QA-002 / QA-003 / QA-004)

## Pipeline overview

| Job          | Blocking | Runs against                  | Source                                         |
| ------------ | -------- | ----------------------------- | ---------------------------------------------- |
| `e2e`        | ✓        | preview/staging deploy        | `tests/e2e/*.spec.ts`                          |
| `a11y`       | ✓        | preview/staging deploy        | `tests/a11y/*.spec.ts`, baseline.json          |
| `mobile`     | ✓        | preview/staging deploy        | `tests/mobile/*.spec.ts` + snapshots/          |
| `lighthouse` | non-blocking | prod deploy                 | `.lighthouserc.js`                             |

Workflow: `.github/workflows/qa-gates.yml`. The `e2e`/`a11y`/`mobile` jobs gate the deploy because they're the highest-signal regression catchers; Lighthouse runs on prod for tracking only.

## Local commands

```bash
cd viza-fe/internal-website
npm i -D @playwright/test @axe-core/playwright
npx playwright install chromium

npm run test:e2e
npm run test:a11y
npm run test:mobile           # iPhone 14 + Pixel 7 viewports
npm run test:mobile -- --update-snapshots   # when a UI change is intentional
```

## Required env for live runs

- `STAGING_TEST_EMAIL` + `STAGING_TEST_PASSWORD` (CI secrets) — pre-seeded staging applicant; tests that need an authenticated session skip when unset.
- `PLAYWRIGHT_BASE_URL` (CI var) — defaults to localhost; CI should point to a preview URL.

## Adding a new test

1. Pick the project: `e2e-desktop` (happy path), `a11y` (sweep), `mobile-*` (snapshot).
2. Drop `tests/<project>/<name>.spec.ts`.
3. If the test needs server state, gate with `test.skip(!process.env.STAGING_TEST_EMAIL, ...)` so it doesn't run on developer laptops without a staging seed.

## Snapshot updates

Mobile snapshots live under `tests/mobile/__screenshots__/`. After an intentional UI change:

```bash
npm run test:mobile -- --update-snapshots
git add tests/mobile/__screenshots__
```

PR review should glance at the diff before merging.

## Baseline a11y allowances

`tests/a11y/baseline.json` lists tolerated legacy violations. Each entry needs `id`, `nodes` (max count), `owner`, `due` (ISO date). When a baseline entry's due-date passes without a fix, the spec is expected to fail; the team chooses to extend the date (with a new owner sign-off) or land the fix.
