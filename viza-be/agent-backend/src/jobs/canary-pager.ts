/**
 * Canary downtime pager (ALERT-002).
 *
 * Reads the latest stress-test summaries (or the per-country canary
 * heartbeat in `portal_health`) and pages PagerDuty when a country has
 * been down for >10 minutes. Pulls runbook URL into the payload so the
 * on-call can ack and jump straight into ops/oncall.md.
 */

import { getSupabaseClient } from "../db/supabase-client.js";

const RUNBOOK_URL = process.env.ONCALL_RUNBOOK_URL || "https://www.viza.app/docs/operations/oncall.md";
const PAGERDUTY_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue";
const DOWNTIME_THRESHOLD_MS = 10 * 60 * 1000;

interface PortalHealthRow {
  country: string;
  status: string;
  last_ok_at: string | null;
  last_failure_at: string | null;
}

interface PagerDutyPayload {
  routing_key: string;
  event_action: "trigger" | "resolve";
  dedup_key: string;
  payload: {
    summary: string;
    severity: "critical" | "error" | "warning" | "info";
    source: string;
    custom_details: Record<string, unknown>;
  };
  links: Array<{ href: string; text: string }>;
}

async function postEvent(event: PagerDutyPayload): Promise<void> {
  await fetch(PAGERDUTY_EVENTS_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
}

export async function runCanaryPager(): Promise<{ paged: number; resolved: number }> {
  const routingKey = process.env.VIZA_RUNNER_PD_KEY;
  if (!routingKey) {
    console.log("[canary-pager] VIZA_RUNNER_PD_KEY not set — skipping");
    return { paged: 0, resolved: 0 };
  }
  const supabase = getSupabaseClient();
  const { data: rows, error } = await supabase
    .from("portal_health")
    .select("country, status, last_ok_at, last_failure_at");
  if (error) {
    console.error("[canary-pager] poll failed:", error.message);
    return { paged: 0, resolved: 0 };
  }

  let paged = 0;
  let resolved = 0;
  const now = Date.now();
  for (const row of (rows ?? []) as PortalHealthRow[]) {
    const dedup = `viza-runner-${row.country}`;
    const lastOkMs = row.last_ok_at ? Date.parse(row.last_ok_at) : 0;
    const lastFailMs = row.last_failure_at ? Date.parse(row.last_failure_at) : 0;
    const downtimeMs = now - lastOkMs;
    const triggered = row.status !== "ok" && downtimeMs > DOWNTIME_THRESHOLD_MS && lastFailMs > lastOkMs;
    if (triggered) {
      await postEvent({
        routing_key: routingKey,
        event_action: "trigger",
        dedup_key: dedup,
        payload: {
          summary: `${row.country} canary down for ${(downtimeMs / 60_000).toFixed(0)}m`,
          severity: "critical",
          source: "viza-canary",
          custom_details: { country: row.country, last_ok_at: row.last_ok_at, last_failure_at: row.last_failure_at },
        },
        links: [{ href: RUNBOOK_URL, text: "On-call runbook" }],
      });
      paged += 1;
    } else if (row.status === "ok") {
      await postEvent({
        routing_key: routingKey,
        event_action: "resolve",
        dedup_key: dedup,
        payload: {
          summary: `${row.country} canary recovered`,
          severity: "info",
          source: "viza-canary",
          custom_details: { country: row.country },
        },
        links: [{ href: RUNBOOK_URL, text: "On-call runbook" }],
      });
      resolved += 1;
    }
  }
  return { paged, resolved };
}
