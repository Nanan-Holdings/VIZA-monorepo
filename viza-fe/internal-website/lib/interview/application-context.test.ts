import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireOwnedApplication, loadAssistantAnswers } = vi.hoisted(() => ({
  requireOwnedApplication: vi.fn(),
  loadAssistantAnswers: vi.fn(),
}));

vi.mock("@/lib/form-assistant/server-context", () => ({
  requireOwnedApplication,
  loadAssistantAnswers,
}));

import {
  InterviewContextError,
  loadInterviewApplicationContext,
  mapDs160AnswersToInterviewProfile,
} from "./application-context";

function answer(value: string) {
  return { value, source: "user" };
}

function legacyAnswer(value: string) {
  return { value, source: null };
}

function adminWithSimplifiedState(value: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: value ? { value_text: JSON.stringify(value) } : null,
    error: null,
  });
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return { from: vi.fn().mockReturnValue(chain) };
}

describe("interview application context", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps saved DS-160 answers without inventing missing facts", () => {
    const mapped = mapDs160AnswersToInterviewProfile({
      purpose_of_trip_specify: answer("B1/B2"),
      planned_location: answer("Seattle"),
      intended_arrival_date: answer("2026-10-01"),
      intended_length_of_stay_value: answer("10"),
      intended_length_of_stay_unit: answer("DAY(S)"),
      trip_payer_type: answer("self"),
      primary_occupation: answer("student"),
      employer_name: answer("Example University"),
      companion_group_travel: answer("no"),
      us_contact_relationship: answer("OTHER"),
      has_been_in_us: answer("no"),
      has_been_refused: answer("no"),
    });

    expect(mapped.profile).toMatchObject({
      purpose: "other",
      purposeDetails: "B1/B2 短期商务或旅游访问",
      destinations: "Seattle",
      duration: "10 DAY(S)",
      occupation: "student",
      employer: "Example University",
      homeTies: "",
    });
    expect(mapped.missingFields).toContain("homeTies");
    expect(mapped.verifiedFields).toContain("refusalHistory");
  });

  it("maps canonical and simplified-form keys while separating unconfirmed values from true gaps", () => {
    const mapped = mapDs160AnswersToInterviewProfile({
      purpose_of_trip: legacyAnswer("B"),
      purpose_of_trip_specify: legacyAnswer("B1/B2"),
      trip_payer_type: legacyAnswer("self"),
      has_been_in_us: legacyAnswer("no"),
      has_traveled_last_five_years: legacyAnswer("yes"),
      traveled_country: legacyAnswer("JPN"),
    }, {
      form: {
        travel: { placesToVisit: ["Seattle"], arrivalDate: "2026-10-01", lengthValue: "10", lengthUnit: "Days" },
        work: { primaryOccupation: "STUDENT", employerName: "Example University" },
      },
    });

    expect(mapped.profile).toMatchObject({
      purposeDetails: "B1/B2 短期商务或旅游访问",
      destinations: "Seattle",
      travelDates: "2026-10-01",
      duration: "10 Days",
      funding: "本人承担",
      occupation: "STUDENT",
      employer: "Example University",
    });
    expect(mapped.needsConfirmationFields).toEqual(expect.arrayContaining([
      "purposeDetails",
      "destinations",
      "funding",
      "previousTravel",
    ]));
    expect(mapped.missingFields).toContain("homeTies");
    expect(mapped.profile.previousTravel).toContain("JPN");
  });

  it("enforces the existing ownership boundary before loading answers", async () => {
    requireOwnedApplication.mockResolvedValue({ status: 403, error: "Unauthorized" });
    await expect(loadInterviewApplicationContext("00000000-0000-4000-8000-000000000001"))
      .rejects.toMatchObject({ code: "APPLICATION_FORBIDDEN", status: 403 });
    expect(loadAssistantAnswers).not.toHaveBeenCalled();
  });

  it("fails closed for an owned non-US or non-DS-160 application", async () => {
    requireOwnedApplication.mockResolvedValue({
      admin: {},
      user: { id: "owner" },
      application: { id: "app", applicant_id: "owner", country: "taiwan", visa_type: "TW_ENTRY_PERMIT" },
    });
    await expect(loadInterviewApplicationContext("00000000-0000-4000-8000-000000000002"))
      .rejects.toBeInstanceOf(InterviewContextError);
    expect(loadAssistantAnswers).not.toHaveBeenCalled();
  });

  it("loads only the owned US DS-160 application's answers", async () => {
    const admin = adminWithSimplifiedState({ form: { travel: { placesToVisit: ["Boston"] } } });
    requireOwnedApplication.mockResolvedValue({
      admin,
      user: { id: "owner" },
      application: { id: "app", applicant_id: "applicant", country: "United States", visa_type: "B1/B2" },
    });
    loadAssistantAnswers.mockResolvedValue({ purpose_of_trip_specify: answer("B2") });
    const result = await loadInterviewApplicationContext("00000000-0000-4000-8000-000000000003");
    expect(loadAssistantAnswers).toHaveBeenCalledWith(admin, "00000000-0000-4000-8000-000000000003", {
      applicantId: "applicant",
      authUserId: "owner",
    });
    expect(result.context.source).toBe("application");
    expect(result.context.missingFields).toContain("homeTies");
    expect(result.profile.destinations).toBe("Boston");
    expect(result.context.needsConfirmationFields).toContain("purposeDetails");
    expect(result.cacheScope).toContain("owner");
  });
});
