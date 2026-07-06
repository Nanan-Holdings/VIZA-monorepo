# Destinations switch page — design

**Date:** 2026-07-05
**Scope:** `viza-fe/internal-website` client portal only.

## Problem

The client home page hosts the "Choose a popular destination" section, but every top-nav item
(Home, Application, Status) operates on a single current application. Country selection is a
mode switch, not a dashboard widget — it belongs on a dedicated page reachable from the
hamburger menu. The home hero also sits too close to the content below it.

## Decisions (user-approved)

1. **One combined page** at `/client/destinations`:
   - Section A "My applications" — one card per destination the user has (applications and
     selected-but-unstarted packages), with progress bar, status label, and the current
     application highlighted. Clicking routes to the application's next step
     (`getNextApplicationHref`), which also updates the implicit current-application context
     (URL params + `viza:recent-application-form-href` localStorage).
   - Section B — the existing `PopularDestinationsSection` (featured + region groups + search),
     moved from home unchanged. Region group cards keep linking to `/client/destinations/[region]`.
2. **Hamburger menu** gains a top item "Change country" (切换国家, Globe icon) →
   `/client/destinations`.
3. **Home page keeps** hero, the 3 glass cards (Subscription / Universal info / Quick actions),
   and Recent Activity. The destinations section and its data fetching are removed. Recent
   Activity gets a larger top margin so content clears the hero bottom.
4. **Zero-application users**: normal funnel is marketing site → guest checkout → magic link →
   portal with a draft application already attached, so this is an edge case (direct signup).
   Section A shows an empty-state hint pointing at Section B. No redirect.
5. **No marketing-website changes** — the handoff (portalUrl deep links → `/checkout/card|wechat`
   → `runPostPaidSideEffects` → magic link → `/client/home`) was verified working.

## Implementation shape

- `lib/client/application-progress.ts` — pure helpers extracted from `app/client/home/page.tsx`
  (`ApplicationRow`/`DocumentRow`/`AnswerRow` types, status sets, `getFormCompletionPercent`,
  `getApplicationProgressPercent`, `buildApplicationProgress`, `getNextApplicationHref`, hrefs,
  and the `DestinationApplicationProgress` type). Consumed by both home (activity hrefs) and the
  new page (full progress computation).
- `app/client/destinations/page.tsx` — new client page; fetches packages, applications,
  documents, answers, form-field schemas, payments; renders sections A + B. Follows the visual
  language of `DestinationRegionPageClient` (back link, white section cards, 1090px column).
- `components/client/animated-menu.tsx` — new menu item.
- `messages/en.json` / `messages/zh.json` — `menu.changeCountry` + `destinationsPage.*` keys
  (zh is Simplified Chinese).
- Home page slims down: drops `PopularDestinationsSection`, `getUserVisaPackages`, the
  `visa_application_answers` and `visa_form_fields` queries, and the progress computation.
