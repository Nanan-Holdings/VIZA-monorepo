import "dotenv/config";
import { supabase } from "../../src/supabase";

/**
 * QUE-008: recover stale-leased and dead-lettered runner_job rows.
 *
 *   # dry-run (default) — shows what WOULD change:
 *   npx ts-node scripts/queue/requeue-jobs.ts --country indonesia
 *   # apply:
 *   npx ts-node scripts/queue/requeue-jobs.ts --country indonesia --confirm
 *   npx ts-node scripts/queue/requeue-jobs.ts --id <runner_job_id> --confirm
 *
 * Eligible rows:
 *   - status='running' with leased_until < now  (crashed worker, stale lease)
 *   - status in ('failed','dead_letter') with attempts < max_attempts
 *
 * Reset policy: status → 'queued', clear leased_by/leased_until/finished_at.
 * `attempts` is PRESERVED (a stale lease didn't consume an attempt; a
 * failed row already counted its attempt and remains < max, so the worker
 * still has retries left). Requires --confirm AND a --country or --id filter.
 */

interface Row {
  id: string;
  application_id: string;
  country: string;
  status: string;
  attempts: number;
  max_attempts: number;
  leased_until: string | null;
}

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

  const cols = "id, application_id, country, status, attempts, max_attempts, leased_until";
  const nowIso = new Date().toISOString();

  let base = supabase.from("runner_job").select(cols);
  if (id) base = base.eq("id", id);
  if (country) base = base.eq("country", country);
  const { data, error } = await base;
  if (error) throw new Error(`runner_job read: ${error.message}`);

  const eligible = ((data ?? []) as Row[]).filter((r) => {
    const staleLease = r.status === "running" && r.leased_until != null && r.leased_until < nowIso;
    const retriable =
      (r.status === "failed" || r.status === "dead_letter") && r.attempts < r.max_attempts;
    return staleLease || retriable;
  });

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
    const { error: updErr } = await supabase
      .from("runner_job")
      .update({ status: "queued", leased_by: null, leased_until: null, finished_at: null })
      .eq("id", r.id);
    if (updErr) {
      console.error(`  failed to requeue ${r.id.slice(0, 8)}: ${updErr.message}`);
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
