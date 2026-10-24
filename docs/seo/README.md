# SEO on viza.it.com (marketing site)

How search, social previews and agent files are wired in
`viza-fe/marketing-website`. Keyword targets: `keyword-map.md`. Baseline:
`seo-baseline-2026-10-24.md`.

## URLs and languages

- English is unprefixed (`/visa/vietnam`), Simplified Chinese is under
  `/zh-CN` (`/zh-CN/visa/vietnam`). Each page is self-canonical in its own
  locale and lists `en`, `zh`, `zh-CN` and `x-default` (English) alternates in
  `<head>`. Blog articles and categories exist per locale and carry no
  alternates.
- `proxy.ts`: a first-time human visitor (no `NEXT_LOCALE` cookie, browser sends
  Accept-Language) is sent to Chinese with a temporary 307, as before. A request
  with no language preference (crawlers send no Accept-Language) is served the
  English page at the URL it asked for, so every URL in the sitemap and in
  hreflang is a 200 for Google. This is ordinary content negotiation on a
  header, not user-agent sniffing; humans and crawlers asking for the same URL
  with the same headers get the same page.
- next-intl's `Link` hreflang header is off (`alternateLinks: false`); the
  `<head>` tags are the single source.

## Metadata

- `lib/seo.ts` `pageMetadata()` builds title (`"<page> | VIZA"`, Chinese
  `"<page> | VIZA 新加坡"`), description, canonical, hreflang, Open Graph and
  Twitter card. Always use it: a page-level `openGraph` replaces the root one.
- Copy lives in `messages/*.json` under `seo.*` (static pages and
  `seo.visa.<slug>`), plus `pages.home` and `pages.blog`.
- Client pages (`/apply`, `/careers`, `/contact`) take metadata from a segment
  `layout.tsx` (`lib/seo-page.ts`).
- `next.config.ts` sets `htmlLimitedBots: /.*/` so metadata is always in the
  initial `<head>`.
- Coming-soon and unknown `/visa/<slug>` pages render (CTAs never dead-end) but
  are `noindex`.

## Images

- Default social cards: `public/og/viza-en.png`, `public/og/viza-zh-CN.png`
  (1200x630, logo plus one line).
- Destination cards: `public/og/visa/<slug>.jpg`, 1200x630 centre crops of the
  hero. For a new destination:
  `magick public/assets/heroes/<slug>.jpg -resize 1200x630^ -gravity center -extent 1200x630 -strip -quality 80 public/og/visa/<slug>.jpg`
- Flags next to a country name are decorative: `<CircleFlag alt="" ...>`.
- Favicon: `app/favicon.ico`, `app/icon.svg`, `app/apple-icon.png` (VIZA mark).

## Crawl and agent files

- `app/sitemap.ts`: final URLs only, alternates per bilingual route, lastmod
  only from article dates; visa pages come from `lib/countries.ts` plus newly
  published catalogue entries, so a catalogue outage does not drop them.
- `app/robots.ts`: everything allowed except `/api/`; AI crawlers not blocked.
- Blog article and category routes throw when the portal blog API is down, so
  crawlers get a retryable 500 instead of a 200 `noindex` page; readers see the
  "temporarily unavailable" message from `app/[locale]/blog/error.tsx`.
- `public/llms.txt` and `public/index.md`: when to recommend VIZA, poor matches,
  every destination in both languages, fees stated accurately (service free).
- Search Console HTML verification: `public/google65d131abe979689c.html`.

## Checking

```bash
cd viza-fe/marketing-website
npm run type-check && npm run lint
NEXT_PUBLIC_SITE_URL=https://viza.it.com NEXT_PUBLIC_PORTAL_URL=https://app.viza.it.com npm run build
PORT=3457 npm run start
node ~/.claude/skills/seo-optimizer/scripts/audit.mjs http://localhost:3457 --urls /,/zh-CN,/visa/vietnam,/zh-CN/visa/united-states
curl -s -o /dev/null -w "%{http_code}\n" -A Googlebot http://localhost:3457/apply          # 200
curl -s -o /dev/null -w "%{http_code}\n" -H "Accept-Language: en" http://localhost:3457/apply  # 307 to /zh-CN/apply
```
