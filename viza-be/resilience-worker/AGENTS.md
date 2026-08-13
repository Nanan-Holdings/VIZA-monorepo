# Resilience Worker Agent Guide

This module owns the independent Cloudflare watchdog and server-to-server
resilience gateway. Keep its scope isolated from the existing GitHub
`scripts/supabase-self-heal.mjs`, frontend session work, and Supabase schema.

## Security boundaries

- Never commit or log `VIZA_RESILIENCE_HMAC_SECRET`,
  `SUPABASE_MANAGEMENT_API_TOKEN`, or `SUPABASE_ANON_KEY`; provision them with
  `wrangler secret put`.
- VIZA encrypts cache/outbox blobs before sending them. This Worker stores and
  forwards opaque ciphertext and must never decrypt or inspect it.
- HMAC signs the exact raw request body and URL pathname. Keep timestamp and
  nonce replay protection enabled.
- Logs may contain only event names, statuses, timings, counts, and error
  categories. Do not log user references, cache keys, or payloads.

## Validation

```powershell
npm run type-check
npm test
npm run deploy:dry-run
```

Production deployment requires explicit user authorization. The operator must
set the secrets and project variables documented in `README.md`, verify the
management token scope, and explicitly enable auto-restart only after healthy
production probes.
