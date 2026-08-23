import assert from "node:assert/strict";
import test from "node:test";

import {
  validateMigrationGovernance,
} from "../database-migration-governance.mjs";

const drizzleRoot = "viza-be/agent-backend/drizzle";
const supabaseRoot = "viza-fe/internal-website/supabase/migrations";
const sameHash = "a".repeat(64);

function validSql() {
  return Buffer.from(`
CREATE TABLE public.example_records (id uuid PRIMARY KEY);
ALTER TABLE public.example_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.example_records FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.example_records TO service_role;

CREATE FUNCTION public.example_internal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$ BEGIN NULL; END; $$;
REVOKE ALL ON FUNCTION public.example_internal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.example_internal() TO service_role;

CREATE VIEW public.example_records_view
WITH (security_invoker = true)
AS SELECT id FROM public.example_records;
`);
}

function fixture(overrides = {}) {
  const drizzlePath = `${drizzleRoot}/0158_database_access_baseline.sql`;
  const supabasePath = `${supabaseRoot}/20260822000000_database_access_baseline.sql`;
  const bytes = validSql();
  return {
    manifest: {
      schema_version: 1,
      historical_duplicate_drizzle_prefixes: {
        "0012": [
          "0012_match_visa_chunks.sql",
          "0012_vn_e_visa_package.sql",
        ],
      },
      historical_duplicate_supabase_versions: {},
      migration_pairs: [{
        drizzle: drizzlePath,
        supabase: supabasePath,
        sha256: sameHash,
      }],
      no_mirror: [],
      unapplied_migration_renames: [],
      applied_migration_renames: [],
    },
    baseManifest: {
      schema_version: 1,
      historical_duplicate_drizzle_prefixes: {
        "0012": [
          "0012_match_visa_chunks.sql",
          "0012_vn_e_visa_package.sql",
        ],
      },
      historical_duplicate_supabase_versions: {},
      migration_pairs: [],
      no_mirror: [],
      unapplied_migration_renames: [],
      applied_migration_renames: [],
    },
    baseFiles: [
      `${drizzleRoot}/0012_match_visa_chunks.sql`,
      `${drizzleRoot}/0012_vn_e_visa_package.sql`,
    ],
    currentFiles: [
      `${drizzleRoot}/0012_match_visa_chunks.sql`,
      `${drizzleRoot}/0012_vn_e_visa_package.sql`,
      drizzlePath,
      supabasePath,
    ],
    changes: [
      { status: "A", path: drizzlePath },
      { status: "A", path: supabasePath },
    ],
    readFile: (filePath) => {
      if (filePath === drizzlePath || filePath === supabasePath) return bytes;
      return Buffer.from("SELECT 1;");
    },
    hash: () => sameHash,
    ...overrides,
  };
}

test("accepts an exact new mirror pair with secure public objects", () => {
  const result = validateMigrationGovernance(fixture());
  assert.deepEqual(result, {
    historical_duplicate_groups: 1,
    historical_supabase_duplicate_versions: 0,
    added_migrations: 2,
    migration_pairs: 1,
    no_mirror: 0,
    unapplied_migration_renames: 0,
    applied_migration_renames: 0,
  });
});

test("accepts an empty approval manifest when a change adds no migration", () => {
  const input = fixture({
    currentFiles: [
      `${drizzleRoot}/0012_match_visa_chunks.sql`,
      `${drizzleRoot}/0012_vn_e_visa_package.sql`,
    ],
    changes: [],
  });
  input.manifest.migration_pairs = [];
  const result = validateMigrationGovernance(input);
  assert.equal(result.added_migrations, 0);
  assert.equal(result.migration_pairs, 0);
});

test("rejects changes, renames, or deletes of an existing migration", () => {
  assert.throws(
    () => validateMigrationGovernance(fixture({
      changes: [{ status: "M", path: `${drizzleRoot}/0012_match_visa_chunks.sql` }],
    })),
    /Existing migration files are immutable/u,
  );
});

test("accepts an exact byte-preserving rename only for a verified unapplied migration", () => {
  const input = fixture();
  const oldPath = input.manifest.migration_pairs[0].drizzle;
  const newPath = `${drizzleRoot}/0162_database_access_baseline.sql`;
  input.currentFiles = input.currentFiles.map((filePath) =>
    filePath === oldPath ? newPath : filePath);
  input.changes = [
    { status: "R", path: oldPath, renamedTo: newPath, renameScore: 100 },
    { status: "A", path: newPath, renamedFrom: oldPath, renameScore: 100 },
  ];
  input.manifest.migration_pairs[0].drizzle = newPath;
  input.manifest.unapplied_migration_renames.push({
    from: oldPath,
    to: newPath,
    sha256: sameHash,
    reason: "Repair a numbering collision before production apply",
    verified_unapplied_at: "2026-08-23T04:00:00Z",
    production_ledger_versions_absent: ["20260822000000"],
  });

  const result = validateMigrationGovernance(input);
  assert.equal(result.added_migrations, 1);
  assert.equal(result.unapplied_migration_renames, 1);
});

