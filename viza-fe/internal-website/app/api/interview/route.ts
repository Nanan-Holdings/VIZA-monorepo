import { NextRequest } from "next/server";
import { z } from "zod";
import { getQuestion, processAnswer } from "./engine";
import type { InterviewTurnResponse } from "./types";
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
} from "./contract";

type TurnPayload = InterviewTurnResponse & { context: ReturnType<typeof contextResponse> };

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    language: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
    applicationId: applicationIdSchema.optional(),
    profile: profileSchema.optional(),
    confirmedFields: z.array(interviewProfileFieldSchema).max(20).optional(),
    questionIndex: z.number().int().min(0).max(7).optional(),
  }).strict(),
  z.object({
    action: z.literal("answer"),
    language: z.enum(["zh-CN", "en-US"]).default("zh-CN"),
    idempotencyKey: z.string().min(8).max(240),
    applicationId: applicationIdSchema.optional(),
    profile: profileSchema.optional(),
    confirmedFields: z.array(interviewProfileFieldSchema).max(20).optional(),
    question: questionSchema,
    answer: z.string().trim().min(1).max(1500),
    questionIndex: z.number().int().min(0).max(20),
    followUpUsed: z.boolean(),
  }).strict(),
]);

const globalTurnCache = globalThis as typeof globalThis & {
  __vizaInterviewTurnCacheV1?: Map<string, IdempotentEntry<TurnPayload>>;
};
const turnCache = globalTurnCache.__vizaInterviewTurnCacheV1 ?? new Map<string, IdempotentEntry<TurnPayload>>();
globalTurnCache.__vizaInterviewTurnCacheV1 = turnCache;

function isExpectedQuestion(profile: Parameters<typeof getQuestion>[0], index: number, received: z.infer<typeof questionSchema>, language: "zh-CN" | "en-US") {
  const expected = getQuestion(profile, index, language);
  if (!expected) return false;
  if (!received.isFollowUp) {
    return received.id === expected.id && received.topic === expected.topic && received.prompt === expected.prompt && !received.parentId;
  }
  return received.id === `${expected.id}-follow-up` && received.parentId === expected.id && received.topic === expected.topic;
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "请求内容不是有效的 JSON。", 400);
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return errorResponse("INVALID_REQUEST", "面试请求资料不完整或格式不正确。", 400);
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

  const responseContext = contextResponse(resolved.context);
  if (parsed.data.action === "start") {
    const questionIndex = parsed.data.questionIndex ?? 0;
    return Response.json({
      question: getQuestion(resolved.profile, questionIndex, parsed.data.language),
      questionIndex,
      context: responseContext,
    });
  }

  if (!isExpectedQuestion(resolved.profile, parsed.data.questionIndex, parsed.data.question, parsed.data.language)) {
    return errorResponse("QUESTION_CONTEXT_MISMATCH", "题目与当前面试进度不一致，请重新开始本轮练习。", 409);
  }

  const cacheKey = `${resolved.cacheScope}:turn:${parsed.data.idempotencyKey}`;
  const fingerprint = requestFingerprint({
    applicationId: parsed.data.applicationId,
    language: parsed.data.language,
    profile: parsed.data.applicationId ? undefined : resolved.profile,
    confirmedFields: parsed.data.confirmedFields,
    question: parsed.data.question,
    answer: parsed.data.answer,
    questionIndex: parsed.data.questionIndex,
    followUpUsed: parsed.data.followUpUsed,
  });
  const cached = readIdempotent(turnCache, cacheKey, fingerprint);
  if (cached.kind === "conflict") {
    return errorResponse("IDEMPOTENCY_CONFLICT", "同一个幂等键不能用于不同的面试回答。", 409);
  }
  if (cached.kind === "hit") {
    return Response.json(cached.response, { headers: { "X-Interview-Turn-Cache": "HIT" } });
  }

  const result: TurnPayload = {
    ...processAnswer({
      profile: resolved.profile,
      context: resolved.context,
      language: parsed.data.language,
      question: parsed.data.question,
      answer: parsed.data.answer,
      questionIndex: parsed.data.questionIndex,
      followUpUsed: parsed.data.followUpUsed,
    }),
    context: responseContext,
  };
  turnCache.set(cacheKey, { fingerprint, response: result });
  return Response.json(result, { headers: { "X-Interview-Turn-Cache": "MISS" } });
}
