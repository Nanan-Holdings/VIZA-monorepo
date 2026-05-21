#!/usr/bin/env npx tsx
/**
 * Tier-3 country prefill smoke test (AUTO-T3-*).
 *
 * Synthetic answers, 90s wall cap per country, exits 0 on stopped_before_pay.
 *
 * Usage:
 *   npx tsx scripts/t3-smoke.ts <country>
 *
 * country ∈ id|eg|it|th|my|nz|ru|tr|ae|ca-eta|mv|ph-etravel
 */

import "dotenv/config";
import * as t3 from "../src/t3/index";
import type { GenericRunResult } from "../src/generic/prefill";

type RunFn = (input: any) => Promise<GenericRunResult>;

const RUNNERS: Record<string, RunFn> = {
  id: t3.runIdPrefill,
  eg: t3.runEgPrefill,
  it: t3.runItPrefill,
  th: t3.runThPrefill,
  my: t3.runMyPrefill,
  nz: t3.runNzPrefill,
  ru: t3.runRuPrefill,
  tr: t3.runTrPrefill,
  ae: t3.runAePrefill,
  "ca-eta": t3.runCaEtaPrefill,
  mv: t3.runMvPrefill,
  "ph-etravel": t3.runPhEtravelPrefill,
};

async function main() {
  const cc = process.argv[2];
  const fn = cc ? RUNNERS[cc] : undefined;
  if (!fn) {
    console.error(`Usage: npx tsx scripts/t3-smoke.ts <${Object.keys(RUNNERS).join("|")}>`);
    process.exit(2);
  }
  const headful = process.env.T3_SMOKE_HEADFUL === "1";
  const result = await Promise.race([
    fn({
      jobId: `smoke-${cc}-${Date.now()}`,
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
        intended_departure_date: "2026-08-15",
        visit_purpose: "tourism",
        occupation: "Engineer",
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("smoke timeout > 90s")), 90_000),
    ),
  ]);
  console.log(JSON.stringify(result, null, 2));
  if (result.status === "stopped_before_pay") {
    console.log(`✅ ${cc} runner reached the pre-pay checkpoint`);
    process.exit(0);
  }
  console.error(`❌ ${cc} ${result.status} — ${result.reason}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(2);
});
