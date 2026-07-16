#!/usr/bin/env npx tsx
import "dotenv/config";
import { runTdacPortalSubmission } from "../src/tdac/runner";
import type { TdacPortalPayload } from "../src/tdac/normalize";

function isoDatePlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const stopBeforeSubmit = !process.argv.includes("--submit");

const payload: TdacPortalPayload = {
  applicationId: "tdac-smoke",
  familyName: "CHEN",
  firstName: "HONGYU",
  passportNumber: "EM7429107",
  nationality: "CHINA",
  dateOfBirth: "2006-07-27",
  gender: "MALE",
  occupation: "STUDENT",
  residenceCountry: "CHINA",
  residenceCity: "CHANGSHA",
  phoneCountryCode: "86",
  phoneNumber: "1997491995",
  emailAddress: "e1484122@u.nus.edu",
  arrivalDate: isoDatePlus(2),
  departureDate: isoDatePlus(3),
  countryBoarded: "SINGAPORE",
  purposeOfTravel: "holiday",
  arrivalModeOfTravel: "air",
  arrivalModeOfTransport: "commercial_flight",
  arrivalTransportNumber: "SQ466",
  departureModeOfTravel: "air",
  departureModeOfTransport: "commercial_flight",
  departureTransportNumber: "SQ221",
  isTransitTraveler: false,
  accommodationType: "hotel",
  addressInThailand: "991 RAMA I ROAD",
  province: "BANGKOK",
  district: "PATHUM WAN",
  subDistrict: "LUMPHINI",
  postalCode: "10330",
  countriesVisitedLast14Days: ["CHINA"],
};

async function main(): Promise<void> {
  if (!stopBeforeSubmit) {
    console.warn("WARNING: --submit will click the final official TDAC submit button.");
  }

  const result = await runTdacPortalSubmission(payload, {
    stopBeforeSubmit,
    headless: process.env.TDAC_PLAYWRIGHT_HEADLESS !== "false",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  const details = typeof error === "object" && error !== null
    ? error as { code?: string; screenshotPaths?: string[]; portalSummary?: string; logs?: string[] }
    : null;
  if (stopBeforeSubmit && details?.code === "tdac_stopped_before_submit") {
    console.log(JSON.stringify({
      passed: true,
      checkpoint: details.code,
      screenshots: details.screenshotPaths,
      portalSummary: details.portalSummary,
      logs: details.logs,
    }, null, 2));
    return;
  }
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  if (details) {
    console.error(JSON.stringify({
      code: details.code,
      screenshots: details.screenshotPaths,
      portalSummary: details.portalSummary,
      logs: details.logs,
    }, null, 2));
  }
  process.exit(1);
});
