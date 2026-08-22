import { describe, expect, test } from "vitest";

import { decidePhEtravelLiveSchedule } from "@/features/ph-etravel/retry-schedule";

type AnswerRow = {
  field_name: string;
  value_text: string;
  value_json?: unknown;
};

const baseApplication = {
  id: "app_ph_sea",
  applicant_id: "profile_ph",
  country: "philippines",
  visa_type: "PH_ETRAVEL_ARRIVAL_CARD",
  arrival_date: null,
  departure_date: null,
  purpose: null,
  accommodation_name: null,
  accommodation_address: null,
  submission_result: null,
  submission_result_status: null,
};

function adminWithAnswers(rows: AnswerRow[]) {
  const query = {
    select: () => query,
    eq: () => query,
    in: async () => ({ data: rows, error: null }),
  };
  return { from: () => query };
}

function seaRows(voyageDepartureDate: string, voyageArrivalDate: string): AnswerRow[] {
  return [
    { field_name: "transport_type", value_text: "SEA" },
    { field_name: "voyage_departure_date", value_text: voyageDepartureDate },
    { field_name: "voyage_arrival_date", value_text: voyageArrivalDate },
    { field_name: "flight_departure_date", value_text: "2026-08-10" },
    { field_name: "flight_arrival_date", value_text: "2026-08-11" },
  ];
}

describe("Philippines eTravel retry scheduling", () => {
  test("schedules SEA voyage arrivals outside the 72-hour window", async () => {
    const decision = await decidePhEtravelLiveSchedule({
      admin: adminWithAnswers(seaRows("2026-07-04", "2026-07-05")) as never,
      applicationId: "app_ph_sea",
      application: baseApplication,
      now: "2026-06-30T10:00:00+08:00",
    });

    expect(decision).toMatchObject({
      action: "schedule",
      arrivalDate: "2026-07-05",
      departureDate: "2026-07-04",
      earliestSubmissionDate: "2026-07-02",
      daysUntilOpen: 2,
    });
    expect(decision.action === "schedule" ? decision.result.payloadSummary : null).toMatchObject({
      modeOfTravel: "SEA",
      dateSource: "voyage",
    });
  });

  test("opens SEA voyage arrivals inside the 72-hour window", async () => {
    const decision = await decidePhEtravelLiveSchedule({
      admin: adminWithAnswers(seaRows("2026-07-04", "2026-07-05")) as never,
      applicationId: "app_ph_sea",
      application: baseApplication,
      now: "2026-07-02T10:00:00+08:00",
    });

    expect(decision).toMatchObject({
      action: "submit",
      arrivalDate: "2026-07-05",
      departureDate: "2026-07-04",
    });
  });

  test("rejects SEA voyage arrivals that are already past", async () => {
    const decision = await decidePhEtravelLiveSchedule({
      admin: adminWithAnswers(seaRows("2026-07-04", "2026-07-05")) as never,
      applicationId: "app_ph_sea",
      application: baseApplication,
      now: "2026-07-06T10:00:00+08:00",
    });

    expect(decision).toMatchObject({
      action: "reject",
      status: 422,
      code: "phetravel_arrival_date_past",
    });
  });
});
