# VIZA — Domain & DNS Reference

**Production domain: `viza.it.com`** (registered on Cloudflare DNS).

This is the single source of truth for every hostname, email sender, and
DNS record the VIZA platform depends on. When a domain changes, update
this file **and** the code fallbacks + provider dashboards it lists.

> History: the platform previously used `haggstorm.com` (app + email +
> inbound alias routing) and placeholder `viza.com` (public contact
> emails). Both were migrated to `viza.it.com` on 2026-07-10, **except**
> the per-applicant inbound-mail alias system — see "Deferred" below.

---

## 1. Hostname map

| Purpose | Hostname | Hosted on | Notes |
|---|---|---|---|
| Marketing site | `viza.it.com` (apex) | Vercel (`marketing-website`) | `NEXT_PUBLIC_SITE_URL` |
| Client portal | `app.viza.it.com` | Vercel (`internal-website`) | `NEXT_PUBLIC_PORTAL_URL` (marketing) + the portal's own `NEXT_PUBLIC_SITE_URL` |
| Agent backend / OCR | `viza-agent-backend-gqix.onrender.com` | Render | No custom domain yet; optional future `api.viza.it.com` |
| Transactional email sender | `viza.it.com` | Resend | `NOTIFY_FROM_EMAIL`, e.g. `VIZA <welcome@viza.it.com>` |

`NEXT_PUBLIC_SITE_URL` on the **portal** is load-bearing: it builds the
Stripe success/cancel URLs, the magic-link `redirectTo`, and the email
logo `src`. It must be `https://app.viza.it.com` in prod.

---

## 2. Environment variables (per deploy target)

### Vercel → `marketing-website`
| Var | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://viza.it.com` |
| `NEXT_PUBLIC_PORTAL_URL` | `https://app.viza.it.com` |
| `AGENT_BACKEND_URL` | `https://viza-agent-backend-gqix.onrender.com` |

### Vercel → `internal-website` (portal)
| Var | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://app.viza.it.com` |
| `NEXT_PUBLIC_AGENT_BACKEND_URL` | `https://viza-agent-backend-gqix.onrender.com` |
| `NOTIFY_FROM_EMAIL` | `VIZA <welcome@viza.it.com>` |
| `CONTACT_INBOX_EMAIL` | ops inbox (e.g. `ops@viza.it.com`) |
| `RESEND_API_KEY` | Resend key (send scope) |
| Supabase, Stripe, WeChat vars | unchanged |

### Render → `viza-agent-backend`
| Var | Value |
|---|---|
| `CORS_ORIGINS` | `https://viza.it.com,https://app.viza.it.com` (+ any staging) |

---

## 3. DNS records to create in Cloudflare (`viza.it.com` zone)

### 3a. Point the sites at Vercel
Add the domain in each Vercel project (Settings → Domains), then create
the records Vercel shows. Typical:

| Type | Name | Value |
|---|---|---|
| A / CNAME | `viza.it.com` (apex) | Vercel's apex target (`76.76.21.21` or CNAME-flatten to `cname.vercel-dns.com`) |
| CNAME | `app` | `cname.vercel-dns.com` |

### 3b. Email sending (Resend) — from `resend.com/domains` after adding `viza.it.com`
Resend generates the exact values; they look like:

| Type | Name | Value (example — use Resend's) |
|---|---|---|
| TXT (SPF) | `send.viza.it.com` | `v=spf1 include:amazonses.com ~all` |
| TXT (DKIM) | `resend._domainkey.viza.it.com` | Resend-provided key |
| MX | `send.viza.it.com` | `feedback-smtp.<region>.amazonses.com` (priority 10) |
| TXT (DMARC) | `_dmarc.viza.it.com` | `v=DMARC1; p=none;` |

Until these are added **and verified**, Resend refuses to send from
`@viza.it.com` (it only allows the account owner's own address via
`onboarding@resend.dev`).

---

## 4. Supabase (Auth URL configuration)

Magic-link sign-in uses `auth.admin.generateLink({ redirectTo })` pointed
at the portal. Supabase rejects redirects not on its allow-list, so in the
Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `https://app.viza.it.com`
- **Redirect URLs** (allow-list): add
  `https://app.viza.it.com/**` (and keep localhost for dev).

No schema/SQL change is needed — this is Auth project config only.

---

## 5. Where domains live in code (fallbacks)

Prod is env-driven, but these hardcoded **fallbacks** were updated to
`viza.it.com` so the app is correct-by-default even if an env var is unset:

- `viza-fe/marketing-website/lib/utils.ts` — `portalUrl()` default
- `viza-fe/marketing-website/app/{layout,robots,sitemap}.ts` — site URL default
- `viza-fe/internal-website/app/actions/{card-checkout,payments,wechat-provisioning}.ts` — `siteUrl()` default
- `viza-fe/internal-website/lib/notify/{email-layout,templates,dispatch}.ts` — logo URL, footer, from-address
- `viza-fe/internal-website/app/actions/receipts.ts`, `app/api/applications/[id]/ds160-proof/route.ts`, `app/api/contact/route.ts` — email senders
- Public contact addresses (`support@`, `privacy@`, `legal@`, `security@`, `dpo@`) in legal/help pages and all `messages/*.json`

---

## 6. Per-applicant inbound-mail alias system

New applicant inbox aliases use `appl-<ulid>@viza.it.com`. Government reply
mail is ingested through **Cloudflare Email Routing** →
`viza-be/email-worker` → Supabase/R2.

Existing `@haggstorm.com` aliases are intentionally not rewritten because an
official portal may already have registered that exact address. The legacy IMAP
ingest path accepts both domains during the transition. Cloud environments
should set:

- `INBOX_ALIAS_DOMAIN=viza.it.com`
- `INBOX_ALIAS_DOMAINS=viza.it.com,haggstorm.com`
- `APPLICANT_INBOX_ALIAS_DOMAIN=viza.it.com`

The code and DNS migrations are complete. Cloudflare Email Routing for
`viza.it.com` was activated on 2026-07-30, and its enabled catch-all routes to
`viza-email-worker`. A live Gmail smoke reached the worker and created an
`inbound_email` row in Supabase. The apex uses Cloudflare's three inbound MX
records; the separate `send.viza.it.com` Amazon SES MX remains in place for
outbound mail.
