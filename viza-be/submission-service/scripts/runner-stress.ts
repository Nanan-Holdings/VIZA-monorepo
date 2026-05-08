/**
 * Runner stress test (BOT-003).
 *
 * Drives one country's prefill runner against N synthetic staging
 * applicants, captures per-attempt status, and reports a pass rate.
 * Pass criterion: ≥95% reach `stopped_before_pay` (or `pay_success`
 * in pass-through mode).
 *
 * Run:
 *   npx ts-node scripts/runner-stress.ts <country> [N]
 *   N=10 by default. Country = kh|la|lk|za|in.
 *
 * Env knobs:
 *   STRESS_HEADFUL=1   show the browser
 *   STRESS_OUT_DIR     where to drop failure artifacts (default ./stress-out/<country>/<run>)
 *   STRESS_PARALLEL    concurrent attempts (default 1)
 *
 * On failure each attempt writes status.json next to whatever the
 * runner already captured via INFRA-006 artifact.put().
 */

import "dotenv/config";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { runKhPrefill } from "../src/kh/runner";
import { runLaPrefill } from "../src/la/runner";
import { runLkPrefill } from "../src/lk/runner";
import { runZaPrefill } from "../src/za/runner";
import { runInPrefill } from "../src/in/runner";

type RunnerResult = {
  status: string;
  reason?: string;
  reachedStep?: string;
  jobId?: string;
  errorCode?: string;
};

type RunnerFn = (input: { jobId: string; applicationId: string; headless: boolean; answers: Record<string, unknown> }) => Promise<RunnerResult>;

interface CountrySpec {
  code: string;
  runner: RunnerFn;
  baseAnswers: Record<string, unknown>;
}

const SPECS: Record<string, CountrySpec> = {
  kh: {
    code: "kh",
    runner: runKhPrefill as unknown as RunnerFn,
    baseAnswers: {
      surname: "DOE",
      given_names: "JANE",
      date_of_birth: "1990-01-15",
      nationality: "USA",
      passport_number: "X12345678",
      passport_expiry_date: "2030-12-31",
      passport_issuing_country: "USA",
      email: "stress@example.invalid",
      phone: "+15551234567",
      visa_purpose: "Tourist",
    },
  },
  la: {
    code: "la",
    runner: runLaPrefill as unknown as RunnerFn,
    baseAnswers: {
      surname: "DOE",
      given_names: "JANE",
      date_of_birth: "1990-01-15",
      nationality: "USA",
      passport_number: "X12345678",
      passport_expiry_date: "2030-12-31",
      email: "stress@example.invalid",
      phone: "+15551234567",
      intended_arrival_date: "2026-06-15",
      port_of_entry: "VTE",
      occupation: "Engineer",
    },
  },
  lk: {
    code: "lk",
    runner: runLkPrefill as unknown as RunnerFn,
    baseAnswers: {
      surname: "DOE",
      given_names: "JANE",
      date_of_birth: "1990-01-15",
      nationality: "USA",
      passport_number: "X12345678",
      passport_expiry_date: "2030-12-31",
      email: "stress@example.invalid",
      phone: "+15551234567",
      intended_arrival_date: "2026-06-15",
      port_of_arrival: "CMB",
      occupation: "Engineer",
      address_in_sri_lanka: "Hilton Colombo, 2 Sir Chittampalam A. Gardiner Mawatha",
      visa_variant: "tourist_double",
    },
  },
  za: {
    code: "za",
    runner: runZaPrefill as unknown as RunnerFn,
    baseAnswers: {
      surname: "DOE",
      given_names: "JANE",
      date_of_birth: "1990-01-15",
      nationality: "CHN",
      passport_number: "E12345678",
      passport_expiry_date: "2030-12-31",
      passport_issuing_country: "CHN",
      email: "stress@example.invalid",
      phone: "+15551234567",
      intended_arrival_date: "2026-06-15",
      intended_departure_date: "2026-06-22",
      purpose_of_visit: "Tourism",
      occupation: "Engineer",
    },
  },
  in: {
    code: "in",
    runner: runInPrefill as unknown as RunnerFn,
    baseAnswers: {
      surname: "DOE",
      given_names: "JANE",
      date_of_birth: "1990-01-15",
      nationality: "USA",
      passport_number: "X12345678",
      passport_expiry_date: "2030-12-31",
      email: "stress@example.invalid",
      phone: "+15551234567",
      visa_purpose: "tourism",
      intended_arrival_date: "2026-06-15",
      port_of_arrival: "DEL",
    },
  },
};

