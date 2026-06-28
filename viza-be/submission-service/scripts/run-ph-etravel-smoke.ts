#!/usr/bin/env npx tsx
import "dotenv/config";
import { PhEtravelPortalError, runPhEtravelPortalSubmission } from "../src/ph-etravel/runner";
import type { PhEtravelPortalPayload } from "../src/ph-etravel/normalize";

function isoDatePlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const stopBeforeSubmit = !process.argv.includes("--submit");

const payload: PhEtravelPortalPayload = {
  countryCode: "PH",
  visaType: "PH_ETRAVEL_ARRIVAL_CARD",
  applicationId: "ph-etravel-smoke",
  fullName: "TEST USER",
  passportNumber: "E12345678",
  passportExpiryDate: "2030-12-31",
  nationality: "CHINA",
  countryOfBirth: "CHINA",
  countryOfResidence: "CHINA",
  occupation: "STUDENT",
  dateOfBirth: "1990-01-01",
  sex: "FEMALE",
  emailAddress: "test@example.com",
  mobileCountryCode: "+86",
  mobileNumber: "13800138000",
  travelType: "ARRIVAL",
  transportType: "AIR",
  flightNumber: "PR101",
  airlineOrVesselName: "Philippine Airlines",
  portOfEntry: "NINOY AQUINO INTERNATIONAL AIRPORT",
  arrivalDate: isoDatePlus(1),
  departureDate: isoDatePlus(5),
  originCountry: "SINGAPORE",
  purposeOfTravel: "HOLIDAY",
  philippinesAddress: "Test Hotel, Manila",
  hasHealthSymptoms: false,
  healthSymptomsDetails: null,
  customs: {
    hasCheckedBaggage: true,
    checkedBaggageCount: "1",
    hasHandcarryBaggage: true,
    handcarryBaggageCount: "1",
    hasDutiableGoods: false,
    dutiableGoodsDetails: null,
    hasCurrencyOverThreshold: false,
    currencyDeclarationDetails: null,
  },
  finalDeclaration: true,
};

async function main(): Promise<void> {
  if (!stopBeforeSubmit) {
    console.warn("WARNING: --submit is intended only for real applicant data and will attempt the official eTravel flow.");
  }

  const result = await runPhEtravelPortalSubmission(payload, {
    stopBeforeSubmit,
    headless: process.env.PH_ETRAVEL_PLAYWRIGHT_HEADLESS !== "false",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  if (
    stopBeforeSubmit &&
    error instanceof PhEtravelPortalError &&
    error.code === "ph_etravel_stopped_before_submit"
  ) {
    console.log(JSON.stringify({
      status: "stopped_before_submit",
      code: error.code,
      screenshots: error.screenshotPaths,
      portalSummary: error.portalSummary,
    }, null, 2));
    return;
  }

  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  if (typeof error === "object" && error !== null) {
    const details = error as { code?: string; screenshotPaths?: string[]; portalSummary?: string };
    console.error(JSON.stringify({
      code: details.code,
      screenshots: details.screenshotPaths,
      portalSummary: details.portalSummary,
    }, null, 2));
  }
  process.exit(1);
});
