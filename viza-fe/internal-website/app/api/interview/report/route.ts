import { NextRequest } from "next/server";
import { z } from "zod";
import { assessAnswer, buildInterviewPlan, createInterviewReport } from "../engine";
import type { InterviewReport } from "../types";
import {
  applicationIdSchema,
  contextErrorResponse,
  contextResponse,
  errorResponse,
  interviewProfileFieldSchema,
  profileSchema,
  questionSchema,
  readIdempotent,
  requestFingerprint,
  resolveInterviewContext,
  type IdempotentEntry,
} from "../contract";

export type { InterviewReport } from "../types";

type ReportPayload = InterviewReport & { context: ReturnType<typeof contextResponse> };

const exchangeSchema = z.object({
  question: questionSchema,
  answer: z.string().trim().min(1).max(1500),
  assessment: z.unknown().optional(),
  submittedAt: z.string().max(80),
}).strict();

const reportRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(240),
  applicationId: applicationIdSchema.optional(),
  profile: profileSchema.optional(),
  confirmedFields: z.array(interviewProfileFieldSchema).max(20).optional(),
  exchanges: z.array(exchangeSchema).min(1).max(24),
}).strict();

const globalReportCache = globalThis as typeof globalThis & {
  __vizaInterviewReportCacheV1?: Map<string, IdempotentEntry<ReportPayload>>;
};
const reportCache = globalReportCache.__vizaInterviewReportCacheV1 ?? new Map<string, IdempotentEntry<ReportPayload>>();
globalReportCache.__vizaInterviewReportCacheV1 = reportCache;

function transcriptIsValid(profile: Parameters<typeof buildInterviewPlan>[0], exchanges: z.infer<typeof exchangeSchema>[]) {
  const topics = new Set(buildInterviewPlan(profile).map((item) => item.id));
  const followUps = new Map<string, number>();
  for (const exchange of exchanges) {
    const baseId = exchange.question.parentId ?? exchange.question.id.replace(/-follow-up$/, "");
    if (!topics.has(baseId)) return false;
    if (exchange.question.isFollowUp) {
      if (exchange.question.id !== `${baseId}-follow-up` || exchange.question.parentId !== baseId) return false;
      followUps.set(baseId, (followUps.get(baseId) ?? 0) + 1);
      if ((followUps.get(baseId) ?? 0) > 1) return false;
    }
  }
  return true;
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "请求内容不是有效的 JSON。", 400);
  }

  const parsed = reportRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse("INVALID_REQUEST", "报告资料不足或格式不正确。", 400);
  }

  let resolved;
  try {
    resolved = await resolveInterviewContext({
      applicationId: parsed.data.applicationId,
      profile: parsed.data.profile,
      confirmedFields: parsed.data.confirmedFields,
    });
  } catch (error) {
    return contextErrorResponse(error);
  }

  if (!transcriptIsValid(resolved.profile, parsed.data.exchanges)) {
    return errorResponse("TRANSCRIPT_CONTEXT_MISMATCH", "面试记录与当前题目合同不一致。", 409);
  }

  const cacheKey = `${resolved.cacheScope}:report:${parsed.data.idempotencyKey}`;
  const fingerprint = requestFingerprint({
    applicationId: parsed.data.applicationId,
    profile: parsed.data.applicationId ? undefined : resolved.profile,
    confirmedFields: parsed.data.confirmedFields,
    exchanges: parsed.data.exchanges.map(({ question, answer, submittedAt }) => ({ question, answer, submittedAt })),
  });
  const cached = readIdempotent(reportCache, cacheKey, fingerprint);
  if (cached.kind === "conflict") {
    return errorResponse("IDEMPOTENCY_CONFLICT", "同一个幂等键不能用于不同的面试报告。", 409);
  }
  if (cached.kind === "hit") {
    return Response.json(cached.response, { headers: { "X-Interview-Report-Cache": "HIT" } });
  }

  const exchanges = parsed.data.exchanges.map((exchange) => ({
    ...exchange,
    assessment: assessAnswer(resolved.profile, exchange.question, exchange.answer, resolved.context),
  }));
  const report: ReportPayload = {
    ...createInterviewReport({
      profile: resolved.profile,
      context: resolved.context,
      exchanges,
      idempotencyKey: parsed.data.idempotencyKey,
    }),
    context: contextResponse(resolved.context),
  };
  reportCache.set(cacheKey, { fingerprint, response: report });
  return Response.json(report, { headers: { "X-Interview-Report-Cache": "MISS" } });
}
