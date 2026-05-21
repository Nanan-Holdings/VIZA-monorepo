/**
 * Seed proxy_pool from a Bright Data IP allocation (PROV-005 / DATA-008).
 *
 * Reads a CSV file with `ip,region` rows (one per allocated residential
 * IP) and upserts proxy_pool rows. Sticky session id is derived from
 * `${BRIGHTDATA_ZONE}-${ip}` so the runner can recover a session from
 * the IP alone.
 *
 * Run:
 *   cd viza-be/submission-service
 *   BRIGHTDATA_ZONE=viza_prod npx ts-node scripts/seed-proxy-pool.ts \
 *     /path/to/bright-data-ips.csv
 *
 * Env knobs:
 *   BRIGHTDATA_ZONE   zone name used in the sticky_session_id prefix
 *   PROXY_SEED_DRY    "1" to print the planned upserts without writing
 */

import * as fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

interface CsvRow {
  ip: string;
  region: string | null;
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function parseCsv(content: string): CsvRow[] {
  const rows: CsvRow[] = [];
  const lines = content.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header) return rows;
  const cols = header.split(",").map((c) => c.trim().toLowerCase());
  const ipIdx = cols.indexOf("ip");
  const regionIdx = cols.indexOf("region");
  if (ipIdx === -1) throw new Error("CSV missing 'ip' column");
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    rows.push({
      ip: parts[ipIdx]?.trim() ?? "",
      region: regionIdx >= 0 ? (parts[regionIdx]?.trim() || null) : null,
    });
  }
  return rows.filter((r) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(r.ip));
}

async function main(): Promise<void> {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("usage: seed-proxy-pool <bright-data-csv>");
    process.exit(2);
  }
  const zone = process.env.BRIGHTDATA_ZONE;
  if (!zone) {
    console.error("BRIGHTDATA_ZONE env var required");
    process.exit(2);
  }
  const dry = process.env.PROXY_SEED_DRY === "1";

  const csv = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(csv);
  console.log(`[seed-proxy-pool] zone=${zone} ips=${rows.length} dry=${dry}`);

  const upserts = rows.map((r) => ({
    ip: r.ip,
    region: r.region,
    sticky_session_id: `${zone}-${r.ip}`,
    is_active: true,
    challenge_streak: 0,
    updated_at: new Date().toISOString(),
  }));

  if (dry) {
    for (const u of upserts) console.log(`  + ${u.sticky_session_id} (${u.region ?? "—"})`);
    return;
  }
  const { error } = await supabase
    .from("proxy_pool")
    .upsert(upserts, { onConflict: "sticky_session_id" });
  if (error) {
    console.error("[seed-proxy-pool] upsert failed:", error.message);
    process.exit(1);
  }
  console.log(`[seed-proxy-pool] upserted ${upserts.length} rows`);
}

main().catch((err) => {
  console.error("[seed-proxy-pool] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
