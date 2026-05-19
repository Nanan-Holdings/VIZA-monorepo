# VIZA Application Developer Guide

This guide explains where the application-form content lives and how the current form, RAG, and field-AI pieces connect.

## High-Level Map

Frontend application route:

- `viza-fe/internal-website/app/client/application/page.tsx`
- `viza-fe/internal-website/app/actions/visa-form-fields.ts`
- `viza-fe/internal-website/app/actions/application-lifecycle.ts`

Shared form components:

- `viza-fe/internal-website/components/dynamic-step-form.tsx`
- `viza-fe/internal-website/components/dynamic-form-field.tsx`
- `viza-fe/internal-website/components/field-guidance-panel.tsx`
- `viza-fe/internal-website/components/application-steps/photo-upload-step.tsx`
- `viza-fe/internal-website/components/application-steps/dynamic-review-step.tsx`

Frontend supporting libraries and types:

- `viza-fe/internal-website/lib/ds160-translations.ts`
- `viza-fe/internal-website/lib/visa-destinations.ts`
- `viza-fe/internal-website/lib/visa-form-fields.ts`
- `viza-fe/internal-website/types/visa-form-fields.ts`
- `viza-fe/internal-website/types/field-guidance.ts`

Backend field guidance and RAG:

- `viza-be/agent-backend/src/routes/field-guidance.routes.ts`
- `viza-be/agent-backend/src/services/visa-knowledge.service.ts`
- `viza-be/agent-backend/src/socket/visa-namespace.ts`
- `viza-be/agent-backend/src/config/visa-destination-registry.ts`

RAG source assets and ingestion:

- `knowledge-base/visa-rag-seeds/README.md`
- `knowledge-base/visa-rag-seeds/countries/*.json`
- `viza-be/agent-backend/scripts/ingest-country-visa-rag.ts`
- `viza-be/agent-backend/scripts/ingest-photo-requirements-rag.ts`
- `viza-be/agent-backend/scripts/ingest-ds160-rag.ts`

Database and migrations:

- `viza-be/agent-backend/drizzle/0001_viza_initial.sql`
- `viza-be/agent-backend/drizzle/0012_match_visa_chunks.sql`
- Supabase tables: `applications`, `application_answers`, `visa_packages`, `visa_form_fields`, `visa_documents`, `visa_chunks`

## Runtime Flow

1. The user opens `/client/application?country=...&visaType=...`.
2. `page.tsx` resolves the requested country and visa type, then loads or creates a matching draft application.
3. The page tries DB-driven form steps from `visa_form_fields`.
4. If DB-driven steps exist, `DynamicStepForm` renders them; otherwise the page falls back to legacy hardcoded B211A steps.
5. Each DB-driven field is rendered as a bilingual pair through `DynamicFormField`.
6. Field values are stored in local step state, then persisted to application answer rows when the user continues.
7. Photo, review, and status steps are appended after the DB-driven form steps.

## Bilingual Form Contract

`DynamicStepForm` is the owner of the bilingual form behavior.

Rules:

- left side is Chinese only
- right side is English or official wording only
- text-like fields keep a `{ zh, en }` pair
- editing either side updates the pair and the canonical field value
- non-text fields share one canonical answer across both sides
- date, country, select, radio, and checkbox values should not diverge by language

Labels, placeholders, and option text are normalized through `lib/ds160-translations.ts` and option helpers in `DynamicStepForm`.

## Keyboard Shortcuts

`DynamicStepForm` keeps a small in-memory form history for non-text controls.

Supported form-level shortcuts:

- `Ctrl+Z` / `Cmd+Z`: undo
- `Ctrl+Y`: redo on Windows
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: redo

Text-editing targets are intentionally excluded so native browser behavior handles copy, paste, cut, select all, and text-level undo.

## Field AI Guidance

Frontend:

- `FieldGuidancePanel` calls `POST /api/field-guidance`.
- The panel receives the current country, visa type, field schema, current answer, and all answers.
- The panel output should be plain text and compact.

Backend:

- `field-guidance.routes.ts` builds deterministic fallback guidance from field metadata.
- It calls `retrieveVisaKnowledge()` when retrieval is enabled.
- It optionally calls Anthropic when `ANTHROPIC_API_KEY` is available.
- It strips Markdown from generated text before returning it.
- It uses an in-memory cache keyed by visa type, field name, and locale.

RAG retrieval:

- `visa-knowledge.service.ts` embeds the query with OpenAI when `OPENAI_API_KEY` is available.
- It calls Supabase RPC `match_visa_chunks` for pgvector similarity search.
- If embeddings are unavailable or retrieval fails, it falls back to filtered rows from `visa_chunks`.
- Intent determines preferred document types, for example `form_requirements` and `photo_requirements` for form intake.

## RAG Source Content

Country-level RAG content lives in `knowledge-base/visa-rag-seeds/countries/*.json`.

Each country seed should contain:

- country identifier
- visa type coverage
- official or authorized source URLs
- requirements/process chunks
- exactly one `documentType: "form_requirements"` document
- photo requirements when available, usually through the photo ingestion script

The shared runtime store is:

- `visa_documents`: document metadata and source URLs
- `visa_chunks`: chunk text, country, visa type, document type, and embedding

Ingestion commands from `viza-be/agent-backend`:

```bash
npm run ingest:all-visa-rag
npm run ingest:country-visa-rag -- --country japan
npm run ingest:country-visa-rag -- --countries japan,us,indonesia
npm run ingest:photo-requirements-rag
```

## Adding A New Country Form

1. Add or update the country RAG seed in `knowledge-base/visa-rag-seeds/countries`.
2. Add or update visa destination metadata in `viza-fe/internal-website/lib/visa-destinations.ts` and backend registry if chat routing needs it.
3. Add `visa_form_fields` seed data for the new country/visa type.
4. Run the appropriate backend seed/ingestion scripts.
5. Verify the home card appears in sorted destination lists.
6. Verify `/client/application?country=<country>&visaType=<visaType>` loads the correct draft flow.
7. Check bilingual labels, placeholders, options, photo guidance, review output, and field AI.

## Design Guardrails

- Match the homepage content width. The current rhythm is `max-w-[1090px]`.
- Keep form layout responsive. Desktop uses sidebar plus form content; mobile stacks steps and form.
- Do not add decorative nested cards or section header table rows inside the form body.
- Keep the outer form card clean and use spacing rather than extra internal borders.
- Use explicit buttons for AI. Field focus should not open AI guidance.
- Keep the review page read-only.

## Validation

Frontend:

```bash
cd viza-fe/internal-website
npm run type-check
npx eslint app/client/application/page.tsx components/dynamic-step-form.tsx components/dynamic-form-field.tsx components/field-guidance-panel.tsx
npx vitest run components/__tests__/dynamic-step-form-copilot-format.test.tsx --testTimeout=15000
```

Backend:

```bash
cd viza-be/agent-backend
npm run type-check
npm run test:field-guidance-copilot
```

Smoke routes:

- `/client/home`
- `/client/application?country=indonesia&visaType=B211A`
- `/client/application?country=germany&visaType=schengen_c`
- `/client/application?country=us&visaType=b1_b2`

Manual checks:

- destination card opens the matching application
- multiple applications preserve separate progress
- bilingual fields sync both directions
- select/date/country controls stay synchronized
- `问 AI` opens only from the button
- AI guidance has no Markdown formatting artifacts
- photo upload copy is country-specific where RAG/source data exists
- review is read-only and complete

