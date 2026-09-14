# VIZA Frontend

This directory owns the user-facing web application for VIZA. The active app is
`internal-website`, a Next.js 16 App Router project that serves the client
portal, admin portal, application form workflow, VIZA AI chat, and Travel AI UI.

Source baseline: **2026-09-13**. Next.js also owns backend-for-frontend logic:
authentication, database reads/writes, Travel conversation coordination, form
assistance, OCR and payment webhooks. See the [runtime architecture](../README.md).

## Apps

```text
viza-fe/
  internal-website/   Next.js 16, React 19, TypeScript, Tailwind, shadcn/ui
```

Older or experimental frontend folders may exist elsewhere in the monorepo, but
new VIZA portal work should happen in `viza-fe/internal-website` unless a task
explicitly says otherwise.

## What The Frontend Does

- Authenticates applicants and admins with Supabase Auth and SSR cookies, plus
  signed `client_session` continuity and explicit impersonation helpers. Admin
  authorization also checks active `admin_memberships`; it is not just a role
  string in the client.
- Renders the authenticated client portal under `/client/*`.
- Lets applicants select visa destinations, fill dynamic bilingual visa forms,
  upload documents/photos, review translations, and track application status.
- Connects `/client/chat` to `viza-be/agent-backend` over Socket.IO namespace
  `/visa` for VIZA AI guidance.
- Embeds Travel AI in `/client/travel-chat` and in the Travel tab of
  `/client/chat`. `/api/travel/chat` calls OpenAI directly and commits canonical
  conversation state; separate routes call Python for itinerary/search/export.
  Revision uses its Next LLM path when configured and only tries the Python
  revision endpoint when that route has no OpenAI key.
- Runs the application-scoped Form Assistant and passport OCR on the server,
  validating model proposals before answer updates or user confirmation.
- Receives signed payment webhooks and coordinates durable provisioning jobs;
  payment completion does not automatically start an official submission.
- Provides the admin operations portal under `/admin/*` for users, products,
  orders, consultations, and package assignment.

## Local Setup

```powershell
cd D:\NUS_Bachelor\Study\Y2S2\VIZA-monorepo\viza-fe\internal-website
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm install
npm run dev
```

Open `http://localhost:3000`.

Do not run `npm install` just to inspect or edit code if dependencies are already
present. Only install when dependencies are missing or a new dependency is
intentionally added.

## Environment Variables

Use `viza-fe/internal-website/.env.example` and the owning module guide for each
feature. Common settings include:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_AGENT_BACKEND_URL=http://localhost:3002
TRAVEL_BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
CLIENT_SESSION_SECRET=
OPENAI_API_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Notes:

- `NEXT_PUBLIC_AGENT_BACKEND_URL` should point to `agent-backend`, normally
  `http://localhost:3002`.
- `TRAVEL_BACKEND_URL` is server-side only and points to the Python travel
  service, normally `http://127.0.0.1:8000`. It does not select the current
  Travel Chat LLM endpoint.
- `OPENAI_API_KEY` is server-only and used by Travel Chat, Form Assistant, OCR
  and other separately configured OpenAI paths. Models and fallbacks differ.
- `CLIENT_SESSION_SECRET` must satisfy `lib/client-session.ts`; signed client
  sessions use a seven-day expiry, with route-specific authorization still
  required for application access.
- `SUPABASE_SERVICE_ROLE_KEY` is used only by server routes/actions/utilities.
  Never expose it in client components.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is required for the interactive Travel map.

## Common Commands

Run from `viza-fe/internal-website`.

```powershell
npm run dev             # Start Next.js dev server
npm run build           # Production build
npm run start           # Start built app
npm run type-check      # TypeScript check
npm run lint            # ESLint
npm run test            # Vitest
npm run test:coverage   # Vitest coverage
npm run sync:check      # Internal sync checks
```

For docs-only changes, a type-check is usually not necessary. For any frontend
code change, run at least `npm run type-check` and a focused route/component
smoke check.

