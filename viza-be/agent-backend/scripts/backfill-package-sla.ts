#!/usr/bin/env npx tsx
/**
 * Weekly back-fill of package_sla from runner_metric (CS-005).
 *
 * For each (country, visa_type) with at least 5 succeeded jobs in
 * the trailing 90 days, compute median + p95 of `time_to_submit_s`,
 * convert to whole hours, and upsert package_sla with source='measured'.
 *
 * Schedule (suggested):
 *   0 4 * * 1   npx tsx viza-be/agent-backend/scripts/backfill-package-sla.ts
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const MIN_SAMPLES = 5;
const WINDOW_DAYS = 90;

interface MetricRow {
  country: string;
  application_id: string;
  time_to_submit_s: number | null;
  success: boolean;
  ts: string;
}

interface ApplicationRow {
  id: string;
  visa_type: string;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[idx];
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

  const { data: metrics, error } = await supabase
    .from("runner_metric")
    .select("country, application_id, time_to_submit_s, success, ts")
    .gte("ts", since)
    .eq("success", true);
  if (error) throw new Error(`metric read: ${error.message}`);
  const rows = (metrics ?? []) as MetricRow[];
  const appIds = Array.from(new Set(rows.map((r) => r.application_id))).filter(
    Boolean,
  );
  if (appIds.length === 0) {
    console.log("[backfill-sla] no metrics; nothing to do.");
    return;
  }
  const { data: apps } = await supabase
    .from("applications")
    .select("id, visa_type")
    .in("id", appIds);
  const visaByApp = new Map<string, string>();
  for (const a of (apps ?? []) as ApplicationRow[]) visaByApp.set(a.id, a.visa_type);

  const buckets = new Map<string, number[]>();
  for (const r of rows) {
    if (r.time_to_submit_s == null || r.time_to_submit_s <= 0) continue;
    const visa = visaByApp.get(r.application_id);
    if (!visa) continue;
    const key = `${r.country}|${visa}`;
    const arr = buckets.get(key) ?? [];
    arr.push(r.time_to_submit_s);
    buckets.set(key, arr);
  }

  let updated = 0;
  for (const [key, samples] of buckets) {
    if (samples.length < MIN_SAMPLES) continue;
    const [country, visaType] = key.split("|");
    const median = quantile(samples, 0.5);
    const p95 = quantile(samples, 0.95);
    const medianHours = Math.max(1, Math.round(median / 3600));
    const p95Hours = Math.max(1, Math.round(p95 / 3600));
    const { error: upErr } = await supabase
      .from("package_sla")
      .upsert(
        {
          country,
          visa_type: visaType,
          median_hours: medianHours,
          p95_hours: p95Hours,
          sample_size: samples.length,
          source: "measured",
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: "country,visa_type" },
      );
    if (upErr) {
      console.error(`[backfill-sla] upsert ${key} failed: ${upErr.message}`);
      continue;
    }
    console.log(
      `${country.padEnd(22)} ${visaType.padEnd(28)} median ${medianHours}h · p95 ${p95Hours}h · ${samples.length} samples`,
    );
    updated += 1;
  }
  console.log(`[backfill-sla] updated ${updated} packages.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(2);
});
