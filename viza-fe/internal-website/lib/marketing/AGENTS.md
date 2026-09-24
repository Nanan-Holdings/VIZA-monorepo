# Marketing Operations Library Guide

Scope: applies to `viza-fe/internal-website/lib/marketing/**`.

This module owns VIZA marketing contracts, validation, privacy-safe tracking,
database mapping, and server-only provider adapters for Google reporting,
DeepSeek/OpenRouter generation, Zernio distribution, and Upload-Post image posts.

`automation.ts` owns idempotent scheduled draft generation, provider status
reconciliation, and stale-run failure settlement. `news-pipeline/**` scans,
ranks, and reads sources before generation; `seo-keywords.ts` accepts measured
keywords only from `content/seo-keywords.json`. `cover.ts` imports remote images
into the public asset bucket; `editor/**` converts TipTap content to Markdown.
Cron routes authenticate through `cron-auth.ts`; generated content remains a
draft until an admin publishes it, except in the scheduled pipeline: when
`scripts/pipeline.config.json` sets `content.autoPublish` and `content.autoSocial`,
a run scoring at or above `content.autoPublishMinScore` publishes the article and
sends its captions with no person involved. Publishing itself lives in
`publish.ts` so the server actions and the automation share one path. `assets.ts` is the single MIME/size allowlist.

- Provider keys and account IDs must be explicit VIZA environment variables.
  Never add another tenant's values or fallback identifiers.
- Provider calls fail closed when required configuration is missing.
- Zernio handles LinkedIn/Facebook delivery and analytics. Upload-Post handles
  Instagram/Pinterest images. Create one provider post per platform; Supabase
  stores composition intent, request IDs, post IDs, and public URLs.
- Blog copy that may contain changing visa requirements must use grounded
  research and retain direct official-source URLs for editorial review. DeepSeek
  does not browse, so it must never be represented as having verified facts
  beyond a staff-supplied brief.
- Tracking stores coarse metadata and a salted anonymous session hash only.
  Never persist raw cookies, IP addresses, full referrers, or full user agents.
- Keep every supported platform's limits enforced server-side in
  `validation.ts`; UI hints are not a security boundary.

Run focused tests under `lib/marketing/__tests__`, then the package type-check
and lint commands after changes.
