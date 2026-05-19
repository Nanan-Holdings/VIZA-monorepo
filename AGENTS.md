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

## Completion Verification

Every user-facing feature or bug fix must be self-tested before reporting completion. Run the relevant automated checks and at least one route/component smoke test that exercises the changed behavior. If a full authenticated flow cannot be tested in the current environment, run the closest possible Playwright route smoke and clearly report the remaining authenticated/manual verification gap.

## Module AGENTS.md Maintenance

- When a module or major feature area is completed, create or update an `AGENTS.md` inside that module directory so future agents can continue safely from local context.
- Each module-level `AGENTS.md` must include the module scope, purpose, key flows, ownership boundaries, validation commands, and all related files with their repo-relative paths.
- At minimum, list every important source file, route, action/API handler, component, test, migration, seed/config file, and documentation file that the module depends on.
- Whenever a file is added, deleted, moved, or renamed, update the nearest relevant module-level `AGENTS.md` in the same change. If no module-level file exists yet and the change completes a coherent module, create it.
- Whenever a new important cross-module rule is introduced, update this root `AGENTS.md` and any affected module-level `AGENTS.md`.
- After finishing any user-facing feature, run automated checks plus Playwright or direct browser verification before reporting completion. If browser verification cannot cover the full authenticated flow, run the closest available route/component smoke and explicitly report the remaining gap.

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
