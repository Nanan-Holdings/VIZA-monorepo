# Runbook — document rejected by portal

> Last reviewed: 2026-05-07.
> Alert class: `submission.document.rejected`.

## Symptoms

- Runner gets a portal-side rejection on a passport scan or photo:
  "image too dark", "background not white", "MRZ unreadable", etc.
- The runner_job lands in `failed` with the portal's exact rejection
  message in `last_error`.

## Diagnosis

- Open `/admin/jobs/<id>` — the step that rendered the rejection
  page has the screenshot + console log.
- Pull the document(s) involved:

  ```sql
  SELECT id, kind, storage_path, created_at
    FROM application_documents
   WHERE application_id = '<id>'
   ORDER BY created_at DESC;
  ```

## Mitigation

1. Notify the applicant via the inbox UI — request a fresh upload
   that matches the per-country photo spec (see
   `docs/photo-specs.md`, DOC-001).
2. Once the applicant re-uploads, re-enqueue the runner_job:

   ```sql
   UPDATE runner_job SET status = 'queued', attempts = 0,
                         last_error = NULL,
                         leased_by = NULL, leased_until = NULL
    WHERE id = '<job_id>';
   ```

3. If the rejection happens repeatedly with the same applicant:
   the portal's spec drifted — update the per-country compliance
   checker (DOC-002 / DOC-003) and document the change in
   `docs/photo-specs.md`.

## Escalation

- Same rejection across multiple applicants in a 24-h window →
  spec drift; loop in engineering and pause the country runner via
  `runner_concurrency_cap.paused = TRUE`.
