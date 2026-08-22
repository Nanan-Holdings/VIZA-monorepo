import type { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluatePhEtravelSubmissionWindow,
  validatePhEtravelFlightDates,
} from "@/features/ph-etravel/date-window";

type ApplicationForSchedule = {
  visa_type: string | null;
  arrival_date: string | null;
  departure_date: string | null;
};

export type PhEtravelScheduleDecision =
  | { action: "submit"; arrivalDate: string; departureDate: string }
  | {
      action: "schedule";
      arrivalDate: string;
      departureDate: string;
      earliestSubmissionDate: string;
      daysUntilOpen: number;
      result: Record<string, unknown>;
    }
  | { action: "reject"; status: number; code: string; message: string };

function firstText(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function answerValueToText(row: { value_text?: unknown; value_json?: unknown }): string | null {
  if (typeof row.value_text === "string" && row.value_text.trim()) return row.value_text.trim();
  const value = row.value_json;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

async function readDateAnswers(
  admin: ReturnType<typeof createAdminClient>,
  applicationId: string,
  application: ApplicationForSchedule,
): Promise<{ arrivalDate: string | null; departureDate: string | null; transportType: string | null; error: string | null }> {
  const { data, error } = await admin
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", applicationId)
    .in("field_name", [
      "arrival_date", "flight_arrival_date", "intended_arrival_date", "planned_arrival_date", "voyage_arrival_date",
      "departure_date", "flight_departure_date", "intended_departure_date", "planned_departure_date", "voyage_departure_date",
      "transport_type",
    ]);

  if (error) return { arrivalDate: null, departureDate: null, transportType: null, error: error.message };

  const answers: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{ field_name?: unknown; value_text?: unknown; value_json?: unknown }>) {
    if (typeof row.field_name !== "string") continue;
    const value = answerValueToText(row);
    if (value) answers[row.field_name] = value;
  }
  const transportType = firstText([answers.transport_type])?.toUpperCase() ?? null;
  const usesVoyageDates = transportType === "SEA";
  return {
    arrivalDate: firstText([
      usesVoyageDates ? answers.voyage_arrival_date : answers.flight_arrival_date,
      answers.arrival_date, answers.intended_arrival_date, answers.planned_arrival_date, application.arrival_date,
    ]),
    departureDate: firstText([
      usesVoyageDates ? answers.voyage_departure_date : answers.flight_departure_date,
      answers.departure_date, answers.intended_departure_date, answers.planned_departure_date, application.departure_date,
    ]),
    transportType,
    error: null,
  };
}

export async function decidePhEtravelLiveSchedule(input: {
  admin: ReturnType<typeof createAdminClient>;
  applicationId: string;
  application: ApplicationForSchedule;
  now: string;
}): Promise<PhEtravelScheduleDecision> {
  const isDepartureCard = input.application.visa_type?.trim().toUpperCase() === "PH_ETRAVEL_DEPARTURE_CARD";
  const dates = await readDateAnswers(input.admin, input.applicationId, input.application);
  if (dates.error) return { action: "reject", status: 500, code: "phetravel_date_load_failed", message: dates.error };

  const travelDates = validatePhEtravelFlightDates(dates.departureDate, dates.arrivalDate);
  if (!travelDates.ok) {
    return { action: "reject", status: 422, code: `phetravel_${travelDates.code}`, message: travelDates.message };
  }
  const submissionTravelDate = isDepartureCard ? travelDates.departureDate : travelDates.arrivalDate;
  const travelDateLabel = isDepartureCard ? "departure" : "arrival";
  const window = evaluatePhEtravelSubmissionWindow(submissionTravelDate, new Date(input.now));
  if (window.status === "invalid") {
    return { action: "reject", status: 422, code: `phetravel_invalid_${travelDateLabel}_date`, message: `Philippines eTravel ${travelDateLabel} date must use YYYY-MM-DD.` };
  }
  if (window.status === "past") {
    return { action: "reject", status: 422, code: `phetravel_${travelDateLabel}_date_past`, message: `Philippines eTravel ${travelDateLabel} date is already in the past. Please update the travel dates before submitting.` };
  }
  if (window.status === "scheduled") {
    const result = {
      country: "PH",
      visaType: isDepartureCard ? "PH_ETRAVEL_DEPARTURE_CARD" : "PH_ETRAVEL_ARRIVAL_CARD",
      status: "scheduled", mode: "live_assisted", provider: "philippines_etravel_live",
      applicationId: input.applicationId, submitted: false, confirmationNumber: null, referenceNumber: null,
      portalUrl: "https://etravel.gov.ph",
      portalResponseSummary: `Philippines eTravel accepts submissions within 72 hours before ${travelDateLabel}. This application is scheduled for ${window.earliestSubmissionDate}.`,
      scheduledFor: window.earliestSubmissionDate,
      arrivalDate: travelDates.arrivalDate, departureDate: travelDates.departureDate,
      artifacts: { screenshots: [], pdfs: [], logs: [], traces: [] },
      payloadSummary: {
        arrivalDate: travelDates.arrivalDate, departureDate: travelDates.departureDate,
        modeOfTravel: dates.transportType, dateSource: dates.transportType === "SEA" ? "voyage" : "flight",
        transportNumber: null, accommodationAddressProvided: false,
      },
    };
    return {
      action: "schedule", arrivalDate: travelDates.arrivalDate, departureDate: travelDates.departureDate,
      earliestSubmissionDate: window.earliestSubmissionDate, daysUntilOpen: window.daysUntilOpen, result,
    };
  }
  return { action: "submit", arrivalDate: travelDates.arrivalDate, departureDate: travelDates.departureDate };
}
