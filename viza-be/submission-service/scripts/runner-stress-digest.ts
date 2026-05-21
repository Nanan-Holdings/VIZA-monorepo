/**
 * Aggregates per-country stress run summaries into a single digest
 * and (optionally) posts to Slack via STRESS_SLACK_WEBHOOK.
 *
 * Run:
 *   npx ts-node scripts/runner-stress-digest.ts <stress-out-root>
 *
 * Walks <root>/<country>/<runId>/summary.json (latest run per country)
 * and prints a Markdown digest to stdout. CI uses stdout to populate
 * the Slack message body; if STRESS_SLACK_WEBHOOK is set the digest
 * is also POSTed there.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

interface CountryDigest {
  country: string;
  runId: string;
  passed: number;
  n: number;
  passRate: number;
  regressed: boolean;
  topFailureReasons: string[];
}

async function latestRunSummary(countryDir: string): Promise<{ runId: string; summary: any } | null> {
  let runs: string[] = [];
  try {
    runs = await fs.readdir(countryDir);
  } catch {
    return null;
  }
  runs.sort();
  for (const runId of runs.reverse()) {
    const p = path.join(countryDir, runId, "summary.json");
    try {
      const raw = await fs.readFile(p, "utf8");
      return { runId, summary: JSON.parse(raw) };
    } catch {
      continue;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const root = process.argv[2];
  if (!root) {
    console.error("usage: runner-stress-digest <stress-out-root>");
    process.exit(2);
  }
  const countries: CountryDigest[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    console.error(`[digest] root not found: ${root}`);
    process.exit(2);
  }

  for (const code of entries.sort()) {
    const countryDir = path.join(root, code);
    const stat = await fs.stat(countryDir).catch(() => null);
    if (!stat?.isDirectory()) continue;
    const latest = await latestRunSummary(countryDir);
    if (!latest) continue;
    const s = latest.summary;
    const failures = (s.attempts || []).filter((a: { pass: boolean }) => !a.pass);
    const reasons = failures
      .map((a: { reason?: string; status: string }) => a.reason || a.status)
      .slice(0, 3);
    countries.push({
      country: code,
      runId: latest.runId,
      passed: s.passed,
      n: s.n,
      passRate: s.passRate,
      regressed: s.passRate < 0.95,
      topFailureReasons: reasons,
    });
  }

  const regressedCount = countries.filter((c) => c.regressed).length;
  const lines: string[] = [];
  lines.push(`*Runner stress digest* — ${regressedCount === 0 ? "all green" : `${regressedCount} regressed`}`);
  lines.push("```");
  lines.push("country  pass     rate    notes");
  for (const c of countries) {
    const tag = c.regressed ? "⚠" : "✓";
    const reasons = c.topFailureReasons.length > 0 ? `: ${c.topFailureReasons.join(" | ")}` : "";
    lines.push(
      `${tag} ${c.country.padEnd(5)} ${`${c.passed}/${c.n}`.padEnd(7)} ${(c.passRate * 100).toFixed(0).padStart(3)}%   ${reasons}`,
    );
  }
  lines.push("```");
  const message = lines.join("\n");
  console.log(message);

  const webhook = process.env.STRESS_SLACK_WEBHOOK;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (!res.ok) {
        console.error(`[digest] slack post failed status=${res.status}`);
        process.exit(1);
      }
      console.log("[digest] posted to slack");
    } catch (err) {
      console.error("[digest] slack post error:", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  }

  if (regressedCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[digest] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(2);
});
