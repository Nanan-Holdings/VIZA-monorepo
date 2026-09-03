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
- Public service availability comes from `lib/public-status.ts`, the
  agent-backend `/api/public/status` snapshot, and the same-site
  `app/api/status/route.ts` refresh proxy. The status UI must show missing or
  stale observations as unknown and must never synthesize uptime or incidents.
- Public editorial content lives at `app/[locale]/blog/**` and is read through
  the validated, fail-closed portal client in `lib/marketing-blog.ts`. The
  marketing app remains auth-free and does not connect directly to Supabase.
- `app/s/[code]/route.ts` delegates privacy-safe click recording to the portal,
  accepts only HTTPS destinations, and sets only the anonymous
  `viza_marketing_session` cookie. Keep `/s` outside locale middleware.
- `app/api/revalidate/route.ts` accepts only the shared server-side bearer
  secret and invalidates localized blog index/detail paths after publication.

## Checks

For code changes in this package, run:

```bash
npm run type-check
npm run lint
npm run build
```