## Directory Map

```text
internal-website/
  app/
    client/             Applicant portal routes
    admin/              Admin operations portal
    api/travel/         OpenAI coordinator, state APIs and downstream proxies
    api/applications/   Owned application APIs, form assistant and submission
    api/passport-ocr/   Vision extraction proposals with confirmation
    auth/               Supabase auth callbacks
    actions/            Server actions for auth, packages, forms, lifecycle
  components/
    ui/                 shadcn primitives
    client/             Client portal composite components
    application-steps/  Legacy and shared application wizard steps
    dynamic-*.tsx       DB-driven form renderer
  hooks/                Socket/chat hooks and tests
  lib/
    supabase/           Browser/server/admin Supabase clients
    travel/             Travel state machine and backend proxy helpers
    form-assistant/     Schema-driven questions, validated patches and review
    checkout/           Durable payment provisioning and lifecycle helpers
    forms/              About-me form mapping
  messages/             next-intl message files
  supabase/             Local Supabase migrations/templates
  types/                Shared frontend TypeScript types
```

## Key Frontend Flows

### Client Auth

- `proxy.ts` protects `/client/*` and `/api/client/*`.
- `/client/login`, `/client/signup`, and `/client/register` are public auth
  pages and redirect authenticated users to `/client/home`.
- Client pages can run under normal Supabase sessions, impersonation sessions,
  or legacy JWT sessions.
- Current-user reads that must respect impersonation should use
  `lib/auth/get-authenticated-user.ts`.

### Client Portal

- Shell: `app/client/layout.tsx`.
- Home dashboard: `app/client/home/page.tsx` plus
  `components/client/home/*`.
- Status center: `app/client/status/page.tsx`; document checklist/uploads live
  separately at `app/client/documents/page.tsx`.
- Settings/subscription/universal profile pages live under `app/client/*`.
- Copy is localized through `messages/en.json` and `messages/zh.json`.

### Application Forms

- Default `/client/application` shows a multi-application lifecycle/status hub.
- Direct links with `country` and `visaType` open the form workflow:
  `/client/application?country=germany&visaType=EU_SCHENGEN_C_SHORT_STAY`.
- `app/actions/visa-form-fields.ts` loads DB-backed `visa_form_fields`.
- `components/dynamic-step-form.tsx` and
  `components/dynamic-form-field.tsx` render one entry language while retaining
  synchronized Chinese and English/official values internally. Chinese final
  review shows both values for verification.
- `app/actions/visa-application-answers.ts` creates draft applications and
  persists dynamic answers.
- `components/field-guidance-panel.tsx` calls the backend
  `POST /api/field-guidance` endpoint.
- `/api/applications/[id]/form-assistant/turn` verifies application ownership,
  reads current answers and schema, and combines deterministic parsing with
  optional LLM extraction. It asks one current question, may accept multiple
  volunteered facts, and applies only validated patches.
- The assistant defaults to `gpt-5.5` with a DeepSeek fallback, has a 4,000-char
  input limit and process-local 30-turn/user/minute limiter. Message keys are
  idempotent; session writes do not use the Travel atomic version-CAS protocol.
- OCR uses the owned Storage document and returns `proposedFields` with
  `needsConfirmation: true`. It is not unconditional answer persistence.

### VIZA AI Chat

- Route: `app/client/chat/page.tsx`.
- Client UI: `app/client/chat/chat-client.tsx`.
- Shared chat UI: `components/client/companion/*`.
- Sessions and visible history are loaded through
  `app/actions/companion-sessions.ts`.
- Socket.IO connects to `${NEXT_PUBLIC_AGENT_BACKEND_URL}/visa`.
- Event contracts are reflected in `types/agent-test.ts`.

### Travel AI

