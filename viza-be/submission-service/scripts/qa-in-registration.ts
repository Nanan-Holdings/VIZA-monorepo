#!/usr/bin/env npx tsx
/**
 * QA harness: drive the India e-Visa runner through the live registration
 * page (via Bright Data proxy + 2Captcha) and HALT before submit.
 * Longer wall cap than in-smoke to accommodate proxy latency + captcha.
 */
import "dotenv/config";
import { runInPrefill } from "../src/in/runner";

async function main(): Promise<void> {
  const result = await Promise.race([
    runInPrefill({
      jobId: `qa-in-${Date.now()}`,
      applicationId: "qa-in",
      headless: process.env.IN_SMOKE_HEADFUL !== "1",
      answers: {
        surname: "DOE",
        given_names: "JANE",
        date_of_birth: "15/01/1990",
        nationality: "USA",
        passport_number: "X12345678",
        passport_expiry_date: "31/12/2030",
        passport_issuing_country: "USA",
        email: "qa-smoke@example.invalid",
        phone: "+15551234567",
        intended_arrival_date: "01/08/2026",
        port_of_arrival: "Delhi",
        occupation: "Engineer",
        visa_purpose: "tourism",
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("qa timeout > 210s")), 210_000),
    ),
  ]);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "stopped_before_pay" ? 0 : 1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(2);
});
