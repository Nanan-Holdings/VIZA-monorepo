# Marketing Website Agent Guide

Scope: applies to `viza-fe/marketing-website`.

Read `CLAUDE.md` in this folder before making product or UI changes. It is the
marketing site convention source for auth boundaries, i18n, visa destination
pages, and portal checkout links.

## Analytics And SEO

- GTM and GA4 are installed in `app/layout.tsx`; keep `NEXT_PUBLIC_GTM_ID` and
  `NEXT_PUBLIC_GA_MEASUREMENT_ID` public-only. GA4 must use the VIZA-owned
  measurement ID, not a tag from an unrelated property.
- Client-side conversion events use `lib/analytics.ts`; global CTA clicks are
  collected by the inline `marketing-click-tracking` script in `app/layout.tsx`.
- Do not send passport values, emails, phone numbers, names, or checkout prefill
  payloads to analytics. Event metadata should stay coarse: event name, page,
  country slug, payment method, counts, and non-identifying status fields.
- Visa destination structured data is emitted by
  `components/VisaStructuredData.tsx` and mounted from the rich and fallback visa
  templates.
- Destination route metadata and indexability live in
  `app/[locale]/visa/[country]/page.tsx`; the interactive catalogue rendering is
  isolated in `components/VisaCountryPageClient.tsx` so crawlers receive the
  destination-specific tags without waiting for client hydration.
- Public availability and display pricing must come from
  `lib/public-catalogue.ts`. On an unavailable or malformed feed, fail closed:
  show no destination as purchasable and never restore static prices.
- Internal payment-test SKUs such as `viza-test` must never appear in the public
  catalogue, even when a production catalogue row is accidentally published.
- Public service availability comes from `lib/public-status.ts`, the
  agent-backend `/api/public/status` snapshot, and the same-site
  `app/api/status/route.ts` refresh proxy. Production requires an explicit HTTPS
  backend URL. The page must remain renderable with an unknown snapshot, while
  the proxy returns non-200 until fresh monitored evidence exists.
- Report-only CSP violations go to the same-origin `app/api/csp-report/route.ts`
  collector. It stores/logs only bounded directive, disposition, and blocked
  source category aggregates; never retain URLs, query strings, samples,
  referrers, cookies, request identity, or user data.
- Public editorial content lives at `app/[locale]/blog/**` and is read through
  the validated, fail-closed portal client in `lib/marketing-blog.ts`. The
  marketing app remains auth-free and does not connect directly to Supabase.
- Public blog layout styles live in `app/blog.css` and are scoped to the blog
  routes by `app/[locale]/blog/layout.tsx`. The shared feature, topic navigation,
  and post cards live in `components/MarketingBlogFeed.tsx`; the article and
  final application CTA live in `components/MarketingBlogArticle.tsx` and
  `components/MarketingBlogCta.tsx`.
- Blog category routes derive their hubs from published portal categories via
  `lib/blog-taxonomy.ts`. `lib/blog-structured-data.ts` owns the public article
  and breadcrumb JSON-LD; the sitemap includes each non-empty category hub.
- `app/s/[code]/route.ts` delegates privacy-safe click recording to the portal,
  accepts only HTTPS destinations, and sets only the anonymous
  `viza_marketing_session` cookie. Keep `/s` outside locale middleware.
- The top-right portal action is an explicit localized Login/登录 button that
  uses `portalUrl("/client/login")`; keep it visible as text on desktop and as
  the compact account icon on small screens.
- Shared footer social links and localized labels live in
  `components/SiteFooter.tsx`; their brand SVGs live in `public/assets/social/`.
- Launch-beta unique links use the privacy-safe `?beta=` suffix on `/apply`.
  Final checkout buttons POST all applicant state to the portal's encrypted
  handoff endpoint; never place email, name, phone, passport prefill, or the
  beta token in a checkout URL. Validation, single-use enforcement, and
  discount logic stay server-side in the portal.
- `app/api/revalidate/route.ts` accepts only the shared server-side bearer
  secret and invalidates localized blog index/detail paths after publication.

## Checks

For code changes in this package, run:

```bash
npm run type-check
npm run lint
npm run build
```
