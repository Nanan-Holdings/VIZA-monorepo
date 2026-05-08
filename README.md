# VIZA

VIZA is an AI-powered visa agency offering end-to-end visa application services for non-immigration visas — tourist, business, work, student, and long-term stays. Human visa consultants work alongside AI technology to guide and process applications on behalf of clients.

**Target market (Phase 1):** Chinese nationals (B2C individuals + B2B companies)  
**Demo scope:** Indonesian tourist visa B211A, via evisa.imigrasi.go.id  
**Headquarters:** Singapore

---

## What this repo is

This monorepo contains the internal client portal — the web app where applicants log in, interact with the AI visa assistant, track their application status, and upload documents. The portal submits completed applications automatically via browser automation.

The external marketing website (Framer, zh-CN first) lives outside this repo.

---

## Structure

```
viza-fe/                  Client portal frontend
  internal-website/       Next.js 15, React 19, Tailwind, Supabase auth
                          /client subtree: home, application, chat, documents, settings

viza-be/                  Backend services
  agent-backend/          AI chat server — Express, Socket.io, Claude, pgvector RAG
  submission-service/     Queue worker — polls submission_queue and runs DS-160 automation
  travel-service/         FastAPI travel planner backend for travel chatbot

knowledge-base/           Visa knowledge ingestion scripts (Node.js, pgvector embeddings)

shared/                   Shared types and utilities (placeholder)

docs/                     Product documentation
  client-portal-prd.md    Full PRD for the internal client portal (this repo)
  marketing-site-prd.md   PRD for the external Framer marketing site
  prd.json                Ralph agent user stories (auto-managed by build pipeline)
  progress.md             Build log

research/                 Competitor and domain research
  competitors/            Boundless.com full site scrape (600+ pages)
  immigration-law/        Immigration law references

scripts/                  Build automation
  run-ralph.sh            Ralph autonomous agent runner
  ralph-runner.mjs        Ralph Node.js runner
  .ralph-prompt.md        Ralph system prompt
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS, Shadcn UI |
| Auth | Supabase (OTP email) |
| AI chat backend | Express, TypeScript, Socket.io, Claude claude-sonnet-4-5 |
| Embeddings / RAG | OpenAI text-embedding-3-small (1536d), Supabase pgvector |
| Database | Supabase (Postgres + Storage) |
| ORM | Drizzle |
| Submission service | Node.js + Playwright (automates evisa.imigrasi.go.id) |
| Frontend hosting | Vercel |
| Backend hosting | Railway |

---

## Local development

```bash
# 0) Prerequisites
# - Node.js 20+
# - Python 3.11+ (or any version supported by travel-service dependencies)
# - A reachable Supabase project URL + service role key

# Frontend
cd viza-fe/internal-website
cp .env.template .env.local
npm install && npm run dev        # http://localhost:3000

# Backend
cd viza-be/agent-backend
cp .env.template .env
npm install && npm run dev        # http://localhost:3002

# Submission service (DS-160 queue worker)
cd viza-be/submission-service
cp .env.example .env
# IMPORTANT: replace placeholder values in .env before running
npm install && npm run dev

# Travel service (for travel chatbot after application submission)
cd viza-be/travel-service
cp .env.example .env
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Travel chatbot integration flow

- The travel chatbot UI lives at `/client/travel-chat`.
- It is unlocked only after the visa application form flow is complete (submitted/approved).
- Frontend `app/api/travel/*` routes proxy to `viza-be/travel-service` (`TRAVEL_BACKEND_URL`, default `http://127.0.0.1:8000`).

### Common startup issues

- `submission-service` keeps printing `Failed to fetch submission_queue: TypeError: fetch failed`
  - Usually `.env` still has placeholders (`https://your-project.supabase.co`, `your-service-role-key`).
  - Fill real `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `agent-backend` shows `supabase_connection_test_failed` / `TypeError: fetch failed`
  - Check DNS/network can resolve your full Supabase subdomain, e.g. `xxxx.supabase.co`.
  - If `Resolve-DnsName <your-project>.supabase.co` fails, fix DNS/network first.

Never commit `.env` or `.env.local`. See `.env.template` in each service for required variables.
