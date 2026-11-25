# VIZA SEO plan

25 Nov 2026. Built from three pieces of research in this folder:

- `audit-existing-pages.md`, `page-inventory.csv`, `page-table.md`: every live URL fetched as Googlebot
- `competitors.md`: who ranks in Singapore and how their pages are built
- `semrush-keywords.md`, `keywords.csv`: Semrush Keyword Magic and Organic Research, database Singapore

Design comes after this. The Framer pages are mapped at the end.

## Where we stand

- viza.it.com ranks for 7 Singapore keywords, all below position 10, with zero traffic. Best: 日本 签证 at 28, 美 签 at 34.
- Google can't see the English site. Every English URL redirects crawlers to `/zh-CN`.
- The 16 destination pages are decent (1,000 to 1,900 words, FAQ schema), but they all share one generic title, none is in the sitemap, and they are written for Singapore passport holders, who mostly don't need a visa.
- Competitors are beatable. Atlys gets almost all its Singapore traffic from one arrival card post. No agency ranks for UK or Australia from Singapore. Nobody has real Chinese-language destination pages for people living in Singapore. Nobody offers a free service.

## Where the searches are

Monthly searches, Google Singapore.

| Demand | Biggest terms | Volume | KD | VIZA today |
|---|---|---:|---:|---|
| Arrival cards | mdac malaysia | 22,200 | 36 | none |
| | ica arrival card / sgac | 18,100 each | 17 / 35 | blog post at 45 |
| | japan arrival card | 9,900 | 39 | none |
| | thailand digital arrival card | 6,600 | 34 | none |
| China visa | apply china visa in singapore | 6,600 | 23 | no page |
| | china visa application singapore | 5,400 | 29 | |
| | china visa singapore | 4,400 | 32 | |
| Korea | k eta | 3,600 | 30 | no page |
| Indonesia | indonesia visa on arrival | 3,600 | 30 | page, wrong focus |
| Japan | japan visa singapore | 2,900 | 49 | page |
| Visa to Singapore | singapore visa | 2,400 | 48 | not offered |
| Vietnam | vietnam e visa | 1,900 | 79 | page |
| India | e visa india | 1,600 | 30 | page |
| Australia | australia visa singapore | 1,600 | 28 | page |
| US | us visa application singapore | 1,000 | 43 | page |
| Thailand | thailand visa | 1,000 | 32 | page |
| UK | uk visa application singapore | 720 | 24 | page |
| Schengen | schengen visa singapore | 480 | 24 | no hub |

What this means:

- "Visa agency" and "visa services" have almost no searches. People search a country plus "visa" plus "Singapore". Titles lead with that.
- Arrival cards are the biggest single opening. They are free government forms that everyone travelling has to fill, so they bring huge volume at low difficulty. This is how Atlys gets its traffic.
- English searches dominate. Chinese volume in Singapore is small (日本 签证 390, 越南 签证 480, 美国 签证 320, 中国 签证 中心 新加坡 480). Chinese pages still matter for conversion and for the Phase 1 audience, but English is where traffic comes from.

## Phase A: technical fixes

One PR, no design change. This is what stops the site from ranking at all.

