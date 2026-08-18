#!/usr/bin/env npx tsx
/**
 * Manual entry point for the evidence-backed portal health service.
 *
 * Production scheduling calls POST /api/internal/status/probe. Keeping this
 * CLI on the same service prevents local/operator runs from updating only the
 * latest row while silently skipping history and incident transitions.
 */

import "dotenv/config";
import { runPortalHealthProbes } from "../src/services/portal-health.service.js";

async function main(): Promise<void> {
  const summary = await runPortalHealthProbes();
  console.log(JSON.stringify(summary, null, 2));
  if (summary.persistenceFailures > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Portal health probe failed");
  process.exitCode = 2;
});
