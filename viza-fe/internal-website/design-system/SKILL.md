---
name: viza-design
description: Use this skill to generate well-branded interfaces and assets for VIZA (AI-powered visa agency, Singapore), either for production or throwaway prototypes/mocks. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

Key files:
- `README.md` — full design system rationale (palette, type, spacing, motion, iconography, tone of voice).
- `colors_and_type.css` — CSS variables and base element styles. Drop-in for any HTML artifact.
- `assets/` — VIZA logos (black, white, blue, mark-only) as SVG.
- `fonts/` — Switzer woff2 files (the heading family). Body uses Geist Sans; fall back to system UI if Geist isn't installed.
- `preview/` — small specimen cards for every token group (colors, type, spacing, components, brand).
- `ui_kits/client-dashboard/` — reference recreation of the `/client/home` dashboard. Copy patterns from here.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Link `colors_and_type.css` at the top of each file — all tokens come through as CSS variables (`--brand-500`, `--font-heading`, etc).

If working on production code, read `README.md` and the original monorepo's `viza-fe/internal-website/frontend.md` to become an expert in designing with this brand. Do not hardcode hex values — always go through tokens. Do not invent new patterns when `BrandActionButton`, `BrandField`, or the existing shadcn primitives already cover the need.

**Canonical components — never regenerate from this skill's specimens.** The repo ships richer versions:

- `CountryDropdown` (`components/ui/country-dropdown.tsx`) — locale-aware names + real flag rendering + cmdk search.
- `DatePicker` (`components/ui/date-picker.tsx`) — zhCN/enUS locale, `YYYY-MM-DD` contract.
- `FileUploadCard` (`components/application-steps/file-upload-card.tsx`) — wired to Supabase Storage.
- `LanguageSelector` (`components/client/language-selector.tsx`) — theme-aware globe.
- `AnimatedDropdown` (`components/ui/animated-dropdown.tsx`) — popover + search + staggered list for any new searchable dropdown.
- `AnimatedTabPill` (`components/ui/animated-tab-pill.tsx`) — `text` and `pill` variants for any tab strip.

The `preview/` HTML specimens for `dropdown`, `tooltip-popover`, `select`, `date-picker`, and `file-upload` are visual references only — production already exists and is better.

If the user invokes this skill without any other guidance, ask them what they want to build or design (marketing page? client-portal screen? slide deck? admin view?), ask a few questions about scope and audience, and act as an expert designer who outputs HTML artifacts *or* production code, depending on the need.
