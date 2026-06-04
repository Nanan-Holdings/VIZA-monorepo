import "dotenv/config";
import { supabase } from "../../src/supabase";

/**
 * MIG-001: verify the queue tables + columns the runner pipeline depends on.
 *
 *   npx ts-node scripts/db/verify-queue-schema.ts
 *
 * Read-only. Probes each table via a `select <cols> limit 0` through
 * PostgREST (information_schema is not exposed via the Supabase client, so
 * a zero-row column probe is the read-only equivalent): a missing table or
 * column surfaces as a PostgREST error, which we collect. Exits non-zero
 * with a clear list of missing objects so CI (MIG-005) can gate deploys.
 */

interface TableSpec {
  table: string;
  columns: string[];
}

const SPECS: TableSpec[] = [
  {
    table: "runner_job",
    columns: [
      "id",
      "application_id",
      "country",
      "status",
      "attempts",
      "max_attempts",
      "leased_by",
      "leased_until",
      "correlation_id",
      "metadata",
      "last_error",
    ],
  },
  {
    // submission_queue.status is a free TEXT column (enum owned by the app
    // layer, incl. *_prefill_pending — see src/index.ts). We verify the
    // table + status column exist.
    table: "submission_queue",
    columns: ["id", "application_id", "status", "attempts", "last_error"],
  },
];

export async function verifyTable(spec: TableSpec): Promise<string[]> {
  const missing: string[] = [];
  // Probe each column individually so we can name the exact missing one.
  for (const col of spec.columns) {
    const { error } = await supabase.from(spec.table).select(col).limit(0);
    if (error) {
      // 42P01 = undefined_table, 42703 = undefined_column
      missing.push(`${spec.table}.${col} (${error.code ?? "?"}: ${error.message})`);
    }
  }
  return missing;
}

async function main(): Promise<void> {
  const allMissing: string[] = [];
  for (const spec of SPECS) {
    const missing = await verifyTable(spec);
    if (missing.length === 0) {
      console.log(`✓ ${spec.table}: all ${spec.columns.length} columns present`);
    } else {
      allMissing.push(...missing);
    }
  }
  if (allMissing.length > 0) {
    console.error(`\n✗ Missing schema objects (${allMissing.length}):`);
    for (const m of allMissing) console.error(`  - ${m}`);
    process.exit(1);
  }
  console.log("\n✓ Queue schema verification passed.");
}

main().catch((err) => {
  console.error("[verify-queue-schema] error:", err);
  process.exit(1);
});
