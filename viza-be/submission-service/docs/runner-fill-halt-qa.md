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

## Inbox keystone (gated-portal verification)

Gated portals email an OTP/verification link during signup. The chain:
per-applicant alias `appl-<ulid>@haggstorm.com` → Cloudflare Email Routing
catch-all → forwards to the IMAP mailbox → **`src/email/inbound-ingest.ts`**
recovers the alias from the recipient headers and writes `inbound_email` →
`inbox.waitForMessage()` (and the per-provider extractors) read it. Run the
ingest with `npx tsx scripts/inbox-ingest.ts --loop`. Setup runbook:
`docs/setup-haggstorm-email-routing.md`. Verified end-to-end.

## Gated-portal feasibility (live-probed via `scripts/portal-probe.ts`)

Probed each portal's entry through the residential proxy:

| Portal | Renders | Verdict | Reality |
|---|---|---|---|
| UK (UKVI) | yes | tractable* | server-rendered GOV.UK; *but the multi-step POST flow intermittently returns "Webpage not available" through the plain residential proxy |
| US (CEAC) | yes | hard | ASP.NET WebForms postback nav + CAPTCHA at `/GenNIV/` |
| VFS (Italy) | no | blocked | silent Akamai bot-wall — title resolves, body never hydrates |
| VFS (South Africa) | no | hard | Akamai SPA; only the OneTrust cookie overlay hydrates |
| Vietnam e-Visa | no | blocked | blank/geo-block through the proxy |

**Root cause:** plain residential proxy + playwright-extra stealth is
sufficient for old server-rendered portals (India ✅) but **not** for modern
anti-bot SPAs (VFS/Akamai, Vietnam) or fragile multi-step POST flows (UKVI).

**Fix — Bright Data Scraping Browser (VERIFIED).** Set `BRIGHTDATA_BROWSER_WS`
to a Scraping Browser `wss://…:9222` endpoint. Two integration points:
- `src/shared/anti-bot-session.ts` (`startAntiBotSession`) — used by the VFS
  runners (`italy-vfs-cn`, `za`); always prefers the Scraping Browser.
- `launchStealthBrowser({ antiBot: true })` — opt-in per call.

**Important — gov-domain policy.** Bright Data's Scraping Browser **refuses
`.gov` domains** by policy (verified: `evisa.gov.vn` → "blocked by Bright Data
usage policy"). So it is **opt-in, not global**: VFS (commercial Akamai) uses
it; `.gov` portals (India/UK/CEAC) must stay on the residential proxy, which
Bright Data permits for them. A global setting would break every gov runner.

Verified results through the Scraping Browser:

| Portal | Residential | Scraping Browser |
|---|---|---|
| VFS Italy | blank (bodyLen 0) | ✅ renders (bodyLen 1715, 35 controls) |
| VFS South Africa | blank | ✅ renders (bodyLen 1473) |
| Vietnam (.gov.vn) | blank | ❌ refused (Bright Data gov policy) |
| India (.gov.in) | ✅ renders (2988) | n/a — stays residential |

VFS is account-gated like UK, so the next step per VFS country is the same
register → inbox-OTP → login → fill flow as `src/uk/register.ts`. Vietnam needs
gov-domain access enabled on a Bright Data zone (KYC) — blocked on both paths
until then.

`src/uk/register.ts` is the gated-portal register template (alias → register →
inbox OTP → encrypted `uk_accounts` row); it reaches the live UKVI portal and
is the first to benefit from the Scraping Browser switch.
