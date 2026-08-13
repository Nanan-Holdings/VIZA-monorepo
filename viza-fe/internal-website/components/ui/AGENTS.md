# UI Primitives Agent Guide

Scope: this file applies to `viza-fe/internal-website/components/ui/**`.

## Purpose

This directory contains shadcn-style primitives used across the frontend:
buttons, inputs, dialogs, sheets, selects, tables, calendars, tooltips, cards,
and related low-level UI building blocks.

## Ownership Boundaries

- Keep primitives generic. Feature-specific behavior belongs in route or
  feature component directories.
- Preserve shadcn conventions from `components.json` and Tailwind tokens.
- Do not hardcode business copy, Supabase calls, backend calls, or route logic
  in primitives.
- When adding a new primitive, prefer `npx shadcn@latest add <component>` and
  then adapt lightly to local conventions.

## Edward-Approved Design Freeze

The UI and behavior currently demonstrated by `/ui-components` are frozen.
The following canonical files, plus any future component added to that gallery,
must not be edited without Edward's explicit review and approval for the exact
change:

- `ai-assist-button.tsx`
- `application-conditional-fields-panel.tsx`
- `application-form-date-picker.tsx`
- `application-form-field.tsx`
- `application-form-input.tsx`
- `application-form-panel.tsx`
- `application-form-select.tsx`
- `application-form-textarea.tsx`
- `application-yes-no-control.tsx`
- `country-dropdown.tsx`
- `supporting-document-card.tsx`
- `page-back-button.tsx`

This freeze covers code, public props, behavior, layout, styling, copy, icons,
spacing, colors, borders, motion, hover states, and focus states. Do not
regenerate, replace, refactor, or restyle these components during adjacent
work. Read-only inspection and tests are allowed; any required edit must pause
for Edward's explicit approval first.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke at least one route that uses the changed primitive.

## Related Files

- `viza-fe/internal-website/components.json`
- `viza-fe/internal-website/tailwind.config.ts`
- `viza-fe/internal-website/app/globals.css`
- `application-form-input.tsx`, `application-form-select.tsx`,
  `country-dropdown.tsx`, `application-form-date-picker.tsx`,
  `application-form-textarea.tsx`, and
  `application-yes-no-control.tsx`: independently reusable application form
  controls sharing the `.application-form-control` CSS contract. The select
  primitive owns regular, searchable single-select, and searchable multi-select
  behavior used by both `/ui-components` and `/client/application`.
- `application-conditional-fields-panel.tsx`: nested panel for fields revealed
  by a parent answer, including the closely coupled repeat-group add action.
- `date-picker.tsx`: compatibility wrapper for the shared application form date
  picker used by existing client flows.
- `application-form-panel.tsx` and `application-form-field.tsx`: shared form
  container and label/helper wrappers. The field wrapper exposes a fixed-size
  `labelAction` slot that owns exact right-edge alignment and hover/focus reveal
  for controls such as the AI field trigger.
  `application-form-controls.tsx` remains a compatibility re-export only.
- `supporting-document-card.tsx`: shared visual shell for individual document
  upload cards; upload behavior remains owned by the consuming feature.
- `document-upload-field.tsx` and `document-pdf-preview.tsx`: canonical upload
  surface plus its client-only first-page PDF renderer. Local file object URLs
  must remain lifecycle-owned and revoked by the upload field.
- `ai-assist-button.tsx`: shared AI help trigger and icon used by application
  fields, supporting-document cards, and Universal Profile cards. Its circular
  `field` variant stays background-transparent on hover while its icon stroke
  changes from brand blue to dark brand blue. Field/card triggers reveal on
  hover or keyboard focus and remain visible while their control or popover is
  active.
- `page-back-button.tsx`: universal icon-only page navigation control. Consumers
  supply a safe fallback destination and localized accessible label, then own
  the spacing around the control in their page layout. It returns through
  browser history when possible and uses the fallback only for a direct entry.
  Its navigation and accessible-name contract is covered by
  `__tests__/page-back-button.test.tsx`.
- `viza-fe/internal-website/frontend.md`
