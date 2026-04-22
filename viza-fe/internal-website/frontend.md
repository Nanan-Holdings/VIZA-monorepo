# VIZA `/client` Portal — Frontend Design Guide

**Scope:** This guide governs any UI work in `/client/*` (routes under `app/client/` and components under `components/client/`). Admin (`/admin-v2`, `/staff`) pages have their own visual language and are out of scope.

**Read this before:**
- Creating new client pages or components
- Refactoring client UI
- Adding shadcn components
- Reviewing client UI changes

When in doubt, **read neighbouring client components first** — consistency with what already ships beats theoretical best practice.

---

## 1. Design tokens (source of truth)

All tokens live in `tailwind.config.ts` and `app/globals.css`. Never hardcode values that already exist as tokens.

### 1.1 Brand color scale

Defined in `tailwind.config.ts` under `theme.extend.colors.brand`:

| Token | Hex | Typical use |
|---|---|---|
| `brand-50` | `#EEF3FA` | Subtle backgrounds, hover fills |
| `brand-100` | `#D4E0F0` | Card accents |
| `brand-200` | `#AABFDF` | Disabled-primary, borders |
| `brand-300` | `#7A9DCE` | Secondary text on dark, dividers |
| `brand-400` | `#3D6DAD` | Hover of primary CTAs |
| `brand-500` | `#03346E` | **Primary** — CTAs, active states, links |
| `brand-600–900` | (darker) | Pressed states, high-contrast text |

Primary = `brand-500 = #03346E`. This is also the shadcn `--primary` and `--ring` in HSL (`213 95% 22%`).

**Always** reference brand with `bg-brand-500`, `text-brand-500`, `ring-brand-500` etc. Never paste raw `#03346E` into components.

### 1.2 shadcn semantic tokens

From `app/globals.css` `:root`:

```
--background        white
--foreground        near-black (20 14.3% 4.1%)
--primary           brand-500
--primary-foreground white
--secondary / --muted / --accent  warm off-white (60 4.8% 95.9%)
--destructive       red-500 equiv (0 84.2% 60.2%)
--border / --input  warm gray (20 5.9% 90%)
--ring              brand-500
--radius            0.25rem  ← all cards/buttons/inputs use this
```

Tailwind maps these to `bg-background`, `text-foreground`, `border-input`, `ring-ring`, etc. **Use the semantic token, not the raw color** — enables future theming (e.g. dark mode) without a rewrite.

### 1.3 Client-shell surface colors

The `/client` portal uses a slightly-warm off-white shell, not pure `--background`:

- Shell background: `bg-[#fafafa]` (hard-coded in `app/client/layout.tsx`; body override also in the layout effect)
- Card surfaces on top of the shell: `bg-white` + `border` + `shadow-sm` (matches shadcn `Card`)
- Auth pages: `bg-white` (no shell tint)

If you add a new full-page background, match `#fafafa`. If you need a subtly-elevated region inside a page, use `bg-white` with `rounded-xl` and a 1px border.

### 1.4 Radius scale

All derived from `--radius: 0.25rem`:

- `rounded-sm` = `calc(0.25rem - 4px)` — tiny chips
- `rounded-md` = `calc(0.25rem - 2px)` — inputs, small buttons
- `rounded-lg` = `0.25rem` — default shadcn
- `rounded-xl` = Tailwind default (`0.75rem`) — **cards use this** (`components/ui/card.tsx`)
- `rounded-full` — avatars, status dots, pill badges

### 1.5 Typography

Configured in `tailwind.config.ts` `fontFamily` and applied globally in `globals.css`:

| Family | Variable | Tailwind class | Where |
|---|---|---|---|
| **Switzer** | `--font-switzer` | `font-heading`, `font-switzer` | All `h1`–`h6` (auto-applied via `globals.css`) |
| **Geist Sans** | `--font-geist-sans` | `font-sans`, `font-geist` | Body, UI text, default everywhere else |

Rules:
- Let headings pick up Switzer automatically via the tag (`<h1>`–`<h6>`). Don't manually add `font-heading` unless you're using a non-heading element as a title.
- The `.client-shell` wrapper applies `letter-spacing: -0.011em` to subtly tighten tracking. Let it cascade — don't override.
- Body base is 16px (Tailwind `text-base`). Never go below `text-sm` (14px) for body content; labels can use `text-xs` (12px).
- Line-height: Tailwind defaults are fine for short UI copy. For paragraphs use `leading-relaxed` (1.625) or `leading-7`.

### 1.6 Spacing

