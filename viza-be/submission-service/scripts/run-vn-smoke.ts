#!/usr/bin/env npx tsx
/**
 * Vietnam e-Visa smoke runner.
 *
 * Drives the public evisa.gov.vn form with synthetic answers and stops at the
 * pre-pay/review checkpoint. The runner never clicks Pay or final Submit.
 *
 * Optional env:
 *   VN_SMOKE_HEADFUL=1
 */

import "dotenv/config";
import { fillVietnamApplication } from "../src/vietnam";

const answers: Record<string, string> = {
  surname: "ZHANG",
  given_name: "EDWARD",
  date_of_birth: "1995-01-01",
  sex: "M",
  nationality: "CHN",
  email_address: "smoke@example.invalid",
  re_enter_email_address: "smoke@example.invalid",
  religion: "None",
  place_of_birth: "Beijing",
  visa_type_requested: "single",
  visa_valid_from: "2026-08-01",
  visa_valid_to: "2026-08-15",
  passport_number: "E12345678",
  passport_issuing_authority: "Exit and Entry Administration",
  passport_type: "ordinary",
  passport_issue_date: "2020-01-01",
  passport_expiry_date: "2030-01-01",
  permanent_residential_address: "1 Test Road, Beijing",
  contact_address: "1 Test Road, Beijing",
  telephone_number: "+8613800000000",
  emergency_contact_full_name: "TEST CONTACT",
  emergency_contact_current_address: "1 Test Road, Beijing",
  emergency_contact_telephone: "+8613800000001",
  emergency_contact_relationship: "Friend",
  occupation_info: "Software engineer",
  employer_name: "Test Company Ltd",
  employer_position: "Engineer",
  employer_address: "1 Employer Road, Beijing",
  employer_phone: "+8610123456789",
  purpose_of_entry: "tourism",
  intended_date_of_entry: "2026-08-01",
  intended_length_of_stay: "15",
  vietnam_phone_number: "+84900000000",
  residential_address_in_vietnam: "Hotel",
  province_city: "Ha Noi",
  ward_commune: "Hoan Kiem",
  intended_border_gate_entry: "Noi Bai",
  intended_border_gate_exit: "Noi Bai",
  intended_expenses_usd: "1200",
  did_you_buy_insurance: "yes",
  trip_expense_payer: "Self",
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`smoke timeout > ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

async function main(): Promise<void> {
  const result = await withTimeout(
    fillVietnamApplication(
      { answers },
      {
        headless: process.env.VN_SMOKE_HEADFUL !== "1",
        runId: `vn-smoke-${Date.now()}`,
        stepTimeoutMs: 60_000,
      },
    ),
    120_000,
  );

  console.log(JSON.stringify(result, null, 2));
  if (result.status === "submitted_pending_pay") {
    console.log("[vn-smoke] Pre-pay checkpoint reached; Pay/Submit was not clicked.");
    process.exit(0);
  }

  if (result.status === "scaffolded_pending_walk") {
    console.error(`[vn-smoke] Scaffolded but did not capture registration code: ${result.reason}`);
    process.exit(2);
  }

  console.error(`[vn-smoke] Failed at ${result.failedStep}`);
  process.exit(3);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(4);
});
