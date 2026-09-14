# Client API

Routes here proxy applicant authentication requests to Supabase from the same
origin so local browser CORS settings never block login or email-code flows.
Do not log credentials, verification codes, or raw Supabase tokens.

`auth/route.test.ts` guards timeout and network-error normalization so raw
Supabase failures never reach the login UI.

`home-dashboard/route.ts` exposes the existing authorized Home aggregate as a
read-only GET. Use the shared server reader and identity/impersonation rules;
application/country/visaType parameters are selection hints, never proof of
ownership. Responses are private and no-store, with fixed safe error codes.
Pass request cancellation into the existing eight-second total read budget,
and never cache applicant rows or start a mutation here. Its route test covers
the DTO, selection, auth/error states and cancellation. Legacy Server Actions
remain available through `app/actions/client-home-dashboard.ts`.

`session/route.ts` validates the active applicant or impersonation session only.
Keep it free of optional onboarding/database bootstrap side effects so opening
a new client tab never redirects the applicant away from the requested page.
Its Supabase fallback has a 1.5-second total deadline, zero retries, and honors
the request abort signal. A verified fallback establishes the existing signed
client cookie once; a valid cookie read neither slides expiry nor writes the
continuity cache. Optional fallback continuity caching uses `after()`.
`session/route.test.ts` covers private no-store responses, fixed 503 errors,
cookie issuance, cancellation, and the impersonation boundary.

`auth/dev-session` is an outage-only local testing escape hatch. It must require
development mode, an explicit server-side enable flag, and a localhost host.
Keep those gates covered by `auth/dev-session/availability.test.ts`; production
requests must receive a 404 even if a public UI flag is accidentally enabled.
