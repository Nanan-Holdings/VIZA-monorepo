import "dotenv/config";
import { runTdacPortalSubmission } from "../src/tdac/runner";
import type { TdacPortalPayload } from "../src/tdac/normalize";

function isoDatePlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const payload: TdacPortalPayload = {
  applicationId: "tdac-smoke-tha",
  familyName: "LIU",
  firstName: "ZHAN",
  passportNumber: "P01234567",
  nationality: "CHINA",
  dateOfBirth: "1990-01-01",
  gender: "MALE",
  occupation: "STUDENT",
  residenceCountry: "THAILAND",
  residenceCity: "BANGKOK",
  phoneCountryCode: "86",
  phoneNumber: "1888888888",
  emailAddress: "e1484122@u.nus.edu",
  arrivalDate: isoDatePlus(2),
  departureDate: isoDatePlus(4),
  countryBoarded: "CHINA",
  purposeOfTravel: "holiday",
  arrivalModeOfTravel: "air",
  arrivalModeOfTransport: "commercial_flight",
  arrivalTransportNumber: "SQ466",
  departureModeOfTravel: "air",
  departureModeOfTransport: "commercial_flight",
  departureTransportNumber: "SQ221",
  isTransitTraveler: false,
  accommodationType: "hotel",
  addressInThailand: "1 Sukhumvit Road",
  province: "BANGKOK",
  district: "BANG KAPI",
  subDistrict: "KHLONG TOEI NUA",
  postalCode: "10110",
  countriesVisitedLast14Days: ["THAILAND", "CHINA"],
};

runTdacPortalSubmission(payload, { headless: true, stopBeforeSubmit: true })
  .then((result) => {
    console.log("result", JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error("error", error instanceof Error ? error.stack || error.message : error);
    const details = error as { code?: string; screenshotPaths?: string[]; portalSummary?: string; logs?: string[] };
    console.error(JSON.stringify({ code: details.code, portalSummary: details.portalSummary, logs: details.logs }, null, 2));
    process.exit(1);
  });
