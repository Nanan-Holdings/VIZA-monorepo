import { z } from "zod";
import type {
  ApplicantProfile,
  InterviewExchange,
  InterviewContextSummary,
  InterviewOfficer,
  InterviewQuestion,
  InterviewReport,
} from "@/app/api/interview/types";

export const INTERVIEW_SESSION_KEY = "viza:b1b2-interview:session:v2";
export const INTERVIEW_SESSION_VERSION = 3;
export const LEGACY_INTERVIEW_SESSION_VERSION = 2;

export type InterviewPhase = "setup" | "interview" | "complete" | "report";
export type ReportStatus = "idle" | "generating" | "failed" | "ready";
export type InterviewPracticeLanguage = "zh-CN" | "en-US";
export type InterviewStage = "profile" | "question" | "answering" | "complete" | "reporting" | "report_ready";

export interface InterviewSessionIdentity {
  applicationId?: string | null;
  visaType?: string | null;
}

export interface InterviewErrorRecovery {
  lastError: string | null;
  retryable: boolean;
  lastFailedAction: "start" | "answer" | "report" | "speech" | null;
  recoveredAt: string | null;
}

export interface InterviewSession {
  version: typeof INTERVIEW_SESSION_VERSION;
  id: string;
  applicationId: string | null;
  visaType: string | null;
  language: InterviewPracticeLanguage;
  stage: InterviewStage;
  phase: InterviewPhase;
  profile: ApplicantProfile;
  officer: InterviewOfficer;
  exchanges: InterviewExchange[];
  currentQuestion: InterviewQuestion | null;
  draftAnswer: string;
  completedTopics: string[];
  questionIndex: number;
  followUpQuestionIds: string[];
  pendingRequestKey: string | null;
  lastAnswerIdempotencyKey: string | null;
  errorRecovery: InterviewErrorRecovery;
  applicationContext: InterviewContextSummary | null;
  disclaimerVersion: number | null;
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
  companions: "",
  usContact: "",
  refusalHistory: "",
};

export const DEFAULT_OFFICER: InterviewOfficer = {
  id: "standard",
  name: "Miller",
  style: "标准节奏，优先核实目的、行程和回国约束",
};

const questionSchema = z.object({
  id: z.string(),
  topic: z.string(),
  prompt: z.string(),
  isFollowUp: z.boolean(),
  parentId: z.string().optional(),
});

const scoreDimensionsSchema = z.object({
  completeness: z.number(),
  specificity: z.number(),
  consistency: z.number().nullable(),
  consistencyStatus: z.enum(["verified", "unverified"]),
});

const exchangeSchema = z.object({
  question: questionSchema,
  answer: z.string(),
  assessment: z.object({
    score: z.number(),
    status: z.enum(["strong", "developing", "weak"]),
    note: z.string(),
    missingRequirements: z.array(z.enum([
      "detail",
      "purpose",
      "activity",
      "travel_anchor",
      "destination",
      "time",
      "money",
      "payer",
      "funding_source",
      "work",
      "role",
      "organization",
      "responsibility",
      "ties",
      "history",
      "companions",
      "contact",
      "refusal",
    ])),
    dimensions: scoreDimensionsSchema.optional(),
  }),
  submittedAt: z.string(),
});

const profileSchema = z.object({
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
  companions: z.string().optional().default(""),
  usContact: z.string().optional().default(""),
  refusalHistory: z.string().optional().default(""),
});

const officerSchema = z.object({
  id: z.enum(["standard", "rapid", "verification", "supportive"]),
  name: z.string(),
  style: z.string(),
});

const applicationContextSchema = z.object({
  source: z.enum(["standalone", "application"]),
  applicationId: z.string().optional(),
  missingFields: z.array(z.string()),
  verifiedFields: z.array(z.string()),
  needsConfirmationFields: z.array(z.string()).optional().default([]),
  fieldStates: z.array(z.object({
    field: z.string(),
    status: z.enum(["confirmed", "needs_confirmation", "missing"]),
    source: z.enum(["saved_application", "simplified_form", "derived", "practice"]).nullable(),
  })).optional().default([]),
  consistencyStatus: z.enum(["unverified", "verifiable", "partially_verifiable"]),
});

