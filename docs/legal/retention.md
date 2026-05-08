# PII retention schedule

> Counsel TODO: confirm jurisdictional minima/maxima where they conflict
> with these defaults. The Privacy Policy mirrors this table; keep them
> in lock-step.

**Last reviewed:** 2026-05-07.

## Defaults

| Data class | Storage location | Retention | Rationale |
|---|---|---|---|
| Passport scan / MRZ | `application_documents` rows + `submission-artifacts` Storage bucket | 12 months from submission completion | Beyond the longest re-attempt window observed across portals. |
| Applicant photo | `application_documents` + `submission-artifacts` Storage bucket | 12 months | Same as passport. |
| Form answers | `visa_application_answers` | 36 months from `applications.updated_at` | Customers reapply within 1–3 years. After that the data is stale and we delete. |
| Submission artefacts (screenshots, run logs, captcha receipts) | `submission_artifacts` bucket + per-country `*_result_payload` JSONB | 12 months from submission completion | Long enough for refund / appeal disputes; short enough to bound risk. |
| Runner walker captures (recon JSON + DOM HTML) | `submission-artifacts/recon/` | 90 days | These are diagnostic artefacts; rotate aggressively. |
| Inbound mail | `inbound_email` rows + R2 `viza-inbox-bodies` | 180 days (configurable; INBOX-007) | Long enough for appeal mail; short enough to bound mail-store growth. |
| Audit logs | `secret_access_log`, `pii_access_log`, `consent_event` | 24 months | Forensic window for a multi-quarter incident. |
| Payment metadata | `orders` (PAY-001+) | 7 years | Tax / accounting law (Singapore: 5y; we keep 7y as safety margin). |
| Account email + auth | Supabase `auth.users` + `applicant_profiles` | Lifetime of account; deleted on user deletion (LEGAL-004) | The account is the customer relationship; deletion request is the trigger. |

## Cron

We schedule purges via Supabase pg_cron. Each function is idempotent
and writes a row to `retention_purge_log` so we can prove the sweep
ran.

```sql
-- Daily 03:17 local — inbound mail (INBOX-007)
SELECT cron.schedule(
  'inbound-email-purge-180d',
  '17 3 * * *',
  $$ SELECT purge_old_inbound_email(180); $$
);

-- Daily 03:23 — visa_application_answers
SELECT cron.schedule(
  'answers-purge-1095d',
  '23 3 * * *',
  $$ SELECT purge_old_application_answers(1095); $$
);

-- Daily 03:31 — application_documents row + Storage object
SELECT cron.schedule(
  'docs-purge-365d',
  '31 3 * * *',
  $$ SELECT purge_old_application_documents(365); $$
);

-- Daily 03:37 — submission run artefacts + walker captures
SELECT cron.schedule(
  'artifacts-purge',
  '37 3 * * *',
  $$ SELECT purge_old_submission_artifacts(365); $$
);

-- Weekly Sun 04:11 — recon walker captures (90d)
SELECT cron.schedule(
  'recon-purge-90d',
  '11 4 * * 0',
  $$ SELECT purge_old_recon_artifacts(90); $$
);

-- Daily 03:43 — secret_access_log / pii_access_log / consent_event
SELECT cron.schedule(
  'audit-purge-730d',
  '43 3 * * *',
  $$ SELECT purge_old_audit_logs(730); $$
);
```

## Idempotency + audit

Every purge function is implemented as `DELETE … RETURNING id`,
written under a single transaction, and inserts one summary row to
`retention_purge_log(class, retention_days, rows_deleted, started_at,
finished_at, error)`. Running the function twice in a row deletes
nothing the second time — the cutoff timestamp moves forward but the
already-deleted rows are gone.

R2 objects are deleted lazily by a small worker (or cron job) that
reads `retention_purge_log` for `class IN ('inbound_email_r2',
'submission_artifacts_r2')` and issues `DELETE` against the
respective buckets for any keys whose corresponding row no longer
exists in the database.

## Post-delivery document purge (DOC-006)

A second sweep runs once an application reaches `status IN ('delivered',
'cancelled')`. Defaults:

- Passport scans + photos: 30 days post-delivery (kind=`passport`, `photo`).
- Supporting documents (bank statements, itineraries, etc.): 90 days
  post-delivery.
- Submission artefacts (HAR, screenshots, per-country payloads): 180
  days post-delivery — long enough for refund / appeal disputes,
  short enough to bound risk.

Function: `purge_post_delivery_documents(passport_days, supporting_days,
artefacts_days)` — defined in
`viza-be/agent-backend/drizzle/0064_post_delivery_purge.sql`. Cron:

```sql
SELECT cron.schedule(
  'docs-post-delivery-purge',
  '49 3 * * *',
  $$ SELECT purge_post_delivery_documents(); $$
);
```

Each run writes `class='post_delivery_documents'` to
`retention_purge_log`. R2 / Storage object cleanup is decoupled —
the existing cleanup worker reads the log and removes the bucket
keys whose database rows are gone.

## Customer-initiated deletion

Customer-initiated deletion (LEGAL-004) bypasses the retention
schedule and erases the account-scoped PII immediately, subject to
the 7-day soft-delete grace window.

## Changes

Material changes to this table imply a Privacy Policy update. Every
change should be paired with a counsel review note in the commit
body.
