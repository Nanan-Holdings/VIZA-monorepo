# VIZA Monorepo

VIZA combines applicant and admin portals, visa consultation, dynamic application
forms, travel planning, and queued browser workflows for official portals.

Documentation baseline: source reviewed on **2026-09-13**. This describes
repository implementations and code defaults. Configuration files, fixture tests
and dated reports do not prove that a feature is currently enabled in production.

## Runtime architecture

```text
Applicant / Admin
  -> Next.js portal (viza-fe/internal-website)
       +-> Supabase Auth / signed client session / ownership checks
       +-> Server Actions and API routes -> Postgres / Storage
       +-> Visa Chat -> Socket.IO /visa -> Express agent-backend
       |                                +-> memory / entry rules
       |                                +-> pgvector RAG -> OpenAI response
       +-> Travel Chat -> Next Responses coordinator -> state commit RPC
       |                +-> itinerary / flight / hotel / export routes
       |                     -> FastAPI travel-service -> external providers
       +-> Form Assistant / OCR -> validated proposals -> application answers
       +-> Payment webhooks -> durable provisioning jobs / fee allocations
       +-> Explicit review/submit -> Postgres queue + runner leases
                                      -> Playwright submission-service
                                      -> official portal / results / artifacts

Cloudflare email-worker: inbound email -> R2 / Postgres -> forwarding/retry
Cloudflare resilience-worker: encrypted outbox -> Durable Objects / Queues
Optional Socket.IO Redis adapter: multi-replica mode, disabled by default
```

Next.js is also a backend-for-frontend: Travel coordination, form assistance,
OCR, payment webhooks and many database operations run in its server routes.
These requests do not all pass through Express.

## Repository map

| Path | Responsibility |
| --- | --- |
| [viza-fe/internal-website](viza-fe/README.md) | Next.js 16 / React 19 portal, Server Actions and API routes |
| [viza-fe/marketing-website](viza-fe/marketing-website/AGENTS.md) | Separate public marketing app |
| [viza-be/agent-backend](viza-be/agent-backend/README.md) | Express, Socket.IO, RAG, field guidance, application APIs and Drizzle migrations |
| [viza-be/submission-service](viza-be/submission-service/README.md) | Playwright runners, queue consumers, health/wake HTTP server and artifacts |
| [viza-be/travel-service](viza-be/travel-service/README.md) | FastAPI itinerary generation/revision, provider search and export |
| [viza-be/email-worker](viza-be/email-worker/README.md) | Email routing, R2 retention, database ingestion and forwarding |
| [viza-be/resilience-worker](viza-be/resilience-worker/README.md) | Encrypted continuity/outbox gateway, Durable Objects and Queues |
| [knowledge-base/visa-rag-seeds](knowledge-base/visa-rag-seeds/README.md) | Country knowledge JSON and source metadata |
| [travel-agent](travel-agent/DG.md) | Historical CLI/prototype; not the current Web conversation entry |
| docs / scripts | Developer guides, dated evidence, runbooks and local tooling |

## AI and workflow boundaries

- Visa Chat uses OpenAI, with `gpt-4o-mini` as the code default. It combines
  deterministic conversation memory and entry rules with retrieved context.
  Its current LLM request has no registered tools or autonomous tool loop.
- RAG uses `text-embedding-3-small`, `vector(1536)` in Supabase Postgres, cosine
  retrieval and bounded, configurable retrieval parameters. The
  [parameter study](viza-be/agent-backend/evals/README.md) records defaults,
  rejected candidates and validation limits. Ingestion preserves curated seed
  chunks by default and supports explicit evaluated character-splitting profiles;
  it has no reranker or BM25/vector fusion.
- Current Travel Chat runs in Next `app/api/travel/chat/route.ts`. Structured
  Responses output is validated and applied by deterministic state operations.
  The default model is `gpt-5.6-luna`; a specific model-not-found failure can
  switch the process to `gpt-5.5`. It invokes neither the old LangGraph CLI nor
  Python `/chat` for normal Web conversation turns.
