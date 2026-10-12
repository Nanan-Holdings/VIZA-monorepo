# VIZA Application Developer Guide

This guide explains where the application-form content lives and how the current form, RAG, and field-AI pieces connect.

Source baseline: **2026-09-13**. This is an implementation guide, not evidence
of production enablement or measured input-error reduction. Verify model
defaults, limits and confirmation gates at the owning entry point when changing
a workflow.

## Local Startup And Page Entry

Use the repository startup helper from the monorepo root. For manual Next.js
startup, use the app directory as shown below:

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
`http://localhost:3002`. Travel conversation turns run in Next.js with its own
OpenAI configuration; itinerary/search/export operations use the Python service:

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
- `viza-fe/internal-website/components/client/form-assistant/form-filling-assistant.tsx`
- `viza-fe/internal-website/components/application-steps/photo-upload-step.tsx`
- `viza-fe/internal-website/components/application-steps/dynamic-review-step.tsx`

Frontend supporting libraries and types:

- `viza-fe/internal-website/lib/ds160-translations.ts`
- `viza-fe/internal-website/lib/visa-destinations.ts`
- `viza-fe/internal-website/lib/visa-form-fields.ts`
- `viza-fe/internal-website/types/visa-form-fields.ts`
- `viza-fe/internal-website/types/field-guidance.ts`
- `viza-fe/internal-website/lib/form-assistant/service.ts`
- `viza-fe/internal-website/lib/form-assistant/server-context.ts`
- `viza-fe/internal-website/lib/form-assistant/knowledge.ts`
- `viza-fe/internal-website/lib/form-assistant/submission-readonly.ts`

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
- `viza-be/agent-backend/drizzle/0123_viza_knowledge_releases_and_chat_memory.sql`
  supersedes the original retrieval RPC with active-release filtering.
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
5. Each DB-driven field is rendered once in the selected interface language
   through `DynamicFormField`; its paired Chinese and English/official values
   remain synchronized in state.
6. Field values are stored in local step state, then persisted to application answer rows when the user continues.
7. Team management (when applicable) is followed by one final Review Application
   step. Before submission, English/official values can be corrected with typed
   controls while preserving Chinese values. The step combines missing-field
   checks, confirmation/submission controls and result state; successful
   submitted applications are read-only.

## Bilingual Form Contract

`DynamicStepForm` is the owner of the bilingual form behavior.

Rules:

- entry renders only the selected interface language
- text-like fields keep a hidden `{ zh, en }` pair; Chinese edits update the
  English/official value through deterministic or realtime translation
- English-interface edits preserve the stored Chinese value
- non-text fields share one canonical answer across both languages
- date, country, select, radio, and checkbox values do not diverge by language
- Chinese-mode final review shows paired Chinese and English/official labels
  and values; entry steps never show the two columns side by side

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
- Public field guidance uses `src/routes/field-guidance-cache.ts`, with country,
  visa type, field and locale in the cache identity. The bounded single-flight
  cache holds at most 256 entries for 15 minutes. Applicant answers and
  personalized follow-up replies are not shared cache entries.
- Initial guidance is cached per field, but follow-up questions are not treated
  as generic field help. When a user asks about the current question, the
  backend builds a question-specific RAG query from the field label, field name,
  current answer, user question, and relevant answers already on the form. For
  select/radio/country fields, it also compares the user's text against the
  exact official options and passes that option context to OpenAI. If an address
  or answer clearly matches one option, the copilot should state that option
  directly before adding caveats.
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

Field guidance defaults to `gpt-5.5` (environment overrides apply), with
structured output limits of 500 tokens for cards and 700 for replies. Context
is bounded to five 1,200-character chunks or three 900-character chunks for
those respective paths. Current retrieval uses `text-embedding-3-small`, 1536
dimensions. Field guidance explicitly keeps its baseline top-k 5 and threshold
0.03 because these augmented queries and truncated contexts need a separate
evaluation from Chat; see the [retrieval study](../../viza-be/agent-backend/evals/README.md).
Active documents and releases are required. Successful vector queries with no
qualifying match stay empty; provider/vector failures may use filtered REST,
which is not a reranker or hybrid search.

## Form-filling assistant

The application-level form-filling assistant supports DB-driven schemas,
subject to the route's `FORM_ASSISTANT_ENABLED` and visa-type checks.
Legacy/fallback forms without a DB schema and status-only views do not render an
empty assistant. Saved conversations remain readable after successful
submission, but `lib/form-assistant/submission-readonly.ts` locks answer, confirmation, document,
validation and voice mutations; the ordinary form is not always editable.

The authenticated routes live under
`/api/applications/[id]/form-assistant`: state/session GET, conversational
turns, audio transcription, deterministic validation, warning acknowledgement,
and owned-document extraction. Every route verifies application ownership.
Sessions and sent messages are stored in `form_assistant_sessions` and
`form_assistant_messages`; raw microphone audio is memory-only and only the
user-confirmed transcript is saved as a message.