- Route: `app/client/travel-chat/page.tsx`.
- Main UI: `app/client/travel-chat/travel-chat-client.tsx`.
- Travel components: `components/client/travel/*`.
- Deterministic state machine: `lib/travel/planner.ts`.
- Current coordinator: `app/api/travel/chat/route.ts`; structured OpenAI
  Responses output is validated as deterministic state operations. No LLM tools
  or autonomous tool loop are registered.
- State operations: `lib/travel/conversation-state.ts`; database authority is
  `travel_agent_sessions` / `travel_agent_messages` with message replay and
  `commit_travel_agent_turn` version checking. Browser archives are continuity
  copies, not the authoritative state.
- Downstream routes: `app/api/travel/*`; itinerary, flights, hotels and exports
  use separate APIs. Current Web chat does not call Python `/chat` or the old
  root `travel-agent/` LangGraph CLI.
- Travel backend URL helper: `lib/travel/backend.ts`.
- The page requires authentication, not a submitted/approved visa application.
  See [Travel implementation and fallback details](../docs/travel-agent-development-guide.md).

### Admin Portal

- Route group: `app/admin/*`.
- Admin shell: `app/admin/admin-layout-content.tsx`.
- RBAC gate: `app/admin/(dashboard)/layout.tsx` and `lib/rbac.ts`.
- Main sections: dashboard, users/accounts, orders, products, consultations.
- Admin operations that bypass RLS should use `createAdminClient()` from
  `lib/supabase/admin.ts`.

## Reliability And Observability

- Shared public schema/document metadata uses bounded TTL/single-flight caches.
  Never cache applicant answers, ownership, credentials or payment data there.
- Supabase retries are limited to supported transient cases; automatic fetch
  retries apply to GET/HEAD. The server-side circuit breaker opens after five
  failures for 20 seconds and is process-local.
- `lib/observability/portal-read.ts` provides opt-in request/stage timings and
  bounded process metrics, not browser paint timing or distributed tracing.
- [Analytics status](internal-website/lib/analytics/README.md) distinguishes the
  event taxonomy/optional PostHog wrapper from actual database-backed admin
  counts. Optional Sentry configuration alone does not prove a working SDK.
- The [local 100-session investigation](../docs/infra/2026-09-11-100-session-backend-optimization-plan.md)
  does not establish production latency or successful capacity acceptance.

## Design Conventions

- For `/client/*` UI, read `viza-fe/internal-website/frontend.md` before
  changing components.
- Prefer existing shadcn primitives in `components/ui`.
- Prefer `BrandActionButton` and `BrandField` for client portal form flows.
- User-facing strings should use `next-intl`; do not hardcode English or
  Chinese copy in reusable UI.
- Use `lucide-react` icons for UI controls.
- Preserve the current light client shell and the `max-w-[1090px]` application
  form rhythm unless a task explicitly changes the design system.

## Adding A New Frontend Feature

1. Find the nearest existing route/component pattern first.
2. Put route orchestration in `app/.../page.tsx` and reusable UI in
   `components/...`.
3. Put server-side mutations in `app/actions/*` unless an HTTP API route is
   required.
4. Update `messages/en.json` and `messages/zh.json` for user-facing copy.
5. Update the nearest `AGENTS.md` when adding, deleting, moving, or renaming
   important files.
6. Run `npm run type-check` and a focused smoke test for the changed route.

## Useful Smoke URLs

```text
http://localhost:3000/client/home
http://localhost:3000/client/application
http://localhost:3000/client/application?country=indonesia&visaType=B211A
http://localhost:3000/client/chat
http://localhost:3000/client/travel-chat
http://localhost:3000/admin
```

Authenticated routes redirect to login when no local session exists. If a full
authenticated flow is unavailable, verify the redirect plus the closest
component/route behavior that does not require credentials.

## Related Backend Services

- `viza-be/agent-backend`: VIZA AI Socket.IO and REST endpoints.
- `viza-be/submission-service`: queue worker and browser automation.
- `viza-be/travel-service`: Python FastAPI travel planner.

See `viza-be/README.md` for backend startup and ownership details.