const storedSessionSchema = z.object({
  version: z.literal(INTERVIEW_SESSION_VERSION),
  id: z.string().min(1),
  applicationId: z.string().nullable(),
  visaType: z.string().nullable(),
  language: z.enum(["zh-CN", "en-US"]),
  stage: z.enum(["profile", "question", "answering", "complete", "reporting", "report_ready"]),
  phase: z.enum(["setup", "interview", "complete", "report"]),
  profile: profileSchema,
  officer: officerSchema,
  exchanges: z.array(exchangeSchema),
  currentQuestion: questionSchema.nullable(),
  draftAnswer: z.string(),
  completedTopics: z.array(z.string()),
  questionIndex: z.number().int().min(0),
  followUpQuestionIds: z.array(z.string()),
  pendingRequestKey: z.string().nullable(),
  lastAnswerIdempotencyKey: z.string().nullable(),
  errorRecovery: z.object({
    lastError: z.string().nullable(),
    retryable: z.boolean(),
    lastFailedAction: z.enum(["start", "answer", "report", "speech"]).nullable(),
    recoveredAt: z.string().nullable(),
  }),
  applicationContext: applicationContextSchema.nullable().optional().default(null),
  disclaimerVersion: z.number().int().positive().nullable().optional().default(null),
  reportStatus: z.enum(["idle", "generating", "failed", "ready"]),
  report: z.unknown().nullable(),
  updatedAt: z.string(),
});

