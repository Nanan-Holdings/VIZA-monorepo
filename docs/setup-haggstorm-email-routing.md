# Task: Set up inbound email (catch-all) for `haggstorm.com`

You are configuring **inbound email receiving** for the domain `haggstorm.com`
so the VIZA submission-service can read verification emails from government
visa portals.

## Why this matters (context)

VIZA automates visa applications. Account-gated portals (UK, VFS Global for
Italy/South Africa, Vietnam e-Visa, US CEAC) email an **OTP / verification
link** during signup. The system gives each applicant a unique alias like
`appl-01jabc...@haggstorm.com`, registers the portal account with it, and an
IMAP poller (`viza-be/submission-service/src/email/imap-poll.ts`) ingests the
reply into the `inbound_email` table, where per-provider extractors pull the
code out.

**The whole flow is dead right now because `haggstorm.com` cannot receive
email** — it has no MX record (`dig +short MX haggstorm.com` returns nothing).
Your job: make a **catch-all** (`*@haggstorm.com`) deliver into a mailbox the
IMAP poller can read.

## Constraints / facts

- Aliases are **dynamic** (`appl-<ulid>@haggstorm.com`), so you MUST configure
  a **catch-all**, not per-address rules. Source of truth:
  `viza-fe/internal-website/app/actions/applicant-inbox.ts` (`ALIAS_DOMAIN = "haggstorm.com"`).
- `haggstorm.com` is the marketing domain (deployed via Vercel project
  `viza-monorepo-deployment`). **Check where its DNS/nameservers live first** —
  this decides the method below.
- The IMAP poller needs real IMAP creds in `viza-be/submission-service/.env`:
  `IMAP_HOST`, `IMAP_PORT` (993), `IMAP_EMAIL`, `IMAP_PASSWORD`.

## Method A — Cloudflare Email Routing  ✅ USE THIS

**Confirmed:** `haggstorm.com` nameservers are already on Cloudflare
(`noah.ns.cloudflare.com`, `gemma.ns.cloudflare.com`), and there is no MX yet.
So Cloudflare Email Routing is the correct path — go straight here, skip
Method B.

1. Cloudflare dashboard → select `haggstorm.com` → **Email** → **Email Routing** → enable.
   (This auto-adds the required MX + SPF TXT records.)
2. **Destination addresses** → add the mailbox you'll forward to (a Gmail or
   other IMAP-capable inbox) → click the verification link sent to it.
3. **Routing rules** → enable **Catch-all address** → action **Send to** →
   the verified destination mailbox → **Save**.
4. Confirm DNS: `dig +short MX haggstorm.com` now returns Cloudflare's
   `route#.mx.cloudflare.net` entries.

## Method B — ImprovMX (use IF DNS is NOT on Cloudflare, e.g. on Vercel)

ImprovMX gives catch-all forwarding by adding records to **any** DNS provider —
no nameserver migration.

1. Create a free ImprovMX account, add domain `haggstorm.com`.
2. In the DNS provider that hosts `haggstorm.com` (Vercel dashboard → Domains,
   or wherever `dig +short NS haggstorm.com` points), add:
   - `MX  @  mx1.improvmx.com`  (priority 10)
   - `MX  @  mx2.improvmx.com`  (priority 20)
   - `TXT @  "v=spf1 include:spf.improvmx.com ~all"`
3. In ImprovMX, set the **catch-all** alias `*@haggstorm.com` → forward to your
   destination mailbox (e.g. the Gmail the poller reads).
4. Confirm: `dig +short MX haggstorm.com` returns the improvmx MX hosts.

## Wire the mailbox into the poller (both methods)

The forwarding destination must be an **IMAP-readable** mailbox. If using Gmail:
1. Enable 2FA, then create an **App Password** (Google Account → Security →
   App passwords). Do NOT use the normal account password.
2. Edit `viza-be/submission-service/.env`:
   - `IMAP_HOST` → `imap.gmail.com`
   - `IMAP_PORT` → `993`
   - `IMAP_EMAIL` → the destination Gmail address
   - `IMAP_PASSWORD` → the App Password
   - (`.env` is gitignored — never commit these.)

## Verification (acceptance criteria — all must pass)

```bash
# 1. MX is live (no longer empty)
dig +short MX haggstorm.com

# 2. IMAP creds connect + list recent mail
cd viza-be/submission-service && npx tsx scripts/imap-smoke.ts

# 3. End-to-end: send a test email to a catch-all alias, confirm it lands
#    (send from any mailbox to:)  appl-routingtest@haggstorm.com
#    then re-run imap-smoke and confirm the test message appears in the list
npx tsx scripts/imap-smoke.ts
```

Done when: `dig MX` returns hosts, `imap-smoke` connects, and a message sent to
`appl-routingtest@haggstorm.com` shows up in the IMAP listing within ~2 min.

## Gotchas

- **Forwarded sender reputation:** some gov portals reject mail to forwarders.
  If OTP emails bounce, consider a real hosted mailbox (Google Workspace /
  Migadu / Fastmail catch-all) instead of pure forwarding.
- **SPF/DMARC:** keep the SPF TXT the provider specifies; don't stack two SPF
  records (only one `v=spf1` per domain).
- **Catch-all only:** per-address rules won't work — aliases are generated per
  applicant at runtime.
- Report back the chosen method, the destination mailbox, and the three
  verification outputs.