Natural-language answers are normalized into official form values. Prompts,
knowledge and sources are always bound to the owned application's exact
`country + visaType`; SGAC's ICA fallback source is never reused for another
product. For SGAC,
relative dates use `Asia/Singapore` as the reference time zone, localized date
phrases are converted to `YYYY-MM-DD`, and Chinese/English option labels map to
the exact official option value. Hierarchical city/port options also accept a
unique natural-language leaf such as `长沙` or `Changsha`; ambiguous place
names are not guessed. Current-field prompts use supportive, conversational
wording and include reviewed choices or examples where useful. A successful
write shows a viewport-level localized notice with the field value and a
conflict-safe Undo action; the notice disappears after 10 seconds, and an old
notice timer cannot dismiss a newer notice.

The server recalculates visible missing fields on every turn. It reads saved
application answers first and asks exactly one current field question. It may
extract multiple facts volunteered in one answer, but only applies
high-confidence values that match the active schema. Assistant
writes use `source=form_assistant` plus provenance in `source_metadata`.
Manual form saves use `source=user_form` and clear earlier AI provenance.
Assistant writes re-read answers and skip detected conflicts with newer manual
edits. The assistant never writes Universal Profile data.

`proposeTurn` defaults to OpenAI `gpt-5.5`, with DeepSeek `deepseek-chat` as a
separately configured fallback. Messages are capped at 4,000 characters, provider
requests at 18 seconds and generated output at 1,000 tokens. OpenAI uses strict
JSON Schema; DeepSeek requests a JSON object and still passes through local
validation. The route limits each user to 30 turns/minute using process-local
memory. Simple yes/no, reviewed options and unambiguous dates are resolved
before model extraction.

This is a schema-driven workflow with LLM proposals, not an autonomous tool
loop. `validateProposal` filters fields, values, exact options and confidence;
corrections, clarifications and legal confirmations use explicit branches.
Messages use `(session_id, idempotency_key, role)` upsert deduplication. Session
`state_version` is written from `Date.now()` without Travel's atomic
expected-version RPC. Re-reading answers and skipping detected conflicts does
not establish one transaction across answer, message and session writes.

SGAC has an empty document-requirement manifest, so its assistant does not ask
for uploads. The country-neutral document extraction policy is deny-by-default
and limits each document type to approved field categories. Documents are read
only from the application's private Storage record; external URLs are not
accepted.

Final checking combines schema-required/conditional rules, exact options,
patterns and date consistency. SGAC also checks arrival/departure ordering,
passport validity at arrival, and surfaces ICA's three-day submission window
as an acknowledgeable warning. Passing this check only navigates to the
existing Review step; it never triggers official submission. Review editing is
allowed before success and locked after successful submission.

The backend's separate `viza-be/agent-backend/src/routes/validate-application.ts` contains fixed Indonesia
B211A/C1 checks plus optional RAG/LLM semantic checking. It is not the universal
cross-country validator. Neither it nor source citations establish complete
legal compliance or sentence-by-sentence factual validation. Legacy backend
validation/translation handlers also lack uniform authentication/ownership
enforcement; service-role access must not be assumed safe because RLS exists
elsewhere.

## OCR And Payment Boundaries

- `app/api/passport-ocr/route.ts` verifies an owned document, records an OCR
  extraction and returns `proposedFields` with `needsConfirmation: true`.
  This frontend path defaults to `gpt-4o`, with `gpt-4o-mini` fallback, a 10 MiB
  upload limit, four concurrent extractions per process and a 45-second provider
  timeout. `PASSPORT_OCR_MAX_FILE_BYTES` can override the upload limit;
  `PASSPORT_OCR_MAX_CONCURRENCY` can override concurrency up to 16. The route also
  accepts the supported national-identity-card document categories. The backend
  passport-scan API has separate defaults.
- Translation records and frontend translation routes support bilingual
  review/correction. Exact official options and identity/date fields must not
  be rewritten as unconstrained translated prose.
- `lib/checkout/payment-provisioning.ts` persists resumable commercial-payment
  work for user/profile/application, inbox and official-fee allocation. Its
  completion does not enqueue browser submission. Explicit review/submit,
  consent and submission entitlements are separate gates.
- `app/api/external-submission/route.ts` ingests externally produced status and
  results; it does not dispatch CEAC. Application, event and notification writes
  are separate, so partial failure is possible.

## RAG Source Content

Country-level RAG content lives in `knowledge-base/visa-rag-seeds/countries/*.json`.

Each country seed should contain:

- country identifier
- visa type coverage
- official or authorized source URLs
- requirements/process chunks
- `documentType: "form_requirements"` documents for the covered visa products
- the shared `standard_passport_identity_field_rules` chunk inside that
  `form_requirements` document
- the source-crawled `official_field_answer_norms` chunk inside that
  `form_requirements` document when official/authorized source pages contain
  field-answer evidence
- photo requirements when available, usually through the photo ingestion script

The shared runtime store is:

- `visa_documents`: document metadata and source URLs
- `visa_chunks`: chunk text, country, visa type, document type, and embedding

