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

- Startup: `src/index.ts` loads `.env`, verifies production database-role
  timeout defaults on three fresh connections before readiness, creates the HTTP server, attaches
  Socket.IO, registers `/visa`, and checks Supabase. `src/server-shutdown.ts`
  owns the bounded Socket.IO/HTTP/database shutdown order.
- Express app: `src/app.ts` mounts REST routes and error handling.
- VIZA AI chat: `src/socket/visa-namespace.ts` plus `src/agent/index.ts`.
  `src/agent/application-context.ts` owns the request-scoped applicant profile
  and latest-application read. Keep its normal path as one nested Supabase
  request, retain the legacy lookup as an availability fallback, and never
  process-cache or log applicant data.
- RAG retrieval: `src/services/visa-knowledge.service.ts`,
  `src/config/visa-destination-registry.ts`, and `visa_chunks`.
- Versioned RAG publishing: `scripts/ingest-country-visa-rag.ts`,
  `scripts/stage-visa-knowledge-supplements.ts`,
  `scripts/promote-visa-knowledge-release.ts`, and
  `visa_knowledge_releases`.
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
  `drizzle/0091_us_appointment_assistant.sql`. China
  `CN/usvisascheduling` assisted-live may auto-provision a VIZA alias official
  appointment account record and hand off login/slot observation to
  `submission-service`; `agent-backend` must keep browser automation out of
  this service and preserve explicit user slot selection plus payment/final
  approval actions.
- France Schengen TLS appointment assistant:
  `src/routes/france-appointment.routes.ts` and
  `src/services/france-appointment/**`. Reuses the shared `appointment_*`
  tables for mainland China `TLSCONTACT_CN_FR`, requires France-Visas official
  reference plus user consent, enforces slot/status cooldowns, exposes only
  safe slot/confirmation/account metadata, and stores TLS payment authorization
  as redacted metadata only. Assisted-live slot checks call the localhost
  submission-service `/local/france-tls/check-slots` endpoint via
  `FRANCE_TLS_SUBMISSION_SERVICE_URL`; browser automation and WAF/CDP handling
  must remain in submission-service. Assisted-live booking calls the protected
  `/internal/france-tls/book-selected-slot` handoff and accepts success only
  when submission-service returns a verifiable official confirmation number;
  dry-run confirmation IDs must never be used for assisted-live jobs. With
  `FRANCE_TLS_ACCOUNT_PREP_ENABLED=true`, the assisted-live action first calls
  the token-protected `/internal/france-tls/register-account` endpoint to
  provision/activate/login the applicant alias and prefill the France-Visas
  reference, stopping before reference submission or slot selection.
  Render declares the URL/gate in `render.yaml`; the shared internal token is
  an unsynced Render secret and must match the Fly secret.
- Japan temporary-visitor appointment preparation:
  `src/routes/japan-appointment.routes.ts` and
  `src/services/japan-appointment/**` reuse the shared `appointment_*` tables
  for eligible Chinese ordinary-passport holders filing through VFS/JVAC
  Singapore. The backend validates stored VIZA answers and passport/photo
  uploads, prepares a redacted alias account record, and delegates official
  portal observation to submission-service. Free Plan mode stops before slot
  selection, payment, and final booking.
- DB schema and migrations: `src/db/schema.ts` and `drizzle/*.sql`.
- Transactional notification delivery: `src/notify/templates/**` and
  `src/notify/worker.ts`; Vietnam status changes use the locale-aware
  `vietnam_status_update` template and link to the VIZA status center.
- Public service health: `src/services/portal-health.service.ts`,
  `src/routes/public-status.routes.ts`, and
  `drizzle/0150_public_status_tracking.sql` own bounded synthetic probes,
  durable observations/incidents, and the redacted public snapshot.
  `drizzle/0190_public_status_aggregate_once.sql` removes repeated history
  aggregation. `src/tests/public-status-aggregate-*.test.ts` verifies the
  mirrored migration plus guarded local database JSON/ACL/OID parity across
  calendar/rolling boundaries and timezones; it never defaults to production.
- Seed/ingestion scripts: `scripts/*.ts`.
- Audited tourist-form seeds:
  `scripts/seed-ca-trv-form-fields.ts`,
  `scripts/seed-tr-e-visa-form-fields.ts`,
  `scripts/seed-in-e-visa-form-fields.ts`,
  `scripts/seed-sa-e-visa-form-fields.ts`, and
  `scripts/seed-ae-tourist-visa-form-fields.ts`. Their canonical products are
  intentionally narrower than legacy generic route aliases; uploads belong in
  `application_documents`, never file-path answers.
- `drizzle/0148_five_tourist_country_packages_and_documents.sql` registers the
  five tourist packages and their Document Center slots;
  `drizzle/0162_uae_tourist_document_contract.sql` reconciles UAE transaction
  783 aliases and audited bank-statement/insurance/conditional-document
  metadata without turning runner-only content review into form questions.