1. **Language routing.** Stop forcing `zh-CN` on visitors without a cookie. Send people whose browser prefers Chinese to `/zh-CN`, and show everyone else (including Googlebot) the English page at the URL they asked for. Keep the cookie for an explicit switch. Fix the `/blog` index exemption.
2. **Hreflang.** One `alternates` helper on every page: canonical, `en-SG`, `zh-Hans-SG`, `x-default` (English).
3. **Metadata on every page.** `generateMetadata` for destination pages (resolve the country on the server, unique title and description per language), and wire the existing `pages.*` copy into apply, contact, careers, security, status, product, events and legal. Server wrappers for the three client pages.
4. **Sitemap.** Build destinations from `lib/countries.ts`, not the empty catalogue API. Final URLs only, both languages, real `lastModified`. Drop `/about` until it exists, `/status` and `/zh-CN/blog` until it has posts.
5. **Index control.** noindex `/status`, `/events`, `/apply`. Real 404 for unknown `/visa/<slug>`. Locale-prefixed internal links on Chinese pages.
6. **Link previews.** A 1200x630 JPEG per page, generated from the content (satori, as on Nanan Auto and LUCA), plus `summary_large_image` Twitter cards.
7. **Schema.** Organization with the Pasir Panjang address and `sameAs`; TravelAgency; Service with an Offer at price 0 for the VIZA fee; FAQPage that matches the visible FAQ; BreadcrumbList pointing to `/visa`. Remove the made-up review counts and the static "5 days ago".
8. **Blog fixes.** Titles of 60 characters or less, descriptions about 155, no doubled brand, links from each post to its destination page.
9. **Build checks.** `check-copy` (dashes, "guaranteed", "official", title and description lengths, duplicates) and a `verify` script that fetches every sitemap URL as Googlebot and WhatsApp.
10. **Search Console.** Verify the domain, submit the sitemap, start Semrush Position Tracking on the target list below.

## Phase B: destination pages

Every destination gets the same template, in English and Chinese, written natively. Based on the best competitor pages (iVisa order and schema, VisaHQ depth, HolidaySG fee block, Atlys review note).

**Audience fix.** Each page answers "I live in Singapore, I hold passport X, what do I need?" A passport table covers Singapore, China, Malaysia, India, Indonesia, Philippines, Vietnam, with residence notes for EP, S Pass, Dependant Pass and PR holders. This is the gap nobody fills.

**Sections in order**
1. At a glance: do you need a visa, government fee, VIZA fee (free), processing time, maximum stay, date checked
2. Do you need a visa? Passport table
3. Visa types
4. Requirements for residents of Singapore by pass type
5. Fees and processing time
6. How to apply with VIZA: Guided or Full-service
7. Document checklist by applicant type
8. Common rejection reasons
9. Before you travel: arrival card, insurance, entry rules
10. Reviewed by a VIZA consultant, with date
11. FAQ, 10 to 15 questions, from real "do I need" and "how to apply" searches
12. Related destinations (real neighbours) and guides
13. Start application

Length 1,800 to 2,500 words per language.

**Title pattern:** `{Country} Visa from Singapore: Fees and How to Apply | VIZA` (60 characters or less). Chinese: `新加坡办理{国家}签证：材料、费用与流程 | VIZA`. H1: `{Country} visa from Singapore` / `新加坡办理{国家}签证`.

**Targets per page** (primary, then secondaries; Singapore volumes)

| Page | Primary | Secondaries | Status |
|---|---|---|---|
| `/visa/china` | apply china visa in singapore 6,600 | china visa application singapore 5,400, china visa singapore 4,400, chinese visa application service center 9,900, singapore to china visa free 480, 中国 签证 中心 新加坡 480 | new |
| `/visa/south-korea` | k eta 3,600 | 韩国 签证 320 | new |
| `/visa/indonesia` | indonesia visa on arrival 3,600 | e-VOA, 印尼 签证 260 | refocus |
| `/visa/japan` | japan visa singapore 2,900 | japan visa application 1,300, japan visa application singapore 720, how to apply japan visa in singapore 170, 日本 签证 390 | rewrite |
| `/visa/vietnam` | vietnam e visa 1,900 | 越南 签证 480 | rewrite (KD 79, slow) |
| `/visa/india` | e visa india 1,600 | indian visa application 1,300, 印度 签证 | rewrite |
| `/visa/australia` | australia visa singapore 1,600 | australia visa application 1,300, tourist visa australia 720, australia visa eta 2,400, 澳洲 签证 260 | rewrite |
| `/visa/united-states` | us visa application singapore 1,000 | us visa singapore 720, us visa appointment singapore 260, 美国 签证 320 | rewrite |
| `/visa/thailand` | thailand visa 1,000 | thailand visa singapore 390, thailand e visa 320, do singaporeans need visa to thailand 260 | rewrite |
| `/visa/united-kingdom` | uk visa application singapore 720 | uk visa singapore 590 (KD 18) | rewrite |
| `/visa/malaysia` | malaysia visa application 1,300 | links to the MDAC guide | rewrite |
| `/visa/schengen` | schengen visa singapore 480 | schengen visa application singapore 210, how to apply schengen visa in singapore 110, 申根 签证 170 | new hub |
| `/visa/france` | france visa singapore 480 | links to the Schengen hub | rewrite |
| `/visa/italy` | italy visa singapore 390 | | rewrite |
| `/visa/saudi-arabia` | saudi arabia visa 390 | saudi visa 320 | rewrite |
| `/visa/canada` | canada visa singapore 320 | canada tourist visa singapore 320 | rewrite |
| `/visa/turkey`, `/visa/uae`, `/visa/egypt` | country + visa | e-visa terms | rewrite |

