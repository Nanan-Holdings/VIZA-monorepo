# Service-role audit (SECRETS-005)

> Last reviewed: 2026-05-06

The Supabase service-role key bypasses Row Level Security. Every call
site must be justified, every call site must run server-only, and the
blast radius of a leaked key must be contained. This document tracks
every place we currently use it.

## Boundaries

- **Module:** the service-role client lives in
  `viza-fe/internal-website/lib/supabase/admin.ts`. It MUST NOT be
  imported from `app/client/**` or `components/**`. The lint rule in
  `viza-fe/internal-website/eslint.config.mjs` enforces this.
- **Helper:** when a server action or route handler needs to escalate,
  it should funnel through `withAdmin(mode, actor, fn)` in
  `viza-fe/internal-website/lib/auth/with-admin.ts`. The helper
  enforces an admin-role check up-front when `mode === "admin"`.
- **`mode === "system"`:** reserved for trusted server-only callers that
  authenticate the request through some other channel (signed token,
  webhook signature). Each `system` call must be justified in the audit
  table below.

## Call sites

`createAdminClient()` direct call sites in
`viza-fe/internal-website/`:

| Path | Layer | Mode | Justification |
|---|---|---|---|
| `lib/supabase/admin.ts` | source module | n/a | The factory itself + `createUserWithAdmin` / `deleteUserWithAdmin` helpers (each calls `requireAdmin()` first). |
| `lib/auth/with-admin.ts` | helper | admin / system | New (SECRETS-005). Single elevation funnel. |
| `lib/auth/get-authenticated-user.ts` | server lib | system | Reads applicant profile by `auth_user_id`; impersonation path bypasses RLS deliberately. Authenticated by Supabase session or signed impersonation cookie. |
| `lib/client-session.ts` | server lib | system | Internal helper — used by server actions only. |
| `app/auth/client-callback/route.ts` | route handler | system | OAuth callback that must look up user before any session exists. |
| `app/auth/impersonate-callback/route.ts` | route handler | system | Validates a single-use impersonation token (signed JWT) before issuing the cookie. Token check is the auth boundary. |
| `app/api/applications/[id]/jp-form-a-pdf/route.ts` | route handler | admin | Generates a PDF that includes RLS-restricted answer rows; route handler verifies session is admin before rendering. |
| `app/api/passport-scan/extract/route.ts` | route handler | system | Uploads scan + writes derived fields to the applicant's profile; authenticated by user session, RLS bypass is needed to write to the applicant_profiles row attached to a different `auth_user_id` than the request session would normally allow. |
| `app/admin/(dashboard)/users/page.tsx` | server page | admin | Admin-only listing. Page component runs `getCurrentUser()` and redirects non-admin sessions before reading. |
| `app/admin/(dashboard)/users/[id]/page.tsx` | server page | admin | Admin user detail. Same gate as above. |
| `app/admin/(dashboard)/users/[id]/secret-access/page.tsx` | server page | admin | Vault audit log view (SECRETS-003). Same gate. |
| `app/actions/auth.ts` | server action | system | Sign-in flow — must read role mapping before a session exists. |
| `app/actions/client-auth.ts` | server action | system | Client-portal sign-in / signup. |
| `app/actions/password-reset.ts` | server action | system | Triggers Supabase Auth admin reset. |
| `app/actions/user-profile.ts` | server action | admin / impersonation | Multiple actions; each verifies caller via `getAuthenticatedUser()` before writing. |
| `app/actions/user-package.ts` | server action | admin | Admin assigns visa packages to applicants. |
| `app/actions/user-timeline.ts` | server action | admin | Admin reads cross-user timeline. |
| `app/actions/visa-application-answers.ts` | server action | impersonation | Allows admin-impersonating-applicant to read/write answers; impersonation cookie is the auth boundary. |
| `app/actions/application-journey.ts` | server action | impersonation | Same pattern as visa-application-answers. |
| `app/actions/companion-sessions.ts` | server action | system | Companion-mode session bookkeeping. |
| `app/actions/ds160-normalize.ts` | server action | system | Normalises DS-160 answers across applicants. |
| `app/actions/form-requests.ts` | server action | admin | Admin/staff bulk operations. |
| `app/actions/settings.ts` | server action | admin | Admin settings panel. |
| `app/actions/submit-signature.ts` | server action | impersonation | Records signature for an impersonated applicant. |

## Backend services

Both `viza-be/agent-backend` and `viza-be/submission-service` use the
service-role key to read / write the applicant vault tables and the
visa application data they need to drive automation. These are
server-only Node services with no public ingress that requires user
auth, and the key is provided through env / Cloud Run secret manager —
never bundled.

## Lint enforcement

`viza-fe/internal-website/eslint.config.mjs` contains a `no-restricted-imports`
override against `app/client/**` and `components/**` for the import
paths `@/lib/supabase/admin` and `@/lib/auth/with-admin`. CI runs
`npm run lint` on the package, which will fail if a future change
imports the admin client from a path that ships to the browser.

## Migration plan (gradual)

New code should use `withAdmin('admin', actor, fn)` rather than calling
`createAdminClient()` directly. Existing call sites continue to work;
they will be migrated opportunistically as the touching them, since a
big-bang rename would expand the diff surface without changing the
trust boundary that already exists.

When migrating an existing site, prefer this shape:

```ts
import { withAdmin } from "@/lib/auth/with-admin";

export async function adminOnlyAction(args) {
  return withAdmin("admin", "actions/foo:adminOnlyAction", async (admin) => {
    // ...service-role queries...
  });
}
```
