# Runner artefact storage (INFRA-006)

> Last reviewed: 2026-05-07.

## Bucket — `submission-artifacts` (Supabase Storage / R2)

Single private bucket holding every runner artefact: screenshots,
HAR captures, submission PDFs, walker recon dumps. Two path
families coexist while the migration to job-id-addressed storage
finishes:

```
jobs/<runner_job.id>/<name>           ← INFRA-006 canonical path
{authUserId}/{applicationId}/{country}/{kind}-{ts}.{ext}    ← legacy
```

The `artifact.put(jobId, name, body)` helper writes only into the
`jobs/...` family. Per-country runners that still call
`uploadArtifact(...)` from `artifact-storage.ts` keep writing to
the legacy path; both paths live in the same bucket.

## Lifecycle rules

Configure on the bucket itself (Supabase dashboard or the R2
mirror):

| Stage | Window | Action |
|---|---|---|
| Hot | 0 – 90 days | Standard reads. Live access from staff portal. |
| Glacier | 91 – 365 days | Move to cold tier (Supabase: `lifecycle_phase` flag; R2: `Standard-IA` if mirroring). |
| Expired | > 365 days | Delete unless `legal_hold=true` metadata is present. |

Aligns with `docs/legal/retention.md` (LEGAL-003): 12-month default
for submission artefacts, 90-day cap for walker recon.

## Helper API

```ts
import { artifact } from "./artifact";

// Upload a screenshot
const ref = await artifact.put(jobId, "step-01.png", pngBytes, {
  contentType: "image/png",
});
console.log(ref.signedUrl);   // valid 5 minutes by default

// List artefacts for a job
const paths = await artifact.list(jobId);

// Mint a fresh signed URL (e.g. when a 5-minute link expires)
const url = await artifact.sign(paths[0]);

// Delete (rare — retention purge owns lifecycle)
await artifact.remove(paths[0]);
```

## RLS

`storage.objects` policy (set up by migration 0016) ties the first
path segment to `auth.uid()` for the legacy path family. The
`jobs/...` family is service-role only — staff dashboards read
through `withAdmin('admin', ...)` and mint signed URLs.

## Staff portal

`/admin/jobs/[id]` (this story) lists artefacts under the prefix
`jobs/<jobId>/` and renders signed download links (5-minute TTL).
The page also shows the metadata bag, including the proxy session
recorded by INFRA-004 — useful when triaging an anti-bot block.

## Migration plan

1. New runners (Vietnam orchestrator + future flows) write directly
   under `jobs/<jobId>/`.
2. Existing per-country runners keep using `uploadArtifact`. As we
   migrate them to the queue worker (INFRA-002 + INFRA-003), they
   switch to `artifact.put(jobId, ...)`.
3. The legacy path family remains readable indefinitely; we never
   rewrite past artefacts to the new layout.