test("accepts an exact Supabase filename reconciliation for a verified applied ledger entry", () => {
  const input = fixture();
  const oldPath = input.manifest.migration_pairs[0].supabase;
  const newPath = `${supabaseRoot}/20260821125959_database_access_baseline.sql`;
  input.baseManifest.migration_pairs = [{ ...input.manifest.migration_pairs[0] }];
  input.currentFiles = input.currentFiles.map((filePath) =>
    filePath === oldPath ? newPath : filePath);
  input.changes = [
    { status: "R", path: oldPath, renamedTo: newPath, renameScore: 100 },
    { status: "A", path: newPath, renamedFrom: oldPath, renameScore: 100 },
  ];
  input.manifest.migration_pairs[0].supabase = newPath;
  input.manifest.applied_migration_renames.push({
    from: oldPath,
    to: newPath,
    sha256: sameHash,
    reason: "Match the repository filename to the exact production ledger version",
    verified_applied_at: "2026-08-23T20:14:31Z",
    project_ref: "oyjxdzsoejraedqghndi",
    production_ledger_version_present: "20260821125959",
    production_ledger_name: "database_access_baseline",
    production_ledger_versions_absent: ["20260822000000"],
    evidence_run_id: 32663790378,
    production_ledger_statement_count: 1,
    production_ledger_statements_sha256: sameHash,
    production_ledger_normalization: "single_statement_lf_without_final_newline",
    production_state_contract: {
      kind: "jp_vjw_official_accommodation_fields_v1",
      row_count: 6,
      sha256: "b".repeat(64),
    },
  });

  const result = validateMigrationGovernance(input);
  assert.equal(result.added_migrations, 1);
  assert.equal(result.applied_migration_renames, 1);
});

test("rejects applied-ledger renames without exact version, name, hash, and Git evidence", () => {
  const input = fixture();
  const oldPath = input.manifest.migration_pairs[0].supabase;
  const newPath = `${supabaseRoot}/20260821125959_database_access_baseline.sql`;
  input.baseManifest.migration_pairs = [{ ...input.manifest.migration_pairs[0] }];
  input.currentFiles = input.currentFiles.map((filePath) =>
    filePath === oldPath ? newPath : filePath);
  input.changes = [
    { status: "R", path: oldPath, renamedTo: newPath, renameScore: 100 },
    { status: "A", path: newPath, renamedFrom: oldPath, renameScore: 100 },
  ];
  input.manifest.migration_pairs[0].supabase = newPath;
  input.manifest.applied_migration_renames.push({
    from: oldPath,
    to: newPath,
    sha256: sameHash,
    reason: "Match the repository filename to the exact production ledger version",
    verified_applied_at: "2026-08-23T20:14:31Z",
    project_ref: "oyjxdzsoejraedqghndi",
    production_ledger_version_present: "20260822000000",
    production_ledger_name: "database_access_baseline",
    production_ledger_versions_absent: ["20260822000000"],
    evidence_run_id: 32663790378,
    production_ledger_statement_count: 1,
    production_ledger_statements_sha256: sameHash,
    production_ledger_normalization: "single_statement_lf_without_final_newline",
    production_state_contract: {
      kind: "jp_vjw_official_accommodation_fields_v1",
      row_count: 6,
      sha256: "b".repeat(64),
    },
  });

  assert.throws(
    () => validateMigrationGovernance(input),
    /Applied migration rename requires exact production-ledger evidence/u,
  );

  input.manifest.applied_migration_renames[0].production_ledger_version_present =
    "20260821125959";
  input.manifest.applied_migration_renames[0].project_ref = "aaaaaaaaaaaaaaaaaaaa";
  assert.throws(
    () => validateMigrationGovernance(input),
    /Applied migration rename requires exact production-ledger evidence/u,
  );
});

test("rejects unapproved or content-changing migration renames", () => {
  const oldPath = `${drizzleRoot}/0158_database_access_baseline.sql`;
  const newPath = `${drizzleRoot}/0162_database_access_baseline.sql`;
  const renamed = fixture({
    currentFiles: [
      `${drizzleRoot}/0012_match_visa_chunks.sql`,
      `${drizzleRoot}/0012_vn_e_visa_package.sql`,
      newPath,
      `${supabaseRoot}/20260822000000_database_access_baseline.sql`,
    ],
    changes: [
      { status: "R", path: oldPath, renamedTo: newPath, renameScore: 100 },
      { status: "A", path: newPath, renamedFrom: oldPath, renameScore: 100 },
    ],
  });
  renamed.manifest.migration_pairs[0].drizzle = newPath;
  assert.throws(
    () => validateMigrationGovernance(renamed),
    /Existing migration files are immutable/u,
  );

  renamed.manifest.unapplied_migration_renames.push({
    from: oldPath,
    to: newPath,
    sha256: sameHash,
    reason: "Repair a numbering collision before production apply",
    verified_unapplied_at: "2026-08-23T04:00:00Z",
    production_ledger_versions_absent: ["20260822000000"],
  });
  renamed.changes[0].renameScore = 99;
  renamed.changes[1].renameScore = 99;
  assert.throws(
    () => validateMigrationGovernance(renamed),
    /100% byte-preserving/u,
  );
});

