# Server Actions Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/actions/**`.

## Purpose

Server actions own trusted server-side reads and mutations used by the Next.js
frontend. They bridge authenticated UI flows to Supabase, backend services, and
application lifecycle state.

## Key Flows

- `auth.ts`: admin auth and password change/signout.
- `client-auth.ts`: client auth/session helpers and signout.
- `application-lifecycle.ts`: lifecycle/status summaries derived from existing
  application, answer, document, and queue tables.
- `client-home-dashboard.ts`: server-side home dashboard reads using the same
  client session/profile identity resolution as authenticated customer routes.
- `applicant-inbox.ts`: resolves current and legacy client-session identities,
  initializes applicant inbox aliases, and records explicit forwarding consent.
  Keep its client-facing failures typed and covered by
  `applicant-inbox.test.ts`.
- `client-application-status.ts`: customer-safe application timeline, file,
  and update reads shared by the home dashboard and the submitted application
  view.
- `application-group.ts`: group application and team companion creation,
  companion review state, and authorized companion application reads.
- `visa-application-answers.ts`: draft app creation and dynamic answer storage.
  Critical answer reads refresh an encrypted independent cache; transient save
  failures enqueue encrypted, idempotent replay events instead of losing work.
- `visa-form-fields.ts`: loads DB-driven visa form fields.
- `companion-sessions.ts`: VIZA chat sessions, messages, title markers, search,
  and history.
- `user-package.ts`: package/destination assignment and active package reads.
- `internal-automation/**`: trusted mutations and reads for payment, consent,
  document readiness, packet lifecycle, status events, notifications, and
  admin/customer status summaries.
- `client-settings.ts`: client settings privacy requests and frequent traveler
  CRUD backed by applicant profiles.
- `support.ts`, `admin-cs.ts`, `support-storage.ts`: applicant support
  ticket submission, admin P2 support inbox reads/replies, and the temporary
  Storage fallback used when a Supabase project has not applied
  `support_ticket` migrations yet.
- `takeover.ts`: admin 2FA-gated operator takeover listing, claims, and
  answer capture. Completion and abandonment settle the session and runner
  job only through the guarded `settle_runner_job_takeover` RPC; focused
  race/conflict coverage lives in `takeover.test.ts`.

## Ownership Boundaries

- Keep user authentication checks inside the action before using admin clients.
- Use `createClient()` from `lib/supabase/server` for user-scoped server reads.
- Use `createAdminClient()` only when RLS bypass is needed after authorization.
- Return typed result objects instead of throwing raw errors into client UI.
- Do not import browser-only code into server actions.
- Do not implement official portal runners or call `viza-be/submission-service`
  from website internal automation actions.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

For lifecycle/application changes, smoke `/client/application` and the direct
form URL involved in the change. For website automation changes, smoke the
nearest affected route such as `/client/status`, `/client/documents`,
`/admin/applications`, or the API route that consumes the action data.

## Related Files

- `viza-fe/internal-website/lib/supabase/server.ts`
- `viza-fe/internal-website/lib/supabase/admin.ts`
- `viza-fe/internal-website/lib/auth/get-authenticated-user.ts`
- `viza-fe/internal-website/types/database.ts`
- `viza-fe/internal-website/types/visa-form-fields.ts`
- `viza-fe/internal-website/types/agent-test.ts`
- `viza-fe/internal-website/app/actions/internal-automation/AGENTS.md`
