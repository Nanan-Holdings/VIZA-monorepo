# Design system analysis

VIZA's look, layout and motion come from the Framer site Edward picked (effective-set-984023.framer.app),
rebuilt in plain React and CSS the same way as Nanan Auto (`nanan-auto/site/docs/design-system/`). The
scrape behind every number is in `viza-reference/framer/viza/`: full-page shots, SSR HTML with the Framer CSS,
fonts, appear-animation JSON and computed styles of every home element in `dump/home-<width>.json`.

Part 1 covers the tokens, motion, section components, header, footer, `/`, `/about` and `/contact`. Every other
page already uses the new header and footer through `components/SiteNav.tsx` and `components/SiteFooter.tsx`,
which now wrap the design-system versions.

| | Framer | VIZA |
|---|---|---|
| Feel | Light grey canvas, white cards, black buttons, Switzer and Inter Display, 15 to 30px corners | Same canvas, cards, type and corners; VIZA navy for every accent |
| Home height at 1440 / 390 | 8,778 / 11,594 px | about 8,300 / 11,100 px |
| Content | Template filler (partner logos, invented stats and reviews, European offices) | Real VIZA content only |

## 1. Tokens

All tokens live in [`design-system/tokens.css`](../../design-system/tokens.css) as CSS variables and are mapped
into `tailwind.config.ts` (`bg-canvas`, `text-ink-muted`, `bg-accent`, `rounded-card`, `text-ds-h2`,
`px-gutter`, `ease-spring` and so on), so older Tailwind code can use them.

### Colour

| Role | Framer (measured) | VIZA token |
|---|---|---|
| Page canvas | `rgb(247,247,247)` | `--ds-canvas #f7f7f7` (also the body background) |
| Cards, inputs on canvas | `#fff` | `--ds-surface #fff` |
| Inputs inside cards, pills | `rgb(245,245,245)` | `--ds-surface-muted #f5f5f5` |
| Headings and text | `#000`, `rgb(10,10,10)` | `--ds-ink #000`, `--ds-ink-soft #0a0a0a` |
| Body and labels | `#707070` | `--ds-ink-muted #707070` |
| Dots, faint marks | `#b4b4b4` | `--ds-ink-faint #b4b4b4` |
| Hairlines | `#ababab` at 50% | `--ds-line`, `--ds-line-strong #ababab` |
| Accent (primary buttons, open toggles, pager) | `#000` | `--ds-accent #03346e` (VIZA navy), hover `#022b5c` |
| Ticks | `#00b906` | `--ds-positive #00b906` |
| Stars | `#f98b31` | `--ds-star` (kept, unused: no reviews) |
| Photo shade | `rgba(0,0,0,.25)` | `--ds-overlay` |
| Glass button | `rgba(255,255,255,.2)` with blur 8px | `--ds-glass` |

### Type

Fonts: **Switzer** for headings (already self-hosted; the Fontshare licence allows web use) and **Inter
Display** for body, the Framer face (OFL 1.1; the latin and latin-ext subsets for 400 and 500 are in
`public/fonts/inter-display/`, declared in `design-system/fonts.css`). Chinese falls through to PingFang SC,
Hiragino Sans GB, Noto Sans SC, Microsoft YaHei.

| Role | Framer 1440 / 1000 / 390 | Token |
|---|---|---|
| Contact and about title | fit text, about 160px | `--ds-fs-display` 160 / 112 / 64, lh 1, -0.05em, `.ds-display` |
| Hero H1, CTA title | Switzer 500, 64 / 48 / 36, lh 1.12, -0.04em | `--ds-fs-hero`, `.ds-hero-title` |
| Section title | Switzer 500, 60 / 44 / 28, lh 1.12, -0.04em | `--ds-fs-h2` 60 / 44 / 30, `.ds-h2` |
| Statement, FAQ title, form title | Switzer 500, 40 / 32 / 26 | `--ds-fs-statement`, `.ds-statement` |
| Stat figure | Switzer 500, 68 / 48 / 44, lh 1, -0.06em | `--ds-fs-stat`, `.ds-stat` |
| Card title | Switzer 500, 26 / 20 / 17, lh 1.25, -0.04em | `--ds-fs-title` 26 / 20 / 18, `.ds-title` |
| FAQ question | Switzer 500, 20 / 20 / 18 | `--ds-fs-subtitle`, `.ds-subtitle` |
| Body | Inter Display 400, 18 / 16 / 15, lh 1.32, -0.02em, `#707070` | `--ds-fs-body`, `.ds-body` |
| Small, meta | Inter Display 16 / 15 / 14 | `--ds-fs-small`, `.ds-small` |
| Caption | Inter Display 14 | `--ds-fs-caption`, `.ds-caption` |
| Button | Inter Display 500, 18 / 16 / 15, -0.03em | `--ds-fs-button` |
| Nav link | Switzer 400, 18, -0.04em | `--ds-fs-nav` |
| Eyebrow dot label | Inter Display 20, grey, beside every title | **Not used** (house rule: no eyebrows; the title is the label) |

