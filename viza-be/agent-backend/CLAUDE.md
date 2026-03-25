# Agent Backend - AI Collaborator Instructions

## Project Overview

VIZA Agent Backend — AI-powered assistant service for visa applicants navigating the application process. Uses Anthropic Claude SDK directly with streaming responses. Exposes REST and WebSocket APIs consumed by the VIZA frontend.

## Critical Rule: Read Progress Tracker Before Planning

**Before entering plan mode or starting any significant work, you MUST:**

1. Read `docs/PROGRESS.md` to understand:
   - Current active work and who owns it
   - Recently completed work (avoid duplicating effort)
   - Known issues and blockers
   - Current codemap and file structure

This ensures you have full context before planning changes.

## Critical Rule: Update Progress Tracker Before Pushing

**Before pushing any changes to git remote, you MUST:**

1. Update `docs/PROGRESS.md` with:
   - Move completed work to "Recently Completed" section
   - Update "Current Sprint / Active Work" if tasks changed
   - Update "Codemap" section if files were added/removed/renamed
   - Update "Last Updated" date and "Updated By" field

2. Include the PROGRESS.md update in your commit

This ensures all collaborators have visibility into project state and codebase structure.

## Key Architecture

- **No LangChain** — Uses Anthropic SDK directly
- **VisaAgent** (`src/agent/index.ts`) — Core streaming agent loop (to be implemented)
- **UserScopedToolRegistry** — Security layer enforcing user data isolation
- **Domain-Based Tools** — Organized by domain:
  - Conversation Domain: Sessions, messages, memory
  - Visa Domain: Applications, documents, submission queue, requirements lookup
  - Knowledge Domain: RAG pipeline over visa requirement documents

## Common Commands

```bash
npm run dev          # Start development server
npm run build        # Build TypeScript
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
npm run test         # Run tests
npm run db:migrate   # Run database migrations
```

## Code Conventions

- Use Drizzle ORM for database queries (`src/db/schema.ts` for table definitions)
- All tool operations must go through UserScopedToolRegistry
- Never hardcode user IDs — always inject from authenticated context
- Use structured logging via `src/utils/logger.ts`
- Mask PII in logs and traces via `src/utils/phi-masker.ts` (`maskPII`, `maskTraceMetadata`)

## File Locations

| What | Where |
|------|-------|
| Server entry point | `src/index.ts` |
| Express app setup | `src/app.ts` |
| Database schema | `src/db/schema.ts` |
| Database client (Drizzle) | `src/db/index.ts` |
| Supabase REST client | `src/db/supabase-client.ts` |
| Supabase adapter (FAQ ops) | `src/db/supabase-adapter.ts` |
| Admin routes | `src/routes/admin-reminders.routes.ts` |
| Cron routes | `src/routes/cron.routes.ts` |
| Error types | `src/utils/errors.ts` |
| Structured logger | `src/utils/logger.ts` |
| PII masking | `src/utils/phi-masker.ts` |
| PGMQ helpers | `src/utils/pgmq.helpers.ts` |
| LangSmith config | `src/config/langsmith.config.ts` |
| Architecture docs | `docs/architecture/` |
| Progress tracker | `docs/PROGRESS.md` |

## Database Schema (src/db/schema.ts)

Core tables:
- `applicant_profiles` — Personal details for each visa applicant
- `applications` — Visa application records
- `application_documents` — Uploaded supporting documents per application
- `submission_queue` — Automation submission tracking
- `visa_chat_sessions` — AI assistant conversation sessions
- `visa_chat_messages` — Messages within sessions
- `visa_documents` — Knowledge base source documents (scraped visa requirement pages)
- `visa_chunks` — Chunked knowledge base entries with pgvector embeddings

## Before You Push Checklist

- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] `docs/PROGRESS.md` is updated
- [ ] Commit message follows conventional commits format
