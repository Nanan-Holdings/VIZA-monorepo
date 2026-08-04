# Client Auth API

Routes here proxy applicant authentication requests to Supabase from the same
origin so local browser CORS settings never block login or email-code flows.
Do not log credentials, verification codes, or raw Supabase tokens.

`session/route.ts` validates the active applicant or impersonation session only.
Keep it free of optional onboarding/database bootstrap side effects so opening
a new client tab never redirects the applicant away from the requested page.

`auth/dev-session` is an outage-only local testing escape hatch. It must require
development mode, an explicit server-side enable flag, and a localhost host.
Keep those gates covered by `auth/dev-session/availability.test.ts`; production
requests must receive a 404 even if a public UI flag is accidentally enabled.