### Spacing and layout

| | Framer 1440 / 1000 / 390 | Token |
|---|---|---|
| Content width | 1296 | `--ds-max 1296px` |
| Page gutter | 72 / 50 / 20 | `--ds-gutter` |
| Section padding | 80 / 60 / 48 top and bottom | `--ds-section-y` |
| Head to content | 60 / 48 / 32 | `--ds-head-gap` |
| Grid | three equal columns, 20px gap (columns start at 72, 511, 949) | `.ds-head`, `.ds-footer-grid`, `.ds-statement-row` |
| Card gaps | 12 to 16 | `--ds-grid-gap 16px` (12 on phones) |
| Hero frame inset | 14 / 10 / 4 | `--ds-frame-inset` |
| Hero frame | 702 / 702 / 657 tall; copy 188 / 144 / 88 from the top | `.ds-hero-frame` |
| Nav height | 84 / 84 / 68 | `--ds-nav-h` 84 / 80 / 68 |
| Buttons | 48 tall, 14px 28px, pill, label plus 16px chevron, gap 8 | `.ds-btn` |
| Round toggles | 40px circles | `.ds-icon-btn` |
| Inputs | 57 tall, 19px 20px, 10px corners, `#f5f5f5` | `.ds-input` |

Breakpoints are Framer's: desktop from 1200, tablet 810 to 1199.98, phone up to 809.98. One change: the header
folds into the menu below 1200 (Framer folds below 810), because six links, the language menu and sign in do
not fit the tablet width.

### Radii

| | Framer | Token |
|---|---|---|
| Hero frame | 16 | `--ds-r-frame` |
| Closing CTA band | 30 | `--ds-r-band` |
| Tall side card | 25 | `--ds-r-panel` |
| Feature, FAQ, post, stat cards | 20 | `--ds-r-card` |
| Media cards | 15 | `--ds-r-card-sm` |
| Photos in cards | 16 | `--ds-r-media` |
| Hero floating card | 14 | `--ds-r-tile` |
| Inputs | 10 | `--ds-r-input` |
| Pager chips | 6 | `--ds-r-chip` |
| Buttons, chips, filters | 50 to 60 | `--ds-r-pill` |

### Motion

From `appear/home.json`, `about.json`, `contact.json` and the page CSS, in
[`design-system/motion.css`](../../design-system/motion.css) and `design-system/motion/`:

| Effect | Framer | VIZA |
|---|---|---|
| Section and card appear | opacity 0 to 1, y 24 to 0, spring stiffness 200 damping 44, once | `[data-reveal]`, 0.9s `cubic-bezier(0.22,1,0.36,1)`, one IntersectionObserver (`Reveal.tsx`), cards stagger 0.05s (`stagger()`) |
| Hero copy | y 32 to 0, delays 0.1 to 0.7s | `data-reveal="hero"` with `delay(0.1)` to `delay(0.5)` |
| Hero video | scale 1.1 to 1, damping 64 | `.ds-hero-photo img` keyframes, 1.4s |
| Header | y -32 to 0 after 0.3s; hides on scroll down, returns white on scroll up | `.ds-header-row` keyframes; `SiteHeader` toggles `is-hidden` and `is-scrolled` |
| Nav link hover | text rolls up to a second copy (line01, line02) | `.ds-roll` |
| Button hover | colour 0.3s, ease (0.44,0,0.56,1) | same, chevron nudges 3px |
| Card hover | image zoom | photos scale 1.04 over 0.6s |
| Accordions | open and close | steps and FAQ toggles swap icon and colour |

Reveals only hide content when scripts run (`html.ds-js`, set before paint by `MotionScript.tsx`), and
`prefers-reduced-motion` turns every effect off.

## 2. Section catalogue