Use the Tailwind 4pt scale (`p-1 … p-12`). Cards default to `p-6` (`components/ui/card.tsx`). Vertical rhythm between page sections: `space-y-6` or `space-y-8`. Page horizontal insets inside the client shell are handled by the layout (`px-4 sm:px-6 md:px-10 xl:px-20`) — **don't add your own outer padding** in page components; assume you're already padded.

### 1.7 Shadow & elevation

Keep it subtle — the client portal is quiet, not layered:

- Cards: `shadow` (shadcn Card default) or `shadow-sm`
- Popovers/dialogs: shadcn defaults (don't override)
- Hover lift: `transition-shadow hover:shadow-md` — only on cards that are themselves clickable
- Never stack more than one elevation level in the same view

### 1.8 Motion

- Library: **`motion/react`** (Motion / ex-Framer Motion). Already used in `app/client/layout.tsx`, `components/client/navbar.tsx`.
- Duration: 150–300ms for UI feedback, 400–600ms for page/nav entrances. Never >600ms.
- Nav color transitions use a 0.6s ease-in-out (see `globals.css` `.client-navbar …`). Match that cadence for nav-adjacent animations.
- Respect `prefers-reduced-motion` — wrap entry animations so they no-op when the user opts out (Motion supports this natively via `useReducedMotion()`).
- Animate `transform` and `opacity` only. Never animate `width`/`height`/`top`/`left`.

### 1.9 Icons

- Library: **`lucide-react`**. Standard size is `h-4 w-4` (matches Button's `[&_svg]:size-4`). Use `h-5 w-5` for prominent section headers, `h-12 w-12` only for loading/empty state illustrations (`Loader2`).
- Never use emoji as structural icons (nav, buttons, status). Emoji are OK inline in content copy (e.g. country flags in `app/client/home/page.tsx` — that's content, not UI chrome).
- Stroke width: leave at Lucide's default (`stroke-width="2"`). Don't mix stroke widths in the same view.

---

## 2. Component inventory — what already exists

Before building a new primitive, check these directories. **Reuse or extend, don't duplicate.**

### 2.1 shadcn primitives — `components/ui/`

```
accordion, alert, alert-dialog, avatar, badge, button, calendar,
calendar-date-picker, card, checkbox, collapsiblce, command,
country-dropdown, date-picker, dialog, dropdown-menu, empty, form,
input, input-group, input-otp, label, popover, region-select,
scroll-area, select, separator, sheet, skeleton, table, tabs,
textarea, toast, tooltip
```

Style: **shadcn "new-york"** on **zinc** base with CSS variables (`components.json`). To add a missing primitive:

```bash
cd viza-fe/internal-website
npx shadcn@latest add <component-name>
```

Don't rewrite a primitive from scratch.

### 2.2 Client-specific components — `components/client/`

```
navbar.tsx, animated-menu.tsx, language-selector.tsx,
auth-language-switcher.tsx, help-article.tsx, static-article.tsx,
sex-prompt-modal.tsx, invite-history.tsx,
about-me/, companion/, constants/, home/
```

When building a new `/client` feature, prefer putting composite components in `components/client/<feature>/`. Page files in `app/client/<route>/page.tsx` should be thin — mostly data fetching + layout — and compose from here.

### 2.3 Utility

- `cn()` from `@/lib/utils` — always use it for conditional classes (`cn("base", cond && "variant", className)`).
- `clsx` is also imported in some places; prefer `cn` for consistency.

---

## 3. Buttons

### 3.1 `BrandActionButton` — the standard flow CTA

**Use for "Continue", "Submit", "Confirm", "Validate" and any other primary or secondary action on a form step, wizard, or modal.**

Source: `components/client/brand-action-button.tsx`. Bakes in the canonical flow-button proportions (`h-12 rounded-full px-6 text-[15px] font-medium`) and the brand palette, so every step in the client portal looks identical.

```tsx
import { BrandActionButton } from "@/components/client/brand-action-button";

<BrandActionButton type="submit" disabled={!canContinue}>
  {t("continue")}
</BrandActionButton>

<BrandActionButton
  variant="secondary"
  onClick={runValidation}
  loading={state === "loading"}
  loadingText={t("review.validation.validating")}
>
  {t("review.validation.validateButton")}
</BrandActionButton>
```

| Prop | Type | Purpose |
|---|---|---|
| `variant` | `"primary"` (default) / `"secondary"` | Primary = filled brand; secondary = brand outline |
| `loading` | `boolean` | Swaps the label for a `<Loader2 className="animate-spin" />` + `loadingText`, disables the button |
| `loadingText` | `ReactNode` | Defaults to `children` if omitted |
| `type`, `disabled`, `onClick`, … | standard `<button>` props | `type` defaults to `"button"` |

**Don't** re-style flow CTAs with `<Button className="h-12 rounded-full bg-[#03346E] …">`. Anything that should *look like* 继续 must use `BrandActionButton` so visual updates propagate in one place.

### 3.2 When to use the shadcn `<Button>` instead

Use the raw shadcn `<Button>` (`components/ui/button.tsx`) only for:

| Variant | When |
|---|---|
| `outline` / `ghost` | In-card/list actions like "Edit", "Add", icon toolbar buttons |
| `destructive` | Delete / irreversible — always confirm via `AlertDialog` |
| `link` | Inline text-style action only |

Every screen must have **one primary CTA**. If two feel equally weighted, one is always more primary — reconsider the hierarchy.

---

## 4. Forms

### 4.1 `BrandInput` + `BrandField` — the standard form field

**Use for every client-portal form.** Source: `components/client/brand-field.tsx`.

- `BrandInput` wraps shadcn `<Input>` with the canonical sizing (`h-12 rounded-lg border-[#e8e8e8] text-[15px]`) and brand focus ring — matches `DatePicker` and `CountryDropdown` so fields in the same row align.
- `BrandField` wraps `<Label>` + control in the standard column layout (`flex flex-col gap-2`), handles the required asterisk, hint text, and `role="alert"` error message.

```tsx
import { BrandField, BrandInput } from "@/components/client/brand-field";

<BrandField label={t("cityOfBirth")} htmlFor="city-birth" required>
  <BrandInput
    id="city-birth"
    value={cityOfBirth}
    onChange={(e) => setCityOfBirth(e.target.value)}
    placeholder={t("cityOfBirthPlaceholder")}
  />
</BrandField>

<BrandField label={t("nationality")}>
  <CountryDropdown defaultValue={nationality} onChange={(c) => setNationality(c.alpha3)} />
</BrandField>
```

**Don't** use the raw shadcn `<Input>` (its default is `h-9 rounded-md`) — mixing it with `DatePicker`/`CountryDropdown` in the same row creates the visible height mismatch the client portal should never show.

**Don't** hand-roll `<div className="flex flex-col gap-2"><Label>…</Label>…</div>` — use `BrandField` so label styling, spacing, and error/hint rules stay in one place.

For dynamic DB-driven forms, `components/dynamic-form-field.tsx` already applies the same `h-12 rounded-lg border-[#e8e8e8]` sizing via `InputGroup` — no change needed there. If you add a new field type, match these tokens.

---

## 5. Patterns already in use — follow them

### 5.1 Loading state
```tsx
<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
  <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
  <p className="text-lg text-muted-foreground">{t("loadingDashboard")}</p>
</div>
```
Source: `app/client/home/page.tsx`. Reuse verbatim.

### 5.2 Empty state
Use the `Empty` primitives from `components/ui/empty.tsx` (`Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`). Don't roll your own.

### 5.3 i18n
Every user-facing string goes through `next-intl`:
```tsx
const t = useTranslations("home");
<h1>{t("title")}</h1>
```
Message files are in `messages/`. Never ship hardcoded English copy in a component.

### 5.4 Auth-aware data fetching
Client actions that must work during admin impersonation use `getAuthenticatedUserId()` from `@/lib/auth/get-authenticated-user`. Don't call Supabase directly for the current user's ID — it bypasses the impersonation cookie and breaks the `/manage/impersonate` flow.

### 5.5 Nav color state
The navbar reads `--nav-text-color` / `--nav-stroke-color` CSS variables (see `globals.css` and `app/client/layout.tsx`). Pages that need a light nav over a dark hero (currently `/client/home`, `/client/invite-friends`) set these vars via `document.documentElement.style.setProperty(...)`. Any new page that isn't one of those inherits black — don't touch the vars.

### 5.6 Scrollbars
The client shell hides scrollbars globally via an injected `<style>` in `app/client/layout.tsx`. Inside scrollable panels where you *want* a visible scrollbar, use the `.ay-scrollbar-visible` class from `globals.css`.

### 5.7 Responsive breakpoints
Standard Tailwind: `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`. The shell's horizontal padding already steps up at `sm md xl`. Design mobile-first; assume the primary device is a phone until you have a reason otherwise.

---

## 6. UX rules — non-negotiable checklist

Distilled from the `ui-ux-pro-max` skill (upstream: github.com/nextlevelbuilder/ui-ux-pro-max-skill). These are the rules that most often get skipped and make UI look unprofessional.

### 6.1 Accessibility (CRITICAL)
- [ ] Text contrast ≥ 4.5:1 (normal), ≥ 3:1 (≥18px or bold). Verify `text-muted-foreground` on your actual background.
- [ ] Every interactive element is keyboard-reachable with a visible focus ring (shadcn's `focus-visible:ring-1 focus-visible:ring-ring` is the baseline — don't remove it).
- [ ] Icon-only buttons have `aria-label`.
- [ ] Form inputs have a visible `<Label>` — placeholder is not a label.
- [ ] No information conveyed by color alone (pair red with an icon or text).

### 6.2 Touch & interaction (CRITICAL)
- [ ] Minimum hit target 44×44px. If an icon is smaller, expand the button's padding.
- [ ] ≥8px spacing between adjacent tap targets.
- [ ] Visible pressed/hover feedback within 100ms of interaction.
- [ ] Never rely on hover alone for mobile — tap behaviour must mirror it.
- [ ] Async buttons disable and show a spinner during the request.

### 6.3 Performance
- [ ] Images: use `next/image` with explicit `width`/`height` (or `fill` + `sizes`). Never unsized `<img>` — causes CLS.
- [ ] Lazy-load below-the-fold media.
- [ ] Skeleton screens (use shadcn `Skeleton`) for loads >300ms, not blank space or infinite spinners at page level.
- [ ] Keep main-thread work off hot paths — debounce inputs (300ms is the convention in this repo, see search inputs in `/manage`).

### 6.4 Layout & responsive
- [ ] Mobile-first. Test at 375px width before shipping.
- [ ] No horizontal scroll on mobile (outside of explicit horizontal strips using `ay-scrollbar-hide`).
- [ ] Body text ≥16px on mobile (prevents iOS auto-zoom on focus).
- [ ] Reserve space for fixed nav (`pt-32 xl:pt-32` is already applied in the client layout — don't re-apply in pages).

### 6.5 Forms
- [ ] Validate on blur, not on keystroke.
- [ ] Errors appear directly below the offending field with `role="alert"` or `aria-live="polite"`.
- [ ] After submit failure, focus moves to the first invalid field.
- [ ] Destructive actions use the `destructive` button variant and require an `AlertDialog` confirmation.
- [ ] Submit button shows loading state; disable it while pending.

### 6.6 Animation
- [ ] 150–300ms for micro-interactions, ≤400ms for transitions.
- [ ] Animate only `transform` and `opacity`.
- [ ] Exit animations are shorter (~60–70%) than enter animations.
- [ ] Always interruptible by user input.
- [ ] Respect `prefers-reduced-motion`.

### 6.7 Navigation
- [ ] Current location is visually indicated in the nav (the navbar animates a pill under the active tab — preserve this pattern).
- [ ] Back navigation preserves scroll position and filter state.
- [ ] Deep links work — every client screen must be reachable by URL.

---

## 7. Pre-delivery checklist

Before opening a PR that touches `/client` UI:

- [ ] Verified at 375px (iPhone SE), 768px (tablet), and 1440px.
- [ ] Every string runs through `useTranslations()` — no hardcoded copy.
- [ ] Tokens used everywhere — no raw hex, no arbitrary spacing outside the 4pt scale (except `#fafafa` for shell parity).
- [ ] `npm run type-check` passes (`viza-fe/internal-website/`).
- [ ] No new `any` types, no unused imports.
- [ ] Ran the page once in a real browser — confirmed golden path + one error state (per project rule: type-check verifies code, not features).
- [ ] Keyboard-only pass: Tab through the whole page, everything reachable, focus ring visible.
- [ ] Loading + empty + error states each exist (use section 5 patterns).
- [ ] Destructive actions gated behind `AlertDialog`.

---

## 8. What not to do

- ❌ Paste raw hex colors (use the `brand-*` scale or shadcn semantic tokens).
- ❌ Build a custom button/card/input — extend the shadcn primitive instead.
- ❌ Add emoji as structural icons (country flags as content are OK).
- ❌ Add global CSS for a one-off component — keep it scoped with Tailwind.
- ❌ Hardcode English strings.
- ❌ Add `px-*` to the outer container of a page component — the client layout already pads.
- ❌ Animate layout properties (`width`, `height`, `top`, `left`).
- ❌ Ship without testing at 375px.
- ❌ Remove a shadcn focus ring to make it "look cleaner".

---

## 9. References

- Tailwind config: `tailwind.config.ts`
- Global CSS / CSS variables: `app/globals.css`
- shadcn config: `components.json` (new-york, zinc, cssVariables: true)
- Client layout + shell: `app/client/layout.tsx`
- Navbar pattern: `components/client/navbar.tsx`
- Button variants: `components/ui/button.tsx`
- Card: `components/ui/card.tsx`
- UX rules source: [ui-ux-pro-max SKILL.md](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md) — this guide distills the rules that apply; consult the upstream for edge cases (charts, native mobile, etc.).