const legacyStoredSessionSchema = z.object({
  version: z.literal(LEGACY_INTERVIEW_SESSION_VERSION),
  id: z.string().min(1),
  phase: z.enum(["setup", "interview", "complete", "report"]),
  profile: profileSchema,
  officer: officerSchema,
  exchanges: z.array(exchangeSchema),
  currentQuestion: questionSchema.nullable(),
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

function normalizeIdentity(identity?: InterviewSessionIdentity): Required<InterviewSessionIdentity> {
  return {
    applicationId: identity?.applicationId?.trim() || null,
    visaType: identity?.visaType?.trim() || null,
  };
}

function segment(value: string) {
  return encodeURIComponent(value.trim()).replace(/%/g, "~");
}

export function getInterviewSessionKey(identity?: InterviewSessionIdentity): string {
  const normalized = normalizeIdentity(identity);
  if (!normalized.applicationId) return INTERVIEW_SESSION_KEY;
  return `${INTERVIEW_SESSION_KEY}:application:${segment(normalized.applicationId)}:${segment(normalized.visaType ?? "unknown")}`;
}

export function createInterviewSession(now = new Date().toISOString()): InterviewSession {
  return {
    version: INTERVIEW_SESSION_VERSION,
    id: createId(),
    applicationId: null,
    visaType: null,
    language: "zh-CN",
    stage: "profile",
    phase: "setup",
    profile: { ...DEFAULT_PROFILE },
    officer: { ...DEFAULT_OFFICER },
    exchanges: [],
    currentQuestion: null,
    draftAnswer: "",
    completedTopics: [],
    questionIndex: 0,
    followUpQuestionIds: [],
    pendingRequestKey: null,
    lastAnswerIdempotencyKey: null,
    errorRecovery: {
      lastError: null,
      retryable: false,
      lastFailedAction: null,
      recoveredAt: null,
    },
    applicationContext: null,
    disclaimerVersion: null,
    reportStatus: "idle",
    report: null,
    updatedAt: now,
  };
}

export function applyInterviewSessionIdentity(
  session: InterviewSession,
  identity?: InterviewSessionIdentity,
): InterviewSession {
  const normalized = identity
    ? normalizeIdentity(identity)
    : normalizeIdentity({ applicationId: session.applicationId, visaType: session.visaType });
  return {
    ...session,
    applicationId: normalized.applicationId,
    visaType: normalized.visaType,
  };
}

export function migrateLegacyInterviewSession(
  legacy: z.infer<typeof legacyStoredSessionSchema>,
  identity?: InterviewSessionIdentity,
): InterviewSession {
  const normalizedIdentity = normalizeIdentity(identity);
  const completedTopics = Array.from(
    new Set(legacy.exchanges.map((exchange) => exchange.question.topic).filter(Boolean)),
  );
  const stage: InterviewStage =
    legacy.phase === "report"
      ? "report_ready"
      : legacy.phase === "complete"
        ? "complete"
        : legacy.phase === "interview"
          ? "question"
          : "profile";

  return {
    ...legacy,
    version: INTERVIEW_SESSION_VERSION,
    applicationId: normalizedIdentity.applicationId,
    visaType: normalizedIdentity.visaType,
    language: "zh-CN",
    stage,
    completedTopics,
    pendingRequestKey: null,
    lastAnswerIdempotencyKey: null,
    errorRecovery: {
      lastError: null,
      retryable: false,
      lastFailedAction: null,
      recoveredAt: null,
    },
    applicationContext: null,
    disclaimerVersion: null,
    report: legacy.report as InterviewReport | null,
  };
}

export function normalizeStoredInterviewSession(
  raw: string | null,
  identity?: InterviewSessionIdentity,
): InterviewSession | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  const result = storedSessionSchema.safeParse(parsed);
  if (result.success) {
    const session = result.data as Omit<InterviewSession, "report"> & { report: unknown };
    return applyInterviewSessionIdentity(
      {
        ...session,
        applicationContext: session.applicationContext as InterviewContextSummary | null,
        report: session.report as InterviewReport | null,
      },
      identity ?? { applicationId: session.applicationId, visaType: session.visaType },
    );
  }

  const legacy = legacyStoredSessionSchema.safeParse(parsed);
  if (legacy.success) return migrateLegacyInterviewSession(legacy.data, identity);

  return null;
}

export function readInterviewSession(
  storage: Pick<Storage, "getItem">,
  identity?: InterviewSessionIdentity,
): InterviewSession | null {
  try {
    return normalizeStoredInterviewSession(storage.getItem(getInterviewSessionKey(identity)), identity);
  } catch {
    return null;
  }
}

export function writeInterviewSession(
  storage: Pick<Storage, "setItem">,
  session: InterviewSession,
  identity?: InterviewSessionIdentity,
) {
  const sessionWithIdentity = applyInterviewSessionIdentity(session, identity);
  storage.setItem(getInterviewSessionKey(sessionWithIdentity), JSON.stringify(sessionWithIdentity));
}

export function clearInterviewSession(
  storage: Pick<Storage, "removeItem">,
  identity?: InterviewSessionIdentity,
) {
  storage.removeItem(getInterviewSessionKey(identity));
}

export function reportIdempotencyKey(session: Pick<InterviewSession, "id" | "exchanges">) {
  const last = session.exchanges.at(-1)?.submittedAt ?? "empty";
  return `${session.id}:${session.exchanges.length}:${last}`;
}

export function answerIdempotencyKey(
  session: Pick<InterviewSession, "id" | "currentQuestion" | "exchanges">,
) {
  const questionId = session.currentQuestion?.id ?? "no-question";
  return `${session.id}:${questionId}:${session.exchanges.length}`;
}

export function interviewStageForPhase(
  phase: InterviewPhase,
  reportStatus: ReportStatus = "idle",
): InterviewStage {
  if (phase === "report") return "report_ready";
  if (phase === "complete") return reportStatus === "generating" ? "reporting" : "complete";
  if (phase === "interview") return "question";
  return "profile";
}

export function recoverableInterviewError(
  lastFailedAction: InterviewErrorRecovery["lastFailedAction"],
  lastError: string,
): InterviewErrorRecovery {
  return {
    lastError,
    retryable: true,
    lastFailedAction,
    recoveredAt: null,
  };
}

export function resetInterviewSession(
  session: InterviewSession,
  now = new Date().toISOString(),
): InterviewSession {
  return applyInterviewSessionIdentity({
    ...createInterviewSession(now),
    disclaimerVersion: session.disclaimerVersion,
  }, {
    applicationId: session.applicationId,
    visaType: session.visaType,
  });
}
