import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/**
 * OBSV-006: synthetic end-to-end smoke — enqueue a fixture runner_job for one
 * country and wait for it to reach a terminal status, against a STAGING DB.
 *
 *   SMOKE_APPLICATION_ID=<uuid> npx tsx scripts/launch/e2e-smoke.ts --country indonesia --confirm
 *
 * Guards: refuses to run without --confirm AND a non-prod env. NEVER point at
 * prod — the env check fails fast if SUPABASE_URL looks like the prod project.
 * Documented in docs/launch/launch-checklist.md.
 */
const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "true";
}

const PROD_PROJECT_REF = "oyjxdzsoejraedqghndi"; // prod Supabase ref — never smoke here.

async function main(): Promise<void> {
  const confirm = arg("confirm") === "true";
  const country = arg("country") ?? "indonesia";
  const applicationId = process.env.SMOKE_APPLICATION_ID;
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!confirm) {
    console.error("Refusing to run without --confirm.");
    process.exit(2);
  }
  if (process.env.NODE_ENV === "production" || url.includes(PROD_PROJECT_REF)) {
    console.error("Refusing to run against production. Point SUPABASE_URL at staging.");
    process.exit(2);
  }
  if (!url || !key || !applicationId) {
    console.error("Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SMOKE_APPLICATION_ID.");
    process.exit(2);
  }

  const supabase = createClient(url, key);
  const { data: inserted, error } = await supabase
    .from("runner_job")
    .insert({ application_id: applicationId, country, status: "queued", attempts: 0, max_attempts: 3, correlation_id: "e2e-smoke", metadata: { smoke: true } })
    .select("id")
    .single();
  if (error || !inserted) {
    console.error(`enqueue failed: ${error?.message}`);
    process.exit(1);
  }
  const jobId = inserted.id as string;
  console.log(`[smoke] enqueued runner_job ${jobId} for ${country}; waiting for terminal status...`);

  const TERMINAL = new Set(["succeeded", "failed", "dead_letter"]);
  const deadline = Date.now() + 5 * 60 * 1000;
  for (;;) {
    if (Date.now() > deadline) {
      console.error("[smoke] timed out waiting for terminal status");
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 5000));
    const { data: row } = await supabase.from("runner_job").select("status").eq("id", jobId).maybeSingle();
    const status = row?.status as string | undefined;
    if (status && TERMINAL.has(status)) {
      console.log(`[smoke] terminal status: ${status}`);
      process.exit(status === "succeeded" ? 0 : 1);
    }
  }
}

main().catch((err) => {
  console.error("[smoke] error:", err);
  process.exit(1);
});