test("rejects any duplicate Drizzle prefix outside the exact historical allowlist", () => {
  const input = fixture();
  const duplicate = `${drizzleRoot}/0158_second.sql`;
  input.currentFiles.push(duplicate);
  input.changes.push({ status: "A", path: duplicate });
  input.manifest.no_mirror.push({
    path: duplicate,
    sha256: sameHash,
    reason: "server-only migration",
  });
  assert.throws(
    () => validateMigrationGovernance(input),
    /Unexpected duplicate Drizzle migration prefix 0158/u,
  );
});

test("requires every new migration to have exactly one mirror or no-mirror decision", () => {
  const input = fixture();
  input.manifest.migration_pairs = [];
  assert.throws(
    () => validateMigrationGovernance(input),
    /not classified exactly once/u,
  );
});

test("pins mirror bytes and prevents historical manifest rewrites", () => {
  assert.throws(
    () => validateMigrationGovernance(fixture({ hash: () => "drifted-hash" })),
    /hash mismatch/u,
  );

  const input = fixture();
  input.manifest.historical_duplicate_drizzle_prefixes["0012"] = [
    "0012_match_visa_chunks.sql",
    "0012_rewritten_history.sql",
  ];
  assert.throws(
    () => validateMigrationGovernance(input),
    /Historical duplicate allowlist is immutable/u,
  );
});

test("requires RLS and explicit ACL for every new public table", () => {
  const input = fixture({
    readFile: () => Buffer.from("CREATE TABLE public.unsafe_records (id uuid PRIMARY KEY);"),
  });
  assert.throws(
    () => validateMigrationGovernance(input),
    /public\.unsafe_records.*enable RLS/u,
  );
});

test("requires empty search_path for SECURITY DEFINER and security_invoker views", () => {
  const secdef = fixture({
    readFile: () => Buffer.from(`
      CREATE FUNCTION public.unsafe() RETURNS void LANGUAGE sql SECURITY DEFINER
      AS $$ SELECT NULL; $$;
    `),
  });
  assert.throws(
    () => validateMigrationGovernance(secdef),
    /SECURITY DEFINER.*empty search_path/u,
  );

  const view = fixture({
    readFile: () => Buffer.from("CREATE VIEW public.unsafe_view AS SELECT 1 AS value;"),
  });
  assert.throws(
    () => validateMigrationGovernance(view),
    /public\.unsafe_view.*security_invoker/u,
  );
});

test("comments, quoted identifiers, UNLOGGED tables, and non-public definer routines cannot bypass guards", () => {
  const quotedTable = fixture({
    readFile: () => Buffer.from(
      'CREATE/* hidden */UNLOGGED TABLE "public"."unsafe_records" (id uuid);',
    ),
  });
  assert.throws(
    () => validateMigrationGovernance(quotedTable),
    /unsafe_records.*enable RLS/u,
  );

  const definerProcedure = fixture({
    readFile: () => Buffer.from(`
      CREATE PROCEDURE "private"."unsafe"()
      LANGUAGE plpgsql SECURITY/* hidden */DEFINER
      AS $$ BEGIN NULL; END; $$;
    `),
  });
  assert.throws(
    () => validateMigrationGovernance(definerProcedure),
    /SECURITY DEFINER.*empty search_path/u,
  );

  const quotedView = fixture({
    readFile: () => Buffer.from('CREATE VIEW "public"."unsafe_view" AS SELECT 1 AS value;'),
  });
  assert.throws(
    () => validateMigrationGovernance(quotedView),
    /unsafe_view.*security_invoker/u,
  );
});

test("new Supabase migrations require a unique 14-digit timestamp", () => {
  const input = fixture();
  const duplicate = `${supabaseRoot}/20260822000000_second.sql`;
  input.currentFiles.push(duplicate);
  input.changes.push({ status: "A", path: duplicate });
  input.manifest.no_mirror.push({
    path: duplicate,
    sha256: sameHash,
    reason: "Supabase-only test migration",
  });
  assert.throws(
    () => validateMigrationGovernance(input),
    /Duplicate Supabase migration version 20260822000000/u,
  );

  const shortVersion = fixture();
  const original = shortVersion.manifest.migration_pairs[0].supabase;
  const replacement = `${supabaseRoot}/20260822_short.sql`;
  shortVersion.currentFiles = shortVersion.currentFiles.map((filePath) =>
    filePath === original ? replacement : filePath);
  shortVersion.changes = shortVersion.changes.map((change) =>
    change.path === original ? { ...change, path: replacement } : change);
  shortVersion.manifest.migration_pairs[0].supabase = replacement;
  assert.throws(
    () => validateMigrationGovernance(shortVersion),
    /14-digit timestamp/u,
  );
});
