# Client Settings Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/settings/**`.

## Purpose

Client settings owns applicant account and profile navigation, Points Center,
traveler and Travel Agent preferences, security, and privacy/data-rights
controls. Billing, payment-method, and subscription links are retired
compatibility routes.

## Key Responsibilities

- Treat Settings rows/tabs as navigation entry points. The overview routes
  profile/account, travelers, Points Center, travel memory, privacy, and
  security details to their dedicated pages; do not reveal those detail
  surfaces inline on the Settings overview page.
- Keep account/profile editing in the existing settings routes unless a new
  route is clearly needed.
- Add privacy controls for data export and deletion requests backed by
  `data_privacy_requests`.
- Keep payment-method and subscription compatibility routes pointed back to
  `/client/settings`; do not add financial navigation or duplicate retired
  billing surfaces.
- Keep sign-out and auth behavior stable.

## Data Sources

- `applicant_profiles`
- `applicant_profiles.dependant_of_user_id` for common/frequent travelers
- `reward_wallets` for the existing Points Center balance and totals
- `data_privacy_requests`
- Existing settings and applicant profile actions

## Local Files

- Server actions for this module live in `app/actions/client-settings.ts`; do
  not add a local `actions.ts` re-export because `"use server"` files may only
  export async functions.
- `components/frequent-travelers-tab.tsx`: common traveler list, add/edit
  form, and soft-delete controls for future group-order selection.
- `components/privacy-tab.tsx`: client privacy/data-rights controls and request
  history.
- `payment-methods/page.tsx`: legacy compatibility redirect to
  `/client/settings`; there is no payment account binding or default-method
  management.
- `points/page.tsx`: existing VIZA points balance, referral/promotion copy,
  and configured redemption catalog. It does not offer points purchases.
- `subscription/page.tsx`: legacy compatibility redirect to
  `/client/settings`; there is no plan, renewal, cancellation, or
  payment-method management.
- `travelers/page.tsx`: common/frequent traveler management.
- `privacy/page.tsx`: privacy/data-rights page.
- `travel-memory/page.tsx`: view, delete, and clear explicitly saved
  cross-session Travel Agent preferences.
- `security/password/page.tsx` and `security/email/page.tsx`: account security
  update entry points.

## Guardrails

- Default new settings functionality to a single SettingsRow-style tab/entry
  point on `/client/settings`, then navigate to a dedicated child route for the
  full detail surface.
- Keep the points center and points marketplace behind one Points Center tab;
  do not split them into separate default-expanded sections.
- Payment-linked purchase-point rewards are retired. Do not describe points as
  purchasable or award them from payment events in this module. The Points
  Center may display existing wallet balances and referral rewards.
- Points redemption uses the configured catalog rather than a payment flow.
  The current entries are 1000 points for an eligible arrival-card submission,
  199 points for a priority checklist, and 499 points for a consultation
  credit; keep copy and implementation aligned before changing these values.
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
