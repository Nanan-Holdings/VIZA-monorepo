import { NextRequest } from "next/server";
import { z } from "zod";
import { getQuestion, processAnswer } from "./engine";
import type { InterviewTurnResponse } from "./types";

const profileSchema = z.object({
  purpose: z.enum(["tourism", "business", "family_visit", "medical", "other"]),
  purposeDetails: z.string().trim().min(2).max(300),
  destinations: z.string().trim().min(2).max(200),
  travelDates: z.string().trim().min(2).max(100),
  duration: z.string().trim().min(1).max(100),
  funding: z.string().trim().min(2).max(200),
  budget: z.string().trim().max(100),
  occupation: z.string().trim().min(2).max(200),
  employer: z.string().trim().max(200),
  homeTies: z.string().trim().min(2).max(300),
  previousTravel: z.string().trim().max(300),
});

const questionSchema = z.object({
  id: z.string().min(1).max(80),
  topic: z.string().min(1).max(40),
  prompt: z.string().min(1).max(300),
  isFollowUp: z.boolean(),
  parentId: z.string().max(80).optional(),
});

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), profile: profileSchema }),
  z.object({
    action: z.literal("answer"),
    idempotencyKey: z.string().min(8).max(240),
    profile: profileSchema,
    question: questionSchema,
    answer: z.string().trim().min(1).max(1500),
    questionIndex: z.number().int().min(0).max(20),
    followUpUsed: z.boolean(),
  }),
]);

const globalTurnCache = globalThis as typeof globalThis & {
  __vizaInterviewTurnCache?: Map<string, InterviewTurnResponse>;
};
const turnCache = globalTurnCache.__vizaInterviewTurnCache ?? new Map<string, InterviewTurnResponse>();
globalTurnCache.__vizaInterviewTurnCache = turnCache;

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: "面试资料不完整，请返回资料确认页检查必填项。" },
      { status: 400 },
    );
  }

  if (parsed.data.action === "start") {
    return Response.json({ question: getQuestion(parsed.data.profile, 0), questionIndex: 0 });
  }

  const cached = turnCache.get(parsed.data.idempotencyKey);
  if (cached) return Response.json(cached, { headers: { "X-Interview-Turn-Cache": "HIT" } });

  const result = processAnswer(parsed.data);
  turnCache.set(parsed.data.idempotencyKey, result);
  return Response.json(result, { headers: { "X-Interview-Turn-Cache": "MISS" } });
}
