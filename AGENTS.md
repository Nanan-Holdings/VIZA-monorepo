# VIZA Monorepo Agent Guide

Scope: this file applies to the whole repository.

## Project

VIZA is a visa application platform. It combines an applicant portal, admin
portal, AI visa assistant, official-source RAG knowledge, dynamic visa forms,
browser automation for official submissions, and a Travel AI planner.

Current workspace:

```text
D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo
```

## Local Test Admin

Use this admin account for local portal smoke testing:

```text
Email: admin@viza.test
Login URL: http://127.0.0.1:3000/admin/login
```

Do not store the plaintext admin password in this repo guide. To reset the
local test password before a test run:

```powershell
cd viza-fe\internal-website
npm run init:admin -- --email admin@viza.test --password "<temporary-password>"
```

## Local Test Client

Use this client account for local applicant portal smoke testing when a test
session needs an existing user:

```text
Email: czz19974931995@gmail.com
Login URL: http://127.0.0.1:3000/client/login
```

Do not store the plaintext client password in this repo guide. Use the password
provided out-of-band for the current test run, or reset the local test password
before testing if needed.

## Repository Map

```text
viza-fe/
  internal-website/       Next.js 16 app: client portal, admin portal, forms,
                          VIZA AI chat, Travel AI UI

viza-be/
  agent-backend/          Express + Socket.IO + Drizzle + Supabase service,
                          VIZA AI, RAG, field guidance, seeds/migrations
  submission-service/     Playwright worker for e-visa and DS-160 CEAC prefill
  travel-service/         Python FastAPI travel planner and export service

knowledge-base/
  visa-rag-seeds/         Country-level visa RAG source JSON files

docs/                     PRDs, developer guides, user guides, gap reports,
                          schema playbook, Travel/VIZA AI docs

shared/                   Shared placeholder/types area
scripts/                  Local runners, Ralph runner, Playwright smoke scripts
prd.json                  Current PRD/story queue for autonomous story work
progress.txt              Append-only implementation log
```

## Source Of Truth

Read the nearest source before making changes:

- Frontend overview: `viza-fe/README.md`
- Backend overview: `viza-be/README.md`
- Client UI rules: `viza-fe/internal-website/frontend.md`
- Application forms: `docs/application/DG.md`
- VIZA AI chat: `docs/viza-ai-chat-development-guide.md`
- Travel AI: `docs/travel-agent-development-guide.md`
- Website internal automation: `docs/internal-automation/AGENTS.md`
- Visa schema process: `docs/visa-schema-playbook.md`
- RAG seeds: `knowledge-base/visa-rag-seeds/README.md`
- Product/story queue: `prd.json`
- Build/progress history: `progress.txt`

Prefer code and current module `AGENTS.md` files over stale comments or old
README sections when they conflict.

## Work Modes

### Direct User Request

If the user asks for a specific change, do that change. Keep edits scoped, read
the relevant code first, and update docs/AGENTS when the module map changes.

### PRD Story Queue

When explicitly working the PRD queue/Ralph workflow:

1. Read `prd.json` in the repo root.
2. Read `progress.txt` if it exists, especially recent learnings.
3. Pick the highest-priority user story with `passes: false`.
4. Implement one story only.
5. Run quality checks for modified packages.
6. If checks pass, update `prd.json` to set that story `passes: true`.
7. Append to `progress.txt`.
8. Commit all intended changes with `feat(US-XXX): Story Title` if the task
   requires a Ralph-style commit.
9. If all stories pass, output exactly `<promise>COMPLETE</promise>`.

Progress format:

```text
## YYYY-MM-DD - STORY-ID
- What was implemented
- Files changed
- Learnings for future iterations
---
```

## Module AGENTS

Read the closest `AGENTS.md` before changing a module. Important current module
guides include:

- `viza-fe/AGENTS.md`
- `viza-fe/internal-website/AGENTS.md`
- `viza-fe/internal-website/app/client/AGENTS.md`
- `viza-fe/internal-website/app/client/application/AGENTS.md`
- `viza-fe/internal-website/app/client/billing/AGENTS.md`
- `viza-fe/internal-website/app/client/chat/AGENTS.md`
- `viza-fe/internal-website/app/client/checkout/AGENTS.md`
- `viza-fe/internal-website/app/client/consent/AGENTS.md`
- `viza-fe/internal-website/app/client/documents/AGENTS.md`
- `viza-fe/internal-website/app/client/settings/AGENTS.md`
- `viza-fe/internal-website/app/client/status/AGENTS.md`
- `viza-fe/internal-website/app/client/support/AGENTS.md`
- `viza-fe/internal-website/app/admin/AGENTS.md`
- `viza-fe/internal-website/app/admin/(dashboard)/applications/AGENTS.md`
- `viza-fe/internal-website/app/admin/(dashboard)/billing/AGENTS.md`
- `viza-fe/internal-website/app/admin/(dashboard)/packages/AGENTS.md`
- `viza-fe/internal-website/app/actions/AGENTS.md`
- `viza-fe/internal-website/app/actions/internal-automation/AGENTS.md`
- `viza-fe/internal-website/app/api/external-submission/AGENTS.md`
- `viza-fe/internal-website/app/api/passport-ocr/AGENTS.md`
- `viza-fe/internal-website/app/api/stripe/AGENTS.md`
- `viza-fe/internal-website/app/api/travel/AGENTS.md`
- `viza-fe/internal-website/components/application-steps/AGENTS.md`
- `viza-fe/internal-website/components/client/companion/AGENTS.md`
- `viza-fe/internal-website/components/client/travel/AGENTS.md`
- `viza-fe/internal-website/components/ui/AGENTS.md`
- `viza-fe/internal-website/lib/travel/AGENTS.md`
- `viza-be/AGENTS.md`
- `viza-be/agent-backend/AGENTS.md`
- `viza-be/agent-backend/drizzle/AGENTS.md`
- `viza-be/agent-backend/src/db/AGENTS.md`
- `viza-be/agent-backend/src/routes/AGENTS.md`
- `viza-be/agent-backend/src/routes/internal-automation/AGENTS.md`
- `viza-be/agent-backend/src/socket/AGENTS.md`
- `viza-be/agent-backend/src/services/AGENTS.md`
- `viza-be/agent-backend/src/services/internal-automation/AGENTS.md`
- `viza-be/submission-service/AGENTS.md`
- `viza-be/submission-service/src/ceac/AGENTS.md`
- `viza-be/travel-service/AGENTS.md`
- `knowledge-base/AGENTS.md`
- `knowledge-base/visa-rag-seeds/AGENTS.md`
- `docs/AGENTS.md`
- `docs/internal-automation/AGENTS.md`
- `scripts/AGENTS.md`

