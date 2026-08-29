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
- `dynamic-review-step.tsx`: DB-driven bilingual review with guarded editing of
  English/official values before submission.
- `__tests__/dynamic-review-localization.test.tsx`: focused coverage for
  bilingual review labels, enum display, and source/official values.
- `review-step.tsx` and `bilingual-review-panel.tsx`: legacy review surfaces.
- `team-step.tsx`: manage companion applicants before final submission.
- `__tests__/team-step.test.tsx`: verifies that saved Settings traveler profiles
  are selectable directly from the flat Team step and already-added profiles
  cannot be selected twice.
- `frequent-traveler-profile-fields.tsx`: shared common-traveler profile
  fields used by Team step and Settings frequent traveler management.
- `submission-disclaimer-dialog.tsx`: shared final-submit disclaimer modal used
  by review steps before an application is submitted.
- `universal-profile-sync-card.tsx`: explicit Review-tab action that copies
  reusable application facts into Universal Profile while excluding trip,
  declaration, payment, and secret fields.
- `status-step.tsx` and `status-card.tsx`: post-submission confirmation/status.
- `bilingual-form-shared.tsx` and `review-shared.tsx`: shared row/format helpers.

## Ownership Boundaries

- The application-step UI is under Edward's design freeze. Do not change
  layout, styling, composition, form controls, responsive behavior, icons,
  copy presentation, hover/focus states, or interaction design without
  Edward's explicit review and approval for that exact change. Requests from
  anyone else are not sufficient approval.
- The bordered English/official-value editors on final review are an
  Edward-approved exception recorded on 2026-08-27. Keep their canonical VIZA
  form styling and do not treat this as approval for unrelated UI changes.
- Continue using the frozen canonical components demonstrated at
  `/ui-components`; do not modify, replace, regenerate, restyle, or work around
  them without Edward's explicit approval.
- Dynamic field rendering belongs in `components/dynamic-step-form.tsx` and
  `components/dynamic-form-field.tsx`, not in this module.
- Country-specific photo copy should come from `lib/photo-guidance.ts` or RAG
  source data, not hardcoded generic text.
- Before submission, review steps allow direct correction of English/official
  values. Preserve the Chinese answer on English edits, store canonical
  option/date values, and keep the section edit action for full-field repairs.
  Successful submitted applications must keep review read-only. Validator
  errors and warnings may highlight the matching review question and answer.
- Shared form rows show only the selected interface language during entry.
  Preserve synchronized Chinese and English/official values internally, and
  keep the final Chinese-mode review bilingual.

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
