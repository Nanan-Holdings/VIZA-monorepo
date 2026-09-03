# Marketing Site Deploy Runbook

Artifact for **MKT-011**. How `viza-fe/marketing-website` is built, configured,
and promoted on Vercel. Cross-references `vercel.json` (MKT-010). **Docs only —
no dashboard actions performed by the agent.**

Per the canonical `docs/DOMAINS.md` topology: marketing = `viza.it.com`
(Vercel project `marketing-website`), portal = `app.viza.it.com` (Vercel
project `internal-website`). Git-only deploys promote `main` to production.

## Vercel project linkage

- One Vercel project, root = `viza-fe/marketing-website`.
- `vercel.json`: framework `nextjs`, `installCommand: npm ci`, `buildCommand:
  next build`, `outputDirectory: .next`, region `sin1` (Singapore, closest to the
  primary audience). Git production branch = `main`.
- Next.js config: `output: "standalone"`, `next-intl` plugin, Unsplash remote
  image patterns (`next.config.ts`).

## Required env vars (names only — set in Vercel project settings)

| Var | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical marketing origin: `https://viza.it.com` |
| `NEXT_PUBLIC_PORTAL_URL` | Portal origin: `https://app.viza.it.com` |
| `NEXT_PUBLIC_AGENT_BACKEND_URL` | Agent backend base (if used by any marketing feature). |
| `NEXT_PUBLIC_GTM_ID` | VIZA-owned Google Tag Manager container. |
| `REVALIDATE_SECRET` | Server-only bearer secret shared with the portal for blog cache refresh. |

The marketing app still has no auth, payment, or Supabase SDK. Its only
server-side secret authenticates cache invalidation; checkout and marketing
operations remain on the portal.

## Portal marketing-operations deployment

The portal hosts `/admin/marketing`, public blog feed APIs, asset uploads,
privacy-safe click recording, and scheduled draft generation. Configure its
Supabase, OpenRouter, Zernio, Google reporting, `CRON_SECRET`, automation actor,
public marketing origin, and matching revalidation secret variables listed in
`viza-fe/internal-website/.env.example`.

Apply the timestamped `2026082817*_marketing_*.sql` migrations before deploying
the portal. They are also included in `scripts/migrate-viza-required.ts` and are
already applied to the canonical production project `oyjxdzsoejraedqghndi`.
Never substitute a Fruition project, key, account, board, channel, or model
credential.

## Preview → production flow

1. Push a branch / open a PR → Vercel builds a **preview** deployment with a
   unique URL. Verify country pages (`/visa/<slug>`), `/zh-CN/...` locale, and
   the home grid.
2. Merge to `main` → Vercel promotes to **production** (`viza.it.com`).
3. Rollback: in the Vercel dashboard, promote a previous production deployment
   (instant, no rebuild).

## Post-deploy checks

```bash
curl -fsS https://viza.it.com/                       # home renders
curl -fsS https://viza.it.com/visa/thailand          # template page
curl -fsS https://viza.it.com/zh-CN/visa/japan       # localized
curl -fsS https://viza.it.com/blog                   # localized blog index
curl -fsS 'https://app.viza.it.com/api/public/marketing/blog?locale=en'
curl -fsS https://viza.it.com/sitemap.xml | grep -c "/blog"
curl -I https://app.viza.it.com/admin/marketing      # unauthenticated → /admin/login
```

After credentials are set, create a draft, upload a cover image, publish it,
verify both public locales, generate linked social copy, create Zernio drafts,
schedule/cancel/sync one post per channel, and confirm `/s/<code>` redirects
even if click telemetry is temporarily unavailable. Invoke the cron routes
without a bearer token and verify they return 401 before testing with the
Vercel-managed secret.
