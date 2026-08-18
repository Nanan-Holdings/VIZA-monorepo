import {
  evaluateKoreaEArrivalCardSubmissionWindow,
  validateKoreaEArrivalCardTravelDates,
} from "./date-window";

export type KoreaEArrivalCardScheduleDecision =
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

export function decideKoreaEArrivalCardLiveSchedule(input: {
  applicationId: string;
  arrivalDate: string | null | undefined;
  departureDate: string | null | undefined;
  transportType?: string | null;
  accommodationAddressProvided?: boolean;
  now?: Date;
}): KoreaEArrivalCardScheduleDecision {
  const dates = validateKoreaEArrivalCardTravelDates(input.arrivalDate, input.departureDate);
  if (!dates.ok) {
    return {
      action: "reject",
      status: 422,
      code: `kr_eac_${dates.code}`,
      message: dates.message,
    };
  }

  const window = evaluateKoreaEArrivalCardSubmissionWindow(dates.arrivalDate, input.now ?? new Date());
  if (window.status === "invalid") {
    return {
      action: "reject",
      status: 422,
      code: "kr_eac_invalid_arrival_date",
      message: "Korea e-Arrival Card arrival date must use YYYY-MM-DD.",
    };
  }
  if (window.status === "past") {
    return {
      action: "reject",
      status: 422,
      code: "kr_eac_arrival_date_past",
      message: "Korea e-Arrival Card arrival date is already in the past. Please update the travel dates before submitting.",
    };
  }
  if (window.status === "scheduled") {
    return {
      action: "schedule",
      arrivalDate: dates.arrivalDate,
      departureDate: dates.departureDate,
      earliestSubmissionDate: window.earliestSubmissionDate,
      daysUntilOpen: window.daysUntilOpen,
      result: {
        country: "KR",
        visaType: "KR_E_ARRIVAL_CARD",
        status: "scheduled",
        mode: "live_assisted",
        provider: "korea_e_arrival_card_live",
        applicationId: input.applicationId,
        submitted: false,
        issueNumber: null,
        confirmationNumber: null,
        referenceNumber: null,
        portalUrl: "https://www.e-arrivalcard.go.kr/portal/",
        portalResponseSummary:
          `Korea e-Arrival Card can be submitted from two calendar days before arrival. This application is scheduled for ${window.earliestSubmissionDate} (Korea time).`,
        scheduledFor: window.earliestSubmissionDate,
        arrivalDate: dates.arrivalDate,
        departureDate: dates.departureDate,
        validUntil: null,
        artifacts: { screenshots: [], pdfs: [], logs: [], traces: [] },
        payloadSummary: {
          arrivalDate: dates.arrivalDate,
          departureDate: dates.departureDate,
          modeOfTravel: input.transportType?.trim().toUpperCase() || null,
          transportNumber: null,
          accommodationAddressProvided: input.accommodationAddressProvided === true,
        },
      },
    };
  }

  return {
    action: "submit",
    arrivalDate: dates.arrivalDate,
    departureDate: dates.departureDate,
  };
}
