import * as fs from "node:fs";
import * as path from "node:path";

/**
 * MIG-003: migration-lineage diff across the three sources.
 *
 *   npx ts-node scripts/db/diff-migrations.ts
 *
 * Filesystem-only (no DB connection). Lists migration filenames in each
 * source and flags filenames missing from any source. Referenced from
 * docs/db/migration-reconciliation-runbook.md.
 */

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const SOURCES: { name: string; dir: string }[] = [
  { name: "agent-backend/drizzle", dir: "viza-be/agent-backend/drizzle" },
  { name: "internal-website/supabase", dir: "viza-fe/internal-website/supabase/migrations" },
  { name: "db (root)", dir: "db" },
];

function listSql(dir: string): string[] {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function main(): void {
  const perSource = SOURCES.map((s) => ({ ...s, files: listSql(s.dir) }));

  console.log("=== Migration counts per source ===");
  for (const s of perSource) {
    console.log(`  ${s.name.padEnd(28)} ${s.files.length} file(s)  (${s.dir})`);
  }

  const union = new Set<string>();
  for (const s of perSource) for (const f of s.files) union.add(f);

  console.log("\n=== Filenames present in some sources but not others ===");
  const divergent: string[] = [];
  for (const f of [...union].sort()) {
    const present = perSource.filter((s) => s.files.includes(f));
    if (present.length !== perSource.filter((s) => s.files.length > 0).length) {
      divergent.push(f);
    }
  }
  if (divergent.length === 0) {
    console.log("  (no shared-name divergence — sources use independent naming schemes)");
  }
  for (const f of divergent) {
    const inSources = perSource.filter((s) => s.files.includes(f)).map((s) => s.name);
    console.log(`  ${f.padEnd(48)} only in: ${inSources.join(", ")}`);
  }

  console.log(
    "\nNote: the three sources use independent naming (drizzle 00NN_, supabase timestamped), so" +
      " cross-source filename overlap is expected to be low. Use the applied-migrations table in" +
      " prod (see migration-reconciliation-runbook.md) to compare what is actually applied.",
  );
}

main();
