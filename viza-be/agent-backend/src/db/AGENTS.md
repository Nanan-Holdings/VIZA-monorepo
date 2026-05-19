# Agent Backend Database Guide

Scope: this file applies to `viza-be/agent-backend/src/db/**` and should be
read with `viza-be/agent-backend/drizzle/**`.

## Purpose

This module owns database connectivity, Drizzle schema types, migrations, and
Supabase service-role client setup for the agent backend.

## Key Files

- `schema.ts`: Drizzle table definitions and inferred TypeScript types.
- `index.ts`: direct Postgres/Drizzle connection using `DATABASE_URL`.
- `migrate.ts`: migration runner.
- `supabase-client.ts`: service-role Supabase client and connection check.
- `supabase-adapter.ts`: Supabase helper adapter for selected operations.
- `../../drizzle/*.sql`: sequential SQL migrations.

## Ownership Boundaries

- Keep SQL migrations sequentially numbered.
- Prefer idempotent migrations where possible.
- Update `schema.ts` when adding tables/columns used by TypeScript code.
- Use service-role clients only after authorization checks in route/action code.
- Do not put business logic in DB connection files.

## Validation

Run from `viza-be/agent-backend`:

```powershell
npm run type-check
npm run db:migrate
```

For schema changes, also run any affected route/eval tests.

## Related Tables

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
