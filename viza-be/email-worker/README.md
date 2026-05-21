# viza-email-worker

Cloudflare Email Worker that ingests every message at `*@haggstorm.com`
into the Supabase `inbound_email` table (INBOX-002). Bodies above 1 MB
are offloaded to the `viza-inbox-bodies` R2 bucket; the row stores the
key.

## Layout

```
src/
  index.ts        — `email(message, env)` entrypoint
  types.d.ts      — local ambient types for tsc --noEmit (without npm install)
wrangler.toml    — bindings, vars, R2 buckets, preview env
package.json     — wrangler + typescript devDeps, deploy + tail scripts
tsconfig.json    — strict, ES2022, no @types deps required for typecheck
```

## Deploy

```
cd viza-be/email-worker
npm install
wrangler login                                 # one-time
wrangler r2 bucket create viza-inbox-bodies    # one-time
wrangler r2 bucket create viza-inbox-bodies-preview
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy
```

Then bind the deployed worker as the catch-all in
`Cloudflare → haggstorm.com → Email → Email Routing → Routes →
Catch-all → Send to a Worker`.

## Schema

Migration: `viza-be/agent-backend/drizzle/0045_inbound_email.sql`.

| Column | Type | Notes |
|---|---|---|
| `to_addr` | TEXT | normalised lowercase |
| `from_addr` | TEXT | original from header |
| `subject` | TEXT | nullable |
| `message_id` | TEXT | nullable |
| `text` | TEXT | inline plain body when ≤ INLINE_BODY_MAX_BYTES |
| `html` | TEXT | inline html body when ≤ INLINE_BODY_MAX_BYTES |
| `headers` | JSONB | curated subset (from / to / subject / message-id / received / spam) |
| `raw_size` | INTEGER | size of the raw RFC 822 message in bytes |
| `r2_key` | TEXT | populated when the body was offloaded |
| `spam_score` | REAL | nullable |
| `received_at` | TIMESTAMPTZ | message receipt time |
| `processed` | BOOLEAN | runners flip to `true` after consumption |

## Local dev

There is no local Cloudflare Email Worker emulator; the test path is
the canary alias from INBOX-001 plus `wrangler tail` for live logs.
Run `npm run type-check` to confirm the worker compiles without
needing `npm install` in the repo (we declare the runtime types
locally in `src/types.d.ts`).
