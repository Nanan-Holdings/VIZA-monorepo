# VIZA — Design System

**VIZA** is an AI-powered visa agency based in Singapore. They handle non-immigration visas (tourist, business, work, student, long-term, digital nomad) for individuals (B2C) and companies (B2B). Their product is a mix of:

1. **Marketing site** (Framer, standalone, primarily zh-CN) — landing + /solutions/* + /pricing + /blog + /contact.
2. **Client portal** (`/client/*` in the Next.js monorepo) — where paying applicants complete their visa applications alongside a human consultant and AI-driven document review.
3. **Admin / staff tools** (`/admin-v2`, `/staff`) — out of scope for this design system; those pages have their own visual language.

**Primary audience:** Chinese nationals (individuals + HR/operations staff at companies) who need help navigating overseas visa applications.

**Tagline (zh):** 专业签证服务，AI 驱动，人工把关

---

## Sources used

- `uploads/VIZA_Logo.svg` — icon-only mark provided by user
- `uploads/VIZA_Logo_Text.svg` — wordmark provided by user
- GitHub: [`EdwardZehuaZhang/VIZA-monorepo`](https://github.com/EdwardZehuaZhang/VIZA-monorepo) — the `/viza-fe/internal-website` Next.js app. Key references:
  - `viza-fe/internal-website/frontend.md` — the client-portal frontend guide (single source of truth for this system)
  - `viza-fe/internal-website/tailwind.config.ts` — brand color scale
  - `viza-fe/internal-website/app/globals.css` — shadcn tokens and `.client-shell` rules
  - `viza-fe/internal-website/app/client/home/page.tsx` — dashboard hero + glass panels + stage timeline
  - `viza-fe/internal-website/app/client/layout.tsx` — shell, nav, session handling
  - `viza-fe/internal-website/components/client/brand-action-button.tsx` — canonical flow CTA
  - `viza-fe/internal-website/components/client/brand-field.tsx` — canonical form field
  - `viza-fe/internal-website/components/client/navbar.tsx` — animated pill navbar
- GitHub: `docs/marketing-site-prd.md` — IA, copy samples, tone, stat slots for the Framer marketing site

---

## Index

- `colors_and_type.css` — CSS vars for color, type, radius, spacing; base element styles (`h1`–`h6`, body, focus rings).
- `assets/` — Logos (black, white, blue, mark-only) as SVG.
- `fonts/` — Switzer woff2 files (variable + static weights).
- `preview/` — Design-system preview cards (render in the Design System tab).
- `ui_kits/client-dashboard/` — High-fidelity recreation of the `/client/home` dashboard with working click-thru.
- `SKILL.md` — Agent-Skills-compatible entry point for using this system elsewhere.

---

## Content fundamentals

**Voice: professional, efficient, trustworthy — but human, not bureaucratic.** The PRD explicitly calls this out: "专业、高效、值得信赖 … Not cold or bureaucratic — clear, direct, human. Does not talk down to the user; explains complexity without jargon."

### Two speakers, two registers

- **zh-CN** (Phase 1, primary): direct, declarative, practical. No corporate-speak, no exclamation marks, no "!"-driven energy.
- **en-US** (Phase 2, in-product): the same tone in English. Warm and direct. `next-intl` is wired up — every string runs through `useTranslations()`.

### Person

- Speaks **to "you" / "您"** when addressing the applicant (second person).
- Speaks as **"we" / "VIZA" / "我们"** when describing what the company does.
- Never "I". Never fake-first-person AI voice.

### Casing

- English: **Sentence case** for everything — headings, buttons, section titles, labels. "Start my application", never "Start My Application".
- No ALL CAPS in UI. ALL CAPS is reserved for tiny 11px labels (`letter-spacing: 0.06em`) above sections.

### What NOT to do

- ❌ No emoji as structural icons (nav, buttons, status). Emoji as **content** is fine (country flags on the home dashboard 🇮🇩🇯🇵 — those are data, not chrome).
- ❌ No exclamation marks. No marketing hype words ("Amazing!", "Effortless!"). The product is serious.
- ❌ No disclaimers-as-warning-boxes. Government-fee notes are a **single italicized footnote**, never a red/yellow callout.
- ❌ No jargon ("utilize", "leverage"). Use plain verbs ("use", "send", "upload").

### Sample copy (from repo + PRD)

| Context | Copy |
|---|---|
| Hero H1 | 签证申请，全程交给 VIZA · *"Your visa application, handled by VIZA"* |
| Hero sub | 无论旅游、商务、工作还是留学，VIZA 专业签证顾问 + AI 智能系统 |
| Primary CTA | 立即开始申请 · *"Start my application"* |
| Stage (empty) | Not started / 未开始 |
| Stage (active) | Start → / 开始 → |
| Activity | "Application created" + "Indonesia · B211A Business" |
| Footnote | 政府官方签证费另计，具体金额因国家而异 |
| Error (form) | Please enter a valid date. (direct — no "Oops!", no emoji) |

---

## Visual foundations

### Palette

- **Primary navy** `#03346E` / `brand-500`. This is THE brand color — used for CTAs, active states, links, hero backgrounds, and the shadcn `--primary` + `--ring` token. Every other color is either a tint of this navy (scale 50→900) or a neutral.
- **Brand scale** (Tailwind `brand-*`): 50 `#EEF3FA` → 100 `#D4E0F0` → 200 `#AABFDF` → 300 `#7A9DCE` → 400 `#3D6DAD` → **500 `#03346E`** → 600 `#022B5C` → 700 `#01214A` → 800 `#011737` → 900 `#000D21`.
- **Surfaces:** `#FFFFFF` for cards; `#FAFAFA` for the client-shell page background; `#FCFCFC` for the dashboard body. Hover surface is `#FBFBFB`.
- **Borders:** `#EFEFEF` hairline (cards), `#E8E8E8` input borders.
- **Text:** primary `#3D3D3D`; secondary `rgba(0,0,0,0.45)`; disabled / locked `#989898`.
- **Semantic:** success `#16A34A`, warning `#FEF3C7/#D97706`, destructive `hsl(0 84% 60%)` (≈ `#EF4444`).

**Rule:** never paste raw hex into components; always go through the token. The only hardcoded hex allowed is `#FAFAFA` for shell parity (documented in `frontend.md`).

### Typography

- **Switzer** — headings only (H1–H6), applied automatically to heading tags via `globals.css`. Variable + static weights shipped locally in `fonts/`.
- **Geist Sans** — body, UI, form controls (default everywhere else).
- **Chinese stack:** PingFang SC / Noto Sans SC via system fallback.
- Body base is **16px**. Never go below 14px for body; labels can use 12px. Body text ≥16px on mobile to prevent iOS auto-zoom on input focus.
- `.client-shell` applies `letter-spacing: -0.011em` globally — let it cascade. Headings get `-0.6px` to `-0.96px` tracking.

### Spacing

- Tailwind **4pt scale** (`p-1 … p-12`). Cards default to `p-6` (24px).
- Vertical section rhythm: `space-y-6` / `space-y-8` (24 / 32px).
- Page horizontal insets live on the `.client-shell` — pages don't add their own outer `px-*`.

### Radius

All derived from shadcn's `--radius: 0.25rem` (4px), plus a larger step for cards:
- `sm` = 2px (chips)
- `md` = 4px (inputs, small buttons — shadcn default)
- `lg` = 4px (shadcn default)
- `xl` = **12px** (cards — this is the dominant radius in the client portal)
- `16px` — stage cards on the home dashboard
- `rounded-full` — pill badges, avatars, **and the 48px-tall flow CTA** (BrandActionButton uses `rounded-full`).

### Backgrounds

- **Plain** `#FAFAFA` shell, no pattern.
- **Navy gradient hero** on `/client/home` and `/client/invite-friends`: `linear-gradient(180deg, #03346E 0%, #3D6DAD 100%)` + `rgba(0,0,0,0.05)` hard-light overlay + a radial soft-light accent near the bottom. Two overlay passes give the navy its depth — the plain color looks flat without them.
- **No hand-drawn illustrations, no gradients on cards, no repeating patterns.** The portal is quiet.

### Glass / elevation

- **Glass panels** (only on the navy hero): `rgba(255,255,255,0.12)` + `backdrop-blur-md (12px)` + 1px `rgba(255,255,255,0.2)` border. This is the *only* place blur is used — do not sprinkle it elsewhere.
- **Card elevation** is subtle: `shadow-sm` by default, `hover:shadow-md` only when the card is itself clickable. Never stack more than one elevation level in the same view.
- Popovers and dialogs inherit shadcn defaults — don't override.

### Borders

1px solid `#EFEFEF` is the workhorse — cards, activity list, stage rows. Inputs use a slightly darker `#E8E8E8` to read as an interactive target.

### Hover / press states

- **Primary CTA** (`#03346E`) → hover `#022B5C` (one step darker in the brand scale).
- **Secondary / outline** → hover `rgba(3,52,110,0.05)` tint-fill.
- **Ghost / link** → hover `#EEF3FA` background + primary text.
- **Card (clickable)** → hover `#FBFBFB` background.
- **Press:** no shrink, no scale transform. Color-only depression (the next-darker brand step).
- **Focus:** shadcn's `focus-visible:ring-1 ring-ring` — 1px brand-500 ring. **Never remove it** to "clean up."

### Motion

- Library: **`motion/react`** (ex-Framer Motion).
- Durations: 150–300ms for UI feedback, 400–600ms for page/nav entrances. Never >600ms.
- Only animate `transform` and `opacity`. Never animate `width`/`height`/`top`/`left`.
- Entry: `{opacity: 0, y: 16–20} → {opacity: 1, y: 0}` with 0.4–0.5s duration and a small stagger via `delay: 0.1` steps.
- Nav pill indicator: 350ms `cubic-bezier(.4,0,.2,1)`.
- Nav color transitions: **0.6s ease-in-out** (see `globals.css`). Match that for anything nav-adjacent.
- Respect `prefers-reduced-motion` via Motion's `useReducedMotion()`.

### Layout rules

- Shell: fixed navbar at the top (`pt-32 xl:pt-32` reserved below). Page content is centered in a `max-w-[1090px]` column on desktop, full-width below.
- Responsive breakpoints: Tailwind defaults (`sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`). Design **mobile-first** — primary device is a phone (WeChat ecosystem).
- No horizontal scroll on mobile.
- Never `scrollIntoView()`.

### Iconography

See the **Iconography** section below.

---

## Iconography

VIZA uses **two icon libraries** in the repo:

1. **`lucide-react`** — the primary UI icon library. Used in almost every client-portal component. Default size `h-4 w-4` (16px, matches the shadcn Button's `[&_svg]:size-4`), `h-5 w-5` (20px) for section headers, `h-12 w-12` only for loading (`Loader2`) and empty-state illustrations.
2. **`@phosphor-icons/react`** — present in `package.json` but used sparingly; treat it as a secondary option for when Lucide lacks a glyph.

**Stroke width:** leave Lucide's default `stroke-width="2"`. Don't mix stroke widths in one view.

**Color:** icons inherit `color` / `stroke` from their text context. Standalone icon-only buttons use `text-muted-foreground` with a hover to `text-foreground`. Status icons pair with the semantic color (`text-brand-500` for primary, `text-amber-600` for warn, `text-red-500` for destructive).

**Emoji:** explicitly **not** used as structural icons (nav, buttons, status). Emoji **is** used as data — country flags on the home dashboard (`🇮🇩🇯🇵🇬🇧`) and stage-card glyphs (`📋 📁 ✈️ 🔍 ✅`). Those are content, not chrome. If you introduce a new stage or status glyph, use Lucide — not a new emoji.

**In this system:** the preview cards reference Lucide inline as SVG strings (matches Lucide 0.553). For production work in the Next.js app, use `lucide-react` directly — don't import our inlined SVGs.

**Available assets in `assets/`:**
- `viza-logo-black.svg` — wordmark, black on light
- `viza-logo-white.svg` — wordmark, white on dark
- `viza-logo-blue.svg` — wordmark, navy tint
- `viza-mark.svg` / `viza-mark-white.svg` — icon-only mark (the "passport / page" glyph)
- `viza-wordmark.svg` / `viza-wordmark-white.svg` — text-only lockups

**Logo usage:**
- On white / off-white shell → `viza-logo-black.svg` (or `-blue` when a brand tint is wanted)
- On navy hero → `viza-logo-white.svg`
- Favicon / compact nav at very small sizes → `viza-mark.svg`

---

## UI kits

- **`ui_kits/client-dashboard/`** — the `/client/home` dashboard, single-file HTML. Demonstrates the navy gradient hero, three glass panels (Application / Documents / Quick actions), stage timeline (Application → Documents → Submit → Review → Decision), and Recent activity list. Includes a login splash and interactive tab pill in the nav.

---

## Known caveats

- `/figma-assets/hero-background.png` is referenced by the real dashboard but isn't in the repo tree. The UI kit ships a CSS-only radial-gradient stand-in — visually close but not identical.
- Phosphor icons, Motion entry variants, and recharts-driven charts aren't exercised in the kit yet (only the home dashboard is recreated).
