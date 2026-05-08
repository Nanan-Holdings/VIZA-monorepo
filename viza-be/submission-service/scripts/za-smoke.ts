#!/usr/bin/env npx tsx
/**
 * South Africa eVisa prefill smoke test (AUTO-ZA-01).
 *
 * Synthetic answers, 90s wall cap, exits 0 on stopped_before_pay.
 *
 * Usage:
 *   npx tsx viza-be/submission-service/scripts/za-smoke.ts
 *   ZA_SMOKE_HEADFUL=1 npx tsx … (visible browser)
 */

import "dotenv/config";
import { runZaPrefill } from "../src/za/runner";

async function main() {
  const headful = process.env.ZA_SMOKE_HEADFUL === "1";
  const result = await Promise.race([
    runZaPrefill({
      jobId: `smoke-${Date.now()}`,
      applicationId: "smoke-app",
      headless: !headful,
      answers: {
        surname: "DOE",
        given_names: "JANE",
        date_of_birth: "1990-01-15",
        nationality: "CHN",
        passport_number: "X12345678",
        passport_expiry_date: "2030-12-31",
        passport_issuing_country: "CHN",
        email: "smoke@example.invalid",
        phone: "+8613000000000",
        intended_arrival_date: "2026-08-01",
        intended_departure_date: "2026-08-15",
        purpose_of_visit: "Tourism",
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
