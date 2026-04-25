# VIZA — Client Dashboard UI kit

Single-file recreation of `/client/home` from the VIZA internal website.

## What's inside

- **Login splash** (click-thru) — email + password + magic-link note. Click Sign in to enter the dashboard.
- **Fixed navbar** — Home / Application / VIZA logo / Chat / Documents. Animated pill indicator under the active tab. Text + logo color cross-fades from white (on navy hero) to black (after scrolling past the hero) over 0.6s.
- **Navy gradient hero** — `#03346E → #3D6DAD` with hard-light overlay. Greeting + three glass panels.
- **Glass panels** (`backdrop-filter: blur(12px)` + 12% white + 20% white border):
  1. Application — country flag + package name + "Not started" pill.
  2. Documents — `0 / 6` counter + progress bar.
  3. Quick actions — three tap rows.
- **Stage timeline** — Application (active, navy pill) → Documents → Submit → Review → Decision, each with its 80px emoji tile, title, subtitle, and pill badge. Locked rows gray out.
- **Recent activity** — list inside a single card; status icons use success / neutral / warning color-pairs.

## Source

Reconstructed from these files in `EdwardZehuaZhang/VIZA-monorepo@main`:

- `viza-fe/internal-website/app/client/home/page.tsx` — dashboard composition, hero, timeline, activity.
- `viza-fe/internal-website/app/client/layout.tsx` — shell, fixed nav, scroll-driven nav color.
- `viza-fe/internal-website/components/client/navbar.tsx` — animated pill indicator.
- `viza-fe/internal-website/components/client/brand-action-button.tsx` + `brand-field.tsx` — form-control sizing.
- `tailwind.config.ts` + `app/globals.css` — tokens.

## What this kit deliberately omits

- **Supabase data fetching** — the real page hits `applicant_profiles`, `applications`, `application_documents`. Here we show the empty-state variant (no active application) as the canonical demo, since that's what most first-time users see.
- **next-intl i18n** — all strings are baked in English. In production every string goes through `useTranslations()`.
- **Phosphor icons + Lucide import** — we inline a small set of SVG icons (check, clock, alert) so the file stays standalone. In production, use `lucide-react` directly.
- **Motion entry animations** — the real page staggers each panel with `motion/react`. The kit ships a static composition so screenshots are deterministic.
- **`/figma-assets/hero-background.png`** — the real hero has a bottom-anchored PNG. The kit uses a CSS radial gradient that reads the same way in screenshots.

## How to extend it

The page is one HTML file with inline CSS + JS — intentional. If you want to build more screens (Application, Chat, Documents, Settings), create siblings in `ui_kits/client-dashboard/` named `application.html`, `chat.html`, etc., and link them from the nav tabs. Copy the `<style>` block out to a shared `kit.css` at that point.

All tokens come from `../../colors_and_type.css`. Never paste raw hex; extend `colors_and_type.css` if a new token is needed.
