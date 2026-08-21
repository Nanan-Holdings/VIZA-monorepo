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
      migration_pairs: [{
        drizzle: drizzlePath,
        supabase: supabasePath,
        sha256: sameHash,
      }],
      no_mirror: [],
    },
    baseManifest: {
      schema_version: 1,
      historical_duplicate_drizzle_prefixes: {
        "0012": [
          "0012_match_visa_chunks.sql",
          "0012_vn_e_visa_package.sql",
        ],
      },
      migration_pairs: [],
      no_mirror: [],
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
    added_migrations: 2,
    migration_pairs: 1,
    no_mirror: 0,
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
