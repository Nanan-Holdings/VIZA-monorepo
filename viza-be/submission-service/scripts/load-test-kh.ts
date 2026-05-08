/**
 * Load test runner for Cambodia (ANTIBOT-001).
 *
 * Drives N=50 sequential KH submissions over a configurable wall-clock
 * window and records the anti_bot_gate hit rate. Pass criterion: <5%.
 *
 * Run:
 *   cd viza-be/submission-service
 *   npx ts-node scripts/load-test-kh.ts
 *
 * Env knobs:
 *   LOAD_TEST_N            sequential runs (default 50)
 *   LOAD_TEST_WINDOW_HOURS spread runs over this many hours (default 6)
 *   LOAD_TEST_HEADFUL=1    show the browser
 */

import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { runKhPrefill } from "../src/kh/runner";

interface RunOutcome {
  index: number;
  status: string;
  reason?: string;
  durationMs: number;
  antiBotHit: boolean;
}

const ANTI_BOT_PATTERNS = [/anti_?bot/i, /cloudflare/i, /captcha/i, /challenge/i];

async function runOne(index: number, headless: boolean): Promise<RunOutcome> {
  const started = Date.now();
  try {
    const result = await Promise.race([
      runKhPrefill({
        jobId: `loadtest-kh-${Date.now()}-${index}`,
        applicationId: `loadtest-app-${index}`,
        headless,
        answers: {
          surname: "DOE",
          given_names: "JANE",
          date_of_birth: "1990-01-15",
          nationality: "USA",
          passport_number: `X${1000000 + index}`,
          passport_expiry_date: "2030-12-31",
          passport_issuing_country: "USA",
          email: `loadtest+${index}@example.invalid`,
          phone: "+15551234567",
          visa_purpose: "Tourist",
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("attempt timeout > 180s")), 180_000),
      ),
    ]);
    const reason = `${result.reason ?? ""} ${result.status}`;
    const antiBotHit = ANTI_BOT_PATTERNS.some((p) => p.test(reason));
    return {
      index,
      status: result.status,
      reason: result.reason,
      durationMs: Date.now() - started,
      antiBotHit,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      index,
      status: "error",
      reason: msg,
      durationMs: Date.now() - started,
      antiBotHit: ANTI_BOT_PATTERNS.some((p) => p.test(msg)),
    };
  }
}

async function main(): Promise<void> {
  const n = Math.max(1, Number(process.env.LOAD_TEST_N || "50"));
  const windowHours = Math.max(0.1, Number(process.env.LOAD_TEST_WINDOW_HOURS || "6"));
  const headless = process.env.LOAD_TEST_HEADFUL !== "1";
  const intervalMs = (windowHours * 60 * 60 * 1000) / n;
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(__dirname, "..", "load-test-results", date);
  await fs.mkdir(outDir, { recursive: true });

  console.log(`[load-test:kh] n=${n} windowHours=${windowHours} interval=${(intervalMs/1000).toFixed(0)}s headless=${headless}`);

  const outcomes: RunOutcome[] = [];
  for (let i = 0; i < n; i += 1) {
    const outcome = await runOne(i, headless);
    outcomes.push(outcome);
    const tag = outcome.antiBotHit ? "ANTI-BOT" : outcome.status;
    console.log(
      `[${i + 1}/${n}] ${tag} ${(outcome.durationMs / 1000).toFixed(1)}s${outcome.reason ? ` — ${outcome.reason}` : ""}`,
    );
    if (i < n - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }

  const antiBotCount = outcomes.filter((o) => o.antiBotHit).length;
  const passed = outcomes.filter((o) => o.status === "stopped_before_pay" && !o.antiBotHit).length;
  const avgDurationMs = outcomes.reduce((s, o) => s + o.durationMs, 0) / outcomes.length;
  const summary = {
    country: "kh",
    runId: new Date().toISOString().replace(/[:.]/g, "-"),
    n,
    windowHours,
    headless,
    antiBotCount,
    antiBotRate: antiBotCount / n,
    passed,
    averageDurationMs: avgDurationMs,
    threshold: 0.05,
    passedThreshold: antiBotCount / n < 0.05,
    outcomes,
  };
  await fs.writeFile(path.join(outDir, "kh.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(
    `[load-test:kh] anti_bot_gate=${antiBotCount}/${n} (${((antiBotCount / n) * 100).toFixed(1)}%) avg=${(avgDurationMs / 1000).toFixed(0)}s pass=${summary.passedThreshold ? "yes" : "no"}`,
  );
  if (!summary.passedThreshold) process.exit(1);
}

main().catch((err) => {
  console.error("[load-test:kh] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(2);
});
