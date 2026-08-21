# Database Architecture Governance

This runbook defines the stage-one safety controls for the VIZA database
architecture program. It does not authorize a production database change by
itself. Production actions remain behind the `supabase-production-recovery`
GitHub Environment and the exact production project ref.

## Architecture audit

Dispatch **Production database maintenance** with
`action=architecture-audit`. The action performs only:

- `GET /advisors/security` and `GET /advisors/performance`;
- read-only Management API database queries for catalog, ACL, RLS, function,
  view, foreign-key, index, connection, lock, vacuum and relation-size metadata;
- optional `pg_stat_statements` aggregates without statement text or parameters.

The JSON envelope identifies the source endpoints, exact project ref, and
`viza-architecture-audit-metadata-only-v1` sanitization schema. Advisor titles,
descriptions, details and remediation text are discarded. The action fails if
the Management API project-details response does not identify the exact
production ref. A database project-ref GUC is an optional secondary marker: if
present it must match, while an unset marker does not override the verified
Management API identity. Catalog ACL results are emitted per relation,
sequence, schema, routine, and default privilege entry. Statement metrics
include the statistics reset timestamp and observation-window length so a
short or reset sample is never mistaken for a stable workload baseline.

## Migration pull-request gate

`database-migration-governance.yml` compares the pull request to its target
branch with full Git history. It enforces:

1. Existing SQL migrations cannot be modified, renamed, copied or deleted.
2. The 17 historical duplicate Drizzle prefixes must match the exact committed
   filename allowlist; the four historical duplicate Supabase versions are
   likewise exact, and every new Supabase migration uses a unique 14-digit
   timestamp.
3. Every added migration is listed exactly once in
   `migration-governance.json`, either as a byte-identical Drizzle/Supabase pair
   with one SHA-256 or as a hash-pinned `no_mirror` entry with a specific reason.
4. A new public or quoted `UNLOGGED` table enables RLS and declares its ACL in
   the same migration. New SECURITY DEFINER functions and procedures in every
   schema use `SET search_path = ''`; new views use
   `security_invoker = true`. Comments and quoted strings cannot satisfy or
   bypass these checks.

Local equivalent (replace the ref with the repository's base remote):

```powershell
node scripts/database-migration-governance.mjs --base-ref upstream/main
node --test scripts/__tests__/database-migration-governance.test.mjs
```

## Approved production batches

An operator adds a reviewed entry to
`scripts/database-architecture/approved-migration-batches.json` only after the
SQL files are final. Each entry pins a batch id, the full source commit,
execution mode, migration version/name/path/SHA-256, and structured catalog
plus ledger pre/postconditions. Raw SQL predicates are not accepted.

- `transactional` wraps the migrations, ledger rows, timeouts and advisory lock
  in one transaction.
- `concurrent-index` accepts only idempotent
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS` statements whose identities and
  canonical definitions are pinned in the manifest. It removes only an
  invalid/not-ready copy before retry, verifies the exact valid definition,
  then records ledger rows in a short transaction. It cannot be mixed with
  general SQL.

Dispatch `action=apply-approved-batch` with the exact `batch_id` and a full
40-character `migration_ref`. The workflow checks out that ref in an isolated
directory, verifies every hash, validates the preflight ledger, uses a pinned
Supabase CA and database role with a maximum ten-minute TTL, revokes that role
even when creation has an ambiguous result, then validates the postflight
ledger and catalog predicates. An unlisted batch, source-ref drift, abbreviated
ref, hash drift, mode violation, missing prerequisite, failed catalog predicate,
or already-recorded migration fails before applying SQL.
