import "dotenv/config";
import { supabase } from "../../src/supabase";
import { requeueRunnerJob } from "../../src/queue/requeue-runner-job";

/**
 * QUE-008: recover retryable failed and dead-lettered runner_job rows.
 *
 *   # dry-run (default) — shows what WOULD change:
 *   npx ts-node scripts/queue/requeue-jobs.ts --country indonesia
 *   # apply:
 *   npx ts-node scripts/queue/requeue-jobs.ts --country indonesia --confirm
 *   npx ts-node scripts/queue/requeue-jobs.ts --id <runner_job_id> --confirm
 *
 * Eligible rows:
 *   - status in ('failed','dead_letter') with attempts < max_attempts
 *
 * Running rows are intentionally excluded. Automatic claim recovery owns
 * expired leases and must be the only path that reclaims them.
 *
 * The guarded requeue RPC applies the reset policy and preserves `attempts`.
 * Requires --confirm AND a --country or --id filter.
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

// Keep this byte-for-byte aligned with the quarantine reason in migration 0139.
// Invalid or retired flows are intentionally terminal and must never be
// requeued by this operator recovery tool.
const INVALID_FLOW_QUARANTINE_REASON =
  "Runner flow is retired or invalid; quarantined by concurrency fence.";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "true";
}

async function main(): Promise<void> {
  const confirm = arg("confirm") === "true";
  const country = arg("country");
  const id = arg("id");
  if (!country && !id) {
    console.error("Refusing to run without a --country or --id filter.");
    process.exit(2);
  }

  const cols =
    "id, application_id, country, status, attempts, max_attempts, last_error, leased_until";
  let base = supabase
    .from("runner_job")
    .select(cols)
    .in("status", ["failed", "dead_letter"]);
  if (id) base = base.eq("id", id);
  if (country) base = base.eq("country", country);
  const { data, error } = await base;
  if (error) throw new Error(`runner_job read: ${error.message}`);

  const eligible = ((data ?? []) as Row[]).filter(
    (r) =>
      r.attempts < r.max_attempts &&
      r.last_error !== INVALID_FLOW_QUARANTINE_REASON,
  );

  console.log(`Found ${eligible.length} eligible row(s)${confirm ? "" : " (dry-run)"}:`);
  for (const r of eligible) {
    console.log(`  ${r.id.slice(0, 8)}  ${r.country}  ${r.status}  att=${r.attempts}/${r.max_attempts}`);
  }

  if (!confirm) {
    console.log("\nDry-run only. Re-run with --confirm to requeue.");
    return;
  }

  let requeued = 0;
  for (const r of eligible) {
    let updated: boolean;
    try {
      updated = await requeueRunnerJob(supabase, r.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  failed to requeue ${r.id.slice(0, 8)}: ${message}`);
      continue;
    }
    if (!updated) {
      console.warn(`  skipped ${r.id.slice(0, 8)}: no longer eligible (concurrent update)`);
      continue;
    }
    requeued += 1;
  }
  console.log(`\nRequeued ${requeued}/${eligible.length} row(s).`);
}

main().catch((err) => {
  console.error("[requeue-jobs] error:", err);
  process.exit(1);
});
