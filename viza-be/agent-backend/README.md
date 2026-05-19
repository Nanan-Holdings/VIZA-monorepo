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
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
LANGSMITH_API_KEY=
TELEGRAM_BOT_TOKEN=
```

Notes:

- `ANTHROPIC_API_KEY` powers streaming VIZA AI and AI-backed field guidance.
- `OPENAI_API_KEY` powers embeddings for RAG retrieval.
- `GOOGLE_AI_API_KEY` or `GOOGLE_TRANSLATE_API_KEY` powers translation routes.
- `DATABASE_URL` is required for Drizzle direct Postgres access.
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
  -> Anthropic streaming helper
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

For Socket.IO changes, run the frontend and smoke `/client/chat`.

## Related Docs

- `viza-be/README.md`
- `viza-be/agent-backend/AGENTS.md`
- `docs/viza-ai-chat-development-guide.md`
- `docs/application/DG.md`
- `docs/visa-schema-playbook.md`
- `knowledge-base/visa-rag-seeds/README.md`
