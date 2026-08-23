import "server-only";

import {
  loadAssistantAnswers,
  requireOwnedApplication,
} from "@/lib/form-assistant/server-context";
import { isDs160VisaType } from "@/lib/submission-queue";
import type {
  ApplicantProfile,
  InterviewApplicationContext,
  InterviewProfileField,
  InterviewPurpose,
} from "@/app/api/interview/types";

type StoredAnswers = Record<string, { value: string; source: string | null }>;

export class InterviewContextError extends Error {
  constructor(
    public readonly code: "AUTH_REQUIRED" | "APPLICATION_NOT_FOUND" | "APPLICATION_FORBIDDEN" | "UNSUPPORTED_APPLICATION" | "CONTEXT_LOAD_FAILED",
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "InterviewContextError";
  }
}

export interface ResolvedInterviewContext {
  profile: ApplicantProfile;
  context: InterviewApplicationContext;
  cacheScope: string;
}

const PROFILE_FIELDS: InterviewProfileField[] = [
  "purpose",
  "purposeDetails",
  "destinations",
  "travelDates",
  "duration",
  "funding",
  "budget",
  "occupation",
  "employer",
  "homeTies",
  "previousTravel",
  "companions",
  "usContact",
  "refusalHistory",
];

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function isUnitedStatesCountry(country: string) {
  return new Set(["US", "USA", "UNITED_STATES", "UNITED_STATES_OF_AMERICA"]).has(normalizeToken(country));
}

function clean(value: string | undefined) {
  return (value ?? "").trim();
}

function valuesFor(answers: StoredAnswers, keys: string[]) {
  const values: string[] = [];
  for (const [fieldName, answer] of Object.entries(answers)) {
    if (!keys.some((key) => fieldName === key || fieldName.startsWith(`${key}[`) || fieldName.startsWith(`${key}.`))) continue;
    const value = clean(answer.value);
    if (value && !values.includes(value)) values.push(value);
  }
  return values;
}

function joinValues(answers: StoredAnswers, keys: string[]) {
  return valuesFor(answers, keys).join(" / ");
}

function inferPurpose(value: string): InterviewPurpose {
  if (/business|商务|商務/i.test(value)) return "business";
  if (/touris|pleasure|旅游|旅遊|观光|觀光/i.test(value)) return "tourism";
  if (/family|relative|friend|探亲|探親|访友|訪友/i.test(value)) return "family_visit";
  if (/medical|treatment|就医|就醫|治疗|治療/i.test(value)) return "medical";
  return "other";
}

function withUnit(value: string, unit: string) {
  if (!value) return "";
  return unit ? `${value} ${unit}` : value;
}

export function mapDs160AnswersToInterviewProfile(answers: StoredAnswers): {
  profile: ApplicantProfile;
  missingFields: InterviewProfileField[];
  verifiedFields: InterviewProfileField[];
} {
  const purposeDetails = joinValues(answers, ["purpose_of_trip", "purpose_of_trip_specify", "purpose_of_trip_details", "trip_purpose_details"]);
  const durationValue = joinValues(answers, ["intended_length_of_stay_value", "intended_length_of_stay"]);
  const durationUnit = joinValues(answers, ["intended_length_of_stay_unit"]);
  const profile: ApplicantProfile = {
    purpose: inferPurpose(purposeDetails),
    purposeDetails,
    destinations: joinValues(answers, ["planned_location", "arrival_city", "departure_city", "us_address_city"]),
    travelDates: joinValues(answers, ["arrival_date", "intended_arrival_date", "departure_date"]),
    duration: withUnit(durationValue, durationUnit),
    funding: joinValues(answers, ["trip_payer_type", "payer_relationship", "payer_organization_name"]),
    budget: joinValues(answers, ["trip_budget", "travel_budget"]),
    occupation: joinValues(answers, ["primary_occupation", "job_title", "occupation_other_explain"]),
    employer: joinValues(answers, ["employer_name", "education_institution_name"]),
    homeTies: joinValues(answers, ["home_ties", "return_plan", "reason_to_return", "return_obligations"]),
    previousTravel: joinValues(answers, ["has_been_in_us", "previous_us_visit", "previous_travel", "countries_visited"]),
    companions: joinValues(answers, ["companion_group_travel", "companion_group_name", "companion_relationship"]),
    usContact: joinValues(answers, ["us_contact_relationship", "us_contact_organization"]),
    refusalHistory: joinValues(answers, ["has_been_refused", "refusal_explain"]),
  };

  const verifiedFields = PROFILE_FIELDS.filter((field) => field === "purpose" ? purposeDetails.length > 0 : clean(profile[field]).length > 0);
  const missingFields = PROFILE_FIELDS.filter((field) => !verifiedFields.includes(field));
  return { profile, missingFields, verifiedFields };
}

function ownershipError(result: { status: number; error: string }) {
  if (result.status === 401) return new InterviewContextError("AUTH_REQUIRED", 401, "请先登录后再读取申请资料。");
  if (result.status === 404) return new InterviewContextError("APPLICATION_NOT_FOUND", 404, "未找到该申请。");
  if (result.status === 403) return new InterviewContextError("APPLICATION_FORBIDDEN", 403, "你无权读取该申请。");
  return new InterviewContextError("CONTEXT_LOAD_FAILED", result.status, "暂时无法读取申请资料。");
}

export async function loadInterviewApplicationContext(applicationId: string): Promise<ResolvedInterviewContext> {
  const owned = await requireOwnedApplication(applicationId);
  if ("status" in owned) throw ownershipError(owned);
  if (!isUnitedStatesCountry(owned.application.country) || !isDs160VisaType(owned.application.visa_type)) {
    throw new InterviewContextError("UNSUPPORTED_APPLICATION", 422, "模拟面试目前仅支持本人名下的美国 B1/B2 / DS-160 申请。");
  }

  let answers: StoredAnswers;
  try {
    answers = await loadAssistantAnswers(owned.admin, applicationId, {
      applicantId: owned.application.applicant_id,
      authUserId: owned.user.id,
    });
  } catch {
    throw new InterviewContextError("CONTEXT_LOAD_FAILED", 500, "暂时无法读取申请资料，请稍后重试。");
  }
  const mapped = mapDs160AnswersToInterviewProfile(answers);
  return {
    profile: mapped.profile,
    context: {
      source: "application",
      applicationId,
      missingFields: mapped.missingFields,
      verifiedFields: mapped.verifiedFields,
    },
    cacheScope: `application:${applicationId}:${owned.user.id}`,
  };
}

export function standaloneInterviewContext(profile: ApplicantProfile): ResolvedInterviewContext {
  return {
    profile,
    context: { source: "standalone", missingFields: [], verifiedFields: [] },
    cacheScope: "standalone",
  };
}
