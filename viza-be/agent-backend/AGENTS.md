# Agent Backend Agent Guide

Scope: this file applies to `viza-be/agent-backend/**`.

## Purpose

`agent-backend` is the main AI and data backend for VIZA. It serves Express REST
routes, Socket.IO streaming chat, RAG retrieval, field guidance, application
translation/validation, Supabase service-role access, Drizzle migrations, and
form/RAG seed scripts.

OpenAI is the backend AI provider for chat generation, field guidance,
application semantic validation, passport OCR, and embeddings. Keep
`OPENAI_API_KEY` as the single model-provider key unless a future task
explicitly reintroduces another provider.

## Key Flows

- Startup: `src/index.ts` loads `.env`, creates HTTP server, attaches Socket.IO,
  registers `/visa`, and checks Supabase.
- Express app: `src/app.ts` mounts REST routes and error handling.
- VIZA AI chat: `src/socket/visa-namespace.ts` plus `src/agent/index.ts`.
- RAG retrieval: `src/services/visa-knowledge.service.ts`,
  `src/config/visa-destination-registry.ts`, and `visa_chunks`.
- Conversation state: `src/services/visa-conversation-state.service.ts`.
- Field guidance: `src/routes/field-guidance.routes.ts`.
- Application translation/validation: `src/routes/translation.routes.ts` and
  `src/routes/validate-application.ts`.
- Website internal automation: `src/routes/internal-automation/**`,
  `src/services/internal-automation/**`, `src/db/schema.ts`, and
  `drizzle/0013_internal_automation_loop.sql`.
- Official visa fee payment framework: `src/routes/official-fee.routes.ts`,
  `src/services/official-fee/**`, `src/db/schema.ts`, and
  `drizzle/0089_official_fee_payment.sql`. Dry-run/manual-review only unless
  a future task explicitly enables provider-approved live payment.
- U.S. B1/B2 appointment assistant: `src/routes/us-appointment.routes.ts`,
  `src/services/us-appointment/**`, `src/db/schema.ts`, and
  `drizzle/0091_us_appointment_assistant.sql`. Dry-run/manual-checkpoint only;
  assisted live providers are disabled scaffolds.
- DB schema and migrations: `src/db/schema.ts` and `drizzle/*.sql`.
- Seed/ingestion scripts: `scripts/*.ts`.
- Tests: `tests/setup.ts` plus the nearest test/module `AGENTS.md`.

## Ownership Boundaries

- Use `getSupabaseClient()` from `src/db/supabase-client.ts` for service-role
  Supabase access.
- Keep Socket.IO namespace `/visa` stable.
- Keep user-facing AI answers plain text by default.
- RAG claims must come from official/authorized seed sources or be framed as
  uncertain.
- Do not move browser automation into this service; official portal automation,
  CAPTCHA handling, proxy/fingerprint handling, and runner artifacts belong
  outside this website automation scope. The U.S. appointment assistant may
  model checkpoint state, but must not bypass login, CAPTCHA, MFA/email,
  payment, waiting-room, rate-limit, or final-confirmation controls.
- Do not move frontend route logic here; Next.js route/UI code belongs in
  `viza-fe/internal-website`.

## Validation

Run from this directory:

```powershell
npm run type-check
npm run lint
npm run test
```

Focused checks:

```powershell
npm run test:visa-agent-evals
npm run test:field-guidance-copilot
npm run db:migrate
```

Smoke `GET /health` after startup and `/client/chat` after Socket.IO changes.

## Important Files

- `package.json`
- `src/index.ts`
- `src/app.ts`
- `src/agent/index.ts`
- `src/socket/visa-namespace.ts`
- `src/db/schema.ts`
- `src/db/supabase-client.ts`
- `src/routes/internal-automation/*`
- `src/routes/official-fee.routes.ts`
- `src/routes/us-appointment.routes.ts`
- `src/services/internal-automation/*`
- `src/services/official-fee/*`
- `src/services/us-appointment/*`
- `src/services/visa-knowledge.service.ts`
- `src/services/visa-conversation-state.service.ts`
- `src/config/visa-destination-registry.ts`
- `src/routes/*`
- `scripts/ingest-country-visa-rag.ts`
- `scripts/ingest-photo-requirements-rag.ts`
- `scripts/import-geonames-destinations.ts`
- `scripts/import-geonames-aliases.ts`
- `scripts/enrich-destinations-wikidata.ts`
- `scripts/recalculate-destination-popularity.ts`
- `scripts/seed-*-form-fields.ts`
- `tests/setup.ts`
- `drizzle/*.sql`
