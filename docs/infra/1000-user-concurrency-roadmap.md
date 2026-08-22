# 1,000-user concurrency infrastructure roadmap

> Reviewed: 2026-08-04. This is a recommendation document only. No plan,
> region, instance size, deployment setting, or production database object was
> changed as part of this review.

## What “1,000 users” means

Capacity should be accepted against a reproducible workload, not the registered
user count. The conservative validation target for this roadmap is:

- 1,000 simultaneously signed-in browser sessions;
- 100–200 requests/second for ordinary reads at peak;
- 20–50 requests/second for writes at peak;
- AI and external-provider calls constrained by separate concurrency budgets;
- a 30-minute steady-state run plus a short burst, with no unbounded queue or
  connection growth.

Before spending on infrastructure, production traffic telemetry should replace
these assumptions with measured route mix, payload sizes, cache hit rate, AI
usage, and WebSocket connection counts.

## Current code baseline

The code now removes the full-screen client bootstrap gate, bounds Supabase and
travel-provider calls with real cancellation/deadlines, makes first-login and
destination selection atomically enforceable in Postgres, configures explicit
database pool and request-body limits, adds liveness/readiness probes, and
provides deterministic fallbacks for travel requests.

Migration `viza-be/agent-backend/drizzle/0131_client_bootstrap_concurrency.sql`
contains the database indexes, uniqueness constraints, and atomic RPCs. It was
applied to production on 2026-08-04; compatible code fallbacks remain in place
for degraded database connectivity.

## Zero-cost optimizations completed

The following changes require no paid plan or additional service:

- Removed the Home dashboard's per-user, whole-table Realtime subscription;
  Home now refreshes only on initial load or when a visible tab returns with
  data older than 30 seconds.
- Deduplicated overlapping Home loads and reduced its database critical path by
  running independent profile/application and document/payment reads in
  parallel.
- Removed the navbar's eager application-lifecycle read, which previously ran
  Auth plus up to six database queries on every client route change.
- Narrowed Next.js proxy matching to authenticated client/admin/auth routes, so
  public pages and unrelated APIs do not invoke authentication middleware.
- Removed duplicate Auth reads from the status and help pages and skipped the
  package lookup when an application URL already contains an explicit visa
  type.
- Paused polling in background tabs, stopped completed payment/account polling,
  replaced overlapping intervals with completion-based timers, added request
  deadlines/backoff, and guaranteed destination-button pending state cleanup.
- Reused one OpenAI client per backend replica, disabled hidden SDK retries,
  added a streaming deadline and disconnect cancellation, and bounded active
  and queued Socket.IO chat turns with per-connection duplicate suppression.

These changes reduce request amplification and protect latency fairness. They
do not change the Free-plan hard quotas of Supabase Realtime, database compute,
or third-party AI APIs; exceeding a provider quota will still require reducing
feature demand or changing capacity later.

## Observed topology risks

The observed services are geographically split: Vercel functions were served
from `iad1`, Supabase is in Mumbai (`ap-south-1`), and the Render backend is in
Singapore. A single request can therefore cross regions more than once. This
adds baseline latency and increases the duration for which connections and
workers stay occupied.

The live Supabase security advisor also reports that `public.users` has RLS
disabled. Do not enable RLS blindly: define and test policies for every caller
first, then enable it in a dedicated security migration. Advisor findings for
unindexed foreign keys and service-only tables should be reviewed against real
query plans rather than bulk-indexed.

## Recommended sequence (not executed)

### 1. Establish evidence and safety gates

- Add route-level p50/p95/p99 latency, timeout, error-rate, database-pool wait,
  AI/provider duration, queue depth, and WebSocket connection dashboards.
- Propagate one request ID from Vercel through backend/travel services and use
  structured logs with secret and applicant-data redaction.
- Rehearse migration `0131` on a staging clone, run the race tests, inspect
  query plans, and document the production rollback/runbook.
- Design and validate Supabase RLS policies, especially for `public.users`, in a
  separate security change.

### 2. Collapse the synchronous path into one region

- Choose one primary application region from measured user distribution. If
  Southeast Asia remains primary, Singapore is the natural candidate for the
  frontend compute, database, and synchronous APIs.
- Set the Vercel function primary region to the chosen database region.
- A Supabase region change requires a new project and controlled migration;
  rehearse Auth, Storage, extensions, secrets, RLS, DNS, and rollback before a
  cutover.
- Keep official-portal runners near their required egress region; they are
  asynchronous and should not dictate the interactive application region.

### 3. Bound and scale each resource independently

- Use the Supabase connection pooler for serverless traffic and set a global
  connection budget across all application replicas. Autoscaling without a
  connection budget can overload Postgres faster.
- Run at least two agent-backend replicas only after adding a shared Socket.IO
  adapter (for example Redis) and verifying cross-instance broadcasts. A second
  replica alone does not make in-memory socket state consistent.
- Autoscale HTTP replicas on concurrency/latency and workers on queue depth.
  Preserve readiness probes so overloaded or dependency-broken replicas leave
  rotation.
- Give AI, travel providers, exports, and portal automation separate
  semaphores/queues. One slow provider must not consume every request slot.
- Cache public, slow-changing metadata at the edge; never publicly cache
  applicant/session responses.

### 4. Validate before raising limits

Run staged tests at 100, 300, 600, then 1,000 concurrent sessions. Stop at each
stage if database connections, event-loop lag, memory, queue age, or error rate
keeps rising after load stabilizes. Include login/home, destination selection,
chat streaming, travel fallback, uploads, and WebSockets; do not send load to
government portals or paid third-party APIs.

Suggested acceptance gates:

| Signal | Initial gate |
|---|---:|
| Ordinary authenticated API p95 | < 500 ms in the primary region |
| Home usable-content p95 | < 1.5 s in the primary region |
| Button acknowledgement p95 | < 200 ms |
| HTTP 5xx + unexpected timeout rate | < 1% |
| Database pool saturation | < 80% sustained |
| Event-loop lag p95 | < 100 ms |
| Unbounded full-screen loading states | 0 |

These are engineering gates, not a promise that every end user will see the
same latency. Mainland China performance in particular cannot be guaranteed by
overseas hosting alone; cross-border routing varies, and a mainland deployment
normally introduces ICP and local compliance requirements.

## Decision order

1. Ship telemetry and run the staging migration/race tests.
2. Load-test the current code-only baseline.
3. Align regions if network time dominates.
4. Increase database/compute capacity only where saturation is measured.
5. Add multi-instance Socket.IO and worker scaling where concurrency demands it.
6. Repeat the same 1,000-session test and retain the results as release evidence.

## Vendor references

- [Vercel regions](https://vercel.com/docs/regions)
- [Vercel Fluid compute](https://vercel.com/docs/fluid-compute)
- [Supabase connection management](https://supabase.com/docs/guides/database/connection-management)
- [Supabase project region migration](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Render WebSockets](https://render.com/docs/websocket)
- [Render scaling](https://render.com/docs/scaling)
- [Alibaba Cloud ICP filing overview](https://www.alibabacloud.com/help/en/icp-filing/basic-icp-service/user-guide/icp-filing-application-overview)
