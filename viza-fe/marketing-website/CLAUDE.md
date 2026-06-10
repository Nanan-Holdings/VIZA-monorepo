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

- `lib/countries.ts` — `CountryMeta` (slug, flag, visa type, validity, hero image, launched).
- `lib/visa-content/<slug>.ts` — the rich `VisaContent` (hero, overview, process,
  documents, rejection reasons, entry/exit, extension, reviews, FAQ, sources, price copy).
  `lib/visa-content/types.ts` is the schema; `indonesia.ts` is the reference.
- `lib/visa-content/index.ts` — `contentBySlug` registry.
- `components/VisaCountryRich.tsx` (+ `visa-rich.css`) — renders a `VisaContent`.
  `app/[locale]/visa/[country]/page.tsx` resolves the slug: launched + has content →
  `VisaCountryRich`; launched without content yet → thin `VisaCountryTemplate` fallback;
  unlaunched/unknown → `ComingSoon`.
- Price card numbers are **computed** from `lib/pricing.ts` (`priceBreakdownSgd`), not
  authored per country — keep `PRICING` in sync with the portal mirror.

### Adding a new visa destination

1. Add a `CountryMeta` entry to `lib/countries.ts` (set `image: HERO("<slug>")`, `launched: true`).
2. Add the pricing key to `lib/pricing.ts` `PRICING` (mirror the portal `PACKAGE_PRICING`).
3. Add a hero image at `public/assets/heroes/<slug>.jpg` — add the slug→Unsplash id to
   `scripts/fetch-hero-images.mjs` and run `node scripts/fetch-hero-images.mjs`, then commit it.
4. Create `lib/visa-content/<slug>.ts` exporting a `VisaContent` (mirror `indonesia.ts`) and
   register it in `lib/visa-content/index.ts`.
5. SEO + sitemap update automatically via `generateStaticParams`.

> i18n note: per-country `VisaContent` prose is authored English-first. Section chrome in
> `VisaCountryRich` is currently inlined English (matching the former bespoke Indonesia page).
> Full zh-CN translation of the rich pages is a tracked follow-up; visa specifics (fees,
> validity, documents, sources) in each content file should be ops/legal-reviewed before publish.

## Application flow

Country pages show a **single** "Start application" CTA → `/apply?country=<slug>`. The
`/apply` wizard (`app/[locale]/apply/page.tsx`) is country-aware and ends with the payment
choice: card / WeChat buttons deep-link to the portal checkout. Payment always happens
*after* the application is started — no pay buttons on the country pages themselves.

## Shared CTA components

- `components/PayByCardButton.tsx` / `components/WechatPayButton.tsx` — deep-link to the
  portal's guest checkout (`portalUrl('/checkout/{card|wechat}?country=&visa=&locale=')`).
  Used **only** on the final step of `/apply`, never on country/landing pages. Marketing-side
  has zero payment / SDK imports — the buttons are plain `<a>`. The `wechat` / `wechat-hover`
  tailwind colors are third-party brand tokens used **only** by the WeChat CTA; do not reuse them.

## Cross-references

- Portal app: `../internal-website/CLAUDE.md`
- Token source: `../internal-website/tailwind.config.ts`, `../internal-website/app/globals.css`
- Marketing PRD: `../../docs/marketing-site-prd.md`
- WeChat Pay checkout (server-side, in the portal): `../internal-website/app/checkout/wechat/`
