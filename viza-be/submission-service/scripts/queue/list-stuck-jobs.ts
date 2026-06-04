import "dotenv/config";
import { supabase } from "../../src/supabase";

/**
 * QUE-007: read-only visibility into stuck runner_job rows.
 *
 *   npx ts-node scripts/queue/list-stuck-jobs.ts
 *
 * Surfaces:
 *   - failed / dead_letter rows (orphaned paid orders), and
 *   - running rows whose lease has expired (crashed worker).
 *
 * SELECT only — never mutates. Pair with requeue-jobs.ts (QUE-008) to recover.
 */

interface Row {
  id: string;
  application_id: string;
  country: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  leased_until: string | null;
}

function printRows(label: string, rows: Row[]): void {
  console.log(`\n=== ${label} (${rows.length}) ===`);
  for (const r of rows) {
    console.log(
      [
        r.id.slice(0, 8),
        r.country.padEnd(20),
        r.status.padEnd(12),
        `att=${r.attempts}/${r.max_attempts}`,
        `app=${r.application_id}`,
        r.last_error ? `err=${r.last_error.slice(0, 120)}` : "",
      ].join("  "),
    );
  }
}

async function main(): Promise<void> {
  const cols = "id, application_id, country, status, attempts, max_attempts, last_error, leased_until";

  const { data: failed, error: failedErr } = await supabase
    .from("runner_job")
    .select(cols)
    .in("status", ["failed", "dead_letter"])
    .order("enqueued_at", { ascending: true });
  if (failedErr) throw new Error(`failed/dead_letter query: ${failedErr.message}`);

  const { data: running, error: runErr } = await supabase
    .from("runner_job")
    .select(cols)
    .eq("status", "running")
    .lt("leased_until", new Date().toISOString())
    .order("leased_until", { ascending: true });
  if (runErr) throw new Error(`stale-lease query: ${runErr.message}`);

  printRows("failed / dead_letter", (failed ?? []) as Row[]);
  printRows("running with expired lease", (running ?? []) as Row[]);
  console.log(
    `\nTotal stuck: ${(failed?.length ?? 0) + (running?.length ?? 0)}. ` +
      `Recover with: npx ts-node scripts/queue/requeue-jobs.ts --country <c> --confirm`,
  );
}

main().catch((err) => {
  console.error("[list-stuck-jobs] error:", err);
  process.exit(1);
});
