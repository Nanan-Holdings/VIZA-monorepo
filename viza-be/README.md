# VIZA Backend

This directory owns the backend services that power the VIZA portal: AI visa
chat, RAG retrieval, dynamic form APIs, submission queue automation, and Travel
AI itinerary generation.

Source baseline: **2026-09-13**. Runtime defaults below are not evidence of
production enablement. The Next.js portal also owns backend routes; it is not
just a proxy to these services. See the [root architecture](../README.md).

## Services

```text
viza-be/
  agent-backend/       Express + Socket.IO + Drizzle + Supabase, default port 3002
  submission-service/  Node/TypeScript Playwright worker for official form automation
  travel-service/      Python FastAPI travel planner, default port 8000
  email-worker/        Cloudflare Email Routing, R2 ingestion and forwarding
  resilience-worker/   Cloudflare encrypted outbox, Durable Objects and Queues
```

Each service is independently runnable and has its own dependencies, scripts,
and environment file. Run commands from the service directory, not from
`viza-be`.

## Service Responsibilities

### `agent-backend`

The main AI and data service for visa assistance.

- Exposes Express REST endpoints under `/api/*`.
- Hosts Socket.IO namespace `/visa` for VIZA AI chat streaming.
- Persists chat sessions/messages in Supabase/Postgres.
- Retrieves RAG knowledge from `visa_documents` and `visa_chunks`.
- Uses OpenAI for the current Visa Chat, embeddings, field guidance and
  application semantic checks. Current chat has no LLM tool-call loop.
- Maintains durable conversation memory with a revision check and consults
  reviewed entry rules before composing source-grounded context.
- Builds dynamic guidance for form fields.
- Owns Drizzle migrations and seed/ingestion scripts for visa packages,
  `visa_form_fields`, and RAG chunks.

Default local URL: `http://localhost:3002`.

### `submission-service`

The browser automation worker.

- Consumes `runner_job` and product-specific `submission_queue` work through
  atomic claims, leases, startup drains and explicit wake requests.
- Dispatches multiple country-specific runners. Legacy queue consumers and
  individual live integrations have separate flags; there is no universal
  always-on 30-second queue polling contract.
- Supports DS-160 CEAC prefill and gated live submission. The live path can
  reach final sign/submit; code defaults remain `dry_run` and live disabled.
- Downloads uploaded documents from Supabase Storage.
- Persists submission or prefill metadata back to Supabase.
- Sends failure alerts through Resend when configured.

`src/health-server.ts` exposes health/readiness and protected internal control
routes. `src/index.ts` coordinates work, heartbeats and shutdown. Fly deployments
use machine slots and conditional idle exit; consult the
[runner README](submission-service/README.md) for exact flags and topology.
Queue deduplication does not guarantee exactly-once official portal clicks.

### `travel-service`

The Python travel planning backend.

- Generates travel itineraries.
- Revises itineraries.
- Exposes an independent `/chat` API, but current Web conversation turns use
  Next `app/api/travel/chat/route.ts` directly, not this Python endpoint.
- Searches flight and hotel options through RapidAPI with fallbacks.
- Exports itinerary documents as Word or PDF.

Default local URL: `http://127.0.0.1:8000`.

Normal Web downstream calls use `/generate`, `/flight-options`,
`/hotel-options`, `/download-word` and `/download-pdf`. Revision uses the Next
OpenAI path when configured, otherwise its Python revision fallback. Python
provider estimates and deterministic itinerary fallbacks are not live offers.
The root `travel-agent/` LangGraph CLI is historical and is not started by the
current VIZA Web path. See the [Travel guide](../docs/travel-agent-development-guide.md).

### Cloudflare workers

- [email-worker](email-worker/README.md) archives inbound email in R2, records
  application-scoped metadata, forwards correspondence, and retries eligible
  failed forwarding from a scheduled handler.
- [resilience-worker](resilience-worker/README.md) accepts signed, encrypted
  continuity/outbox data and publishes opaque work pointers through Cloudflare
  Queues. Durable Objects maintain persistence, leases and concurrency state.
  The worker does not decrypt applicant payloads.

