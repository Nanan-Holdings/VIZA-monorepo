# Admin Portal Agent Guide

Scope: this file applies to `viza-fe/internal-website/app/admin/**`.

## Purpose

The admin portal is the internal operations surface for VIZA staff/admin users.
It manages accounts, products, orders, consultations, user package assignment,
website automation monitoring, coverage, and billing support.

## Key Flows

- `login/page.tsx`: centered admin login form using `app/actions/auth.ts` and
  the shared auth form primitives. Keep it visually distinct from the client
  portal login; do not add the client travel globe to this route.
- Admin login is portal-aware and requires both a `users.role = 'admin'`
  record and an email accepted by `lib/admin-access.ts`; production access is
  limited to the explicit staff allowlist.
- `(dashboard)/layout.tsx`: server-side role gate through `lib/rbac.ts`.
- `admin-layout-content.tsx`: fixed desktop admin shell and sidebar.
- `(dashboard)/page.tsx`: live operations control tower across work items,
  provisioning, submissions, support, privacy, appointments, portal health,
  refunds, takeovers, and notification failures.
- `(dashboard)/metrics/concurrency-health.ts`: pure shared-pool health and alert
  derivation used by the metrics page and its unit tests; keep helpers outside
  the Next.js page module so the route exports only supported page fields.
- `(dashboard)/work/**`: durable staff work queue with ownership, SLA, SOP
  checklists, resolution codes, and event history.
- `(dashboard)/leads/**`: marketing enquiry ownership, response SLA,
  qualification, conversion, and loss workflow.
- `(dashboard)/privacy/**`: data-rights identity verification, private exports,
  legal hold, two-admin/2FA erasure execution, evidence, and decisions.
- `(dashboard)/refunds/**`: request decision, line-based Stripe refunds, and
  Stripe dispute synchronization/evidence submission.
- `(dashboard)/team/**`, `(dashboard)/audit/**`: staff workload visibility and
  redacted operational command history.
- `(dashboard)/users/**`: user list/detail and package assignment.
- `(dashboard)/applications/**`: staff monitoring queue and application watch
  detail for website-owned automation.
- `(dashboard)/packages/**`: country/package coverage matrix and supported
  automation capability flags.
- `(dashboard)/billing/**`: payment, receipt, invoice, and refund support
  visibility.
- `(dashboard)/support/**`: staff support inbox for customer questions and
  replies.
- `(dashboard)/orders/page.tsx`: commercial payment, provisioning,
  official-fee allocation, and order exception management.
- `(dashboard)/products/page.tsx`: catalogue control and readiness entry point.
- `(dashboard)/catalogue-publication/**`: draft, readiness, publish, retire,
  and version visibility for the public marketing catalogue.
- `(dashboard)/cal-bookings/page.tsx`: appointment case ownership, persisted
  manual-action expiry, and official-confirmation recovery controls.
- `(dashboard)/takeovers/[id]/**`: protected, AAL2-gated operator takeover
  workflow and audit history.
- `standalone-admin-layout.tsx` plus legacy top-level route layouts keep older
  operational pages authenticated and inside the shared admin shell.
- `admin-theme.css` scopes shadcn semantic tokens and legacy compatibility
  styles to `/admin` only. Client portal tokens and frozen client primitives
  must not be changed as part of admin restyling.
- `components/admin/**` composes the existing shadcn primitives into reusable
  admin page headers, metric cards, status badges, empty states, and sections.
- `(dashboard)/patients/**`: compatibility redirects from the retired medical
  template naming to VIZA customer accounts; do not add new patient workflows.

## Ownership Boundaries

- Admin-only data access should use server components/actions and
  `createAdminClient()` where RLS bypass is required.
- Do not mix client applicant session assumptions into admin pages.
- Keep admin UI separate from `/client` visual rules unless a shared primitive
  is intentionally reused.
- If adding a new admin section, update `admin-layout-content.tsx` navigation
  and this file.
- Staff monitoring pages should observe and support cases; they must not become
  required manual approval gates for the happy path.
- Mutating operational commands must record actor, reason, target, and
  before/after state before an irreversible or externally visible action.
- Admin shell and dashboard page copy should follow the global interface
  language (`NEXT_LOCALE`) for English/Chinese switching.

## Validation

Run from `viza-fe/internal-website`:

```powershell
npm run type-check
npm run lint
```

Smoke `/admin/login` and `/admin`. Without an admin session, verify protected
dashboard routes redirect to `/admin/login`.

## Related Files

- `viza-fe/internal-website/app/admin/login/page.tsx`
- `viza-fe/internal-website/app/admin/(dashboard)/layout.tsx`
- `viza-fe/internal-website/app/admin/admin-layout-content.tsx`
- `viza-fe/internal-website/app/admin/admin-theme.css`
- `viza-fe/internal-website/components/admin/admin-ui.tsx`
- `viza-fe/internal-website/app/admin/(dashboard)/applications/AGENTS.md`
- `viza-fe/internal-website/app/admin/(dashboard)/packages/AGENTS.md`
- `viza-fe/internal-website/app/admin/(dashboard)/billing/AGENTS.md`
- `viza-fe/internal-website/app/admin/(dashboard)/support/page.tsx`
- `viza-fe/internal-website/lib/rbac.ts`
- `viza-fe/internal-website/lib/admin-access.ts`
- `viza-fe/internal-website/app/actions/auth.ts`
- `viza-fe/internal-website/lib/supabase/admin.ts`
