#!/usr/bin/env npx tsx
/**
 * Laos e-Visa prefill smoke test (AUTO-LA-01).
 *
 * Synthetic answers, 90s wall cap, exits 0 on stopped_before_pay.
 *
 * Usage:
 *   npx tsx viza-be/submission-service/scripts/la-smoke.ts
 *   LA_SMOKE_HEADFUL=1 npx tsx … (visible browser)
 */

import "dotenv/config";
import { runLaPrefill } from "../src/la/runner";

async function main() {
  const headful = process.env.LA_SMOKE_HEADFUL === "1";
  const result = await Promise.race([
    runLaPrefill({
      jobId: `smoke-${Date.now()}`,
      applicationId: "smoke-app",
      headless: !headful,
      answers: {
        surname: "DOE",
        given_names: "JANE",
        date_of_birth: "1990-01-15",
        nationality: "USA",
        passport_number: "X12345678",
        passport_expiry_date: "2030-12-31",
        passport_issuing_country: "USA",
        email: "smoke@example.invalid",
        phone: "+15551234567",
        intended_arrival_date: "2026-08-01",
        port_of_entry: "Wattay International Airport",
        occupation: "Engineer",
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("smoke timeout > 90s")), 90_000),
    ),
  ]);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "stopped_before_pay") {
    console.log("✅ runner reached the pre-pay checkpoint");
    process.exit(0);
  }
  console.error(`❌ ${result.status} — ${result.reason}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(2);
});