## Local Setup

### Agent Backend

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\agent-backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Install dependencies only when missing or intentionally changed.
npm install
npm run dev
```

Minimum environment:

```env
PORT=3002
CORS_ORIGINS=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
OPENAI_API_KEY=
```

Important notes:

- `getSupabaseClient()` in `src/db/supabase-client.ts` is the service-role
  Supabase client used by backend code.
- `DATABASE_URL` is required for Drizzle migrations and direct Postgres access.
- `OPENAI_API_KEY` enables current chat and other OpenAI paths as well as RAG
  embeddings. Missing embeddings can fall back to metadata-filtered chunks;
  this does not provide an offline substitute for LLM chat generation.
- Chat defaults to `gpt-4o-mini`; field guidance defaults to `gpt-5.5`.
  Consult `src/agent/index.ts` and `src/routes/field-guidance.routes.ts` for
  the separate model override chains.
- Google translation and Telegram integrations have separate optional settings.
  LangSmith configuration is not wired to the current Agent runtime. Do not
  treat historical provider examples as required chat configuration.
- Direct Postgres uses `src/db/connection-config.ts`: pool size defaults to 3,
  with a 2-second connection timeout. Production configuration verifies the
  intended Supabase transaction pooler/TLS and bounded database timeouts.

### Submission Service

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\submission-service
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run install-browsers
npm run dev
```

Environment:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
TWOCAPTCHA_API_KEY=
CEAC_LOCATION_CODE=NSS
```

`RESEND_API_KEY` and `TWOCAPTCHA_API_KEY` are optional for some local paths, but
official CEAC smoke/prefill work needs CAPTCHA support.

The sample is not a safe production enablement recipe. Before starting a
consumer, check the target database, pending work, live flags and product smoke
runbook. Browser startup can perform external work even though this guide is
only documentation.

### Travel Service

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-be\travel-service
if (!(Test-Path .env)) { Copy-Item .env.example .env }
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Environment:

```env
OPENAI_API_KEY=
RAPIDAPI_KEY=
RAPIDAPI_BOOKING_HOST=booking-com15.p.rapidapi.com
RAPIDAPI_BOOKING_BASE_URL=https://booking-com15.p.rapidapi.com
```

## Common Commands

### Agent Backend

Run from `viza-be/agent-backend`.

```powershell
npm run dev
npm run build
npm run start
npm run lint
npm run type-check
npm run test
npm run test:unit
npm run test:integration
npm run test:visa-agent-evals
npm run test:field-guidance-copilot
npm run db:migrate
npm run ingest:all-visa-rag
npm run ingest:country-visa-rag -- --country japan
npm run ingest:photo-requirements-rag
npm run seed:ds160-form-fields
```

### Submission Service

Run from `viza-be/submission-service`.

```powershell
npm run dev
npm run build
npm run start
npm run type-check
npm run install-browsers
```

### Travel Service

Run from `viza-be/travel-service` after activating `.venv`.

```powershell
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

There is currently no package-level type-check command for `travel-service`.
Use route smoke checks and focused Python execution when changing it.

## Integration Map

```text
Frontend /client/chat
  -> Socket.IO http://localhost:3002/visa
  -> agent-backend/src/socket/visa-namespace.ts
  -> agent-backend/src/agent/index.ts
  -> Supabase visa_chat_sessions, visa_chat_messages, visa_chunks

Frontend /client/application
  -> Next server actions for draft apps and answers
  -> Next Form Assistant / OCR / payment API routes
  -> agent-backend REST endpoints for validation, translations, field guidance
  -> Supabase applications, visa_application_answers, application_documents
  -> runner_job or product-specific submission_queue for automation handoff

submission-service
  -> startup drain / authenticated wake / atomic queue claim
  -> loads application/profile/documents from Supabase
  -> fills official portals with Playwright
  -> writes submission metadata and queue status

Frontend /client/travel-chat
  -> Next /api/travel/chat -> OpenAI Responses -> versioned state RPC
  -> Next itinerary / search / export routes
  -> travel-service /generate, /flight-options, /hotel-options, export routes
```

