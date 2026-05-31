# Application Steps Agent Guide

Scope: this file applies to `viza-fe/internal-website/components/application-steps/**`.

## Purpose

This module contains legacy and shared application wizard steps used by
`/client/application`: personal/passport/travel/document steps, photo upload,
review, bilingual review helpers, and status confirmation.

## Key Flows

- `personal-info-step.tsx`, `passport-step.tsx`, `travel-info-step.tsx`:
  legacy B211A-style form steps.
- `document-upload-step.tsx`: supporting document uploads.
- `photo-upload-step.tsx`: country/visa-aware photo upload guidance and storage.
- `dynamic-review-step.tsx`: DB-driven read-only review with translations.
- `review-step.tsx` and `bilingual-review-panel.tsx`: legacy review surfaces.
- `submission-disclaimer-dialog.tsx`: shared final-submit disclaimer modal used
  by review steps before an application is submitted.
- `status-step.tsx` and `status-card.tsx`: post-submission confirmation/status.
- `bilingual-form-shared.tsx` and `review-shared.tsx`: shared row/format helpers.

## Ownership Boundaries

- Dynamic field rendering belongs in `components/dynamic-step-form.tsx` and
  `components/dynamic-form-field.tsx`, not in this module.
- Country-specific photo copy should come from `lib/photo-guidance.ts` or RAG
  source data, not hardcoded generic text.
- Review steps must stay read-only. Editing belongs in form steps.
- Preserve the bilingual two-column contract when changing shared form rows.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npx vitest run components/application-steps/__tests__ --testTimeout=15000
```

Smoke a direct application URL that reaches the changed step.

## Related Files

- `viza-fe/internal-website/app/client/application/page.tsx`
- `viza-fe/internal-website/components/dynamic-step-form.tsx`
- `viza-fe/internal-website/components/dynamic-form-field.tsx`
- `viza-fe/internal-website/lib/photo-guidance.ts`
- `viza-fe/internal-website/lib/photo-validation.ts`
- `viza-fe/internal-website/lib/ds160-translations.ts`
- `viza-fe/internal-website/app/actions/visa-application-answers.ts`
