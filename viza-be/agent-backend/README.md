# VIZA Agent Backend

Express + Socket.IO backend for VIZA AI, visa RAG retrieval, application form
guidance, translations, validation, Supabase data access, Drizzle migrations,
and country/form seed scripts.

Default local URL: `http://localhost:3002`.

## Responsibilities

- Serve REST APIs under `/api/*`.
- Serve Socket.IO namespace `/visa` for streaming VIZA AI chat.
- Persist VIZA chat sessions and messages.
- Retrieve official-source visa knowledge from `visa_documents` and
  `visa_chunks`.
- Maintain structured conversation state for compact follow-ups.
- Return field-level application guidance for dynamic visa forms.
- Translate and validate application answers.
- Own database schema, migrations, visa package seeds, form field seeds, and RAG
  ingestion scripts.

## Local Setup

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\agent-backend
npm install
npm run dev
```

The dev server loads `.env.local` first, then `.env`.

Minimum environment:

```env
PORT=3002
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
OPENAI_API_KEY=
# Required only when using application translation routes (one of these is enough).
GOOGLE_AI_API_KEY=
GOOGLE_TRANSLATE_API_KEY=
# Optional; only Telegram webhook/news-monitor paths need this.
TELEGRAM_BOT_TOKEN=
```

Notes:

- `OPENAI_API_KEY` powers VIZA chat, field guidance, application validation,
  passport OCR, and RAG embeddings. The chat default is `gpt-4o-mini`; field
  guidance defaults to `gpt-5.5`; validation defaults to `gpt-4o-mini`.
  The model override order is route-specific and uses the corresponding
  `OPENAI_*_MODEL`, then `OPENAI_CHAT_MODEL`, then `OPENAI_MODEL`.
- `GOOGLE_AI_API_KEY` or `GOOGLE_TRANSLATE_API_KEY` powers translation routes;
  neither is required for chat/RAG startup. `TELEGRAM_BOT_TOKEN` is optional
  and is used only by the Telegram webhook/news-monitor path.
- `LANGSMITH_API_KEY` is read by an unused configuration helper; the current
  chat/RAG paths do not create LangSmith runs. `SENTRY_DSN` enables the
  best-effort lazy Sentry initializer when the optional `@sentry/node`
  package is available.
- The chat OpenAI client has `maxRetries=0` and a default request timeout of
  `60,000ms` (configurable by `OPENAI_REQUEST_TIMEOUT_MS`, clamped to
  `120,000ms`). Streaming has a separate default deadline of `75,000ms`,
  clamped to `180,000ms` by `OPENAI_STREAM_DEADLINE_MS`. Field-guidance and
  validation construct the OpenAI client without explicit retry/timeout
  options, so their SDK defaults apply; RAG embeddings use direct fetch and no
  application-level retry. All provider work is bounded by the gate below.
- `DATABASE_URL` is required for Drizzle and must use the Supabase transaction
  pooler at runtime. Direct database connections are operator-only for
  migrations and diagnostics. `DB_POOL_MAX` defaults to 3 per service instance
  (hard-clamped to 20); budget total connections against maximum instances.
  Production additionally requires the VIZA project's approved Mumbai shared
  pooler `aws-1-ap-south-1.pooler.supabase.com:6543` (or its project-scoped
  dedicated pooler), with no URL options and the `/postgres` database. Before
  deployment, the database
  `postgres` role must default `statement_timeout` and
  `idle_in_transaction_session_timeout` to positive values no greater than 30
  seconds; startup verifies both across three concurrent fresh connections,
  closes the sampling clients, and refuses readiness if any sample differs.
  The matching `DB_STATEMENT_TIMEOUT_MS` and
  `DB_IDLE_IN_TRANSACTION_TIMEOUT_MS` values are maximum expectations, not
  pooler session settings.
  `application_name=viza-agent-backend` is sent only as best-effort
  observability metadata and is never used as a security or readiness guard.
- `NEXT_PUBLIC_SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` are required for
  Supabase service-role operations.

## Commands

```powershell
npm run dev                         # tsx watch src/index.ts
npm run build                       # tsc
npm run start                       # node dist/index.js
npm run lint                        # ESLint
npm run type-check                  # tsc --noEmit
npm run prep                        # lint + type-check
npm run test                        # Vitest
npm run test:unit
npm run test:integration
npm run test:visa-agent-evals
npm run test:field-guidance-copilot
npm run load:concurrency
npm run load:online-capacity
npm run load:local-rls
npm run db:migrate
npm run ingest:all-visa-rag
npm run ingest:country-visa-rag -- --country japan
npm run ingest:photo-requirements-rag
npm run seed:ds160-form-fields
```

## Runtime Map

```text
src/index.ts
  -> loads env
  -> creates HTTP server
  -> attaches Socket.IO
  -> registers /visa namespace
  -> checks Supabase connection

src/app.ts
  -> configures Express, CORS, JSON parsing
  -> mounts REST routes
  -> installs error handler

src/socket/visa-namespace.ts
  -> handles visa_chat_message
  -> persists chat history
  -> loads application context
  -> updates conversation state
  -> retrieves RAG chunks
  -> emits application redirect blocks when needed
  -> streams assistant tokens

src/agent/index.ts
  -> base system prompt
  -> application context builder
  -> OpenAI streaming helper (no model tools or tool loop)
