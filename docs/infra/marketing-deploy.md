# Marketing Site Deploy Runbook

Artifact for **MKT-011**. How `viza-fe/marketing-website` is built, configured,
and promoted on Vercel. Cross-references `vercel.json` (MKT-010). **Docs only —
no dashboard actions performed by the agent.**

Per deployment topology: marketing = `haggstorm.com` (Vercel project), portal =
`app.haggstorm.com`. Git-only deploys (push to `main` → production).

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
| `NEXT_PUBLIC_SITE_URL` | Canonical marketing origin (sitemap/robots, OG). e.g. `https://haggstorm.com` |
| `NEXT_PUBLIC_PORTAL_URL` | Portal origin for `portalUrl()` cross-app links + checkout deep-links. e.g. `https://app.haggstorm.com` |
| `NEXT_PUBLIC_AGENT_BACKEND_URL` | Agent backend base (if used by any marketing feature). |

No secret/server env vars — the marketing app has **zero auth/payment SDKs**
(see marketing CLAUDE.md non-negotiable #1); checkout happens on the portal.

## Preview → production flow

1. Push a branch / open a PR → Vercel builds a **preview** deployment with a
   unique URL. Verify country pages (`/visa/<slug>`), `/zh-CN/...` locale, and
   the home grid.
2. Merge to `main` → Vercel promotes to **production** (`haggstorm.com`).
3. Rollback: in the Vercel dashboard, promote a previous production deployment
   (instant, no rebuild).

## Post-deploy checks

```bash
curl -fsS https://haggstorm.com/                # home renders
curl -fsS https://haggstorm.com/visa/thailand   # template page
curl -fsS https://haggstorm.com/zh-CN/visa/japan # localized
curl -fsS https://haggstorm.com/sitemap.xml | grep -c "/visa/"  # all launched countries (×2 locales)
```
