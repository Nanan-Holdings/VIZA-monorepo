import { createHash } from "node:crypto";
import { z } from "zod";
import type { ApplicantProfile, InterviewApplicationContext } from "./types";
import {
  InterviewContextError,
  loadInterviewApplicationContext,
  standaloneInterviewContext,
  type ResolvedInterviewContext,
} from "@/lib/interview/application-context";

export const profileSchema = z.object({
  purpose: z.enum(["tourism", "business", "family_visit", "medical", "other"]),
  purposeDetails: z.string().trim().max(300),
  destinations: z.string().trim().max(300),
  travelDates: z.string().trim().max(160),
  duration: z.string().trim().max(100),
  funding: z.string().trim().max(240),
  budget: z.string().trim().max(100),
  occupation: z.string().trim().max(240),
  employer: z.string().trim().max(240),
  homeTies: z.string().trim().max(400),
  previousTravel: z.string().trim().max(400),
  companions: z.string().trim().max(300).default(""),
  usContact: z.string().trim().max(300).default(""),
  refusalHistory: z.string().trim().max(400).default(""),
});

export const questionSchema = z.object({
  id: z.string().min(1).max(80),
  topic: z.string().min(1).max(60),
  prompt: z.string().min(1).max(500),
  isFollowUp: z.boolean(),
  parentId: z.string().max(80).optional(),
});

export const applicationIdSchema = z.string().uuid();

export async function resolveInterviewContext(input: {
  applicationId?: string;
  profile?: ApplicantProfile;
}): Promise<ResolvedInterviewContext> {
  if (input.applicationId) return loadInterviewApplicationContext(input.applicationId);
  if (!input.profile) {
    throw new InterviewContextError("CONTEXT_LOAD_FAILED", 400, "独立练习需要提供练习资料。");
  }
  return standaloneInterviewContext(input.profile);
}

export function contextResponse(context: InterviewApplicationContext) {
  const consistencyStatus = context.source === "standalone" || context.verifiedFields.length === 0
    ? "unverified"
    : context.missingFields.length === 0
      ? "verifiable"
      : "partially_verifiable";
  return {
    source: context.source,
    applicationId: context.applicationId,
    missingFields: context.missingFields,
    verifiedFields: context.verifiedFields,
    consistencyStatus,
  };
}

export function errorResponse(code: string, message: string, status: number, details?: Record<string, unknown>) {
  return Response.json({ error: message, code, retryable: status >= 500, ...(details ? { details } : {}) }, { status });
}

export function contextErrorResponse(error: unknown) {
  if (error instanceof InterviewContextError) return errorResponse(error.code, error.message, error.status);
  return errorResponse("CONTEXT_LOAD_FAILED", "暂时无法读取面试资料，请稍后重试。", 500);
}

export function requestFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export type IdempotentEntry<T> = { fingerprint: string; response: T };

export function readIdempotent<T>(cache: Map<string, IdempotentEntry<T>>, key: string, fingerprint: string) {
  const cached = cache.get(key);
  if (!cached) return { kind: "miss" as const };
  if (cached.fingerprint !== fingerprint) return { kind: "conflict" as const };
  return { kind: "hit" as const, response: cached.response };
}
