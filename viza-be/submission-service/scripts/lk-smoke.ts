#!/usr/bin/env npx tsx
import "dotenv/config";
import { runLkPrefill } from "../src/lk/runner";

async function main() {
  const headful = process.env.LK_SMOKE_HEADFUL === "1";
  const result = await Promise.race([
    runLkPrefill({
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
        port_of_arrival: "Bandaranaike International Airport",
        occupation: "Engineer",
        address_in_sri_lanka: "Cinnamon Grand Colombo",
        visa_variant: "Tourist single",
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
