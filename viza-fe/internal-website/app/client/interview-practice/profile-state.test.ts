import { describe, expect, it } from "vitest";
import type { ApplicantProfile, InterviewContextSummary } from "@/app/api/interview/types";
import {
  captureMissingFactsFromAnswer,
  confirmExistingProfile,
  mergeLoadedProfile,
  profilePreparationCounts,
  updatePracticeField,
} from "./profile-state";

const profile: ApplicantProfile = {
  purpose: "other",
  purposeDetails: "B1/B2 短期商务或旅游访问",
  destinations: "Seattle",
  travelDates: "",
  duration: "",
  funding: "本人承担",
  budget: "",
  occupation: "",
  employer: "",
  homeTies: "",
  previousTravel: "无赴美记录",
  companions: "",
  usContact: "",
  refusalHistory: "无拒签记录",
};

const context: InterviewContextSummary = {
  source: "application",
  applicationId: "app",
  consistencyStatus: "partially_verifiable",
  missingFields: ["travelDates", "duration", "occupation", "employer", "homeTies"],
  verifiedFields: ["destinations"],
  needsConfirmationFields: ["purpose", "purposeDetails", "funding"],
  fieldStates: [
    { field: "purpose", status: "needs_confirmation", source: "saved_application" },
    { field: "purposeDetails", status: "needs_confirmation", source: "saved_application" },
    { field: "destinations", status: "confirmed", source: "saved_application" },
    { field: "travelDates", status: "missing", source: null },
    { field: "duration", status: "missing", source: null },
    { field: "funding", status: "needs_confirmation", source: "saved_application" },
    { field: "occupation", status: "missing", source: null },
    { field: "employer", status: "missing", source: null },
    { field: "homeTies", status: "missing", source: null },
  ],
};

describe("interview profile preparation", () => {
  it("keeps a restored practice value while filling empty fields from the application", () => {
    const current = { ...profile, destinations: "Boston", funding: "" };
    const practiceContext = {
      ...context,
      fieldStates: context.fieldStates?.map((state) => state.field === "destinations"
        ? { ...state, source: "practice" as const, status: "confirmed" as const }
        : state),
    };
    expect(mergeLoadedProfile(current, practiceContext, profile)).toMatchObject({ destinations: "Boston", funding: "本人承担" });
  });

  it("replaces stale non-practice session values with the latest saved application mapping", () => {
    const stale = { ...profile, purpose: "business" as const, purposeDetails: "旧缓存" };
    expect(mergeLoadedProfile(stale, context, profile)).toMatchObject({
      purpose: "other",
      purposeDetails: "B1/B2 短期商务或旅游访问",
    });
  });

  it("marks edited practice values confirmed without writing application data", () => {
    const result = updatePracticeField(profile, context, "homeTies", "回国继续学业");
    expect(result.profile.homeTies).toBe("回国继续学业");
    expect(result.context?.verifiedFields).toContain("homeTies");
    expect(result.context?.fieldStates?.find((state) => state.field === "homeTies")).toMatchObject({ source: "practice", status: "confirmed" });
  });

  it("confirms only populated values and reports preparation counts", () => {
    const confirmed = confirmExistingProfile(profile, context);
    expect(confirmed.verifiedFields).toEqual(expect.arrayContaining(["purposeDetails", "destinations", "funding"]));
    expect(confirmed.missingFields).toContain("homeTies");
    expect(profilePreparationCounts(confirmed).criticalMissing).toBeGreaterThan(0);
  });

  it("only confirms the key facts shown to the user when a field scope is provided", () => {
    const confirmed = confirmExistingProfile(profile, context, ["purposeDetails"]);

    expect(confirmed.verifiedFields).toEqual(expect.arrayContaining(["purposeDetails", "destinations"]));
    expect(confirmed.needsConfirmationFields).toEqual(expect.arrayContaining(["purpose", "funding"]));
  });

  it("captures a missing fact from an interview answer in this practice context", () => {
    const result = captureMissingFactsFromAnswer(profile, context, {
      id: "return_ties",
      topic: "回国约束",
      prompt: "回国后有什么安排？",
      isFollowUp: false,
    }, "假期结束后回国继续负责当前项目");
    expect(result.profile.homeTies).toContain("继续负责当前项目");
    expect(result.context?.verifiedFields).toContain("homeTies");
  });
});
