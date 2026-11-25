# Marketing Website Agent Guide

Scope: applies to `viza-fe/marketing-website`.

The look comes from the Framer reference, rebuilt as the design system in `design-system/` (tokens, motion,
section components); `docs/design-system/ANALYSIS.md` maps every Framer value and section to it. Build new
pages from those components. The shared header and footer are `design-system/sections/SiteHeader.tsx` and
`SiteFooter.tsx` (`components/SiteNav.tsx` and `components/SiteFooter.tsx` wrap them); footer social links
follow `SAME_AS` in `lib/seo/site.ts`.

Read `CLAUDE.md` in this folder before making product or UI changes. It is the
marketing site convention source for auth boundaries, i18n, visa destination
pages, and portal checkout links.

## Analytics And SEO

- SEO plumbing: `lib/seo/metadata.ts` (page metadata helper), `lib/seo/titles.ts` (destination titles and descriptions),
  `lib/locales.ts` (locale registry), `app/sitemap.ts` and `app/robots.ts`. `scripts/og.mjs` renders the link previews,
  `scripts/check-copy.mjs` runs before every build, `scripts/verify.mjs` fetches every sitemap URL as Googlebot and WhatsApp.

- `app/[locale]/blog/**` renders published portal articles. `lib/marketing-blog.ts` reads the portal's public API; category and article JSON-LD live in `lib/blog-structured-data.ts` and `lib/blog-taxonomy.ts`.
- Public blog layout styles live in `app/blog.css` and are scoped to the blog
  routes by `app/[locale]/blog/layout.tsx`. The shared featured story, topic
  navigation, and cards live in `components/MarketingBlogFeed.tsx`; article
  rendering and the final CTA live in `components/MarketingBlogArticle.tsx` and
  `components/MarketingBlogCta.tsx`.
- `app/api/revalidate/route.ts` accepts the shared revalidation secret after an admin publishes a post. Keep draft content out of the public feed and sitemap.

- GTM is installed in `app/layout.tsx`; keep `NEXT_PUBLIC_GTM_ID` public-only.
- Client-side conversion events use `lib/analytics.ts`; global CTA clicks are
  collected by the inline `marketing-click-tracking` script in `app/layout.tsx`.
- Do not send passport values, emails, phone numbers, names, or checkout prefill
  payloads to analytics. Event metadata should stay coarse: event name, page,
  country slug, counts, and non-identifying status fields.
- Visa destination structured data is emitted by
  `components/VisaStructuredData.tsx` and mounted from the rich and fallback visa
  templates.
- VIZA's service is free; there is no checkout. Never display a VIZA fee,
  paid upgrade, or refund promise. The only fee shown is the published
  government fee from `lib/public-catalogue.ts`, labelled as paid directly to
  the issuing authority. On an unavailable or malformed feed, never restore
  static prices.
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
