# Marketing Website Agent Guide

Scope: applies to `viza-fe/marketing-website`.

Read `CLAUDE.md` in this folder before making product or UI changes. It is the
marketing site convention source for auth boundaries, i18n, visa destination
pages, and portal checkout links.

## Analytics And SEO

- GTM is installed in `app/layout.tsx`; keep `NEXT_PUBLIC_GTM_ID` public-only.
- Client-side conversion events use `lib/analytics.ts`; global CTA clicks are
  collected by the inline `marketing-click-tracking` script in `app/layout.tsx`.
- Do not send passport values, emails, phone numbers, names, or checkout prefill
  payloads to analytics. Event metadata should stay coarse: event name, page,
  country slug, payment method, counts, and non-identifying status fields.
- Visa destination structured data is emitted by
  `components/VisaStructuredData.tsx` and mounted from the rich and fallback visa
  templates.
- Public availability and display pricing must come from
  `lib/public-catalogue.ts`. On an unavailable or malformed feed, fail closed:
  show no destination as purchasable and never restore static prices.
- Public service availability comes from `lib/public-status.ts`, the
  agent-backend `/api/public/status` snapshot, and the same-site
  `app/api/status/route.ts` refresh proxy. The status UI must show missing or
  stale observations as unknown and must never synthesize uptime or incidents.

## Checks

For code changes in this package, run:

```bash
npm run type-check
npm run lint
npm run build
```