When a file is added, deleted, moved, or renamed, update the nearest relevant
module `AGENTS.md`. If no module file exists and the change completes a coherent
module, create one.

## Quality Checks

Run checks only for packages you modify.

Frontend:

```powershell
cd viza-fe\internal-website
npm run type-check
npm run lint
```

Agent backend:

```powershell
cd viza-be\agent-backend
npm run type-check
npm run lint
```

Submission service:

```powershell
cd viza-be\submission-service
npm run type-check
```

Travel service:

```powershell
cd viza-be\travel-service
.\.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Then smoke the changed endpoint or frontend route. Docs-only changes usually do
not need type-checks.

## Required Smoke Testing

Every user-facing feature or bug fix needs at least one self-test beyond static
checks:

- Frontend UI: Playwright/browser route smoke at the changed route.
- Authenticated flows: test the closest available redirect or component state if
  no authenticated session is available, and report the gap.
- Chat changes: verify `/client/chat` and backend `/health` when possible.
- Travel changes: verify `/client/travel-chat` or a direct `/api/travel/*`
  request with `travel-service` running.
- Submission/CEAC changes: follow the nearest service smoke doc and preserve
  diagnostics on failure.

## Key Conventions

- Frontend Supabase client-side: `createClient()` from
  `viza-fe/internal-website/lib/supabase/client.ts`.
- Frontend Supabase server-side: `createClient()` from
  `viza-fe/internal-website/lib/supabase/server.ts`.
- Frontend admin operations: `createAdminClient()` from
  `viza-fe/internal-website/lib/supabase/admin.ts`.
- Agent backend Supabase service role: `getSupabaseClient()` from
  `viza-be/agent-backend/src/db/supabase-client.ts`.
- Socket.IO namespace: `/visa`.
- Drizzle migrations: `viza-be/agent-backend/drizzle/*.sql`, sequentially
  numbered.
- Server actions: `viza-fe/internal-website/app/actions/*`.
- RAG country seeds: `knowledge-base/visa-rag-seeds/countries/*.json`.
- No new `any` types. No unused imports.
- Do not run `npm install` unless dependencies are missing or a new dependency
  is intentionally required.
- Never commit `.env`, `.env.local`, service-role keys, API keys, screenshots
  with secrets, or downloaded applicant documents.

## Product Guardrails

- Dynamic visa forms must preserve the bilingual Chinese/English two-column
  contract.
- All user-facing copy must observe the current user's selected language and
  render in the matching display language/style. Avoid hard-coded single-
  language UI text, chat text, status text, validation messages, notification
  content, and exported labels unless a product rule explicitly requires
  bilingual or official-source wording.
- VIZA AI must not collect detailed application form fields in chat. It should
  redirect users to `/client/application` once the route is clear.
- VIZA AI user-facing answers should be plain text by default.
- RAG answers must not invent official requirements. State uncertainty and point
  to official sources when data is missing.
- Website internal automation covers payment, consent, documents, OCR, packet
  generation, status display, notifications, staff monitoring, and external
  status ingestion only.
- Do not add official portal runners, CAPTCHA solving, proxy/browser
  fingerprinting, or Playwright submission automation unless the user
  explicitly reopens `viza-be/submission-service` scope.
- DS-160 CEAC automation must stop before final sign/submit.
- Travel AI required-field order is deterministic and lives in
  `viza-fe/internal-website/lib/travel/planner.ts`.

## Dirty Worktrees

This repo often has ongoing work. Before editing, check `git status --short`.
Never revert changes you did not make unless the user explicitly asks. If you
must edit a file that is already modified, read it carefully and preserve the
existing work.

## Commit Format

When asked to commit, use the story or feature identifier when available:

```text
feat(US-XXX): Story title

- What changed
- Why
```

Use conventional commits for non-story changes when no story ID exists.
