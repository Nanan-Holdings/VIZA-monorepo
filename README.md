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
# Frontend
cd viza-fe/internal-website
cp .env.template .env.local
npm install && npm run dev        # http://localhost:3000

# Backend
cd viza-be/agent-backend
cp .env.template .env
npm install && npm run dev        # http://localhost:3001
```

Never commit `.env` or `.env.local`. See `.env.template` in each service for required variables.