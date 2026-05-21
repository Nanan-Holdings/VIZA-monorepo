# VIZA Monorepo

VIZA is an AI-powered visa operations platform. This repository contains the core product surfaces used by clients and operations teams, plus backend services for dynamic visa-form generation and submission workflows.

## Repository scope

This monorepo currently includes:

- Client, staff, and admin web portals (Next.js app with role-based surfaces) — `viza-fe/internal-website`
- Public marketing website — `viza-fe/marketing-website` (Next.js, SEO-first, deploys to `viza.com`)
- Agent backend (chat, data APIs, form schema services)
- Submission service (Playwright automation and runtime validation tooling)
- Knowledge-base ingestion and research artifacts
- Country visa schema playbooks, scope docs, and gap reports

## Current highlights

- Frontend upgraded to Next.js 16 + React 19
- Dynamic visa-form pipeline expanded beyond DS-160 to:
  - UK Standard Visitor
  - EU Schengen Type C (short-stay)
  - Vietnam E-Visa (live-portal alignment pass completed)
- Country rollout pattern standardized: seed script + package migration + scope/gap docs
- DS-160 CEAC runtime-validation and CAPTCHA solve path documented and implemented in submission-service

## Monorepo structure

```
viza-fe/
  internal-website/           Next.js 16 app (client + staff + admin surfaces) — deploys to app.viza.com
  marketing-website/          Next.js 16 marketing site (public, SEO-first)     — deploys to viza.com

viza-be/                  Backend services
  agent-backend/          AI chat server — Express, Socket.io, pgvector RAG，Express + Socket.IO + Drizzle + Supabase
  submission-service/     Playwright-based submission and runtime validation tools
  travel-service/         FastAPI travel planner backend for travel chatbot

knowledge-base/               Ingestion and scraping utilities
research/                     Competitor + immigration research
shared/                       Shared assets/utilities
docs/                         PRDs, scope docs, gap reports, QA notes, playbooks
scripts/                      Runner scripts and automation helpers
vietnam-visa-helper-v1/       Vietnam form helper extension research artifact
```

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind |
| Backend | Node.js, Express, Socket.IO, TypeScript |
| Database | Supabase Postgres + Storage |
| ORM/Migrations | Drizzle |
| Automation | Playwright (+ stealth tooling where needed) |
| AI/LLM integrations | Anthropic + other provider SDKs in backend workflows |

## Getting started

### Prerequisites

- Node.js 20+
- npm
- Supabase project credentials (service and client envs)

### 1) Frontend — internal portal

```bash
cd viza-fe/internal-website
cp .env.template .env.local
npm install
npm run dev
```

### 1b) Frontend — public marketing site

```bash
cd viza-fe/marketing-website
cp .env.example .env.local
npm install
npm run dev
```

### 2) Agent backend

```bash
cd viza-be/agent-backend
cp .env.template .env
npm install
npm run dev
```

### 3) Submission service (optional local run)

```bash
cd viza-be/submission-service
cp .env.template .env
npm install
npm run dev
```

For browser automation setup:

```bash
cd viza-be/submission-service
npm run install-browsers
```

## Quality checks

Run checks in packages you changed:

```bash
# 0) Prerequisites
# - Node.js 20+
# - Python 3.11+ (or any version supported by travel-service dependencies)
# - A reachable Supabase project URL + service role key

# Frontend
cd viza-fe/internal-website
npm run type-check
npm run lint

# Agent backend
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
npm run type-check
npm run lint

# Submission service
cd viza-be/submission-service
npm run type-check
```

## Dynamic visa schema workflow

The current country rollout pattern is:

1. Define canonical source scope in docs
2. Add or update seed script in `viza-be/agent-backend/scripts/`
3. Register visa package via Drizzle migration in `viza-be/agent-backend/drizzle/`
4. Validate dynamic rendering path in frontend
5. Publish scope and gap reports in `docs/`

Reference playbook: `docs/visa-schema-playbook.md`

## Key documentation map

- Product and roadmap:
  - `prd.json`
  - `progress.txt`
- DS-160 and CEAC:
  - `docs/prd-ds160-ceac-runtime-validation.md`
  - `viza-be/submission-service/docs/ceac-smoke-test.md`
- UK visa:
  - `docs/uk-visa-scope.md`
  - `docs/uk-visa-gap-report.md`
- Schengen visa:
  - `docs/schengen-visa-scope.md`
  - `docs/schengen-visa-gap-report.md`
- Vietnam visa:
  - `docs/vietnam-visa-scope.md`
  - `docs/vietnam-visa-gap-report.md`
  - `docs/vietnam-visa-qa-report-2026-04-24.md`

## Notes

- Do not commit `.env` files.
- Keep schema parity claims truthful; document gaps explicitly in `docs/*-gap-report.md`.
- Prefer extending dynamic schema flow over hardcoded country-specific frontend forms.