Order of work: China, Japan, Australia, UK, US, Indonesia, India, Thailand, Schengen hub, Korea, then the rest.

## Phase C: arrival card guides

A hub at `/arrival-cards` with one guide each: Malaysia MDAC (22,200), Singapore SG Arrival Card (18,100), Japan Visit Japan Web (9,900), Thailand TDAC (6,600), Indonesia All Indonesia. Each says what it is, who must fill it, when, a step-by-step walk-through with screenshots, common mistakes, and links to the matching visa page. The existing SG arrival card post (position 45) folds into its guide with a 301.

If VIZA's TDAC and SGAC automation (in the repo) can fill these for users, each guide gets a "VIZA fills it for you, free" option. That turns the biggest traffic source into sign-ups.

## Phase D: guides and news

- Split `/blog` into `/guides` (evergreen: Schengen document list, US interview preparation, UK and Australia ETA vs visa, rejection and re-application) and `/news` (today's update posts), with 301s from the old URLs.
- Chinese versions of the guides, written natively. Today all 13 posts are English only.
- Every news post links to its destination page, and every destination page lists its latest news.

## Decisions for Edward

1. **Language default.** English searches dominate, so English should be the default page for Google and for non-Chinese browsers, while Chinese browsers still land in Chinese. This replaces the forced-Chinese rule from July.
2. **China visa page.** It's the biggest visa term in Singapore (people of other nationalities applying from Singapore). Does VIZA take China visa applications?
3. **Arrival card help.** Can VIZA offer free arrival card filling (TDAC and SGAC automation exist)? If not, the guides are still worth building for traffic.
4. **Visas to Singapore.** "singapore visa" is 2,400 a month (mostly Indian and Chinese visitors). Does VIZA want to serve people coming to Singapore?
5. **Domain.** viza.it.com or a move to viza.sg before this work. Moving later loses the rankings we build.

## Then design

The Framer pages map onto the site like this; the rest are built from Framer sections.

| Framer page | Site page |
|---|---|
| Home | `/` |
| About | `/about` (new, also fixes the 404 in the sitemap) |
| Contact | `/contact` |
| Blogs and blog post | `/guides`, `/news` and their posts |
| Works and visa type detail (tourist, business, student, work permit, long-term stay, digital nomad) | visa type pages, and the base layout for destination pages |
| Legal | `/legal/terms`, `/legal/privacy` |

Built from Framer sections: the destination gallery (`/visa`), destination pages, arrival card guides, apply, careers, security.

## Limits of this research

- Semrush volumes are Semrush estimates for db=sg. Google Keyword Planner was not available (Ryze plan ended).
- Competitor SERPs came from Firecrawl's index, so ranking order is indicative.
- Chinese data in db=sg is thin. Chinese pages are judged on conversion more than volume.