- Form Assistant combines schema-driven questions, deterministic parsing and
  validated LLM patches. Its default model is `gpt-5.5`, with a separate
  DeepSeek fallback. Passport OCR returns proposed fields for confirmation.
- Official browser runners use deterministic mappings and persisted business
  state. DS-160 defaults to dry-run/live disabled; an enabled live path can
  reach final submission. Other products have independent flags and approvals.
- Commercial payment and official-fee allocation are separate records.
  Provisioning does not itself enqueue official submission; review, consent
  and submission-entitlement checks remain separate.

See module guides for environment overrides, timeouts, fallbacks and ownership
checks. Rule checks and source context are not comprehensive factual or legal
verification. The code alone does not establish a measured reduction in input
errors.

## Local development

Use **Node.js 24.x** for agent-backend (`engines: >=24 <25`), npm, and a Python
environment compatible with `viza-be/travel-service/requirements.txt`. Install
dependencies only when missing or intentionally changed.

From the repository root on Windows:

```powershell
.\scripts\start-viza-dev.ps1
# Stop processes managed by this script:
.\scripts\start-viza-dev.ps1 -Stop
```

The script starts the portal and agent backend, and starts Travel when its
configured Python environment is available. Runner startup is separate and can
consume durable jobs; follow its module guide and use a scoped test environment.

Manual startup and environment examples:

- [Frontend setup](viza-fe/README.md)
- [Backend setup](viza-be/README.md)
- [Travel setup](viza-be/travel-service/README.md)
- [Submission setup and live gates](viza-be/submission-service/README.md)

Use the existing `.env.example` files where provided. Never overwrite a working
environment just to refresh documentation, or commit credentials. The current
Travel page requires authentication; it does not require the latest visa
application to be submitted or approved.

## Validation and evidence

Run each command from its package directory:

| Package | Static checks | Behavior verification |
| --- | --- | --- |
| `viza-fe/internal-website` | `npm run type-check`, `npm run lint` | Focused tests and changed browser route |
| `viza-be/agent-backend` | `npm run type-check`, `npm run lint` | Focused tests, `/health`, relevant REST/Socket flow |
| `viza-be/submission-service` | `npm run type-check` | Fixtures and the product-specific smoke runbook |
| `viza-be/travel-service` | No package-level TypeScript command | Focused Python tests and changed FastAPI route |
| Documentation only | Diff, links, commands and source checks | No service startup required |

The repository contains local load tests and a dated 100-session investigation.
The [optimization report](docs/infra/2026-09-11-100-session-backend-optimization-plan.md)
records failed capacity acceptance and variable local results. It is not a
production benchmark or a proven concurrency guarantee. Keep deployment status,
functional verification and capacity acceptance separate.

Structured logs, local request/run IDs, bounded DB/RAG/runtime metrics, persisted
events and some browser artifacts exist. LangSmith configuration and optional
Sentry bootstraps do not establish working end-to-end tracing.

## Deployment configuration

The portal has Vercel configuration; agent-backend has Render configuration and
older Cloud Build configuration; runners have Fly topology files; Cloudflare
workers have Wrangler configuration. These express deployment intent, not a
verified inventory of running services.

Follow [AGENTS.md](AGENTS.md) for organization-owned Vercel authentication and
upload rules. Runner deployment must preserve on-demand startup, bounded slots,
lease renewal, terminal cleanup and idle exit. Use the applicable release
runbook and actual environment verification before deploying.

## Development guides

- [Visa Chat and RAG](docs/viza-ai-chat-development-guide.md)
- [Travel coordination and services](docs/travel-agent-development-guide.md)
- [Application forms and assistant](docs/application/DG.md)
- [Visa schema playbook](docs/visa-schema-playbook.md)
- [Database governance](docs/db/database-architecture-governance.md)
- [Internal automation boundaries](docs/internal-automation/AGENTS.md)
- [CEAC smoke runbook](viza-be/submission-service/docs/ceac-smoke-test.md)
- Product queue: `prd.json`; append-only implementation history: `progress.txt`

Dated reports and prototypes retain their historical meaning. Prefer current
entry points and module guides over historical implementation notes. Keep
official-source parity, authorization and live-submission claims limited to
evidence for the exact product and route.