```

## REST Endpoints

Mounted in `src/app.ts`:

- `GET /health`
- `/api/admin/reminders`
- `/webhook/telegram`
- `/api/validate-application`
- `/api/field-guidance`
- `/api/chat/save-block`
- `/api/user/package`
- `/api/applications`
- `/api/profile/prefill`
- `/api/public/status` and secret-protected `/api/internal/status`

## Database And RAG

Important files:

- `src/db/schema.ts`: Drizzle schema and table types.
- `src/db/index.ts`: Drizzle/Postgres connection.
- `src/db/migrate.ts`: migration runner.
- `src/db/supabase-client.ts`: service-role Supabase client.
- `drizzle/*.sql`: sequential migrations.
- `src/services/visa-knowledge.service.ts`: embeddings and vector retrieval.
- `src/config/visa-destination-registry.ts`: country aliases, supported
  visitor visa types, Schengen membership, and RAG routing metadata.
- `scripts/ingest-country-visa-rag.ts`: country seed ingestion.
- `scripts/ingest-photo-requirements-rag.ts`: photo requirements ingestion.
- `scripts/enrich-field-answer-norms-rag.ts`: optional official-URL enrichment
  of JSON seed chunks.
- `scripts/stage-visa-knowledge-supplements.ts` and
  `scripts/promote-visa-knowledge-release.ts`: staged release governance.
- `scripts/seed-*-form-fields.ts`: dynamic form field seed scripts.

Runtime tables include:

- `applicant_profiles`
- `applications`
- `application_documents`
- `submission_queue`
- `visa_chat_sessions`
- `visa_chat_messages`
- `visa_documents`
- `visa_chunks`
- `visa_form_fields`
- `visa_packages`
- `user_packages`
- `visa_application_answers`
- `application_translations`

The current repository contains 61 country seed files, 159 seed documents and
559 seed chunks (including 70 `form_requirements` documents). The backend
registry contains 61 destinations, while `VISA_SERVICE_COUNTRIES` currently
opens 56 of them; `mexico`, `morocco`, `nepal`, `qatar`, and `russia` remain
dormant reference seeds. These are repository inventory counts, not a claim
about the contents of a deployed database.

RAG runtime uses `text-embedding-3-small` with 1536-dimensional vectors. The
request default is top-k 5, clamped to 1..12, and runtime `minSimilarity`
defaults to 0.03. The SQL RPC itself has a 0.5 default, but the service passes
0.03 explicitly. It first tries intent-filtered `match_visa_chunks()` vector
search, then a broader vector query when intent document types have no match,
then active-release country/visa/document filters through REST. The REST
fallback has no similarity ordering or reranker; it returns the limited rows
from the filtered query. There is no generic runtime chunker, fixed chunk size,
or overlap: JSON seed chunks are ingested as supplied and embedding input is
truncated to 8,000 characters.

The SQL release gate requires active release metadata, chunks, embeddings,
official-source reachability and reviewed entry-rule coverage before promotion.
`visa-entry-rule.service.ts`
decides deterministic eligibility/routing before RAG; RAG must not override an
unknown or conditional entry-rule result. `/api/validate-application` is a
local Indonesia B211A/C1 validation path with hard checks plus optional
structured OpenAI review and fixed Indonesia knowledge context, not a generic
cross-country contextual validator. `/api/field-guidance` combines metadata
checks, public RAG and optional structured OpenAI guidance; translation is a
separate Google `zh` to `en` batch route.

## Frontend Contracts

The frontend expects:

- Socket.IO namespace `/visa`.
- Chat events compatible with
  `viza-fe/internal-website/types/agent-test.ts`.
- Field guidance response compatible with
  `viza-fe/internal-website/types/field-guidance.ts`.
- Application redirect blocks that send users to
  `/client/application?country=...&visaType=...`.
- Plain-text VIZA AI answers by default.

## Guardrails

- Do not default unknown destination questions to Indonesia or any other
  country.
- Do not collect detailed application form fields in chat; redirect to the form.
- Do not fabricate visa requirements, fees, or timelines.
- Keep hidden chat system marker rows hidden from users and LLM context.
- Do not log PII, service-role keys, API keys, or full raw applicant payloads.
- Keep browser automation in `viza-be/submission-service`.

The current Express app has no global authentication middleware. The AI,
field-guidance, validation and translation routes are mounted directly, and
the `/visa` Socket.IO handler currently trusts the `user_id` and `session_id`
payload; it does not verify a Supabase bearer token or session ownership.
Applicant ownership checks are implemented separately on selected appointment,
fee and submission routes. Direct exposure of the AI routes therefore requires
a trusted server-side proxy or external perimeter that both authenticates the
caller and checks applicant/session ownership before forwarding; a frontend
login state by itself does not protect the backend.

Non-chat provider calls share an instance-local FIFO gate with defaults of
8 active calls, 32 queued calls, a 5,000ms queue timeout and a 60,000ms
execution timeout (each is environment-configurable within code clamps).
Chat has its separate 16-active/64-queued/8,000ms-turn gate. Capacity and RAG
metrics are aggregate-only; `/api/internal/status/capacity` requires its own
`CAPACITY_STATUS_SECRET`. Sentry initialization is optional and best effort;
LangSmith configuration exists but is not connected to these runtime paths.

## Validation

```powershell
npm run type-check
npm run lint
npm run test
```

Focused validations:

```powershell
npm run test:visa-agent-evals
npm run test:field-guidance-copilot
```

Smoke:

```powershell
Invoke-RestMethod http://localhost:3002/health
```

For Socket.IO changes, run the frontend and smoke `/client/chat`. A passing
local type-check, smoke or capacity harness does not certify production AI
provider, authenticated route, RAG release, or multi-replica capacity.

## Related Docs

- `viza-be/README.md`
- `viza-be/agent-backend/AGENTS.md`
- `docs/viza-ai-chat-development-guide.md`
- `docs/application/DG.md`
- `docs/visa-schema-playbook.md`
- `knowledge-base/visa-rag-seeds/README.md`
