# Migration Reconciliation Runbook

Artifact for **MIG-002**. Reconciles the three migration sources in this repo
against a production database whose lineage has diverged (reported ~66
migrations behind). **The deliverable is this committed runbook — the agent
executes no production DB commands.**

## The three sources

| # | Source | Path | Files | Naming |
| --- | --- | --- | --- | --- |
| 1 | agent-backend drizzle | `viza-be/agent-backend/drizzle` | 93 `.sql` | `00NN_name.sql` (sequential, authoritative) |
| 2 | internal-website supabase | `viza-fe/internal-website/supabase/migrations` | 12 `.sql` | mixed (`00000000000000_base_schema.sql` + timestamped) |
| 3 | db (root) | `db/` | 0 `.sql` | (empty placeholder) |

The **agent-backend drizzle** directory is authoritative for the application
schema. Source 2 carries Supabase-managed objects (RLS, auth glue). Source 3 is
currently empty.

Use `scripts/db/diff-migrations.ts` (MIG-003) to print the per-source filename
inventory before reconciling.

### Migrations that create the queue objects (for MIG-001 verification)

- `runner_job`: created in `0054_runner_job.sql`; extended by
  `0055_runner_concurrency.sql`, `0057_runner_step_log.sql`,
  `0060_runner_metrics.sql`, `0077_antibot.sql`.
- `submission_queue`: created in `0001_viza_initial.sql`; extended by
  `0013_fv_accounts_and_prefill_columns.sql`, `0014_uk_prefill_columns.sql`,
  `0019_au_submission_queue_columns.sql`, `0080_submission_queue_paused_reason.sql`.

## Reconciliation procedure (operator-run)

> **Back up first.** Nothing below runs until a fresh backup + PITR checkpoint
> exists.

1. **Backup.** `pg_dump` the prod database to a timestamped artifact and confirm
   Supabase PITR is enabled (PROV-008). Record the restore point.
2. **Snapshot applied state.** Query the prod migration ledger
   (`drizzle.__drizzle_migrations` and/or `supabase_migrations.schema_migrations`)
   and save the list of applied hashes/filenames.
3. **Diff.** Run `npx ts-node scripts/db/diff-migrations.ts` to list local files;
   compare against the applied snapshot from step 2 to find the gap (the ~66
   unapplied drizzle files).
4. **Dry-run.** Apply the missing drizzle migrations to a **staging clone** of
   prod in filename order (`0001` → `00NN`). Each VIZA migration is written
   idempotently (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`); a
   re-run on an already-applied object is a no-op.
5. **Verify on staging.** Run `npm run db:verify` (MIG-001 + MIG-004) against the
   staging clone. It must exit 0.
6. **Apply to prod.** Replay the same ordered set against prod during a low-traffic
   window. Watch for lock contention on large tables.
7. **Post-verify.** Re-run `npm run db:verify` against prod. Re-snapshot the
   ledger and commit it for the next reconciliation.

## Rollback

If step 6 fails partway: stop, restore from the step-1 backup (or PITR to the
recorded restore point), and re-attempt on staging. Because the migrations are
idempotent and additive (no destructive `DROP`), a forward-fix is usually
preferable to a full restore — but the restore point is the hard backstop.

## Diverged-lineage note

Where prod and the drizzle ledger disagree on a hash for the *same* logical
object, prefer marking the prod row as applied (ledger repair) over re-running
the migration, since re-running an additive `IF NOT EXISTS` migration is safe
but a hash mismatch alone does not imply the object is missing — verify with
`db:verify` first.
