# Client Settings Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/client/settings/**`.

## Purpose

Client settings owns applicant account, profile, billing entry points, and
privacy/data-rights controls.

## Key Responsibilities

- Keep account/profile editing in the existing settings tabs unless a new route
  is clearly needed.
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

## Guardrails

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