- Tests: `tests/setup.ts` plus the nearest test/module `AGENTS.md`.
  `src/tests/notification-signature-rls-initplan-*.test.ts` proves the audited
  notification/signature SELECT-policy optimization preserves policy identity
  and cross-user/service-role visibility in a gated local PostgreSQL transaction.
  `src/tests/applicant-single-path-rls-initplan-*.test.ts` proves the applicant
  secret, notification preference, and staff chat thread InitPlan rewrite keeps
  policy identity, ACL/RLS contracts, cross-user denial, and service visibility.
  `src/tests/supporting-doc-submission-rls-initplan-*.test.ts` proves the
  supporting-document SELECT-policy InitPlan rewrite preserves its two-hop
  applicant ownership, policy/relation identity, ACL/RLS state, anonymous
  denial, and service-role visibility.
  `src/tests/notification-preferences-policy-dedupe-*.test.ts` proves the
  redundant notification-preferences SELECT policy can be removed while the
  identical ALL-policy identity, ACL/RLS state, applicant isolation, own-row
  writes, anonymous denial, and service-role visibility remain unchanged.
- Arrival-card seeds:
  `scripts/sgac/**` for `SG_ARRIVAL_CARD`, `scripts/my-mdac/**` for
  `MY_MDAC_ARRIVAL_CARD`, and `scripts/th-tdac/**` for
  `TH_TDAC_ARRIVAL_CARD`, `scripts/ph-etravel/**` for
  `PH_ETRAVEL_ARRIVAL_CARD`, `scripts/vn-prearrival/**` for
  `VN_PREARRIVAL_DECLARATION`, and `scripts/kr-e-arrival/**` for
  `KR_E_ARRIVAL_CARD`; `scripts/jp-vjw/**` for `JP_VISIT_JAPAN_WEB`, and
  `scripts/ke-eta/**` for `KE_ETA`. Keep the top-level
  `scripts/seed-*-form-fields.ts` files as command entries and keep country
  packages separate from visa flows.
- The Japan VJW package owns the reviewed VJW 3.16 official option snapshot,
  its Simplified Chinese display-label snapshot, field/control parity tests,
  and the byte-identical `0185`-`0187` schema migrations under
  `scripts/jp-vjw/**`. Chinese labels are display-only; official stored values
  and runner payloads remain unchanged. Official master changes require manual
  review; the generator must never publish directly to production.
- Taiwan entry-permit seed: `scripts/seed-tw-entry-permit-form-fields.ts` owns
  `TW_ENTRY_PERMIT` for mainland Chinese nationals residing abroad or in
  Hong Kong/Macau. It is an entry permit, not an arrival card. Migrations
  `0104`/`0105` add the package + document_requirements rows (not yet run
  against the production DB as of this writing).
- Vietnam schema audit: `src/tests/vietnam-schema-localization.test.ts`
  verifies the Vietnam seed has clear bilingual labels and localized options.
- Staging concurrency release gate: `scripts/concurrency-load.ts` is a guarded,
  staging-only harness for the `0149_concurrency_phase_two.sql` runner-pool
  claim/settlement RPCs. It requires `CONCURRENCY_LOAD_CONFIRM=staging-only`,
  a Supabase direct/pooler URL bound to the explicit non-production
  `CONCURRENCY_LOAD_PROJECT_REF`, and authoritative database settings
  `app.viza_environment=staging` plus `app.viza_project_ref=<ref>` before it
  creates synthetic rows. The script never sets those markers. The default
  release matrix is exactly 100/300/600/1000; subsets are diagnostics and fail
  the release gate. It refuses to run when non-synthetic eligible pool jobs or
  owned machine slots are present, uses bounded workers/timeouts, and always
  cleans up synthetic rows in `finally`. Results are written to the ignored
  `load-test-results/concurrency/<runId>/summary.json`; never commit result
  files or credentials. Run only against an isolated staging database:
  `npm run load:concurrency`.
- Read-only edge-capacity gate: `scripts/online-capacity-load.ts` runs exactly
  100 synthetic users against the client login page, unauthenticated
  application redirect, and dependency-aware agent readiness endpoint. It
  accepts only explicit
  `local-test` or `staging-only` confirmation, binds the target to an exact
  non-production Supabase ref, and rejects `viza.it.com`, `viza-prod-*`, and
  the production project ref before issuing requests. It never sends cookies,
  authorization headers, payments, application writes, or official-portal
  submissions. Diagnostic user counts below 100 always fail the release
  decision. Results are written to ignored
  `load-test-results/online-capacity/<runId>/summary.json`. Run with
  `npm run load:online-capacity` only against local or isolated staging targets.
  Passing this gate proves only the public edge/auth-redirect/readiness surfaces;
  it does not certify authenticated database reads, AI chat, Runner throughput,
  official submission, or payment capacity. Those require separate isolated
  staging gates.
- The `authenticated_sustained_read_only` scope additionally requires a
  dedicated `@viza.test` account plus an ephemeral session Cookie supplied only
  through the protected workflow. Before load,
  `/api/health/online-capacity-session` must prove
  that Cookie belongs to the exact configured synthetic user UUID and is not an
  impersonation session. It ramps 100 sessions for 30 seconds and then
  holds read-only `/client/home`, `/client/status`, and `/ready` traffic for at
  least five minutes; the Cookie must never be logged or written to artifacts.
