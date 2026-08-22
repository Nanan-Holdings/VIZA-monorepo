#!/usr/bin/env npx tsx
/**
 * Drive one of the five tourist runners through the real queue dispatch table,
 * using an existing hosted application id — the same code path the runner_job
 * worker takes for an application created from /applications.
 *
 * It stops wherever the runner's own fail-closed gates stop it. It never
 * authorizes a charge, enters card data, clicks Pay, or submits an application:
 * those boundaries live inside each runner and are not overridden here.
 *
 * Usage:
 *   node --env-file=.env --env-file=../agent-backend/.env.local --import tsx \
 *     scripts/run-tourist-runner.ts <country> [applicationId]
 */
import "dotenv/config";
import { getRunOne } from "../src/queue/dispatch.js";
import { NeedsHumanError, RetryableRunnerError } from "../src/queue/types.js";
import {
  FIVE_TOURIST_APPLICATIONS,
  type TouristCountry,
} from "../src/tourist-qa-applications.js";

function classify(error: unknown): { kind: string; message: string } {
  if (error instanceof NeedsHumanError) {
    return { kind: "needs_human", message: error.message };
  }
  if (error instanceof RetryableRunnerError) {
    return { kind: "retryable", message: error.message };
  }
  return {
    kind: "unexpected_error",
    message: error instanceof Error ? error.message : String(error),
  };
}

async function main(): Promise<void> {
  const country = process.argv[2] as TouristCountry | undefined;
  if (!country || !(country in FIVE_TOURIST_APPLICATIONS)) {
    throw new Error(
      `Usage: run-tourist-runner.ts <${Object.keys(FIVE_TOURIST_APPLICATIONS).join("|")}> [applicationId]`,
    );
  }
  const applicationId = process.argv[3] ?? FIVE_TOURIST_APPLICATIONS[country].applicationId;

  const startedAt = Date.now();
  const runOne = getRunOne(country);
  try {
    const outcome = await runOne(applicationId, `qa-${country}-${startedAt}`);
    console.log(
      JSON.stringify(
        {
          country,
          applicationId,
          result: "completed",
          outcome: outcome.outcome,
          reachedStep: outcome.reachedStep,
          artefactCount: outcome.artefacts?.length ?? 0,
          elapsedMs: Date.now() - startedAt,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const { kind, message } = classify(error);
    console.log(
      JSON.stringify(
        { country, applicationId, result: kind, message, elapsedMs: Date.now() - startedAt },
        null,
        2,
      ),
    );
    process.exitCode = kind === "unexpected_error" ? 1 : 0;
  }
}

void main();
