#!/usr/bin/env npx tsx
/**
 * Per-country worker autoscaler driver (INFRA-003).
 *
 * Reads `runner_queue_depth` and emits a `desired_workers` decision
 * per country. The actual driver — Fly Machines / Cloud Run jobs /
 * k8s HPA — consumes the JSON output via stdout.
 *
 * Decision rule (intentionally simple — bumps come from observed data):
 *   desired = clamp(ceil(queued / cap.max_concurrent), 0, cap.max_concurrent)
 *   if cap.paused → desired = 0
 *   if running > cap.max_concurrent → emit a concurrency-violation alert
 *
 * Usage:
 *   npx tsx viza-be/agent-backend/scripts/autoscale-runners.ts
 *   npx tsx viza-be/agent-backend/scripts/autoscale-runners.ts --json | xargs -I{} fly scale ...
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *               RESEND_OPS_ALERT_TO.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

interface QueueDepthRow {
  country: string;
  max_concurrent: number;
  paused: boolean;
  queued: number;
  running: number;
  failed_24h: number;
}

interface ScaleDecision {
  country: string;
  paused: boolean;
  cap: number;
  queued: number;
  running: number;
  desired: number;
  violation: boolean;
}

async function fetchDepth(): Promise<QueueDepthRow[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  const { data, error } = await supabase.from("runner_queue_depth").select("*");
  if (error) throw new Error(`runner_queue_depth read: ${error.message}`);
  return (data ?? []) as QueueDepthRow[];
}

function decide(rows: QueueDepthRow[]): ScaleDecision[] {
  return rows.map((r) => {
    const violation = r.running > r.max_concurrent;
    let desired: number;
    if (r.paused) {
      desired = 0;
    } else if (r.queued === 0) {
      desired = Math.min(r.running, r.max_concurrent);
    } else {
      desired = Math.min(
        r.max_concurrent,
        Math.max(1, Math.ceil(r.queued / Math.max(1, r.max_concurrent))),
      );
    }
    return {
      country: r.country,
      paused: r.paused,
      cap: r.max_concurrent,
      queued: r.queued,
      running: r.running,
      desired,
      violation,
    };
  });
}

async function alertViolations(violations: ScaleDecision[]): Promise<void> {
  if (violations.length === 0) return;
  const to = process.env.RESEND_OPS_ALERT_TO;
  if (!to) {
    console.warn("[autoscale] RESEND_OPS_ALERT_TO not set — skipping alert");
    return;
  }
  const body =
    `Per-country concurrency violation(s) detected.\n\n` +
    violations
      .map(
        (v) =>
          `  ${v.country}: running=${v.running} cap=${v.cap} queued=${v.queued}`,
      )
      .join("\n") +
    `\n\nRun investigations from /admin/queue (TBD) or directly via\n` +
    `  SELECT * FROM runner_queue_depth;`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "VIZA OPS <ops@haggstorm.com>",
      to,
      subject: "[VIZA] runner concurrency violation",
      text: body,
    }),
  });
  if (!res.ok) {
    console.error(`[autoscale] alert send failed: ${res.status}`);
  }
}

async function main() {
  const json = process.argv.includes("--json");
  const rows = await fetchDepth();
  const decisions = decide(rows);
  const violations = decisions.filter((d) => d.violation);
  await alertViolations(violations);

  if (json) {
    process.stdout.write(JSON.stringify(decisions, null, 2) + "\n");
    return;
  }
  for (const d of decisions) {
    console.log(
      `${d.country.padEnd(22)} cap=${d.cap} queued=${d.queued} running=${d.running} desired=${d.desired}${d.paused ? " (paused)" : ""}${d.violation ? " ⚠ VIOLATION" : ""}`,
    );
  }
  if (violations.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(2);
});
