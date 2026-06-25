#!/usr/bin/env npx tsx
import "dotenv/config";
import { runMdacPortalSubmission } from "../src/mdac/runner";
import type { MdacPortalPayload } from "../src/mdac/normalize";

function isoDatePlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const stopBeforeSubmit = !process.argv.includes("--submit");

const payload: MdacPortalPayload = {
  applicationId: "mdac-smoke",
  fullName: "CHEN HONGYU",
  passportNumber: "EM7429107",
  passportExpiryDate: "2031-01-01",
  nationality: "CHINA",
  dateOfBirth: "2006-07-27",
  sex: "MALE",
  emailAddress: "e1484122@u.nus.edu",
  mobileCountryCode: "+86",
  mobileNumber: "1997491995",
  arrivalDate: isoDatePlus(2),
  departureDate: isoDatePlus(3),
  modeOfTravel: "AIR",
  transportNumber: "SQ466",
  lastEmbarkationCountry: "SINGAPORE",
  portOfEntry: "KUALA LUMPUR INTERNATIONAL AIRPORT",
  purposeOfVisit: "HOLIDAY",
  accommodationType: "HOTEL",
  accommodationName: "TRADERS HOTEL KUALA LUMPUR",
  addressInMalaysia: "KUALA LUMPUR",
  city: "KUALA LUMPUR",
  state: "WILAYAH PERSEKUTUAN KUALA LUMPUR",
  postcode: "50088",
};

async function main(): Promise<void> {
  if (!stopBeforeSubmit) {
    console.warn("WARNING: --submit will click the final official MDAC submit button.");
  }

  const result = await runMdacPortalSubmission(payload, {
    stopBeforeSubmit,
    headless: process.env.MDAC_PLAYWRIGHT_HEADLESS !== "false",
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
