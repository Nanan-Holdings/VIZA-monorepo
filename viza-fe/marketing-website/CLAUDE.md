# viza-fe/marketing-website — Conventions

Public marketing site for VIZA. Next.js 16 App Router. Deploys to `viza.com`.

## Audience and goals

- Visa-shopping visitors (B2C) and B2B leads.
- Primary KPI: account creation on the portal (`NEXT_PUBLIC_PORTAL_URL`).
- Secondary KPI: SEO surface for visa-by-country queries.

## Non-negotiables

1. **No auth dependencies.** Never import `@supabase/*`, `stripe`, `socket.io-client`, or any other auth/portal SDK. Marketing pages must render with zero user state. If a feature needs auth, link out to the portal.
2. **Brand tokens, never raw hex.** Use `bg-brand-500`, `text-fg-1`, `border-border-hairline`, etc. Tokens come from `tailwind.config.ts` and `app/globals.css :root`. If a value isn't tokenised, add it to the token layer first.
3. **Cross-app links via `portalUrl()`.** Don't hardcode `app.viza.com`. Use the helper in `lib/utils.ts` so envs swap cleanly between dev/preview/prod.
4. **Static-by-default.** Pages should be Server Components and statically renderable. Add `"use client"` only when interactivity is required (e.g. form submit handler).
5. **i18n routing already wired.** Pages live under `app/[locale]/...`. Locales: `en` (default, no prefix) and `zh-CN`. Add strings to `messages/en.json` and `messages/zh-CN.json`; never inline copy that should be translated.

## Adding a new visa destination

1. Create `lib/visa-content/{country}.ts` exporting a `VisaContent` object (mirror `indonesia.ts`).
2. Register it in `app/[locale]/visa/[country]/page.tsx#visaMap`.
3. Mark `available: true` and update the price/duration in `lib/visa-content/destinations.ts`.
4. SEO + sitemap update automatically via `generateStaticParams`.

## Cross-references

- Portal app: `../internal-website/CLAUDE.md`
- Token source: `../internal-website/tailwind.config.ts`, `../internal-website/app/globals.css`
- Marketing PRD: `../../docs/marketing-site-prd.md`
