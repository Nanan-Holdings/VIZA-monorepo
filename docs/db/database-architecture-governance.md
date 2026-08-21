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
the database project marker is missing or does not match production.

## Migration pull-request gate

`database-migration-governance.yml` compares the pull request to its target
branch with full Git history. It enforces:

1. Existing SQL migrations cannot be modified, renamed, copied or deleted.
2. The 17 historical duplicate Drizzle prefixes must match the exact committed
   filename allowlist; no new duplicate prefix is accepted.
3. Every added migration is listed exactly once in
   `migration-governance.json`, either as a byte-identical Drizzle/Supabase pair
   with one SHA-256 or as a hash-pinned `no_mirror` entry with a specific reason.
4. A new public table enables RLS and declares its ACL in the same migration.
   New SECURITY DEFINER functions use `SET search_path = ''`; new public views
   use `security_invoker = true`.

Local equivalent (replace the ref with the repository's base remote):

```powershell
node scripts/database-migration-governance.mjs --base-ref upstream/main
node --test scripts/__tests__/database-migration-governance.test.mjs
```

## Approved production batches

An operator adds a reviewed entry to
`scripts/database-architecture/approved-migration-batches.json` only after the
SQL files are final. Each entry pins a batch id, execution mode, migration
version/name/path/SHA-256 and ledger pre/postconditions.

- `transactional` wraps the migrations, ledger rows, timeouts and advisory lock
  in one transaction.
- `concurrent-index` accepts only idempotent
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS` statements, then records the ledger
  rows in a short transaction. It cannot be mixed with general SQL.

Dispatch `action=apply-approved-batch` with the exact `batch_id` and a full
40-character `migration_ref`. The workflow checks out that ref in an isolated
directory, verifies every hash, validates the preflight ledger, uses a pinned
Supabase CA and short-lived database role, revokes that role even on failure,
then validates the postflight ledger. An unlisted batch, abbreviated ref, hash
drift, mode violation, missing prerequisite or already-recorded migration fails
before applying SQL.
