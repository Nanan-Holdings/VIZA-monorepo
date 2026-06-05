import type { JsonObject, USAppointmentApplication } from "../types.js";

export interface USAppointmentProfileSeed {
  applicationId: string;
  countryCode: "US";
  visaType: "B1/B2";
  ds160Available: boolean;
  retrievalUrlAvailable: boolean;
  source: "viza_application";
  redactedSnapshot: JsonObject;
}

export function mapVizaToUsAppointmentProfile(
  application: USAppointmentApplication,
): USAppointmentProfileSeed {
  return {
    applicationId: application.id,
    countryCode: "US",
    visaType: "B1/B2",
    ds160Available: Boolean(application.ds160ApplicationId || application.confirmationNumber),
    retrievalUrlAvailable: Boolean(application.ds160RetrievalUrl),
    source: "viza_application",
    redactedSnapshot: {
      application_id: application.id,
      country_code: "US",
      visa_type: "B1/B2",
      ds160_available: Boolean(application.ds160ApplicationId || application.confirmationNumber),
      retrieval_url_available: Boolean(application.ds160RetrievalUrl),
    },
  };
}
