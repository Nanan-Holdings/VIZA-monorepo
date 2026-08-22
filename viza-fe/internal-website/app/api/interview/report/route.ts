import { NextRequest } from "next/server";
import { z } from "zod";
import { createInterviewReport } from "../engine";
import type { InterviewReport } from "../types";

export type { InterviewReport } from "../types";

const profileSchema = z.object({
  purpose: z.enum(["tourism", "business", "family_visit", "medical", "other"]),
  purposeDetails: z.string().max(300),
  destinations: z.string().max(200),
  travelDates: z.string().max(100),
  duration: z.string().max(100),
  funding: z.string().max(200),
  budget: z.string().max(100),
  occupation: z.string().max(200),
  employer: z.string().max(200),
  homeTies: z.string().max(300),
  previousTravel: z.string().max(300),
});

const exchangeSchema = z.object({
  question: z.object({
    id: z.string().min(1).max(80),
    topic: z.string().min(1).max(40),
    prompt: z.string().min(1).max(300),
    isFollowUp: z.boolean(),
    parentId: z.string().max(80).optional(),
  }),
  answer: z.string().trim().min(1).max(1500),
  assessment: z.object({
    score: z.number().min(0).max(100),
    status: z.enum(["strong", "developing", "weak"]),
    note: z.string().max(300),
    missingRequirements: z.array(
      z.enum(["detail", "destination", "time", "money", "work", "ties", "history"]),
    ),
  }),
  submittedAt: z.string().max(80),
});

const reportRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(240),
  profile: profileSchema,
  exchanges: z.array(exchangeSchema).min(1).max(20),
});

const globalReportCache = globalThis as typeof globalThis & {
  __vizaInterviewReportCache?: Map<string, InterviewReport>;
};
const reportCache = globalReportCache.__vizaInterviewReportCache ?? new Map<string, InterviewReport>();
globalReportCache.__vizaInterviewReportCache = reportCache;

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = reportRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "报告资料不足，请返回面试继续完成回答。" }, { status: 400 });
  }

  const cached = reportCache.get(parsed.data.idempotencyKey);
  if (cached) {
    return Response.json(cached, { headers: { "X-Interview-Report-Cache": "HIT" } });
  }

  const report = createInterviewReport(parsed.data);
  reportCache.set(parsed.data.idempotencyKey, report);
  return Response.json(report, { headers: { "X-Interview-Report-Cache": "MISS" } });
}
