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

## Visa destination pages

Every `/visa/<slug>` page renders from data via one rich, shared component — there
is no bespoke per-country page. The pieces:

- `lib/countries.ts` — reviewed presentation and checkout-availability metadata
  for known routes; a launched entry must match the portal's canonical pricing
  matrix.
- `lib/public-catalogue.ts` + `components/CatalogueProvider.tsx` — fail-closed
  catalogue snapshots from the portal API (availability plus the published
  government fee), overlaid onto the reviewed availability list.
- `lib/visa-content/<slug>.ts` — the rich `VisaContent` (hero, overview, process,
  documents, rejection reasons, entry/exit, extension, reviews, FAQ, sources, price copy).
  `lib/visa-content/types.ts` is the schema; `indonesia.ts` is the reference.
- `lib/visa-content/index.ts` — `contentBySlug` registry.
- `components/VisaCountryRich.tsx` (+ `visa-rich.css`) — renders a `VisaContent`.
  `app/[locale]/visa/[country]/page.tsx` resolves the slug: launched + has content →
  `VisaCountryRich`; launched without content yet → thin `VisaCountryTemplate` fallback;
  unlaunched/unknown → `ComingSoon`.
- VIZA's service is free (payments were retired on 2026-09-15, see
  `architecture.payment`). Price cards show "VIZA service: Free" and, when the
  published snapshot has one, the government fee via `lib/pricing.ts`, always
  labelled as paid directly to the issuing authority. Never show a VIZA fee,
  "all-inclusive" totals, paid upgrades, or refund promises.

### Adding a new visa destination

1. Add a `CountryMeta` fallback entry to `lib/countries.ts` with
   `launched: false` so the route can render a coming-soon state.
2. Add a hero image at `public/assets/heroes/<slug>.jpg` — add the slug→Unsplash id to
   `scripts/fetch-hero-images.mjs` and run `node scripts/fetch-hero-images.mjs`, then commit it.
3. Create `lib/visa-content/<slug>.ts` exporting a `VisaContent` (mirror `indonesia.ts`) and
   register it in `lib/visa-content/index.ts`.
4. In `/admin/catalogue-publication`, save the public draft, resolve every
   readiness blocker, and publish. Only then do cards, detail pages, checkout,
   and sitemap availability appear.

> i18n note: per-country `VisaContent` prose is authored English-first. Section chrome in
> `VisaCountryRich` is currently inlined English (matching the former bespoke Indonesia page).
> Full zh-CN translation of the rich pages is a tracked follow-up; visa specifics (fees,
> validity, documents, sources) in each content file should be ops/legal-reviewed before publish.

## Application flow

Country pages show a **single** "Start application" CTA → `/apply?country=<slug>`. The
`/apply` wizard (`app/[locale]/apply/page.tsx`) is country-aware and ends with a free
hand-off to the portal application. There is no checkout and nothing to pay VIZA.

## Shared CTA components

- `components/StartApplicationButton.tsx` deep-links to the portal application
  (`portalUrl('/client/application?country=&visaType=')`). Signed-out visitors are sent to
  portal login with `returnTo` and come back to that destination. Used **only** on the final
  step of `/apply`. It is a plain `<a>`; the marketing site has zero payment or auth SDK imports.

## Cross-references

- Portal app: `../internal-website/CLAUDE.md`
- Token source: `../internal-website/tailwind.config.ts`, `../internal-website/app/globals.css`
- Marketing PRD: `../../docs/marketing-site-prd.md`
- Payment removal decision: `../../architecture.payment`
