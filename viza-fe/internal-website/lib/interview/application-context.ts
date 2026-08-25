import "server-only";

import {
  loadAssistantAnswers,
  requireOwnedApplication,
} from "@/lib/form-assistant/server-context";
import { isDs160VisaType } from "@/lib/submission-queue";
import type {
  ApplicantProfile,
  InterviewApplicationContext,
} from "@/app/api/interview/types";
import {
  mapDs160AnswersToInterviewProfile,
  parseSimplifiedFormState,
  type StoredAnswers,
} from "./profile-mapper";

export { mapDs160AnswersToInterviewProfile } from "./profile-mapper";

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

function normalizeToken(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function isUnitedStatesCountry(country: string) {
  return new Set(["US", "USA", "UNITED_STATES", "UNITED_STATES_OF_AMERICA"]).has(normalizeToken(country));
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
  const { data: simplifiedRow, error: simplifiedError } = await owned.admin
    .from("visa_application_answers")
    .select("value_text")
    .eq("application_id", applicationId)
    .eq("field_name", "__simplified_form_state")
    .maybeSingle();
  if (simplifiedError) {
    throw new InterviewContextError("CONTEXT_LOAD_FAILED", 500, "暂时无法读取申请资料，请稍后重试。");
  }
  const mapped = mapDs160AnswersToInterviewProfile(
    answers,
    parseSimplifiedFormState(simplifiedRow?.value_text),
  );
  return {
    profile: mapped.profile,
    context: {
      source: "application",
      applicationId,
      missingFields: mapped.missingFields,
      verifiedFields: mapped.verifiedFields,
      needsConfirmationFields: mapped.needsConfirmationFields,
      fieldStates: mapped.fieldStates,
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
