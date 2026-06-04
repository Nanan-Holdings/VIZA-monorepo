# Client Settings Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/settings/**`.

## Purpose

Client settings owns applicant account, profile, billing entry points, and
privacy/data-rights controls.

## Key Responsibilities

- Treat Settings rows/tabs as navigation entry points. When a user opens a
  settings tab, route to a dedicated page such as
  `/client/settings/points` or `/client/settings/payment-methods`; do not
  reveal the detail surface inline on the Settings overview page.
- Keep account/profile editing in the existing settings routes unless a new
  route is clearly needed.
- Add privacy controls for data export and deletion requests backed by
  `data_privacy_requests`.
- Link billing actions to `/client/billing` rather than duplicating full
  billing tables in settings.
- Keep sign-out and auth behavior stable.

## Data Sources

- `applicant_profiles`
- `applicant_profiles.dependant_of_user_id` for common/frequent travelers
- `data_privacy_requests`
- Existing settings/about-me actions

## Local Files

- Server actions for this module live in `app/actions/client-settings.ts`; do
  not add a local `actions.ts` re-export because `"use server"` files may only
  export async functions.
- `components/frequent-travelers-tab.tsx`: common traveler list, add/edit
  form, and soft-delete controls for future group-order selection.
- `components/privacy-tab.tsx`: client privacy/data-rights controls and request
  history.
- `payment-methods/page.tsx`: payment account binding and default-method
  management.
- `points/page.tsx`: VIZA points balance, earning rules, and marketplace.
- `travelers/page.tsx`: common/frequent traveler management.
- `privacy/page.tsx`: privacy/data-rights page.
- `security/password/page.tsx` and `security/email/page.tsx`: account security
  update entry points.

## Guardrails

- Default new settings functionality to a single SettingsRow-style tab/entry
  point on `/client/settings`, then navigate to a dedicated child route for the
  full detail surface.
- Keep the points center and points marketplace behind one Points Center tab;
  do not split them into separate default-expanded sections.
- VIZA points earn rule: every RMB 100 of confirmed customer spend grants 100
  points. Award points through `reward_transactions` so `reward_wallets`
  reflects the balance via the wallet trigger.
- Points redemption rule: 1000 points can redeem one free arrival-card
  submission for visa-free destinations that mainly require an entry/arrival
  card, including Singapore, Malaysia, and Thailand.
- Do not delete applicant PII directly from client UI. Create a request record
  unless a dedicated retention/deletion service owns the operation.
- Do not show service-role-only fields in browser components.
- Preserve existing settings tabs and translations where possible.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```
