# Runner fill+halt QA — template, infra, and per-country feasibility

This documents the live-portal "fill + halt" QA path proven for the India
e-Visa runner, the reusable infrastructure it introduced, and the hard
finding about why most other portals cannot be QA'd the same way.

## What "fill + halt" means

Drive the **real** government portal through a residential proxy, fill the
first public form with synthetic data, and **stop before any submit/payment**.
For India, submitting the registration page mints a government Temporary
Application ID — so the safe checkpoint is *after* filling + solving the
captcha, *before* clicking Continue. No government record is ever created.

## Local QA environment

1. `supabase start` (local stack). Enable extensions the migrations need:
   `CREATE EXTENSION vector; CREATE EXTENSION pg_cron;` and synthesize the
   `public.users` table (it predates the drizzle migration set — diverged
   lineage; see migration notes).
2. `cd viza-be/agent-backend && npm run db:migrate` — replays all 93 SQL
   migrations against `DATABASE_URL` (local).
3. Point `submission-service/.env`, `internal-website/.env.local`, and
   `agent-backend/.env.local` at the local Supabase URL + keys. Keep the
   Stripe **test** keys (`sk_test…`) — demo checkout works with test cards.
4. Seed: `photo_spec` (migration 0071), `derive:question-sets`,
   `seed-proxy-pool` (from a Bright Data IP CSV).

## Bright Data proxy

Government portals geo-gate and bot-block datacenter IPs. The runners egress
through a Bright Data **residential** zone. Required env vars (values from the
zone dashboard — store in `.env`, never commit):

| Var | Example |
|---|---|
| `BRIGHTDATA_PROXY_HOST` | `brd.superproxy.io` |
| `BRIGHTDATA_PROXY_PORT` | `33335` |
| `BRIGHTDATA_USERNAME` | `brd-customer-<id>-zone-<zone>` |
| `BRIGHTDATA_PASSWORD` | the zone password |

`src/shared/proxy-launch.ts` → `brightDataProxy(country)` builds the
Playwright `proxy` option with the exit country pinned and a sticky session.
The proxy presents a MITM cert, so contexts pair it with
`ignoreHTTPSErrors: Boolean(proxy)`.

## India runner — the reference implementation (`src/in/runner.ts`)

Real flow harvested via recon (`recon-out/in/`, promoted into
`selectors.generated.ts`):

1. **Landing** `tvoa.html` → click Referer-gated `a[href="Registration"]`
   (deep-linking redirects back; the click is mandatory).
2. **Registration page** — fill 11 `appl.*` fields. Selects are jQuery
   **Chosen** (hidden native `<select>`); dates are **readonly datepickers**.
   Both need `src/shared/form-helpers.ts` (`chosenSelect`, `forceFill`),
   not `page.fill`.
3. **Captcha** — image captcha solved via `src/shared/captcha.ts` (2Captcha;
   `TWOCAPTCHA_API_KEY`).
4. **Halt** — status `stopped_before_pay`; never clicks Continue.

Run it: `npx tsx scripts/qa-in-registration.ts` (with proxy + 2captcha env).

## Reusable infra introduced

| File | Purpose |
|---|---|
| `src/shared/proxy-launch.ts` | Bright Data residential proxy launch option |
| `src/shared/captcha.ts` | 2Captcha image-captcha solver |
| `src/shared/form-helpers.ts` | jQuery Chosen selects + readonly datepicker fills |

Proxy is wired into `in`, `za`, `lk`, `la`, `kh` runners and the recon
`stealth-browser` launcher.

## Per-country feasibility — the account-gating wall

A proxy recon sweep of every public e-Visa portal found that **India is the
exception**: its registration form is public (19 harvestable fields). Almost
every other portal **gates the application form behind a login/account**:

| Portal | Public form fields | Status |
|---|---|---|
| India | 19 | ✅ fill+halt working |
| Malaysia | 2 | minimal public surface |
| za / lk / la / kh | 1–8 | shallow public surface |
| Indonesia, Thailand, UAE, Türkiye, Saudi | 0 | form behind login |
| Egypt, Vietnam | recon crashed | needs harvester fix |
| UK, Canada, Australia | n/a | account + OTP gated |
| Italy (VFS), Japan (paper), France | n/a | non-public mechanism |

**Implication:** you cannot harvest selectors from — or fill+halt — a form
that requires an account to view. Extending fill+halt to the login-gated
portals requires provisioning **real test accounts per portal** (a
product/legal decision), at which point filling crosses into real submission
territory. Until then, those runners stay blocked on data, not code.
