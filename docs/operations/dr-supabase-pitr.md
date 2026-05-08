# Supabase PITR + restore drill (DR-001)

## 1. Why

Point-in-time recovery (PITR) is our last line of defence against application bugs that corrupt or delete data (e.g. a bad migration, a lateral DELETE without WHERE). Daily snapshots aren't enough — we need second-level rewind.

## 2. Enable PITR

Supabase PITR is a paid feature on the Pro plan and above. To enable:

1. Go to https://supabase.com/dashboard/project/<project-ref>/settings/database
2. Under **Database** → **Backups**, switch the plan to **Pro** if not already.
3. In the **Point in Time Recovery** card, toggle **Enable**. Set the retention window to **7 days** (extend later if compliance demands).
4. Confirm. The first PITR base backup completes within 24h; PITR rewind is available immediately after.

Verify by running:

```bash
supabase backups list --project-ref <project-ref>
```

You should see a `pitr_enabled: true` row.

## 3. Quarterly restore drill

Schedule: first Monday of each quarter, 14:00 UTC. Captured in PagerDuty's `viza-data` service as a recurring incident reminder.

### Procedure

1. **Pick a target timestamp** — usually `now - 1h` so the drill runs against fresh data.
2. **Create a Supabase branch** from PITR:
   ```bash
   supabase branches create dr-drill-$(date +%Y%m%d) \
     --project-ref <prod-ref> \
     --restore-time "$(date -u -v-1H +'%Y-%m-%dT%H:%M:%SZ')"
   ```
3. **Compute checksums** on the source (taken from the same target time via PITR read-only) and the restored branch:
   ```sql
   -- Run on both projects:
   SELECT
     SUM(LENGTH(text(applications))) AS app_bytes,
     COUNT(*)                        AS app_rows
   FROM applications
   WHERE created_at <= '<target-ts>';

   SELECT
     SUM(LENGTH(text(applicant_profiles))) AS profile_bytes,
     COUNT(*)                              AS profile_rows
   FROM applicant_profiles
   WHERE created_at <= '<target-ts>';
   ```
4. **Match**: drill passes if the byte+row counts on the branch match the source within ±0 rows. ±1 is acceptable for tables with `created_at = NOW()` defaults if the source query ran later.
5. **Smoke test**: connect a local viza-be/agent-backend to the branch's `DATABASE_URL` and run `npm run dev`; confirm `/admin` and `/api/visa/applications` resolve without RLS errors.
6. **Document the drill** in `docs/operations/dr-drills/YYYY-Q<n>.md`:
   - Target timestamp
   - Branch URL
   - Checksum table (per-table rows + bytes match)
   - Smoke-test result
   - Drill duration (start → smoke pass)
   - Observations / improvements

### Pass criteria

- ✓ All checksum rows match
- ✓ Smoke test green within 10 min of branch creation
- ✓ Restore time < 30 min from `branches create` to ack-able state

If any criterion fails, open a `viza-data` incident and treat as a real outage drill (post-mortem in retro template).

## 4. Tear-down

After the drill, delete the branch:

```bash
supabase branches delete dr-drill-<yyyymmdd> --project-ref <prod-ref>
```

(Branches accrue billable connection hours.)

## 5. Out-of-cycle restores

For real incidents (not drills), the same procedure applies but:

1. Page `viza-data` first to keep the rest of the team informed.
2. Restore into a **branch** first, validate, then choose between:
   - **Logical restore**: `pg_dump` from the branch → `psql` into a new schema on prod, then swap (lower-risk for partial corruption).
   - **Full PITR rewind**: stops new writes, rewinds prod to the target time. Requires CTO approval — destroys all writes after the target.
