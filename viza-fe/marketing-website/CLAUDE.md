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
5. **i18n routing already wired.** Pages live under `app/[locale]/...`. English is unprefixed (`/visa/japan`), every other locale is prefixed (`/zh-CN/visa/japan`). `lib/locales.ts` holds the full 60-locale list (same as GrooveSheet); only the codes in `ENABLED_LOCALES` are routable, in the sitemap, in hreflang and in the language switcher (today `en` and `zh-CN`). To launch a language: add `messages/<code>.json` (and its `lib/visa-content/<code>` files, then `npm run og`) and add the code to `ENABLED_LOCALES`. Missing message keys fall back to English (`i18n.ts`). Add strings to the messages files; never inline copy that should be translated.
6. **No forced language.** `proxy.ts` never redirects by browser language or cookie on deep links, so crawlers get each URL in its own language. The only redirects are the `viza_locale` choice cookie on `/` and the first-visit country rule in `vercel.json` (CN, HK, MO, TW to `/zh-CN`, never for crawlers).
7. **SEO on every page.** Return `pageMetadata()` from `lib/seo/metadata.ts` (title and description, canonical, hreflang plus x-default, Open Graph and Twitter large card). Link previews are static JPEGs in `public/og/<locale>/<key>.jpg`, made by `npm run og`. `npm run build` runs `scripts/check-copy.mjs`; after a deploy run `npm run verify -- <base-url>`.

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

### Destination page template (Phase B)

New and rewritten pages use `DestinationContent` (`lib/visa-content/types.ts`): the shared core fields
(hero, rejection reasons, FAQ, sources, price card) plus a `page` block. Section order, rendered by
`components/VisaDestinationMain.tsx`: at a glance, passport table, visa types, Singapore residents by pass
type, fees and timing, how to apply (Guided or Full-service), document checklist by applicant type, rejection
reasons, before you travel, reviewed line with date, FAQ (10 to 15, also the FAQPage JSON-LD), related
destinations and guides, start application. Headings and chrome come from `visa.dest` in the messages files.
Per country a page needs `lib/visa-content/<slug>.ts` and `zh-CN/<slug>.ts`, an entry in both registries,
a `lib/countries.ts` row, a hero image, and (if the default pattern is wrong) a `lib/seo/titles.ts` override.
`consultOnly: true` publishes a page that has no portal pricing row: its CTA is "Talk to a consultant" to
`/contact` and `launched` stays false. Run `npm run og` after adding a slug.

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