- The harness also samples `/api/internal/status/capacity` once per second using
  a step-scoped telemetry secret and fails closed on incomplete/malformed
  samples, non-open pool state, a cumulative wait peak above one, any wait that
  persists into a one-second sample, peak DB pool utilization at or above 80%,
  counter reset, new failed/slow query, a disabled/restarted runtime monitor,
  event-loop delay p95 at or above 100 ms, event-loop utilization at or above
  80%, or V8 heap utilization at or above 80%. RSS is recorded only as an
  aggregate because the V8 heap limit is not the container memory limit. Results retain only
  aggregates and SHA-256 query fingerprints. The status route uses its own
  `CAPACITY_STATUS_SECRET`, never the broader portal-probe secret. The protected
  synthetic `/api/internal/status/capacity/database-read` route is enabled only
  with the default-off capacity target marker and executes `SELECT 1`; the
  authenticated release matrix includes it so the agent DB pool is exercised.
  `src/tests/online-capacity-db.integration.test.ts` is an explicit local-only
  PostgreSQL gate for the matching paced load shape. It requires a loopback URL,
  `ONLINE_CAPACITY_DB_CONFIRM=local-test`, a non-production marker, and the DB
  GUC `app.viza_environment=local-test`; without all four it must skip safely.
- `src/online-capacity-target.ts` owns the default-off target marker returned at
  `/api/health/online-capacity-target`. It derives the project ref from the
  service's actual Supabase URL and must never return keys or connection URLs.
- `src/utils/provider-capacity.ts` owns the bounded instance-local budget for
  non-chat AI/provider calls. Passport OCR, field guidance, validation, and
  embedding requests must enter through `runWithProviderCapacity()`, consume
  its execution `AbortSignal`, and preserve the bounded execution deadline.
  Chat keeps its separate turn-level gate. The protected capacity route may
  expose only aggregate gate counts and bounded latency percentiles, never
  prompts, responses, request identities, model input, or provider errors.
- `src/observability/runtime-capacity.ts` owns low-cardinality process metrics
  for the secret-protected capacity endpoint. It samples event-loop delay and
  utilization plus aggregate process memory/uptime; never add PID, hostname,
  environment values, request identity, user data, stack traces, or heap
  snapshots. Event-loop delay is reset after each protected snapshot so load
  gates observe bounded windows rather than a process-lifetime average.

## Ownership Boundaries

- Use `getSupabaseClient()` from `src/db/supabase-client.ts` for service-role
  Supabase access.
- Keep Socket.IO namespace `/visa` stable.
- Keep user-facing AI answers plain text by default.
- RAG claims must come from official/authorized seed sources or be framed as
  uncertain.
- Do not move browser automation into this service; official portal automation,
  CAPTCHA handling, proxy/fingerprint handling, and runner artifacts belong
  outside this website automation scope. The U.S. and France appointment
  assistants may
  create/link appointment account records and model checkpoint state, but
  actual login, official account registration, CAPTCHA/MFA/email handling,
  waiting-room/rate-limit handling, and slot capture belong in
  `submission-service`. User slot selection and payment/final approval remain
  explicit VIZA actions.
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
For multi-replica topology changes, also run
`npm run test:socket-scaling-integration` against a disposable loopback Redis;
the test skips safely when its dedicated URL is absent.

## Important Files

- `package.json`
- `src/index.ts`
- `src/app.ts`
- `src/agent/index.ts`
- `src/socket/visa-namespace.ts`
- `src/db/schema.ts`
- `src/db/supabase-client.ts`
- `src/db/successful-probe-cache.ts`: bounded success-only single-flight cache
  used by Supabase health/readiness probes; failed probes are never cached.
- `src/routes/internal-automation/*`
- `src/routes/official-fee.routes.ts`
- `src/routes/us-appointment.routes.ts`
- `src/routes/france-appointment.routes.ts`
- `src/services/internal-automation/*`
- `src/services/official-fee/*`
- `src/services/us-appointment/*`
- `src/services/france-appointment/*`
- `src/services/visa-knowledge.service.ts`
- `src/services/visa-conversation-state.service.ts`
- `src/config/visa-destination-registry.ts`
- `src/config/visa-product-registry.ts`: canonical internal form and audited
  official-redirect catalogue used by deterministic entry-rule recommendations.
- `src/routes/*`
- `scripts/ingest-country-visa-rag.ts`
- `scripts/stage-visa-knowledge-supplements.ts`
- `scripts/enrich-field-answer-norms-rag.ts`
- `scripts/ingest-photo-requirements-rag.ts`
- `scripts/import-geonames-destinations.ts`
- `scripts/import-geonames-aliases.ts`
- `scripts/enrich-destinations-wikidata.ts`
- `scripts/recalculate-destination-popularity.ts`
- `scripts/bilingual-seed-row.ts`
- `scripts/seed-*-form-fields.ts`
- `tests/setup.ts`
- `drizzle/*.sql`
