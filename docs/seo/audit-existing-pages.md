# Existing pages SEO audit: viza.it.com (25 Nov 2026)

Raw data: `page-inventory.csv` (125 rows: 96 Googlebot fetches with no cookie, 29 English fetches with `NEXT_LOCALE=en`). Per-URL table: `page-table.md`.

## Top issues by impact

1. **Googlebot cannot reach the English site.** `proxy.ts` forces `zh-CN` for any request without a cookie. Every unprefixed URL answers 307 to `/zh-CN/...`: home, all static pages and all 16 English destination pages. Only blog posts and categories escape. `/blog` itself also redirects, because the exemption is `startsWith("/blog/")`.
2. **Destination pages have no metadata.** `visa/[country]/page.tsx` has no `generateMetadata`. All 32 destination URLs (16 slugs x 2 locales) use the site default title and the English default description, including the zh-CN ones.
3. **No destination is in the sitemap.** `sitemap.ts` builds them from `app.viza.it.com/api/public/catalogue`, which returns no entries today. All 16 slugs are `launched: true` and render.
4. **No hreflang or x-default anywhere.** Canonicals exist only on the blog.
5. **Most static pages have no metadata.** Apply, contact, careers, security, status, product, events and legal use the site default. Translated titles and descriptions already exist in `messages/*.json` under `pages.*` but are not wired in.
6. **Sitemap quality.** Of 38 URLs: 25 return 200, 12 redirect, 1 is a 404 (`/about`, no route). `lastModified` is always "now".
7. **Social previews.** `og:image` only on blog posts. Other pages use the default `og:title`; Twitter card is `summary`.
8. **Chinese pages carry English metadata.** zh-CN title and description are the English default on 8 of 11 static pages and all destinations. `/zh-CN/blog` is empty (284 words) but in the sitemap; every `/zh-CN/blog/<slug>` and category URL is a 404.
9. **Blog titles.** Index and category titles repeat the brand ("... VIZA · VIZA"). All 13 post titles are over 60 characters and 12 descriptions are over 160.
10. **Soft 404s.** Unknown `/visa/<slug>` returns 200 with a "coming soon" page and no noindex. Internal links on zh-CN pages are unprefixed, so each click is a redirect hop.

## What is fine

- robots.txt is permissive and points to the sitemap.
- Destination pages are server rendered despite the `"use client"` wrapper: 1,000 to 1,900 English words, 10 H2s, Service, BreadcrumbList and FAQPage JSON-LD.
- Blog posts: one H1, canonical, BlogPosting schema, og:image, 750 to 1,300 words.

## Metadata in code

- `app/layout.tsx`: default title, template `%s · VIZA`, one English description, `openGraph` with no image, Organization and WebSite JSON-LD. No alternates, no twitter block.
- Home: `generateMetadata` uses `pages.home`, no canonical, hreflang or image.
- Blog: canonical, no hreflang.
- Apply, contact and careers are `"use client"` and need a server wrapper to export metadata.
- `VisaStructuredData`: `Offer` has no price; breadcrumb "Visa services" points to home.
- `sitemap.ts`: depends on the live API for destinations; lists `/about`, `/status` and redirecting URLs.
- `robots.ts`: no Disallow for `/api/`, `/s/` or `/apply`.

## Duplicates and thin pages

- The default title and default English description each appear on 55 URLs.
- Thin: `/zh-CN/blog` 284 words, `/zh-CN/product` 218 (121 in English), `/events` 106 to 183, unknown slugs 117 to 192 with HTTP 200, two blog categories about 250.
- `/status` is 54k (English) to 91k (Chinese) words; poor index candidate.
- Missing schema: `sameAs`, `inLanguage`, `HowTo`, offer prices, `ContactPage`, a local business with the Singapore address.

## Destination pages

- `lib/countries.ts` has 16 slugs, all `launched: true`, English content and a Chinese twin. `viza-test` correctly 404s.
- Japan, Indonesia and France share one template with 10 H2 sections. English word counts: Japan 1,544, Indonesia 1,028, France 1,691. Each has official source links, SGD fee examples and extension rules.

| Section | Japan | Indonesia | France |
|---|---|---|---|
| Process | 228 words | 156 | 214 |
| Documents | 104 | 49 | 134 |
| Rejection reasons | 157 | 70 | 161 |
| Visible FAQ | 420 | 240 | 524 |
| FAQ entries in JSON-LD | 6 | 5 | 7 |

Weak points:

- Written for Singapore passport holders, who are often visa free, so the paying customer (a visa-required national living in Singapore) is not addressed.
- Indonesia shows "get it by 9 May 2026", a past date.
- Review totals differ per page (14,203 on Japan, 12,841 on Indonesia and France) and "5 days ago" is static text. Do not add Review schema for these.
- "Nearby countries" always lists the same five slugs, so Japan links to Egypt and Saudi Arabia.

## Fixes by page

**Site wide**
- Stop forcing zh-CN for crawlers and cookie-less visitors; exempt `/blog` itself.
- Shared `alternates` helper (canonical, `en`, `zh-CN`, `x-default`).
- Default 1200x630 og and twitter image; zh-aware Organization block.
- Sitemap from `COUNTRIES`, drop `/about` (until built) and `/status`, final URLs only, real `lastModified`.
- Real 404 for unknown slugs, locale-prefixed internal links, fix the doubled brand.

**Home:** canonical, hreflang, image; `ItemList` of destinations; a crawlable intro paragraph.

**`/product`, `/events`:** metadata and real content, or remove. `/events` noindex until it has content.

**`/apply`:** 3 H1s down to 1; use `pages.apply`; consider noindex.

**`/contact`:** use `pages.contact`; `ContactPage` schema; phone, WhatsApp and WeChat details.

**`/careers`, `/security`:** wire `pages.careers` and `pages.security`. `JobPosting` only for real roles.

**`/status`:** use `pages.status`; noindex; out of the sitemap.

**Legal:** metadata, canonical, hreflang.

**`/about`:** build it (who runs VIZA, licences, team, address) or remove it from the sitemap.

**Blog index and categories:** fix the duplicate brand; unique description and short intro per category; og:image. `/zh-CN/blog` noindex and out of the sitemap until Chinese posts exist.

**Blog posts:** titles of 60 characters or less, descriptions about 155; og image size and alt; contextual links to the matching `/visa/<slug>` pages.

**Destination pages:** `generateMetadata` and `generateStaticParams` resolving the country on the server; unique titles and descriptions per locale (wording from keyword research); canonical, hreflang pair, 1200x630 image; `price` and `priceCurrency` on `Offer` or drop `Offer`; FAQ JSON-LD matching the visible FAQ; `HowTo`; fix stale dates and review totals; real neighbours; consistent H1 audience wording.

**Unknown slugs:** 404 or noindex.
