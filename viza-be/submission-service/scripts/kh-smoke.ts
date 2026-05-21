#!/usr/bin/env npx tsx
/**
 * Cambodia e-Visa prefill smoke test (AUTO-KH-01).
 *
 * Runs `runKhPrefill` with synthetic but plausible answers and
 * verifies the runner reaches the review checkpoint without manual
 * intervention. Caps total runtime to 90s.
 *
 * Usage:
 *   npx tsx viza-be/submission-service/scripts/kh-smoke.ts
 *   KH_SMOKE_HEADFUL=1 npx tsx … (visible browser for triage)
 */

import "dotenv/config";
import { runKhPrefill } from "../src/kh/runner";

async function main() {
  const headful = process.env.KH_SMOKE_HEADFUL === "1";
  const result = await Promise.race([
    runKhPrefill({
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
        visa_purpose: "Tourist",
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
  console.error(`❌ runner did not stop before pay: ${result.status} — ${result.reason}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(2);
});