## Data Ownership

- Drizzle schema: `agent-backend/src/db/schema.ts`.
- SQL migrations: `agent-backend/drizzle/*.sql`.
- Visa form seed scripts: `agent-backend/scripts/seed-*-form-fields.ts`.
- RAG country seed source files: `knowledge-base/visa-rag-seeds/countries/*.json`.
- Runtime RAG tables: `visa_documents` and `visa_chunks`.
- Submission queues: `runner_job` and `submission_queue`, plus their lease,
  machine-slot and product-specific state tables.
- Travel conversation: `travel_agent_sessions`, `travel_agent_messages`,
  `travel_user_preferences`; `commit_travel_agent_turn` saves each turn atomically.
- Visa conversation: `visa_chat_sessions` and `visa_chat_messages`, including
  `memory_json` / `memory_revision` rather than a framework checkpoint.

When adding a country or visa type, update both frontend destination metadata and
backend registries/seeds where applicable.

## Reliability, authorization and evidence boundaries

- RAG is OpenAI `text-embedding-3-small` plus pgvector `vector(1536)`, cosine
  retrieval and active-release filtering. Current parameter decisions and
  rejected experiments are in the [retrieval study](agent-backend/evals/README.md).
  Successful vector queries with no qualifying matches return an empty result;
  unordered REST fallback is reserved for provider/vector-request failures.
- `src/socket/chat-concurrency.ts` and `src/utils/provider-capacity.ts` bound
  process-local work. Defaults are chat concurrency 16/queue 64 and non-chat
  concurrency 8/queue 32. They are not distributed provider quotas.
- `src/socket/socket-scaling.ts` implements the Redis adapter behind
  `SOCKET_IO_MULTI_REPLICA_ENABLED=true`; default mode uses a memory adapter.
- Authentication is route-specific. Supabase RLS does not replace ownership
  checks when a handler uses the service-role client. The current legacy
  validation/translation handlers and Socket identity/room payloads do not have
  uniform token-to-owner enforcement; do not infer a global auth gate from CORS.
- `src/utils/logger.ts`, DB/RAG/runtime diagnostics and persisted business
  events provide logs and local measurements. Optional Sentry bootstrap and
  LangSmith config are not proof of operational end-to-end tracing or a shared
  LLM token/cost ledger.
- The fixed Indonesia application validator, entry-rule service and field
  checks provide scoped business validation, not comprehensive legal or
  sentence-by-sentence factual verification.
- Local capacity tooling and reports exist, but the latest related 100-session
  report does not establish successful capacity acceptance or production p95.
  See the [capacity investigation](../docs/infra/2026-09-11-100-session-backend-optimization-plan.md).

## Quality Checks

Run only for the packages you modify.

```powershell
cd viza-be\agent-backend
npm run type-check
npm run lint

cd ..\submission-service
npm run type-check
```

For backend behavior changes, add the closest smoke check:

- `GET http://localhost:3002/health` for agent-backend startup.
- `/client/chat` Socket.IO smoke from the frontend for chat changes.
- A focused `runner_job` or product-specific queue dry/local fixture for
  submission automation changes, using the actual configured transport.
- `POST http://127.0.0.1:8000/generate` for travel-service changes.

## Development Guardrails

- Do not use `any` in TypeScript changes.
- Keep Socket.IO namespace `/visa` and event contracts aligned with
  `viza-fe/internal-website/types/agent-test.ts`.
- Keep VIZA AI answers plain text by default; do not add Markdown formatting
  unless the user explicitly asks.
- Keep official submission behind the exact product's user action, entitlement,
  review and live gates. DS-160 live execution can submit; prefill-only paths
  stop at handoff. Never infer final approval enforcement from a config field
  alone, or treat a missing confirmation response as safe evidence to resubmit.
- Keep RAG grounded in official or authorized sources. Missing policy details
  should be surfaced as unknown, not invented.
- Never commit `.env` files or service-role keys.
