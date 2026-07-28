#!/usr/bin/env npx tsx
import "dotenv/config";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runTdacPortalSubmission } from "../src/tdac/runner";
import type { TdacPortalPayload } from "../src/tdac/normalize";

function isoDatePlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function argumentValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length).trim() || undefined;
}

const stopBeforeSubmit = !process.argv.includes("--submit");
const transit = process.argv.includes("--transit");
const arrivalDate = isoDatePlus(2);
const yellowFeverAnswer = argumentValue("yellow-fever-certificate");
const auditApiPath = argumentValue("audit-api");
const resumeAudit = process.argv.includes("--audit-resume");
const completedAuditLabels = new Set<string>();
if (auditApiPath) {
  const resolvedAuditPath = resolve(auditApiPath);
  mkdirSync(dirname(resolvedAuditPath), { recursive: true });
  if (resumeAudit && existsSync(resolvedAuditPath)) {
    for (const line of readFileSync(resolvedAuditPath, "utf8").split(/\r?\n/)) {
      if (!line.trim()) continue;
      const record = JSON.parse(line) as { url?: unknown };
      if (typeof record.url !== "string") continue;
      const marker = "#audit=";
      const markerIndex = record.url.indexOf(marker);
      if (markerIndex >= 0) {
        completedAuditLabels.add(decodeURIComponent(record.url.slice(markerIndex + marker.length)));
      }
    }
  } else {
    writeFileSync(resolvedAuditPath, "", "utf8");
  }
}

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
  arrivalDate,
  departureDate: transit ? arrivalDate : isoDatePlus(3),
  countryBoarded: argumentValue("country-boarded") ?? "SINGAPORE",
  purposeOfTravel: argumentValue("purpose") ?? "holiday",
  purposeOfTravelOther: argumentValue("purpose-other"),
  arrivalModeOfTravel: "air",
  arrivalModeOfTransport: "commercial_flight",
  arrivalTransportNumber: argumentValue("arrival-transport") ?? "SQ466",
  departureModeOfTravel: "air",
  departureModeOfTransport: "commercial_flight",
  departureTransportNumber: argumentValue("departure-transport") ?? "SQ221",
  isTransitTraveler: transit,
  accommodationType: "hotel",
  addressInThailand: "991 RAMA I ROAD",
  province: "BANGKOK",
  district: "PATHUM WAN",
  subDistrict: "LUMPHINI",
  postalCode: "10330",
  countriesVisitedLast14Days: (argumentValue("countries-visited") ?? "CHINA")
    .split(",")
    .map((country) => country.trim())
    .filter(Boolean),
  yellowFeverVaccinationCertificate:
    yellowFeverAnswer === "yes"
      ? true
      : yellowFeverAnswer === "no"
        ? false
        : undefined,
};

async function main(): Promise<void> {
  if (!stopBeforeSubmit) {
    console.warn("WARNING: --submit will click the final official TDAC submit button.");
  }

  const result = await runTdacPortalSubmission(payload, {
    stopBeforeSubmit,
    headless: process.env.TDAC_PLAYWRIGHT_HEADLESS !== "false",
    auditFullOfficialDropdowns: Boolean(auditApiPath),
    officialDropdownAuditSkipLabels: completedAuditLabels,
    onInitialOfficialApiResponse: auditApiPath
      ? (response) => {
          appendFileSync(resolve(auditApiPath), `${JSON.stringify(response)}\n`, "utf8");
        }
      : undefined,
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
