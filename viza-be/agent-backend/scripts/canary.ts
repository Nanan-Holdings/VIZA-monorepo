#!/usr/bin/env npx tsx
/**
 * Hourly per-portal canary (OPS-004).
 *
 * For each row in `portal_health`, fetch `probe_url` with a 15-second
 * timeout and upsert the result. Failures fire an OPS-003 alert via
 * Resend (a future Slack swap is one-line).
 *
 * Status rule:
 *   ok        — 2xx response under 5 s
 *   degraded  — 2xx under 15 s, OR 3xx, OR 4xx with anti-bot signature
 *   down      — 5xx, network error, or > 15 s timeout
 *   unknown   — initial seed value (never written by the canary)
 *
 * Alert classes:
 *   portal.health.<country>
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const TIMEOUT_MS = 15_000;
const FAST_THRESHOLD_MS = 5_000;

interface ProbeRow {
  country: string;
  probe_url: string | null;
}

interface ProbeResult {
  country: string;
  url: string;
  status: "ok" | "degraded" | "down";
  http_status: number | null;
  latency_ms: number;
  note: string;
  error: string | null;
}

async function probe(row: ProbeRow): Promise<ProbeResult> {
  const url = row.probe_url ?? "";
  if (!url) {
    return {
      country: row.country,
      url,
      status: "down",
      http_status: null,
      latency_ms: 0,
      note: "probe_url empty",
      error: "no probe_url configured",
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VIZA-canary/1.0; +https://haggstorm.com)",
        Accept: "text/html,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "manual",
    });
    const latency = Date.now() - start;
    const code = res.status;
    let status: ProbeResult["status"];
    let note = `${code} in ${latency}ms`;
    if (code >= 500) {
      status = "down";
    } else if (code >= 400) {
      status = "degraded";
      note += " (likely anti-bot or maintenance)";
    } else if (code >= 300) {
      status = "degraded";
      note += " (redirect)";
    } else if (latency > FAST_THRESHOLD_MS) {
      status = "degraded";
    } else {
      status = "ok";
    }
    return {
      country: row.country,
      url,
      status,
      http_status: code,
      latency_ms: latency,
      note,
      error: null,
    };
  } catch (err) {
    return {
      country: row.country,
      url,
      status: "down",
      http_status: null,
      latency_ms: Date.now() - start,
      note: "fetch error",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fireOpsAlert(result: ProbeResult): Promise<void> {
  const to = process.env.RESEND_OPS_ALERT_TO;
  if (!to || !process.env.RESEND_API_KEY) {
    console.warn(`[canary] alert env not set — skipping for ${result.country}`);
    return;
  }
  const text =
    `class: portal.health.${result.country}\n` +
    `${result.url}\n` +
    `status: ${result.status} (${result.http_status ?? "—"} in ${result.latency_ms}ms)\n` +
    `${result.note}\n${result.error ?? ""}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "VIZA OPS <ops@haggstorm.com>",
      to,
      subject: `[VIZA] portal canary ${result.status} — ${result.country}`,
      text,
    }),
  });
  if (!res.ok) {
    console.error(`[canary] alert send failed: ${res.status}`);
  }
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  const { data, error } = await supabase
    .from("portal_health")
    .select("country, probe_url");
  if (error) throw new Error(`portal_health read: ${error.message}`);

  const rows = (data ?? []) as ProbeRow[];
  const results = await Promise.all(rows.map(probe));

  for (const r of results) {
    const { error: upErr } = await supabase
      .from("portal_health")
      .update({
        status: r.status,
        http_status: r.http_status,
        latency_ms: r.latency_ms,
        note: r.note,
        error: r.error,
        last_run_at: new Date().toISOString(),
      })
      .eq("country", r.country);
    if (upErr) {
      console.error(`[canary] upsert ${r.country}: ${upErr.message}`);
    }
    console.log(
      `${r.country.padEnd(22)} ${r.status.padEnd(9)} ${r.http_status ?? "—"} ${r.latency_ms}ms`,
    );
    if (r.status !== "ok") {
      await fireOpsAlert(r);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(2);
});
