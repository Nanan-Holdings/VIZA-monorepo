import "dotenv/config";
import { supabase } from "../../src/supabase";
import { normalizeCountry } from "../../src/queue/dispatch";

/**
 * QUE-009: one-time recovery for the orphaned-paid-orders incident.
 *
 *   # dry-run (default):
 *   npx ts-node scripts/queue/backfill-paid-orders.ts
 *   # apply:
 *   npx ts-node scripts/queue/backfill-paid-orders.ts --confirm
 *
 * Finds paid orders whose application has NO runner_job and NO
 * submission_queue row (conservative: any submission_queue row means the
 * legacy path owns it), then enqueues a runner_job using the same contract
 * as lib/queue/enqueue.ts (status='queued', attempts=0, max_attempts=3),
 * with country normalized per QUE-004. Depends on the QUE-002 worker being
 * live to drain the backfilled rows.
 */

interface OrderRow {
  id: string;
  application_id: string | null;
}

function hasConfirm(): boolean {
  return process.argv.includes("--confirm");
}

async function main(): Promise<void> {
  const confirm = hasConfirm();

  const { data: paidOrders, error: ordErr } = await supabase
    .from("order")
    .select("id, application_id")
    .eq("status", "paid");
  if (ordErr) throw new Error(`paid orders query: ${ordErr.message}`);

  const orders = ((paidOrders ?? []) as OrderRow[]).filter((o) => o.application_id);
  console.log(`Paid orders with an application: ${orders.length}`);

  let enqueued = 0;
  let skipped = 0;
  for (const order of orders) {
    const applicationId = order.application_id as string;

    const { data: existingJob } = await supabase
      .from("runner_job")
      .select("id")
      .eq("application_id", applicationId)
      .limit(1)
      .maybeSingle();
    if (existingJob) {
      skipped += 1;
      continue;
    }

    const { data: legacy } = await supabase
      .from("submission_queue")
      .select("id")
      .eq("application_id", applicationId)
      .limit(1)
      .maybeSingle();
    if (legacy) {
      skipped += 1;
      continue;
    }

    const { data: app } = await supabase
      .from("applications")
      .select("country")
      .eq("id", applicationId)
      .maybeSingle();
    if (!app?.country) {
      console.warn(`  skip ${applicationId}: no country on application`);
      skipped += 1;
      continue;
    }
    const country = normalizeCountry(app.country as string);

    console.log(`  ${confirm ? "enqueue" : "would enqueue"} app=${applicationId} country=${country}`);
    if (!confirm) {
      enqueued += 1;
      continue;
    }
    const { error: insErr } = await supabase.from("runner_job").insert({
      application_id: applicationId,
      country,
      status: "queued",
      attempts: 0,
      max_attempts: 3,
      correlation_id: `backfill:${order.id}`,
      metadata: { backfill: true },
    });
    if (insErr) {
      console.error(`  failed to enqueue ${applicationId}: ${insErr.message}`);
      continue;
    }
    enqueued += 1;
  }

  console.log(
    `\n${confirm ? "Enqueued" : "Would enqueue"} ${enqueued}; skipped ${skipped} (already queued or legacy-owned).`,
  );
  if (!confirm) console.log("Dry-run only. Re-run with --confirm to write.");
}

main().catch((err) => {
  console.error("[backfill-paid-orders] error:", err);
  process.exit(1);
});
