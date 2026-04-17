# Ralph Agent Instructions - VIZA Monorepo

You are an autonomous coding agent working on the VIZA visa application platform.

## Your Task

1. Read the PRD at `prd.json` (in the repo root - this is the authoritative file)
2. Read `progress.txt` if it exists (check Codebase Patterns section first)
3. Pick the **highest priority** user story where `passes: false`
4. Implement that single user story
5. Run quality checks (typecheck, lint)
6. If checks pass, commit ALL changes with message: `feat(US-XXX): [Story Title]`
7. Update `prd.json` to set `passes: true` for the completed story
8. Append progress to `progress.txt`
9. If ALL stories pass: output `<promise>COMPLETE</promise>`

## Progress Report Format

APPEND to progress.txt (never replace):
```
## [Date] - [Story ID]
- What was implemented
- Files changed
- Learnings for future iterations
---
```

## Codebase Overview

**VIZA** is a visa application platform. Monorepo at `D:\Coding-Files\GitHub\VIZA-monorepo`.

```
viza-fe/internal-website/    - Next.js 16 App Router (client portal + admin)
viza-be/agent-backend/       - Express + Socket.IO (AI chat backend, port 3002)
viza-be/submission-service/  - Playwright DS-160 automation
```

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind, shadcn/ui, Supabase client
- **Backend**: Express, Socket.IO, Drizzle ORM, Supabase (postgres)
- **Auth**: Supabase Auth (JWT)
- **DB**: Supabase (PostgreSQL), Drizzle for migrations

## Quality Checks

Run from the relevant package directory:
```bash
# Frontend
cd viza-fe/internal-website && npm run type-check

# Backend
cd viza-be/agent-backend && npm run type-check

# Submission service
cd viza-be/submission-service && npm run type-check
```

Only run type-check for packages you modified. Do NOT run `npm install` unless a new dependency is required.

## Key Conventions

- Supabase service role client: use `getSupabaseClient()` from `src/db/supabase-client.ts` in agent-backend
- Frontend Supabase: use `createClient()` from `@/lib/supabase/client` (client-side) or `@/lib/supabase/server` (server-side)
- Admin operations: use `createAdminClient()` from `@/lib/supabase/admin`
- Socket.IO namespace: `/visa` - all chat events go through here
- Drizzle migrations: SQL files in `viza-be/agent-backend/drizzle/` - name sequentially (0008_, 0009_, etc.)
- Server actions: in `viza-fe/internal-website/app/actions/`
- No `any` types. No unused imports.
- Follow existing file/component patterns - look at neighbouring files before writing new ones

## Commit Format

feat(US-XXX): Story title
- What changed
- Why

## Stop Condition

If ALL stories in prd.json have `passes: true`, output exactly:
<promise>COMPLETE</promise>

Work on ONE story per iteration. Keep changes minimal and focused.
