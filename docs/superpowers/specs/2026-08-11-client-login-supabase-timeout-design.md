# Client Login Supabase Timeout and Input Border Design

## Problem

The client login route returns the raw English message `Supabase request timed out` when the hosted Supabase Auth service does not respond before the server-side deadline. The login email and password borders are also too faint against the white auth-page background.

Diagnostics on 2026-08-11 showed that DNS, TLS, Supabase Storage, and the local Next.js route were reachable. Auth requests made with both the public publishable key and the server-only service-role key produced no response within 12–25 seconds. The local `/api/client/auth` route failed after about 6.7 seconds, but returned the raw timeout because its unavailable-error classifier rejected Supabase error-shaped objects that were not `instanceof Error`.

## Considered Approaches

1. **Classify error-shaped Supabase failures and keep a bounded deadline (recommended).** Treat safe object values with a string `name` or `message` as unavailable when they indicate an abort, timeout, network failure, or connection reset. Return the existing `provider_unavailable` code, which the client localizes. Keep the current deadline so a stuck provider cannot leave the form pending indefinitely.
2. **Increase or remove the timeout.** This only makes users wait longer when the hosted Auth service is unhealthy and does not address the leaked raw error. Rejected.
3. **Use the service-role key or direct database access as an authentication fallback.** This would weaken the authentication boundary and risk privileged key misuse. Rejected.

The hosted Auth instance itself must be recovered operationally through the Supabase dashboard, logs, or project restart. Application code cannot restore a stuck managed Auth service.

## Design

### Auth Error Boundary

Keep password and OTP operations behind `/api/client/auth`. Update the route's unavailable-error classifier so it safely reads `name` and `message` from both real `Error` instances and plain Supabase error objects. Do not expose provider internals or credentials. Unavailable responses continue to use `{ success: false, code: "provider_unavailable" }`, and the login page continues to render locale-specific copy.

### Login Input Borders

Do not modify the frozen shared `ApplicationFormInputGroup` primitive. Override only the two login input groups through the existing `--application-control-border-color` contract, using Tailwind's `brand-300` design token for the resting border. Preserve the existing `brand-500` focus border and ring supplied by the shared control CSS.

### Data Flow

1. The browser posts password or OTP input to `/api/client/auth`.
2. The server uses the public Supabase client key and the bounded fetch wrapper.
3. Successful authentication returns the existing session cookies and `{ success: true }`.
4. Invalid credentials remain a normal localized authentication error.
5. Timeout/network/provider errors return `provider_unavailable`; raw provider messages never reach the user.

## Testing

- Add a focused route regression test that supplies a plain error-shaped timeout object and first confirms the current route leaks the raw timeout.
- After the fix, assert that the route returns `provider_unavailable` and the generic provider message.
- Use a browser smoke check to verify the login input groups compute to the `brand-300` resting border and retain the `brand-500` focused border.
- Run the focused test, full frontend test suite, type-check, and lint.
- Re-run the local auth endpoint. If hosted Auth remains unhealthy, verify bounded failure and localized UI; report the external recovery gap rather than claiming login success.

## Scope

This change does not alter Supabase keys, sessions, RLS, database schemas, global form primitives, or unrelated client routes.
