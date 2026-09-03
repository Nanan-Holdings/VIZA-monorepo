# Marketing Operations Library Guide

Scope: applies to `viza-fe/internal-website/lib/marketing/**`.

This module owns VIZA marketing contracts, validation, privacy-safe tracking,
database mapping, and server-only provider adapters for Google reporting,
OpenRouter generation, and Zernio distribution.

`automation.ts` owns idempotent scheduled draft generation and stale-run
failure settlement. Cron routes authenticate through `cron-auth.ts`; generated
content remains a draft until an admin publishes it. `assets.ts` is the single
MIME/size allowlist for the public marketing asset bucket.

- Provider keys and account IDs must be explicit VIZA environment variables.
  Never add Fruition values or fallback tenant identifiers.
- Provider calls fail closed when required configuration is missing.
- Zernio remains the source of truth for live post state and analytics. Create
  one provider post per platform; Supabase stores composition intent and IDs.
- Blog copy that may contain changing visa requirements must use grounded
  research and retain direct official-source URLs for editorial review.
- Tracking stores coarse metadata and a salted anonymous session hash only.
  Never persist raw cookies, IP addresses, full referrers, or full user agents.
- Keep every supported platform's limits enforced server-side in
  `validation.ts`; UI hints are not a security boundary.

Run focused tests under `lib/marketing/__tests__`, then the package type-check
and lint commands after changes.
