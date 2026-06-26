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
  fullName: "CHEN HONGYU",
  passportNumber: "EM7429107",
  nationality: "CHINA",
  dateOfBirth: "2006-07-27",
  sex: "MALE",
  occupation: "STUDENT",
  emailAddress: "e1484122@u.nus.edu",
  mobileNumber: "1997491995",
  arrivalDate: isoDatePlus(2),
  departureDate: isoDatePlus(3),
  purposeOfTravel: "Holiday/Sightseeing/Leisure",
  modeOfTravel: "air",
  transportNumber: "SQ466",
  countryBoarded: "SINGAPORE",
  portOfArrival: "SUVARNABHUMI",
  accommodationType: "Hotel",
  addressInThailand: "991 RAMA I ROAD",
  province: "Bangkok",
  district: "Pathum Wan",
  subDistrict: "Lumphini",
  postalCode: "10330",
  countriesVisitedLast14Days: "CHINA",
  hasHealthSymptoms: "no",
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
