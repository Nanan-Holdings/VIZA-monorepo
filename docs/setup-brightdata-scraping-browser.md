# Task: Provision a Bright Data Scraping Browser for the VIZA runners

You are provisioning a **Bright Data Scraping Browser** zone and wiring its CDP
endpoint into the VIZA submission-service so the visa runners can reach
anti-bot government portals that a plain residential proxy cannot.

## Why (context)

The runners drive real government visa portals in a headless browser. A plain
Bright Data **residential proxy** + stealth plugin is enough for old
server-rendered portals (India e-Visa works), but it FAILS on modern anti-bot
portals:

- **VFS Global** (Italy, South Africa, India-consular) — Akamai Bot Manager;
  the Angular SPA never hydrates (blank body behind a resolving title).
- **Vietnam e-Visa** — blank/geo-block through the proxy.
- **UKVI** (apply-uk-visa) — renders, but the multi-step POST flow
  intermittently dies ("Webpage not available").

Bright Data's **Scraping Browser** is a remote, CDP-connectable Chromium that
solves fingerprinting, CAPTCHA, and retries server-side and carries its own
proxy + geo. The code already supports it: `src/ceac/stealth-browser.ts`
connects over CDP when `BRIGHTDATA_BROWSER_WS` is set, and EVERY runner +
recon + probe goes through `launchStealthBrowser`, so no code change is needed
— only the env var.

## Account facts

- Bright Data customer id: `hl_dfc708a6` (same account as the existing
  `residential_proxy1` zone).
- This is a **paid** product, billed per GB of traffic. Create a small zone.

## Steps

1. Bright Data dashboard → **Proxies & Scraping Infrastructure** → **Add** →
   choose **Scraping Browser** (a.k.a. Browser API). Name the zone e.g.
   `viza_scraping_browser`.
2. Open the zone → **Overview / Access parameters**. Copy:
   - the **zone name** (e.g. `viza_scraping_browser`)
   - the **zone password** (distinct from the residential zone password)
3. The CDP endpoint format is:
   ```
   wss://brd-customer-hl_dfc708a6-zone-<ZONE_NAME>:<ZONE_PASSWORD>@brd.superproxy.io:9222
   ```
   (Bright Data also shows a ready-made endpoint string in the zone's
   "Code examples" → Playwright tab — prefer copying that verbatim; it already
   embeds the customer id, zone, and password.)
4. Add it to `viza-be/submission-service/.env` (gitignored — never commit):
   ```
   BRIGHTDATA_BROWSER_WS=wss://brd-customer-hl_dfc708a6-zone-<ZONE_NAME>:<ZONE_PASSWORD>@brd.superproxy.io:9222
   ```

## Verification (acceptance — all must pass)

The probe loads a portal through whatever `launchStealthBrowser` is configured
with, so once `BRIGHTDATA_BROWSER_WS` is set it goes through the Scraping
Browser automatically.

```bash
cd viza-be/submission-service

# 1. VFS Italy — was blank (Akamai); should now render real content.
PROBE_URL="https://visa.vfsglobal.com/chn/en/ita/" PROBE_COUNTRY=cn PROBE_STEPS=3 \
  npx tsx scripts/portal-probe.ts 2>/dev/null | sed -n '/===PROBE_JSON===/,$p' | tail -n +2

# 2. Vietnam e-Visa — was blank; should now render.
PROBE_URL="https://evisa.gov.vn/e-visa/foreigners" PROBE_COUNTRY=vn PROBE_STEPS=3 \
  npx tsx scripts/portal-probe.ts 2>/dev/null | sed -n '/===PROBE_JSON===/,$p' | tail -n +2
```

PASS = the step-0 snapshot now shows **`bodyLen` > 300** (ideally with real
form `controls`/`buttons`), instead of the previous `bodyLen: 0`. Report the
`bodyLen`, `title`, and any `challenge` value for each portal.

## Gotchas / notes

- The endpoint is **`wss://`** on port **9222**, not `https`. The auth
  (customer-zone-password) is embedded in the URL userinfo.
- The Scraping Browser **password differs** from the residential zone password
  (`ml85hbtuhw40`). Use the new zone's password.
- When `BRIGHTDATA_BROWSER_WS` is set, the launcher ignores the
  `BRIGHTDATA_PROXY_*` residential args (the Scraping Browser carries its own
  egress) — that's intentional, no action needed.
- It routes **all** browser traffic (including India, which doesn't need it)
  through the paid Scraping Browser. Fine for testing; for production you may
  want to gate it per-country, but that's a later optimization.
- Report back: the zone name, the verification `bodyLen` for VFS Italy +
  Vietnam, and confirm `.env` was updated.