Components are in [`design-system/sections/`](../../design-system/sections/), primitives in `design-system/ui/`
(`Button`, `Logo`, `Photo`, `Icons`). Copy comes in through props or `next-intl`; chrome strings are in the `ds`
messages namespace, page copy in `homePage`, `aboutPage` and `contactPage`.

| Framer section | VIZA component | Used on | Notes for the next pages |
|---|---|---|---|
| Navbar | `SiteHeader` (`active` tab) | every page | `components/SiteNav.tsx` maps the old `activeTab` names |
| Footer | `SiteFooter` | every page | three columns, hairline, copyright, registered office, legal links |
| Section head (dot label, 60px title, text, button) | `SectionHead` (`title`, `lede`, `action`, `size`) | home, about | no dot label; the plain title is the label |
| Home hero (video frame, H1, two buttons, Recent Works card) | `PhotoHero` + `HeroPicks` | `/` | the floating card pages through three real destinations |
| Logo marquee | not used | | template filler |
| Results (statement, testimonial, stat cards) | `Statement` + `FactTiles` | `/about` | stat cards only show counts from the site's own registries |
| Visa types carousel | `MediaCarousel` | `/` | white media card with window dots and arrows |
| Works cards | `DestinationGallery` (`DestinationCard`) | `/` | keeps passport selector, search, filters, sort, grid and map |
| Process (side card and numbered accordion) | `StepsAccordion`, wrapped by `components/HowItWorks.tsx` | `/`, `/about` | open row shows photo, text and chips |
| Plan comparison table | `CompareTable` | `/`, `/about` | Guided against Full-service, real table markup |
| Why us (icon cards, photo cards) | `FeatureCards` | `/` | template line illustrations replaced by large line icons |
| Clients and testimonials | not used | | invented reviews are not allowed |
| Blog strip | `PostCards` | `/` (guides) | photo is the first covered destination's photo |
| FAQ (title, contact card, question cards) | `FaqSection` with `ContactCard` | `/`, `/contact` | `schema` prop emits FAQPage JSON-LD (home only) |
| "Got a project" office columns | `ContactLines` | `/contact` | VIZA's real channels |
| Closing CTA (photo band, contact card, rising form card) | `CtaBand` with `ContactForm` | `/`, `/about` | form posts to `/api/contact` |
| Contact hero (fit-text title, email) | `DisplayHero` | `/contact`, `/about` | about puts the navy logo inside the H1, with "About VIZA" as hidden text |
| Company info tiles | `InfoTiles` | `/about` | registered office, email, phone, languages |
| Team carousel | not used | | no real team photos |
| Contact form | `ContactForm` (`short`, `full`) | home, about, contact | keeps the honeypot, success and error states and the `lead_submit` event |

Layout classes for new pages: `.ds-main` around the page, `.ds-section` per block, `.ds-container` inside,
`.ds-stack` for a head plus content, `.ds-section--ruled` for a hairline above.

## 3. Content rules applied

- Titles are plain labels: Destinations, Visa types, How it works, Pricing, Why VIZA, Guides, FAQ, Contact.
- Removed template filler: partner logos, "Used by 60+ developers", 50+ countries, 98% approval, 500+ clients,
  the testimonials, the European offices, residio.inc emails, "Recent Works". The old contact page's unsupported
  claims (live consultant counts, reply times, certifications, decorative QR codes) went with it.
- The gallery's "Guaranteed by VIZA" line and "Guaranteed delivery" sort are gone; the sort now works
  (Featured, Open now first, A to Z).
- Not carried over from the old contact page and footer: the Shanghai address and the +66 number, which need
  checking before they come back.

## 4. Images

Photos are VIZA's destination photography in `public/assets/heroes/`, served through `next/image`
(`ui/Photo.tsx`). Hero: Canada; CTA band: United Arab Emirates; about: Japan and South Korea. Visa types,
steps and feature cards use other destinations so the first screen of the gallery does not repeat. No Framer
template images are used.

## 5. Screens

`screens/` holds 1440 and 390 shots of `/`, `/about`, `/contact` and `/zh-CN/`, plus `compare-<page>-<width>.jpg`
(Framer left, VIZA right). Re-take them with `node scripts/screens.mjs http://localhost:3217` against
`NEXT_PUBLIC_SITE_URL=https://viza.it.com npx next start -p 3217` (add `--tablet` for 1000, `--only /a,/b` for
other pages). The script reports any horizontal overflow.
