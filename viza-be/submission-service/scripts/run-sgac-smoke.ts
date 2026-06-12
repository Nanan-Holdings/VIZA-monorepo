import "dotenv/config";
import * as path from "node:path";
import { normalizeSgacPortalPayload, runSgacPortalSubmission } from "../src/sgac";
import type { SubmissionPayload } from "../src/country-submissions/types";

function isoDatePlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const stopBeforeSubmit = !process.argv.includes("--submit");

const payload: SubmissionPayload = {
  payloadVersion: "smoke",
  countryCode: "SG",
  visaType: "SG_ARRIVAL_CARD",
  applicationId: "sgac_smoke",
  dryRun: false,
  idempotencyKey: `sgac-smoke:${Date.now()}`,
  personal: {
    fullName: "TEST USER",
    dateOfBirth: "1990-01-01",
    gender: "male",
    nationality: "China",
    passportNumber: "E12345678",
    passportExpiryDate: "2030-12-31",
    email: "test@example.com",
    phone: "+86 13800138000",
  },
  trip: {
    destinationCountry: "Singapore",
    arrivalDate: isoDatePlus(1),
    departureDate: isoDatePlus(2),
    purpose: "holiday",
    accommodationAddress: "Transit",
  },
  countrySpecific: {
    purpose_of_travel: "holiday",
    place_of_birth_country: "China",
    place_of_residence: "CHINA, BEIJING, BEIJING",
    has_used_different_name_to_enter_singapore: "no",
    has_health_symptoms: "no",
    recent_country_visit_history: "none",
    last_city_or_port_before_singapore: "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR",
    next_city_or_port_after_singapore: "THAILAND, BANGKOK, BANGKOK",
    mode_of_travel: "air",
    transport_number: "SQ317",
    accommodation_type: "others",
    accommodation_other_type: "transit",
    health_declaration: "yes",
    official_submission_acknowledgement: "yes",
    final_declaration: "yes",
  },
  metadata: {},
};

async function main(): Promise<void> {
  if (!stopBeforeSubmit) {
    console.warn(
      "WARNING: --submit will click the final ICA SGAC submit button. Use only with real applicant data.",
    );
  }

  const normalized = normalizeSgacPortalPayload(payload);
  const result = await runSgacPortalSubmission(normalized, {
    stopBeforeSubmit,
    headless: process.env.SGAC_PLAYWRIGHT_HEADLESS !== "false",
    artifactDir: path.join(process.cwd(), "tmp", "sgac-smoke"),
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
