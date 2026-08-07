# VIZA Application Route Agent Rules

Scope: this file applies to `viza-fe/internal-website/app/client/application/**`.

## Goal

Keep `/client/application` as the authenticated visa application filling flow:

1. Users arrive from destination cards or VIZA AI redirects with `country` and `visaType`.
2. The page loads or creates the matching draft application instead of assuming a single global active application.
3. DB-driven forms render as a bilingual two-column form: Chinese on the left, English/official wording on the right.
4. Field-level AI help opens only from the `问 AI` button and should support the current field without taking over normal form interaction.
5. Photo upload is handled inside the supporting-documents step; review,
   submit/status steps remain part of the same application progress.

## Source Of Truth

Before changing this route, read:

1. `docs/application/DG.md`
2. `docs/application/UG.md`
3. `viza-fe/internal-website/app/client/application/page.tsx`
4. `viza-fe/internal-website/components/dynamic-step-form.tsx`
5. `viza-fe/internal-website/components/dynamic-form-field.tsx`
6. `viza-fe/internal-website/components/field-guidance-panel.tsx`
7. `viza-fe/internal-website/components/application-steps/dynamic-review-step.tsx`
8. `viza-be/agent-backend/src/routes/field-guidance.routes.ts`
9. `viza-be/agent-backend/src/services/visa-knowledge.service.ts`
10. `knowledge-base/visa-rag-seeds/README.md`

## Key Files

- `page.tsx`: route entry and application flow coordinator. It resolves query params, loads draft application state, chooses DB-driven versus fallback steps, and appends supporting-documents/review/status steps.
- `components/dynamic-step-form.tsx`: shared DB-driven bilingual form renderer, including Chinese/English synchronization, field-level validation, repeat groups, keyboard undo/redo, and AI trigger buttons.
- `components/dynamic-form-field.tsx`: primitive field renderer for text, textarea, date, select, country, radio, checkbox, phone, SSN, and upload-like fields.
- `components/field-guidance-panel.tsx`: frontend panel for field-level AI help. It calls `POST /api/field-guidance` and must render plain, useful field guidance.
- `components/client/form-assistant/form-filling-assistant.tsx`: application-level SGAC pilot assistant, including text/voice composer, progress, provenance list, and final-check controls.
- `components/application-steps/dynamic-review-step.tsx`: read-only review step for DB-driven forms.
- `app/client/application/_components/result-cards/submission-status-poll.ts`:
  bounded retry policy for final-step status polling. Network failures and
  retryable upstream responses must reconnect without marking the durable
  submission job failed or creating another submission.
- `app/actions/visa-form-fields.ts`: loads `visa_form_fields` rows and groups them into wizard steps.
- `app/actions/application-lifecycle.ts`: creates and reads per-user application progress summaries.
- `app/client/application/_components/result-cards/__tests__`: focused regression tests for confirmation/result cards.
  `DigitalArrivalCardResultCard.test.tsx` verifies that Vietnam Pre-Arrival QR
  and confirmation PDF artifacts are rendered as authenticated downloads.
  `UsResultCard.test.tsx` verifies that the completed DS-160 action requests a
  fresh application instead of being swallowed by completed-result idempotency.

## Guardrails

1. **Edward-approved UI freeze:** Do not make any further visual or interaction
   design change anywhere under `/client/application` without Edward's
   explicit review and approval for that exact change. This includes layout,
   composition, component selection, typography, spacing, colors, borders,
   icons, copy presentation, motion, responsive behavior, hover/focus states,
   and form-control variants. Requests from anyone other than Edward are not
   sufficient approval. Read-only inspection, tests, data fixes, and diagnosis
   may proceed, but stop before an implementation would alter the UI.
2. The application UI must continue using the frozen canonical components
   demonstrated at `/ui-components`. Do not modify, replace, regenerate,
   restyle, or work around those components without Edward's explicit approval.
3. Preserve the two-column bilingual contract: left is fully Chinese, right is fully English/official wording.
4. Do not reintroduce section-header rows or nested table/card borders inside the form body unless Edward explicitly reviews and approves that design change. The outer form card is enough.
5. Keep the application page width aligned with the homepage content width. Use the shared `max-w-[1090px]` page rhythm unless Edward explicitly approves a design change.
6. Avoid clipped focus or active borders. Prefer real borders inside the element over rings that overflow a constrained container.
7. Text fields may be edited from either language side. Chinese-side edits may update the English/official side and the canonical value; English/official-side edits must not overwrite the Chinese side.
8. Preserve native input shortcuts. Form-level shortcuts may handle non-text controls, but text inputs and textareas must keep browser-native `Ctrl/Cmd+C`, `Ctrl/Cmd+V`, `Ctrl/Cmd+Z`, and related behavior.
9. Field AI must open only from the explicit `问 AI` button. Do not open it on generic field focus or row click.
10. VIZA AI and field guidance answers must be plain text by default. Do not render Markdown-heavy output in the form panel.
11. Do not hardcode country photo rules in shared copy. Use country/visa-specific data where available, with a generic fallback only when no rule exists.
12. When adding or changing a country workflow, update the country seed in `knowledge-base/visa-rag-seeds/countries`, the form field seed if needed, and the docs in `docs/application`.
13. Keep review read-only. Review should show what the user entered and the derived English/official value, but final editing belongs in the form steps.
14. Be careful with dirty worktrees. This route is commonly edited alongside backend RAG and form seeds; do not revert unrelated files.
15. The form-filling assistant is separate from general VIZA AI and field-level `问 AI`. It may collect form answers only through the owned application APIs, must never modify Universal Profile implicitly, and must leave the manual form usable when AI or voice services fail.

## Validation Checklist

For frontend application changes:

1. `cd viza-fe/internal-website && npm run type-check`
2. Run focused tests when touching covered components, for example:
   `npx vitest run components/__tests__/dynamic-step-form-copilot-format.test.tsx --testTimeout=15000`
3. Lint changed frontend files, for example:
   `npx eslint app/client/application/page.tsx components/dynamic-step-form.tsx`
4. Smoke test at least one application route:
   `/client/application?country=germany&visaType=schengen_c`
5. If an authenticated browser session is available, verify:
   - destination card opens the expected application
   - Chinese-side text edits update the English/official side, while English/official-side text edits do not overwrite Chinese text
   - `问 AI` opens and closes only from the button
   - photo upload is available from the supporting-documents photo row
   - review page is read-only
   - mobile layout does not clip sidebar cards or form controls

For backend field-guidance or RAG changes:

1. `cd viza-be/agent-backend && npm run type-check`
2. Verify `POST /api/field-guidance` returns a plain-text guidance payload with deduplicated sources.
3. If RAG seeds changed, run the relevant ingestion command from `viza-be/agent-backend`.
4. If retrieval behavior changed, run the field-guidance eval script where practical:
   `npm run test:field-guidance-copilot`
