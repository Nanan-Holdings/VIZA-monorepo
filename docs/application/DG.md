# VIZA Application Developer Guide

This guide explains where the application-form content lives and how the current form, RAG, and field-AI pieces connect.

## Local Startup And Page Entry

Start the VIZA portal from the Next.js app directory, not from the monorepo
root:

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo
.\scripts\start-viza-dev.ps1
```

This starts the frontend, agent backend, and Travel service when its Python
`.venv` already exists. It writes logs to `.dev-logs` and opens
`/client/login`. To stop services started by this script:

```powershell
.\scripts\start-viza-dev.ps1 -Stop
```

Manual frontend-only startup is:

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-fe\internal-website
npm run dev
```

Open the URL printed by Next.js, normally:

```text
http://localhost:3000/client/login
```

After login, the main client dashboard is:

```text
http://localhost:3000/client/home
```

If port `3000` is already used by another local app or an old Next process,
start this app on a different port and use that port in the browser:

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-fe\internal-website
npm run dev -- -p 3001
```

Then open:

```text
http://localhost:3001/client/login
```

For AI chat, field guidance, and backend-backed application flows, also start
the agent backend:

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\agent-backend
npm run dev
```

The frontend expects this backend at `NEXT_PUBLIC_AGENT_BACKEND_URL`, normally
`http://localhost:3002`. Travel AI pages also need the Python travel service:

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\travel-service
.\.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### If `/client/home` Shows 404

`/client/home` exists at
`viza-fe/internal-website/app/client/home/page.tsx`. A 404 usually means the
browser is pointed at a different server than the current `internal-website`
app, or the Next dev server was not restarted after route files were added.

Check in this order:

1. Confirm the terminal running Next.js is in
   `D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-fe\internal-website`.
2. Confirm the browser URL uses the same port printed by Next.js.
3. Stop the dev server with `Ctrl+C`, then run `npm run dev` again.
4. If port `3000` is occupied, run `npm run dev -- -p 3001` and open
   `http://localhost:3001/client/home`.
5. If the route still 404s after a restart, clear the generated Next cache:

   ```powershell
   Remove-Item -Recurse -Force .next
   npm run dev
   ```

## High-Level Map

Frontend application route:

- `viza-fe/internal-website/app/client/application/page.tsx`
- `viza-fe/internal-website/app/actions/visa-form-fields.ts`
- `viza-fe/internal-website/app/actions/application-lifecycle.ts`
- `viza-fe/internal-website/app/client/status/page.tsx`
- `viza-fe/internal-website/app/client/documents/page.tsx`
- `viza-fe/internal-website/app/client/checkout/page.tsx`
- `viza-fe/internal-website/app/client/billing/page.tsx`
- `viza-fe/internal-website/app/client/consent/page.tsx`
- `viza-fe/internal-website/app/admin/(dashboard)/applications/page.tsx`
- `viza-fe/internal-website/app/admin/(dashboard)/packages/page.tsx`
- `viza-fe/internal-website/app/admin/(dashboard)/billing/page.tsx`

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
- `viza-be/agent-backend/drizzle/0013_internal_automation_loop.sql`
- Supabase tables: `applications`, `application_answers`,
  `visa_application_answers`, `application_documents`, `visa_packages`,
  `visa_form_fields`, `visa_documents`, `visa_chunks`, `payment_records`,
  `consent_events`, `application_signatures`, `application_packets`,
  `application_events`, `notification_events`, `coverage_matrix`,
  `government_fee_rules`, `invoice_requests`, `refund_requests`,
  `data_rights_requests`, `pii_retention_jobs`

## Website Automation Page Map

The internal automation work adds pages around the application form. These pages
stay inside the VIZA website and do not run official portal automation.

Client routes:

- `/client/login`: applicant login.
- `/client/home`: dashboard and destination/application entry.
- `/client/application`: application lifecycle hub or direct form route when
  `country` and `visaType` query params are present.
- `/client/status`: canonical customer status center for payment, consent,
  documents, packet, external handoff, submitted/result states, and downloads.
- `/client/documents`: package-aware document checklist and upload center.
- `/client/checkout`: Stripe Checkout entry for VIZA agency fee only.
- `/client/billing`: receipts, invoice request, payment history, and refund
  visibility.
- `/client/consent`: ToS, Privacy, agency authorisation, and e-sign workflow.
- `/client/settings`: profile, billing settings, privacy export/delete
  requests.
- `/client/chat`: VIZA AI and Travel AI chat.
- `/client/travel-chat`: dedicated Travel AI route.

Admin routes:

- `/admin/login`: staff login.
- `/admin`: admin dashboard.
- `/admin/applications`: monitoring queue for website automation cases.
- `/admin/applications/[id]`: watch detail for support and status visibility.
- `/admin/packages`: country/package coverage matrix.
- `/admin/billing`: payment, invoice, and refund support workspace.

API/action boundaries:

- `app/actions/internal-automation/**`: trusted server actions for lifecycle,
  payment, consent, documents, packet, notifications, coverage, billing, and
  data-rights reads/mutations.
- `app/api/stripe/**`: Stripe Checkout and webhook route handlers.
- `app/api/passport-ocr/**`: server-side passport OCR proposal route.
- `app/api/external-submission/**`: status/result ingest from the external
  official-submission owner.

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
- It optionally calls OpenAI when `OPENAI_API_KEY` is available.
- It strips Markdown from generated text before returning it.
- It uses an in-memory cache keyed by visa type, field name, and locale.
- For standard-answer identity fields such as passport issuing authority,
  place of issue, passport type, nationality, and passport dates, it injects
  standard passport-field RAG and must prefer the passport biodata page, MRZ,
  official identity document, or official dropdown options over free-form
  inference.

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
- the shared `standard_passport_identity_field_rules` chunk inside that
  `form_requirements` document
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

- `/client/login`
- `/client/home`
- `/client/status`
- `/client/documents`
- `/client/checkout`
- `/client/billing`
- `/client/consent`
- `/admin/login`
- `/admin/applications`
- `/admin/packages`
- `/admin/billing`
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
