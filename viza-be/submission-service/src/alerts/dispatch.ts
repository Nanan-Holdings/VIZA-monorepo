import { supabase } from "../supabase.js";

/**
 * Unified failure alerting (OPS-003).
 *
 * Routes critical events to Slack (primary) and Resend (email backup).
 * Per-class throttle keeps a portal outage from firing 100 alerts —
 * the first ping breaks the throttle, repeats inside the window are
 * counted but not delivered until the window closes.
 *
 * Severity vocab:
 *   info   — informational (e.g. successful daily reconciliation)
 *   warn   — needs attention but no SLA breach yet
 *   error  — SLA-breaking; on-call should page
 *   critical — service-down; everyone on the channel
 */

export type AlertSeverity = "info" | "warn" | "error" | "critical";

export interface AlertInput {
  severity: AlertSeverity;
  /** Stable id for the failure class — used by the throttle. */
  class: string;
  title: string;
  body: string;
  /** Optional context — surface in the alert body and the artefact link. */
  jobId?: string;
  applicationId?: string;
  /**
   * Throttle window in seconds. Default 15 minutes. Suppresses repeats
   * inside the window — the first hit always fires, the rest land in
   * `alert_throttle.fire_count` for forensics.
   */
  throttleSeconds?: number;
}

const DEFAULT_THROTTLE_S = 15 * 60;
const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  info: ":white_check_mark:",
  warn: ":warning:",
  error: ":rotating_light:",
  critical: ":fire:",
};

const SEVERITY_TO_EMAIL: Record<AlertSeverity, boolean> = {
  info: false, // Slack only.
  warn: false,
  error: true,
  critical: true,
};

/**
 * @returns true if the caller should fire — false if throttled.
 *
 * Atomic insert-or-update keyed on `class`. Reads the prior
 * `last_fired_at` and only allows the fire when the elapsed time
 * exceeds `throttleSeconds`.
 */
export async function shouldFire(
  className: string,
  throttleSeconds: number,
): Promise<boolean> {
  const cutoffIso = new Date(Date.now() - throttleSeconds * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: existing, error: readErr } = await supabase
    .from("alert_throttle")
    .select("last_fired_at, fire_count")
    .eq("class", className)
    .maybeSingle();
  if (readErr) {
    // On a read error we err on the side of firing — better duplicate
    // alerts than silent outage.
    console.error(`[alerts] throttle read failed: ${readErr.message}`);
    return true;
  }
  if (!existing) {
    const { error: insErr } = await supabase
      .from("alert_throttle")
      .insert({ class: className, last_fired_at: nowIso, fire_count: 1 });
    if (insErr && insErr.code !== "23505") {
      console.error(`[alerts] throttle insert failed: ${insErr.message}`);
    }
    return true;
  }
  const fire = (existing.last_fired_at as string) < cutoffIso;
  if (fire) {
    await supabase
      .from("alert_throttle")
      .update({ last_fired_at: nowIso, fire_count: 1 })
      .eq("class", className);
    return true;
  }
  // Suppressed: bump the counter so we know how many we ate.
  await supabase
    .from("alert_throttle")
    .update({ fire_count: (existing.fire_count as number) + 1 })
    .eq("class", className);
  return false;
}

function dashboardLinks(input: AlertInput): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.haggstorm.com";
  const links: string[] = [];
  if (input.jobId) links.push(`${base}/admin/jobs/${input.jobId}`);
  if (input.applicationId)
    links.push(`${base}/admin/applications/${input.applicationId}`);
  return links.length > 0 ? `\n${links.join("\n")}` : "";
}

async function postSlack(input: AlertInput): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.warn("[alerts] SLACK_WEBHOOK_URL not set — skipping Slack");
    return;
  }
  const text =
    `${SEVERITY_EMOJI[input.severity]} *[${input.severity.toUpperCase()}] ${input.title}*\n` +
    `class: \`${input.class}\`` +
    dashboardLinks(input) +
    `\n\n${input.body}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error(`[alerts] Slack webhook returned ${res.status}`);
  }
}

async function postEmail(input: AlertInput): Promise<void> {
  const to = process.env.RESEND_OPS_ALERT_TO;
  const key = process.env.RESEND_API_KEY;
  if (!to || !key) {
    console.warn("[alerts] RESEND_* env not set — skipping email");
    return;
  }
  const subject = `[VIZA ${input.severity}] ${input.title}`;
  const text = `class: ${input.class}${dashboardLinks(input)}\n\n${input.body}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "VIZA OPS <ops@haggstorm.com>",
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) {
    console.error(`[alerts] Resend returned ${res.status}`);
  }
}

export async function sendAlert(input: AlertInput): Promise<{ fired: boolean }> {
  const window = input.throttleSeconds ?? DEFAULT_THROTTLE_S;
  const fire = await shouldFire(input.class, window);
  if (!fire) return { fired: false };
  // Slack always gets the alert; email fires only at error / critical.
  await postSlack(input);
  if (SEVERITY_TO_EMAIL[input.severity]) {
    await postEmail(input);
  }
  return { fired: true };
}
