#!/usr/bin/env npx tsx
/**
 * SLA breach sweeper (CS-005).
 *
 * Fires once per hour. Walks every active runner_job (status in
 * queued / running / needs_human / paused) and compares
 * (now - enqueued_at) against package_sla.p95_hours. Anything past
 * p95 emits an OPS alert via Resend (class
 * `sla.breach.<country>`) and inserts a notification_event_log row
 * tagged `sla_breach_courtesy` so applicant comms wires can pick it
 * up and email a status update.
 *
 * Idempotency: throttle-keyed by (country, visa_type) at the alert
 * dispatcher; the courtesy log is gated by the per-job
 * `metadata.sla_courtesy_sent_at` flag so each job emits one
 * courtesy update per breach window.
 */

import "dotenv/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

interface JobRow {
  id: string;
  application_id: string;
  country: string;
  status: string;
  enqueued_at: string;
  metadata: Record<string, unknown> | null;
}

interface ApplicationRow {
  id: string;
  visa_type: string;
  applicant_id: string;
}

interface SlaRow {
  country: string;
  visa_type: string;
  p95_hours: number;
}

async function fireOpsAlert(
  classKey: string,
  title: string,
  body: string,
): Promise<void> {
  const to = process.env.RESEND_OPS_ALERT_TO;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "VIZA OPS <ops@haggstorm.com>",
      to,
      subject: `[VIZA] SLA breach — ${title}`,
      text: `class: ${classKey}\n${body}`,
    }),
  });
}

async function logCourtesyNeeded(
  admin: SupabaseClient,
  job: JobRow,
  app: ApplicationRow,
): Promise<void> {
  await admin.from("notification_event_log").insert({
    applicant_id: app.applicant_id,
    application_id: app.id,
    event: "sla_breach_courtesy",
    channel: "queued",
    outcome: "queued",
  });
  const merged = { ...(job.metadata ?? {}), sla_courtesy_sent_at: new Date().toISOString() };
  await admin
    .from("runner_job")
    .update({ metadata: merged })
    .eq("id", job.id);
}

async function main() {
  const admin = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );

  const { data: jobs } = await admin
    .from("runner_job")
    .select("id, application_id, country, status, enqueued_at, metadata")
    .in("status", ["queued", "running", "needs_human", "paused"]);
  const jobRows = (jobs ?? []) as JobRow[];
  if (jobRows.length === 0) {
    console.log("[sla-sweep] no active jobs.");
    return;
  }

  const appIds = Array.from(new Set(jobRows.map((j) => j.application_id)));
  const { data: apps } = await admin
    .from("applications")
    .select("id, visa_type, applicant_id")
    .in("id", appIds);
  const appById = new Map<string, ApplicationRow>();
  for (const a of (apps ?? []) as ApplicationRow[]) appById.set(a.id, a);

  const { data: slas } = await admin.from("package_sla").select("country, visa_type, p95_hours");
  const slaByKey = new Map<string, number>();
  for (const s of (slas ?? []) as SlaRow[]) {
    slaByKey.set(`${s.country}|${s.visa_type}`, s.p95_hours);
  }

  let breaches = 0;
  for (const job of jobRows) {
    const app = appById.get(job.application_id);
    if (!app) continue;
    const slaP95 = slaByKey.get(`${job.country}|${app.visa_type}`);
    if (!slaP95) continue;
    const elapsedHours = (Date.now() - Date.parse(job.enqueued_at)) / 3_600_000;
    if (elapsedHours <= slaP95) continue;
    breaches += 1;
    if (!(job.metadata as { sla_courtesy_sent_at?: string } | null)?.sla_courtesy_sent_at) {
      await logCourtesyNeeded(admin, job, app);
    }
    await fireOpsAlert(
      `sla.breach.${job.country}`,
      `${job.country} ${app.visa_type}`,
      `Job ${job.id.slice(0, 8)} application ${app.id.slice(0, 8)} elapsed ${elapsedHours.toFixed(1)}h > p95 ${slaP95}h`,
    );
  }
  console.log(`[sla-sweep] examined ${jobRows.length} active jobs · breaches ${breaches}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(2);
});
