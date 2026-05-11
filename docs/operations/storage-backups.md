# Off-site storage backups (OBS-004)

## Why

`application-documents` holds passport scans + applicant photos. Supabase Storage is redundant within a region but a region-wide failure (or a user-data corruption like a bad delete) would lose every applicant's KYC artefacts. We mirror to a different region nightly.

## Schedule

Cron entry (extend `0079_pg_cron_schedules.sql` when wiring):

```sql
SELECT cron.schedule(
  'viza_storage_backup',
  '0 4 * * *',  -- daily 04:00 UTC, after retention purge
  $$ SELECT net.http_post(
       url := current_setting('app.edge_url', true) || '/jobs/storage-backup',
       headers := jsonb_build_object('x-cron-secret', current_setting('app.edge_secret', true))
     ); $$
);
```

The Edge Function calls `rclone copy` (or `supabase storage sync`) from the prod project's `application-documents` bucket → a secondary bucket in a different Supabase project (or external S3 in a different cloud region).

## storage_backup_log

Every run inserts a row (migration `0085_storage_backup_log.sql`). Drizzle: `storageBackupLog`.

Columns:

| col          | meaning                                                          |
| ------------ | ---------------------------------------------------------------- |
| bucket       | `application-documents` (or another bucket)                      |
| target       | destination URI / bucket                                         |
| status       | `running` → `succeeded` | `failed`                              |
| bytes        | total transferred                                                |
| object_count | objects copied this run                                          |
| started_at   | mandatory                                                        |
| completed_at | filled at terminal                                               |
| error        | filled on failure                                                |
| is_drill     | TRUE when run as a restore drill (verifies a roundtrip works)    |

## /admin/storage-backups

Shows the latest successful run + an age alert when > 36h. Drill rows are marked separately.

## Quarterly restore drill

Once a quarter, run a one-off backup with `is_drill=TRUE` AND restore the dump into a scratch bucket. Verify:

1. Object count matches.
2. SHA-256 of a sampled subset matches across source + target.
3. App can read a sampled object via signed URL.

Log the drill row in `storage_backup_log` so /admin/storage-backups carries the proof.

## Cost

Egress for nightly mirror ~ N×GB across regions. Budget alarm at $50/month sustained — surfaces in `/admin/costs` (OBS-003).
