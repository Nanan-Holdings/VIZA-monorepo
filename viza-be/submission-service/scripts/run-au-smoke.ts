#!/usr/bin/env npx tsx
/**
 * Australia Subclass 600 smoke runner.
 *
 * Logs in to ImmiAccount, starts or resumes a Visitor 600 draft, walks the
 * form, and stops on Review. It never clicks final Submit or payment.
 *
 * Required env:
 *   AU_USERNAME, AU_PASSWORD
 * Optional env:
 *   AU_TOTP_SECRET, AU_RESUME_TRN, AU_SMOKE_HEADFUL=1
 */

import "dotenv/config";
import { launchStealthBrowser } from "../src/ceac/stealth-browser";
import { fillVisitor600Application, type AnswerMap } from "../src/au-visitor";
import { generateTotp } from "../src/au-visitor/totp";

function fail(message: string): never {
  console.error(`[au-smoke] ${message}`);
  process.exit(1);
}

const answers: AnswerMap = {
  stream: "tourist",
  applying_outside_australia: "yes",
  applying_all_outside_australia: "yes",
  current_location_country: "CN",
  current_location_legal_status: "Citizen",
  purpose_of_stay_initial: "Tourism and sightseeing.",
  significant_dates_in_australia: "No significant dates.",
  family_name: "ZHANG",
  given_names: "EDWARD",
  sex: "male",
  date_of_birth: "1995-01-01",
  passport_number: "E12345678",
  passport_country_of_issue: "CN",
  passport_nationality: "CN",
  passport_date_of_issue: "2020-01-01",
  passport_date_of_expiry: "2030-01-01",
  passport_place_of_issue: "Beijing",
  passport_issuing_authority: "Exit and Entry Administration",
  has_national_id: "no",
  country_of_birth: "CN",
  town_of_birth: "Beijing",
  state_or_province_of_birth: "Beijing",
  relationship_status: "Never married",
  country_of_residence: "CN",
  residential_address_line_1: "1 Test Road",
  residential_address_suburb: "Beijing",
  residential_address_state: "Beijing",
  residential_address_postcode: "100000",
  residential_address_country: "CN",
  phone_number: "8613800000000",
  email_address: "smoke@example.invalid",
  intended_length_of_stay_months: "1",
  intended_arrival_date: "2026-08-01",
  intended_departure_date: "2026-08-15",
  current_employment_status: "employed",
  funding_source: "self_funded",
  funds_available_amount: "5000",
  funds_currency: "AUD",
};

async function main(): Promise<void> {
  const username = process.env.AU_USERNAME;
  const password = process.env.AU_PASSWORD;
  const totpSecret = process.env.AU_TOTP_SECRET;
  if (!username || !password) {
    fail("AU_USERNAME and AU_PASSWORD env vars are required");
  }

  const headless = process.env.AU_SMOKE_HEADFUL !== "1";
  const handles = await launchStealthBrowser({ headless, acceptDownloads: true });

  try {
    const result = await fillVisitor600Application({
      context: handles.context,
      credentials: {
        username,
        password,
        mfaCodeProvider: totpSecret ? async () => generateTotp(totpSecret) : undefined,
      },
      answers,
      resumeTrn: process.env.AU_RESUME_TRN ?? null,
      options: {},
    });

    console.log(JSON.stringify(result, null, 2));
    if (result.outcome === "review_reached") {
      console.log("[au-smoke] Review reached; final Submit was not clicked.");
      process.exit(0);
    }

    if (result.outcome === "stopped_early") {
      console.error(`[au-smoke] Stopped early at ${result.result?.reachedPage ?? "unknown"}`);
      process.exit(2);
    }

    console.error("[au-smoke] Runner failed before Review.");
    process.exit(3);
  } finally {
    await handles.context.close().catch(() => undefined);
    await handles.browser.close().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(4);
});
