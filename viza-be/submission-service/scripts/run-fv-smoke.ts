/**
 * Smoke runner for the France-Visas autofill pipeline.
 *
 * Loads credentials + answers from env + a JSON file and runs
 * `fillFranceVisasApplication()` end-to-end. Intended for local verification
 * of the scaffold before wiring the submission-queue worker.
 *
 * Usage:
 *   export FV_EMAIL=you@example.com
 *   export FV_PASSWORD='...'
 *   npx ts-node scripts/run-fv-smoke.ts ./answers.json [--headful]
 *
 * The script DOES create a draft application in the signed-in France-Visas
 * account (no final submission is performed). Delete the draft from the
 * accueil dashboard afterwards if you don't want it lingering.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fillFranceVisasApplication } from "../src/france-visas/run";
import type { FvApplicationAnswers } from "../src/france-visas/field-mappings";

function fail(msg: string): never {
  console.error(`[fv-smoke] ${msg}`);
  process.exit(1);
}

function loadAnswers(filePath: string): FvApplicationAnswers {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) fail(`answers file not found: ${abs}`);
  let raw: string;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch (err) {
    fail(`failed to read answers file: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`answers file is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  // Shallow validation of top-level keys; deeper shape is enforced by TS at
  // the callsite. Surface the missing-step cause clearly for the operator.
  const required: Array<keyof FvApplicationAnswers> = ["step1", "step2", "step3", "step4", "step5"];
  for (const key of required) {
    if (!(parsed as Record<string, unknown>)[key]) {
      fail(`answers file is missing required top-level key "${key}"`);
    }
  }
  return parsed as FvApplicationAnswers;
}

async function main(): Promise<void> {
  const email = process.env.FV_EMAIL;
  const password = process.env.FV_PASSWORD;
  if (!email || !password) fail("FV_EMAIL and FV_PASSWORD env vars are required");

  const [answersPath, ...flags] = process.argv.slice(2);
  if (!answersPath) fail("usage: run-fv-smoke.ts <answers.json> [--headful]");

  const headless = !flags.includes("--headful");
  const answers = loadAnswers(answersPath);
  const runId = `fv-smoke-${Date.now()}`;

  console.log(`[fv-smoke] Starting run ${runId} for ${email} (headless=${headless})`);

  const result = await fillFranceVisasApplication(
    { credentials: { email, password }, answers },
    { headless, runId },
  );

  if (result.status === "prefilled") {
    console.log(`[fv-smoke] ✓ Prefilled successfully. Steps: ${result.stepsCompleted.join(", ")}.`);
    if (result.draftReference) console.log(`[fv-smoke]   Draft reference (internal): ${result.draftReference}`);
    if (result.applicationReference) console.log(`[fv-smoke]   Application reference: ${result.applicationReference}`);
    if (result.pdfPath) console.log(`[fv-smoke]   PDF saved to: ${result.pdfPath}`);
    process.exit(0);
  } else {
    console.error(`[fv-smoke] ✗ Failed at ${result.failedStep}`);
    if (result.validationMessages.length > 0) {
      console.error(`[fv-smoke] Validation messages:`);
      for (const msg of result.validationMessages) console.error(`    - ${msg}`);
    }
    if (result.error) {
      console.error(`[fv-smoke] Error:`, JSON.stringify(result.error, null, 2));
    }
    console.error(`[fv-smoke] URL at failure: ${result.url}`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(`[fv-smoke] Unhandled error:`, err);
  process.exit(3);
});