interface AttemptOutcome {
  index: number;
  status: string;
  reason?: string;
  reachedStep?: string;
  jobId: string;
  durationMs: number;
  pass: boolean;
}

const PASS_STATUSES = new Set(["stopped_before_pay", "pay_success", "submitted_to_government", "delivered"]);

async function runOne(spec: CountrySpec, index: number, headless: boolean): Promise<AttemptOutcome> {
  const jobId = `stress-${spec.code}-${Date.now()}-${index}`;
  const started = Date.now();
  try {
    const result = await Promise.race([
      spec.runner({
        jobId,
        applicationId: `stress-app-${index}`,
        headless,
        answers: { ...spec.baseAnswers, email: `stress+${index}@example.invalid` },
      }),
      new Promise<RunnerResult>((_, reject) =>
        setTimeout(() => reject(new Error("attempt timeout > 120s")), 120_000),
      ),
    ]);
    return {
      index,
      status: result.status,
      reason: result.reason,
      reachedStep: result.reachedStep,
      jobId,
      durationMs: Date.now() - started,
      pass: PASS_STATUSES.has(result.status),
    };
  } catch (err) {
    return {
      index,
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
      jobId,
      durationMs: Date.now() - started,
      pass: false,
    };
  }
}

async function main(): Promise<void> {
  const country = process.argv[2];
  const n = Math.max(1, Number(process.argv[3] || "10"));
  if (!country || !SPECS[country]) {
    console.error(`usage: runner-stress <kh|la|lk|za|in> [N=10]`);
    process.exit(2);
  }
  const spec = SPECS[country];
  const headless = process.env.STRESS_HEADFUL !== "1";
  const parallel = Math.max(1, Number(process.env.STRESS_PARALLEL || "1"));
  const cwd = path.resolve(__dirname, "..");
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = process.env.STRESS_OUT_DIR || path.join(cwd, "stress-out", country, runId);
  await fs.mkdir(outDir, { recursive: true });

  console.log(`[stress:${country}] N=${n} parallel=${parallel} headless=${headless} out=${outDir}`);

  const queue = Array.from({ length: n }, (_, i) => i);
  const results: AttemptOutcome[] = [];
  const inFlight = new Set<Promise<void>>();

  while (queue.length > 0 || inFlight.size > 0) {
    while (inFlight.size < parallel && queue.length > 0) {
      const idx = queue.shift()!;
      const p = runOne(spec, idx, headless).then((outcome) => {
        results.push(outcome);
        const tick = outcome.pass ? "PASS" : "FAIL";
        console.log(
          `[${country}] ${tick} #${idx} ${outcome.status} ${(outcome.durationMs / 1000).toFixed(1)}s ${outcome.reason ? `— ${outcome.reason}` : ""}`,
        );
      }).finally(() => {
        inFlight.delete(p);
      });
      inFlight.add(p);
    }
    if (inFlight.size > 0) await Promise.race(inFlight);
  }

  results.sort((a, b) => a.index - b.index);
  const passed = results.filter((r) => r.pass).length;
  const passRate = passed / results.length;
  const summary = {
    country,
    runId,
    n: results.length,
    passed,
    passRate,
    threshold: 0.95,
    headless,
    parallel,
    attempts: results,
  };
  await fs.writeFile(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(`\n[stress:${country}] ${passed}/${results.length} pass · ${(passRate * 100).toFixed(1)}% (need ≥95%)`);

  if (passRate < 0.95) {
    console.error(`[stress:${country}] FAIL — pass rate ${(passRate * 100).toFixed(1)}% below threshold`);
    process.exit(1);
  }
  console.log(`[stress:${country}] PASS`);
}

main().catch((err) => {
  console.error("[runner-stress] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(2);
});
