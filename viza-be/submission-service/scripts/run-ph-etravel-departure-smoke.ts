#!/usr/bin/env npx tsx

// Dedicated safe-by-default entry point. The shared runner still refuses to
// click the official Submit button unless --submit is explicitly supplied.
process.argv.push("--travel-type", "departure");
void import("./run-ph-etravel-smoke").catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
