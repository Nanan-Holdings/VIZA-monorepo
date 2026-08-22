import { z } from "zod";
import type {
  ApplicantProfile,
  InterviewExchange,
  InterviewOfficer,
  InterviewQuestion,
  InterviewReport,
} from "@/app/api/interview/types";

export const INTERVIEW_SESSION_KEY = "viza:b1b2-interview:session:v2";
export const INTERVIEW_SESSION_VERSION = 2;

export type InterviewPhase = "setup" | "interview" | "complete" | "report";
export type ReportStatus = "idle" | "generating" | "failed" | "ready";

export interface InterviewSession {
  version: typeof INTERVIEW_SESSION_VERSION;
  id: string;
  phase: InterviewPhase;
  profile: ApplicantProfile;
  officer: InterviewOfficer;
  exchanges: InterviewExchange[];
  currentQuestion: InterviewQuestion | null;
  draftAnswer: string;
  questionIndex: number;
  followUpQuestionIds: string[];
  reportStatus: ReportStatus;
  report: InterviewReport | null;
  updatedAt: string;
}

export const DEFAULT_PROFILE: ApplicantProfile = {
  purpose: "tourism",
  purposeDetails: "",
  destinations: "",
  travelDates: "",
  duration: "",
  funding: "",
  budget: "",
  occupation: "",
  employer: "",
  homeTies: "",
  previousTravel: "",
};

export const DEFAULT_OFFICER: InterviewOfficer = {
  id: "standard",
  name: "Miller",
  style: "标准节奏，优先核实目的、行程和回国约束",
};

const storedSessionSchema = z.object({
  version: z.literal(INTERVIEW_SESSION_VERSION),
  id: z.string().min(1),
  phase: z.enum(["setup", "interview", "complete", "report"]),
  profile: z.object({
    purpose: z.enum(["tourism", "business", "family_visit", "medical", "other"]),
    purposeDetails: z.string(),
    destinations: z.string(),
    travelDates: z.string(),
    duration: z.string(),
    funding: z.string(),
    budget: z.string(),
    occupation: z.string(),
    employer: z.string(),
    homeTies: z.string(),
    previousTravel: z.string(),
  }),
  officer: z.object({
    id: z.enum(["standard", "rapid", "verification", "supportive"]),
    name: z.string(),
    style: z.string(),
  }),
  exchanges: z.array(z.object({
    question: z.object({
      id: z.string(),
      topic: z.string(),
      prompt: z.string(),
      isFollowUp: z.boolean(),
      parentId: z.string().optional(),
    }),
    answer: z.string(),
    assessment: z.object({
      score: z.number(),
      status: z.enum(["strong", "developing", "weak"]),
      note: z.string(),
      missingRequirements: z.array(z.enum(["detail", "destination", "time", "money", "work", "ties", "history"])),
    }),
    submittedAt: z.string(),
  })),
  currentQuestion: z.object({
    id: z.string(),
    topic: z.string(),
    prompt: z.string(),
    isFollowUp: z.boolean(),
    parentId: z.string().optional(),
  }).nullable(),
  draftAnswer: z.string(),
  questionIndex: z.number().int().min(0),
  followUpQuestionIds: z.array(z.string()),
  reportStatus: z.enum(["idle", "generating", "failed", "ready"]),
  report: z.unknown().nullable(),
  updatedAt: z.string(),
});

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `interview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createInterviewSession(now = new Date().toISOString()): InterviewSession {
  return {
    version: INTERVIEW_SESSION_VERSION,
    id: createId(),
    phase: "setup",
    profile: { ...DEFAULT_PROFILE },
    officer: { ...DEFAULT_OFFICER },
    exchanges: [],
    currentQuestion: null,
    draftAnswer: "",
    questionIndex: 0,
    followUpQuestionIds: [],
    reportStatus: "idle",
    report: null,
    updatedAt: now,
  };
}

export function readInterviewSession(storage: Pick<Storage, "getItem">): InterviewSession | null {
  try {
    const raw = storage.getItem(INTERVIEW_SESSION_KEY);
    if (!raw) return null;
    const result = storedSessionSchema.safeParse(JSON.parse(raw));
    if (!result.success) return null;
    const session = result.data as Omit<InterviewSession, "report"> & { report: unknown };
    return { ...session, report: session.report as InterviewReport | null };
  } catch {
    return null;
  }
}

export function writeInterviewSession(
  storage: Pick<Storage, "setItem">,
  session: InterviewSession,
) {
  storage.setItem(INTERVIEW_SESSION_KEY, JSON.stringify(session));
}

export function clearInterviewSession(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(INTERVIEW_SESSION_KEY);
}

export function reportIdempotencyKey(session: Pick<InterviewSession, "id" | "exchanges">) {
  const last = session.exchanges.at(-1)?.submittedAt ?? "empty";
  return `${session.id}:${session.exchanges.length}:${last}`;
}
