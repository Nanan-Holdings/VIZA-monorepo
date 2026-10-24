# viza.it.com SEO baseline, 2026-10-24

Recorded before the `seo/technical-2026-10-24` changes, so the effect can be
measured in 4 to 8 weeks. Source: `audit.mjs https://viza.it.com` (36 sitemap
URLs crawled) plus manual checks with curl as Googlebot.

## Search data available today

- Search Console: no property reachable by the Kelin service account
  (`gsc.mjs sites`). DNS already carries two `google-site-verification` TXT
  records, so a property exists under another Google account. The HTML file
  `google65d131abe979689c.html` is added in this change for Edward's account.
- Third-party rank/traffic tools (Semrush, Ubersuggest, Ahrefs, OpenRush): no
  quota or plan on 2026-10-24, so no ranked-keyword or backlink baseline.
- Analytics: GA4 `G-RKJ1ZKV7QK`, PostHog and Clarity present in the HTML.

## Audit counts (production, 36 pages)

| Check | Count |
|---|---|
| Sitemap URLs that redirect (unprefixed to `/zh-CN`) | 11 |
| Missing canonical | 26 |
| Missing og:image | 31 |
| Pages with images missing alt | 34 (home 18 of 29) |
| Missing title / description / og:title / twitter:card | 8 each (blog posts) |
| Description under 70 chars | 7 (home 48) |
| Title over 60 chars | 3 |
| Duplicate default title ("VIZA", em dash, "AI-powered visa applications") | 16 pages |
| Sitemap URL that 404s (`/about`, `/zh-CN/about`) | 2 |
| Pages with 3 h1 (`/apply`, `/zh-CN/apply`) | 2 |
| favicon.ico | 404 |

## Root causes found

1. **English pages were invisible to crawlers.** `proxy.ts` sent every request
   without a `NEXT_LOCALE` cookie to `/zh-CN/...` with a 307. Crawlers never
   carry the cookie, so every unprefixed English URL (except `/blog/*`) was a
   temporary redirect for Google, while the `Link` hreflang header and the
   sitemap both pointed at those redirecting URLs.
2. **The money pages had no metadata.** `/visa/<slug>` pages rendered good
   content but no title (site default), description, canonical or social card,
   and were missing from the sitemap whenever the portal catalogue API was down
   (it answered 503 on 2026-10-24, so the sitemap listed zero visa pages).
3. **Blog outages were cached as noindex.** When the portal blog API failed, an
   article URL answered 200 with "The journal is temporarily unavailable" and
   `noindex`. 8 of 11 English articles were in that state on 2026-10-24.
4. Header hreflang (next-intl) advertised Chinese twins of English-only articles.
5. Next.js streamed metadata into `<body>` for user agents outside its bot list,
   so tools and some crawlers saw pages with no title or canonical.
6. `llms.txt` and `index.md` still said VIZA charges a service fee and promised
   guaranteed delivery dates; the service has been free since 2026-09-15.

## After (local `next build && next start`, 20-page sample, 2026-10-24)

`audit.mjs http://localhost:3457 --urls` over home, apply, contact, careers,
product, security, status, legal, blog and 7 visa pages in both locales:
0 missing title, description, canonical, og:image or twitter:card; 0 sitemap
redirects; 0 images missing alt; favicon 200; 52 sitemap URLs (blog posts
appear when the portal blog API is up), all 200 for a crawler. Remaining audit
notes are expected locally (canonical and og:image on the production host) or
by design (CJK descriptions under 70 characters).

## To re-measure after deploy

```bash
S=~/.claude/skills/seo-optimizer/scripts
node $S/audit.mjs https://viza.it.com
# Search Console (Edward's property): submit https://viza.it.com/sitemap.xml,
# request indexing for /zh-CN/visa/united-states, /visa/vietnam,
# /zh-CN/visa/vietnam, /visa/indonesia, /visa/india, /zh-CN/visa/japan,
# /zh-CN/visa/france, /visa/united-kingdom, /zh-CN, /
```