The main ingestion script consumes pre-authored JSON chunks; there is no
universal fixed token size or overlap. Knowledge release status and promotion
checks control visibility. See the
[RAG seed guide](../../knowledge-base/visa-rag-seeds/README.md) for staging,
promotion and supplement ingestion.

Ingestion commands from `viza-be/agent-backend`:

```bash
npm run ingest:all-visa-rag
npm run ingest:country-visa-rag -- --country japan
npm run ingest:country-visa-rag -- --countries japan,us,indonesia
npm run ingest:photo-requirements-rag
npm run enrich:field-answer-norms-rag -- --all
```

## Adding A New Country Form

1. Add or update the country RAG seed in `knowledge-base/visa-rag-seeds/countries`.
2. Add or update visa destination metadata in `viza-fe/internal-website/lib/visa-destinations.ts` and backend registry if chat routing needs it.
3. Add `visa_form_fields` seed data for the new country/visa type.
4. Run the appropriate backend seed/ingestion scripts.
5. Verify the home card appears in sorted destination lists.
6. Verify `/client/application?country=<country>&visaType=<visaType>` loads the correct draft flow.
7. Check bilingual labels, placeholders, options, photo guidance, review output, and field AI.

## Cross-form assistant answer review

Every DB-driven application schema participates in the shared form-assistant
review flow; country pages must not implement their own issue navigation.

- A validation error or warning is mapped to its canonical `fieldName` and
  displayed with the complete original question and control inside the
  assistant conversation.
- Each issue offers a second path to the original form field. Original fields
  remain highlighted and expose a next-issue action; the last issue returns to
  the assistant so the applicant can run **Review final answers** again.
- Final review highlights the same question and answer. Before success, its
  official-value editors preserve the same canonical value contract as the
  assistant and original form; successful submission makes these read-only.
- Manual form users get a return-to-assistant review action when deterministic
  required-field completion is reached.
- Any edit after validation marks that result stale. Final-review navigation is
  disabled and stale issues are removed from both surfaces while the latest
  draft is saved and revalidated automatically. The refreshed result replaces
  the assistant and form issue maps together, including new cross-field issues;
  warnings still require the normal explicit acknowledgement flow.
- Assistant completion progress is derived from the current merged form draft,
  so manual, AI, and undo edits update it without waiting for another assistant
  response. Vietnam Pre-Arrival's controlled date radios display the official
  `DD/MM/YYYY` label while storing the canonical ISO date, and remote official
  selects must not be checked against an incomplete static fallback option list.
- Issue ordering comes from the shared schema display order in
  `lib/form-assistant/review-issues.ts`, including repeat-instance answer keys.

## Design Guardrails

- Match the homepage content width. The current rhythm is `max-w-[1090px]`.
- Keep form layout responsive. Desktop uses sidebar plus form content; mobile stacks steps and form.
- Do not add decorative nested cards or section header table rows inside the form body.
- Keep the outer form card clean and use spacing rather than extra internal borders.
- Use explicit buttons for AI. Field focus should not open AI guidance.
- Before submission, render every English/official review value in a bordered
  editor. Preserve `_zh` when English text changes, save the canonical value and
  `_en`, and use typed date/option controls so official codes remain valid.
  Successful submitted applications keep review read-only.

## Universal Profile reuse

Universal Profile uses two compatible layers:

- `applicant_profiles` keeps the core identity, passport, contact, and OCR
  fields used by existing flows.
- `universal_profile_answers` stores reusable facts by canonical field key,
  including bilingual values, the source application/visa type, and the field
  schema that produced the answer.

On the final Review Application tab, the applicant can explicitly choose
**Update Universal Profile**. The server reads the saved application answers,
keeps stable identity/contact/passport/family/work/education and immigration
history facts, and excludes trip-specific plans, destination contacts,
declarations, payment data, CAPTCHA/session data, and secrets. Future forms use
these records only as non-overwriting prefill: an application-specific saved
answer always wins.

`/client/universal-info` builds its extended sections from the union of current
`visa_form_fields` schemas. Saved values use the same read-only row treatment as
Review Application, while missing values use the canonical application form
controls. This lets new country schemas expand Universal Profile without adding
one database column per question.

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
- Chinese-side text edits update the English/official side, while English/official-side text edits do not overwrite Chinese text
- select/date/country controls stay synchronized
- `问 AI` opens only from the button
- AI guidance has no Markdown formatting artifacts
- photo upload copy is country-specific where RAG/source data exists
- review is complete; official-value corrections preserve Chinese values before
  submission, and successful submitted applications remain read-only

# Taiwan overseas-China tourist entry permit

`TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT` is a separate Taiwan product for Chinese mainland passport holders resident in Singapore who apply for tourism. It is not an arrival card. Its DB-driven form must keep synchronized Chinese/English values while showing one interface-language entry column, select exactly one Singapore eligibility route, collect the matching evidence, require a mainland passport with at least six months validity and a recent white-background photo, and obtain an explicit official-submission declaration. The submission runner uses a VIZA-managed alias at the NIA email-verification boundary; it must return a structured recon checkpoint until an authorized controlled session maps every post-verification official field. Never mark an application submitted merely because the email page loaded.
