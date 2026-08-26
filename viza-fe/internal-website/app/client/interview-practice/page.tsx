"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  Briefcase,
  CalendarBlank,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Flag,
  Headphones,
  MapPin,
  Microphone,
  PaperPlaneTilt,
  Pause,
  Play,
  SpeakerHigh,
  Stop,
  Target,
  WarningCircle,
  Wallet,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  ApplicantProfile,
  InterviewContextSummary,
  InterviewProfileField,
  InterviewProfileFieldStatus,
} from "@/app/api/interview/types";
import {
  DEFAULT_OFFICER,
  INTERVIEW_OFFICERS,
  answerIdempotencyKey,
  applyInterviewSessionIdentity,
  clearInterviewSession,
  createInterviewSession,
  interviewStageForPhase,
  recoverableInterviewError,
  readInterviewSession,
  resetInterviewSession,
  reportIdempotencyKey,
  writeInterviewSession,
  type InterviewSession,
} from "./session";
import { useBrowserSpeech } from "./_hooks/use-browser-speech";
import { useInterviewerTts } from "./_hooks/use-interviewer-tts";
import {
  INTERVIEW_DISCLAIMER_VERSION,
  captureMissingFactsFromAnswer,
  confirmExistingProfile,
  fieldState,
  mergeLoadedProfile,
  profilePreparationCounts,
  updatePracticeField,
} from "./profile-state";

const REQUIRED_FIELDS: Array<keyof ApplicantProfile> = [
  "purposeDetails",
  "destinations",
  "travelDates",
  "duration",
  "funding",
  "occupation",
  "homeTies",
];

const TOPICS = ["目的", "行程", "停留", "资金", "工作/学习", "同行/联系人", "过往记录", "回国约束"];

const PREPARATION_PRIORITY_FIELDS: InterviewProfileField[] = [
  "purpose",
  "purposeDetails",
  "destinations",
  "travelDates",
  "duration",
  "funding",
  "occupation",
  "employer",
  "homeTies",
];

const PURPOSE_LABELS: Record<ApplicantProfile["purpose"], string> = {
  tourism: "旅游",
  business: "商务",
  family_visit: "探亲访友",
  medical: "就医",
  other: "其他短期访问",
};

function InterviewBackdrop({ dark = false }: { dark?: boolean }) {
  const line = dark ? "rgba(175, 200, 240, 0.09)" : "rgba(0, 32, 96, 0.055)";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className={dark ? "absolute inset-0 bg-[#050b16]" : "absolute inset-0 bg-[#f8fafc]"} />
      <div
        className={dark
          ? "absolute inset-x-[-35%] bottom-[-55%] h-[125%] opacity-90"
          : "absolute inset-x-[-55%] top-[-12%] h-[115%] opacity-90 [mask-image:linear-gradient(to_bottom,black_0%,black_62%,transparent_100%)]"}
        style={{
          backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
          backgroundSize: "42px 42px",
          transform: dark
            ? "perspective(760px) rotateX(62deg) scale(1.35)"
            : "perspective(1000px) rotateX(60deg) scale(2.15) translateY(-8%)",
          transformOrigin: dark ? "center bottom" : "center top",
        }}
      />
      {!dark ? (
        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(0,32,96,0.035),transparent)] bg-[length:200%_100%] motion-safe:animate-[pulse_6s_ease-in-out_infinite]" />
      ) : null}
      <div
        className={`absolute inset-x-0 top-[34%] h-px motion-safe:animate-pulse ${dark ? "bg-[#8bb8ee]/15" : "bg-brand-300/20"}`}
      />
      <div className={`absolute inset-x-0 top-0 h-40 ${dark ? "bg-[#081426]/80" : "bg-white/[0.72]"}`} />
      {!dark ? <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-b from-transparent via-[#f8fafc]/85 to-[#f8fafc]" /> : null}
    </div>
  );
}

function PhaseRail({ active, dark = false }: { active: 1 | 2 | 3; dark?: boolean }) {
  const phases = ["资料准备", "模拟面试", "练习报告"];
  return (
    <ol aria-label="练习阶段" className="flex min-w-0 items-center gap-2 text-xs sm:gap-3">
      {phases.map((phase, index) => {
        const number = index + 1;
        const reached = number <= active;
        return (
          <li key={phase} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${
                reached
                  ? dark ? "border-[#9fc5ef] bg-[#d6e8fb] text-[#071322]" : "border-brand-700 bg-brand-700 text-white"
                  : dark ? "border-white/20 text-white/45" : "border-[#cbd5e1] text-[#7a8798]"
              }`}
            >
              {number}
            </span>
            <span className={`truncate ${reached ? dark ? "text-white" : "text-[#26364a]" : dark ? "text-white/45" : "text-[#8a94a6]"}`}>
              {phase}
            </span>
            {index < phases.length - 1 ? (
              <span className={`h-px min-w-3 flex-1 ${number < active ? dark ? "bg-[#9fc5ef]" : "bg-brand-500" : dark ? "bg-white/15" : "bg-[#dfe5ec]"}`} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function VoiceWaveform({ active, dark = false }: { active: boolean; dark?: boolean }) {
  const heights = [28, 46, 72, 42, 88, 58, 34, 68, 50, 82, 38, 60, 30];
  return (
    <div aria-hidden="true" className="flex h-16 items-center justify-center gap-1.5">
      {heights.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={`w-1 rounded-full transition-opacity ${active ? "motion-safe:animate-pulse" : "opacity-45"} ${dark ? "bg-[#9fc5ef]" : "bg-brand-500"}`}
          style={{ height: `${active ? height : Math.min(height, 34)}%`, animationDelay: `${index * 70}ms` }}
        />
      ))}
    </div>
  );
}

function profileDisplayValue(profile: ApplicantProfile, field: InterviewProfileField) {
  if (field === "purpose") return PURPOSE_LABELS[profile.purpose];
  return String(profile[field] ?? "").trim();
}

type PreparationDossierItem = {
  id: "purpose" | "destination" | "timing" | "funding" | "anchor";
  label: string;
  fields: InterviewProfileField[];
};

function dossierStatus(
  context: InterviewContextSummary | null,
  fields: InterviewProfileField[],
): InterviewProfileFieldStatus {
  const statuses = fields.map((field) => fieldState(context, field).status);
  if (statuses.includes("missing")) return "missing";
  if (statuses.includes("needs_confirmation")) return "needs_confirmation";
  return "confirmed";
}

function preparationDossierItems(
  context: InterviewContextSummary | null,
  linked: boolean,
): PreparationDossierItem[] {
  const anchorCandidates: InterviewProfileField[] = ["homeTies", "occupation", "employer"];
  const rank: Record<InterviewProfileFieldStatus, number> = {
    missing: 3,
    needs_confirmation: 2,
    confirmed: 1,
  };
  const anchor = [...anchorCandidates].sort((left, right) => (
    rank[fieldState(context, right).status] - rank[fieldState(context, left).status]
  ))[0];

  return [
    { id: "purpose", label: "赴美目的与具体活动", fields: ["purpose", "purposeDetails"] },
    { id: "destination", label: "目的地", fields: ["destinations"] },
    { id: "timing", label: "出行时间与停留时长", fields: ["travelDates", "duration"] },
    { id: "funding", label: "费用承担", fields: ["funding"] },
    {
      id: "anchor",
      label: linked ? FIELD_LABELS[anchor] : "职业与回国安排",
      fields: linked ? [anchor] : ["occupation", "homeTies"],
    },
  ];
}

function DossierIcon({ id }: { id: PreparationDossierItem["id"] }) {
  const className = "h-5 w-5";
  if (id === "destination") return <MapPin className={className} />;
  if (id === "timing") return <CalendarBlank className={className} />;
  if (id === "funding") return <Wallet className={className} />;
  if (id === "anchor") return <Briefcase className={className} />;
  return <Target className={className} />;
}

function relevantFactFields(questionId: string): InterviewProfileField[] {
  const root = questionId.split(":")[0];
  if (root.includes("purpose")) return ["purposeDetails", "destinations"];
  if (root.includes("itinerary")) return ["destinations", "travelDates"];
  if (root.includes("duration")) return ["duration", "travelDates"];
  if (root.includes("funding")) return ["funding", "budget"];
  if (root.includes("employment") || root.includes("education")) return ["occupation", "employer"];
  if (root.includes("companions") || root.includes("contact")) return ["companions", "usContact"];
  if (root.includes("history") || root.includes("refusal")) return ["previousTravel", "refusalHistory"];
  if (root.includes("return") || root.includes("ties")) return ["homeTies", "occupation"];
  return ["purposeDetails", "destinations", "duration"];
}

function updateSession(session: InterviewSession, patch: Partial<InterviewSession>): InterviewSession {
  const next = { ...session, ...patch };
  return {
    ...next,
    stage: patch.stage ?? interviewStageForPhase(next.phase, next.reportStatus),
    updatedAt: new Date().toISOString(),
  };
}

const FIELD_LABELS: Record<InterviewProfileField, string> = {
    purpose: "访问目的",
    purposeDetails: "赴美目的",
    destinations: "目的地",
    travelDates: "出行时间",
    duration: "停留时长",
    funding: "资金来源",
    budget: "预计预算",
    occupation: "职业或身份",
    employer: "单位/学校",
    homeTies: "回国安排",
    previousTravel: "既往出境记录",
    companions: "同行人",
    usContact: "美国联系人",
    refusalHistory: "拒签或入境记录",
};

const FIELD_PLACEHOLDERS: Record<InterviewProfileField, string> = {
  purpose: "请选择真实访问目的",
  purposeDetails: "说明真实访问目的和一项具体活动",
  destinations: "计划前往的城市或地点",
  travelDates: "预计出发和返程时间",
  duration: "预计停留天数或时长",
  funding: "费用由谁承担、资金来自哪里",
  budget: "本次旅行的真实预算",
  occupation: "当前职业、学业或其他身份",
  employer: "公司、机构或学校名称",
  homeTies: "回国后继续履行的具体工作、学业或家庭安排",
  previousTravel: "如实说明既往出境或赴美记录",
  companions: "独自出行或同行人关系",
  usContact: "美国联系人或机构类型",
  refusalHistory: "如实说明拒签或被拒绝入境记录",
};

function fieldLabel(field: keyof ApplicantProfile) {
  return FIELD_LABELS[field];
}

function scoreTone(score: number) {
  return score >= 78
    ? "bg-emerald-50 text-emerald-700"
    : score < 60
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-700";
}

function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
      <div className="flex gap-2">
        <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    </div>
  );
}

function speechErrorMessage(error: ReturnType<typeof useBrowserSpeech>["error"]) {
  if (!error) return null;
  return ({
    unsupported: "当前浏览器不支持语音输入，可继续文字回答。",
    permission_denied: "浏览器拒绝了麦克风权限。你可以重新授权，或继续文字回答。",
    no_speech: "没有识别到语音。可以再试一次，或继续文字回答。",
    audio_capture: "没有可用麦克风或麦克风被占用。文字回答仍可使用。",
    network: "语音服务网络异常。请稍后重试，或继续文字回答。",
    aborted: "语音输入已停止。文字回答仍可使用。",
    unknown: "语音输入出现问题。请再试一次，或继续文字回答。",
  } satisfies Record<NonNullable<ReturnType<typeof useBrowserSpeech>["error"]>, string>)[error];
}

function SetupField({
  label,
  value,
  onChange,
  placeholder,
  status,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  status?: InterviewProfileFieldStatus;
}) {
  return (
    <label className="text-sm font-medium text-[#26364a]">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {status ? <FieldStatusBadge status={status} /> : null}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10"
      />
    </label>
  );
}

function FieldStatusBadge({ status }: { status: InterviewProfileFieldStatus }) {
  const label = status === "confirmed" ? "已确认" : status === "needs_confirmation" ? "待确认" : "缺失";
  const tone = status === "confirmed"
    ? "bg-emerald-50 text-emerald-700"
    : status === "needs_confirmation"
      ? "bg-amber-50 text-amber-800"
      : "bg-red-50 text-red-700";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
}

export default function InterviewPracticePage() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId")?.trim() || null;
  const visaType = searchParams.get("visaType")?.trim() || "US_B1_B2";
  const sessionIdentity = useMemo(() => ({ applicationId, visaType }), [applicationId, visaType]);
  const [session, setSession] = useState<InterviewSession>(() =>
    applyInterviewSessionIdentity(createInterviewSession(), sessionIdentity)
  );
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextLoadStatus, setContextLoadStatus] = useState<"idle" | "loading" | "ready" | "error">(
    applicationId ? "idle" : "ready",
  );
  const [contextLoadError, setContextLoadError] = useState<string | null>(null);
  const [contextRetryToken, setContextRetryToken] = useState(0);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [calibrationTranscript, setCalibrationTranscript] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const speechQuestionRef = useRef<string | null>(null);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    const saved = readInterviewSession(window.localStorage, sessionIdentity);
    if (saved) {
      setSession(saved);
      setDisclaimerAccepted(saved.disclaimerVersion === INTERVIEW_DISCLAIMER_VERSION);
    }
    setHydrated(true);
  }, [sessionIdentity]);

  useEffect(() => {
    if (!hydrated || !applicationId) return;
    const controller = new AbortController();
    setContextLoadStatus("loading");
    setContextLoadError(null);
    void fetch(`/api/interview/context?applicationId=${encodeURIComponent(applicationId)}`, {
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json() as {
        profile?: ApplicantProfile;
        context?: InterviewContextSummary;
        error?: string;
      };
      if (!response.ok || !data.profile || !data.context) {
        throw new Error(data.error || "暂时无法读取申请资料，请稍后重试。");
      }
      setSession((current) => updateSession(current, {
        profile: mergeLoadedProfile(current.profile, current.applicationContext, data.profile!),
        applicationContext: data.context!,
      }));
      setContextLoadStatus("ready");
    }).catch((loadError: unknown) => {
      if (controller.signal.aborted) return;
      setContextLoadError(loadError instanceof Error ? loadError.message : "暂时无法读取申请资料，请稍后重试。");
      setContextLoadStatus("error");
    });
    return () => controller.abort();
  }, [applicationId, contextRetryToken, hydrated]);

  useEffect(() => {
    if (hydrated) writeInterviewSession(window.localStorage, session, sessionIdentity);
  }, [hydrated, session, sessionIdentity]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [applicationId, hydrated, session.phase, visaType]);

  const setDraft = useCallback((draftAnswer: string) => {
    setSession((current) => updateSession(current, { draftAnswer }));
  }, []);
  const speech = useBrowserSpeech(setDraft, session.language);
  const calibrationSpeech = useBrowserSpeech(setCalibrationTranscript, session.language);
  const interviewerTts = useInterviewerTts(session.language);

  const missingFields = useMemo(
    () => REQUIRED_FIELDS.filter((field) => !(session.profile[field] ?? "").trim()),
    [session.profile],
  );
  const blockingMissingFields = applicationId ? [] : missingFields;
  const preparationCounts = profilePreparationCounts(session.applicationContext);
  const preparationTotal = session.applicationContext?.fieldStates?.length ?? REQUIRED_FIELDS.length;
  const preparationScore = preparationTotal
    ? Math.round(((preparationCounts.confirmed + preparationCounts.needsConfirmation * 0.5) / preparationTotal) * 100)
    : 0;
  const requestApplicationId = session.applicationId ?? applicationId ?? undefined;
  const dossierItems = preparationDossierItems(session.applicationContext, Boolean(applicationId));
  const actionFields = Array.from(new Set(dossierItems.flatMap((item) => item.fields))).filter((field) => (
    fieldState(session.applicationContext, field).status !== "confirmed"
  ));
  const hiddenActionCount = Math.max(
    0,
    (applicationId ? PREPARATION_PRIORITY_FIELDS : REQUIRED_FIELDS).filter((field) => (
      fieldState(session.applicationContext, field).status !== "confirmed"
    )).length - actionFields.length,
  );

  useEffect(() => {
    const prompt = session.currentQuestion?.prompt;
    const promptKey = `${session.language}:${prompt ?? ""}`;
    if (!prompt || speechQuestionRef.current === promptKey || session.phase !== "interview" || isPaused) return;
    speechQuestionRef.current = promptKey;
    interviewerTts.play(prompt);
  }, [interviewerTts.play, isPaused, session.currentQuestion?.prompt, session.language, session.phase]);

  const updateProfile = (field: InterviewProfileField, value: string) => {
    setSession((current) => {
      const updated = updatePracticeField(current.profile, current.applicationContext, field, value);
      return updateSession(current, {
        profile: updated.profile,
        applicationContext: updated.context,
      });
    });
  };

  const begin = async (mode: "confirm" | "existing" = "confirm") => {
    if (requestInFlightRef.current) return;
    if (!disclaimerAccepted) {
      setError("请先阅读并确认免责声明。");
      return;
    }
    if (blockingMissingFields.length) {
      setError(`请先补全：${blockingMissingFields.map(fieldLabel).join("、")}`);
      return;
    }
    requestInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    const effectiveContext = mode === "confirm" && session.applicationContext
      ? confirmExistingProfile(session.profile, session.applicationContext, actionFields)
      : session.applicationContext;
    const confirmedFields = effectiveContext?.verifiedFields ?? [];
    setSession((current) => updateSession(current, {
      applicationContext: effectiveContext,
      disclaimerVersion: INTERVIEW_DISCLAIMER_VERSION,
    }));
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          language: session.language,
          applicationId: requestApplicationId,
          profile: session.profile,
          confirmedFields,
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error || "暂时无法开始，请稍后重试。");
      }
      const data = await response.json() as {
        question: InterviewSession["currentQuestion"];
        questionIndex: number;
        context: InterviewContextSummary;
      };
      speechQuestionRef.current = null;
      setSession((current) => updateSession(current, {
        phase: "interview",
        stage: "question",
        applicationContext: data.context,
        currentQuestion: data.question,
        questionIndex: data.questionIndex,
        exchanges: [],
        draftAnswer: "",
        completedTopics: [],
        followUpQuestionIds: [],
        pendingRequestKey: null,
        lastAnswerIdempotencyKey: null,
        errorRecovery: {
          lastError: null,
          retryable: false,
          lastFailedAction: null,
          recoveredAt: null,
        },
        report: null,
        reportStatus: "idle",
      }));
      setIsPaused(false);
    } catch (startError) {
      setError(`${startError instanceof Error ? startError.message : "暂时无法开始，请稍后重试。"} 你的资料已保留。`);
      setSession((current) => updateSession(current, {
        errorRecovery: recoverableInterviewError("start", "start_failed"),
        pendingRequestKey: null,
      }));
    } finally {
      requestInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const submitAnswer = async () => {
    const question = session.currentQuestion;
    const answer = session.draftAnswer.trim();
    if (!question || !answer || submitting || requestInFlightRef.current) return;
    const idempotencyKey = answerIdempotencyKey(session);
    requestInFlightRef.current = true;
    speech.stop();
    interviewerTts.stop();
    setSubmitting(true);
    setError(null);
    setSession((current) => updateSession(current, {
      stage: "answering",
      pendingRequestKey: idempotencyKey,
    }));
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          language: session.language,
          applicationId: requestApplicationId,
          profile: session.profile,
          confirmedFields: session.applicationContext?.verifiedFields ?? [],
          question,
          answer,
          questionIndex: session.questionIndex,
          idempotencyKey,
          followUpUsed: session.followUpQuestionIds.includes(question.parentId ?? question.id),
        }),
      });
      if (!response.ok) throw new Error("answer_failed");
      const data = await response.json() as {
        assessment: InterviewSession["exchanges"][number]["assessment"];
        nextQuestion: InterviewSession["currentQuestion"];
        nextQuestionIndex: number;
        completed: boolean;
        context: InterviewContextSummary;
      };
      speechQuestionRef.current = null;
      setSession((current) => {
        const captured = captureMissingFactsFromAnswer(current.profile, data.context, question, answer);
        return updateSession(current, {
          profile: captured.profile,
          exchanges: [...current.exchanges, { question, answer, assessment: data.assessment, submittedAt: new Date().toISOString() }],
          applicationContext: captured.context,
          currentQuestion: data.nextQuestion,
          questionIndex: data.nextQuestionIndex,
          draftAnswer: "",
          completedTopics: Array.from(new Set([...current.completedTopics, question.parentId ?? question.id])),
          followUpQuestionIds: question.isFollowUp
            ? current.followUpQuestionIds
            : [...current.followUpQuestionIds, ...(data.nextQuestion?.isFollowUp ? [question.id] : [])],
          pendingRequestKey: null,
          lastAnswerIdempotencyKey: idempotencyKey,
          errorRecovery: {
            lastError: null,
            retryable: false,
            lastFailedAction: null,
            recoveredAt: null,
          },
          phase: data.completed ? "complete" : "interview",
        });
      });
    } catch {
      setError("回答没有保存。请检查网络后再次提交；当前文字回答不会丢失。");
      setSession((current) => updateSession(current, {
        stage: "question",
        errorRecovery: recoverableInterviewError("answer", "answer_failed"),
        pendingRequestKey: null,
      }));
    } finally {
      requestInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const endEarly = () => {
    speech.stop();
    interviewerTts.stop();
    setIsPaused(false);
    setSession((current) => updateSession(current, { phase: "complete", stage: "complete", currentQuestion: null, draftAnswer: "" }));
  };

  const togglePause = () => {
    if (!isPaused) {
      speech.stop();
      interviewerTts.stop();
      setIsPaused(true);
      return;
    }
    setIsPaused(false);
  };

  const generateReport = async () => {
    if (
      !session.exchanges.length ||
      submitting ||
      requestInFlightRef.current ||
      session.reportStatus === "generating" ||
      (session.reportStatus === "ready" && session.report)
    ) return;
    const key = reportIdempotencyKey(session);
    requestInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    setSession((current) => updateSession(current, {
      stage: "reporting",
      reportStatus: "generating",
      pendingRequestKey: key,
    }));
    try {
      const response = await fetch("/api/interview/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: key,
          applicationId: requestApplicationId,
          profile: session.profile,
          confirmedFields: session.applicationContext?.verifiedFields ?? [],
          exchanges: session.exchanges,
        }),
      });
      if (!response.ok) throw new Error("report_failed");
      const report = await response.json() as InterviewSession["report"] & { context?: InterviewContextSummary };
      setSession((current) => updateSession(current, {
        phase: "report",
        stage: "report_ready",
        applicationContext: report.context ?? current.applicationContext,
        report,
        reportStatus: "ready",
        pendingRequestKey: null,
        errorRecovery: {
          lastError: null,
          retryable: false,
          lastFailedAction: null,
          recoveredAt: null,
        },
      }));
    } catch {
      setError("报告暂时无法生成。本轮回答已保留，稍后可再次尝试。");
      setSession((current) => updateSession(current, {
        stage: "complete",
        reportStatus: "failed",
        pendingRequestKey: null,
        errorRecovery: recoverableInterviewError("report", "report_failed"),
      }));
    } finally {
      requestInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const restart = () => {
    speech.stop();
    calibrationSpeech.stop();
    interviewerTts.stop();
    clearInterviewSession(window.localStorage, sessionIdentity);
    speechQuestionRef.current = null;
    setError(null);
    setCalibrationTranscript("");
    setIsPaused(false);
    setSession((current) => resetInterviewSession(current));
  };

  const restartWeakTopics = () => {
    speech.stop();
    interviewerTts.stop();
    setIsPaused(false);
    speechQuestionRef.current = null;
    setError("已保留你的资料。下一轮请优先练习报告中分数较低的主题。");
    setSession((current) => updateSession(current, {
      phase: "setup",
      stage: "profile",
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
      reportStatus: "idle",
      report: null,
      officer: DEFAULT_OFFICER,
    }));
  };

  const restartFromTopic = async (questionIndex: number) => {
    if (submitting || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          language: session.language,
          applicationId: requestApplicationId,
          profile: session.profile,
          confirmedFields: session.applicationContext?.verifiedFields ?? [],
          questionIndex,
        }),
      });
      if (!response.ok) throw new Error("topic_restart_failed");
      const data = await response.json() as {
        question: InterviewSession["currentQuestion"];
        questionIndex: number;
        context: InterviewContextSummary;
      };
      setSession((current) => updateSession(current, {
        phase: "interview",
        stage: "question",
        applicationContext: data.context,
        currentQuestion: data.question,
        questionIndex: data.questionIndex,
        exchanges: [],
        draftAnswer: "",
        completedTopics: [],
        followUpQuestionIds: [],
        pendingRequestKey: null,
        lastAnswerIdempotencyKey: null,
        reportStatus: "idle",
        report: null,
      }));
      setIsPaused(false);
    } catch {
      setError("暂时无法重练该主题，本轮报告已保留。 ");
    } finally {
      requestInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-5xl py-10 text-center text-sm text-muted-foreground">
        正在恢复练习会话…
      </main>
    );
  }

  if (applicationId && session.phase === "setup" && contextLoadStatus !== "ready") {
    if (contextLoadStatus === "error") {
      return (
        <main className="mx-auto max-w-3xl pb-14 pt-8">
          <section className="border-y border-amber-200 bg-amber-50 px-5 py-8 text-center">
            <WarningCircle size={32} className="mx-auto text-amber-700" />
            <h1 className="mt-3 text-xl font-semibold text-[#26364a]">申请资料读取失败</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#66758a]">
              {contextLoadError ?? "暂时无法读取申请资料。"} 页面没有把读取失败伪装成空白资料。
            </p>
            <Button onClick={() => setContextRetryToken((value) => value + 1)} className="mt-5 h-10 rounded-full px-5">
              重新读取
            </Button>
          </section>
        </main>
      );
    }
    return (
      <main className="mx-auto max-w-3xl pb-14 pt-10 text-center">
        <CircleNotch size={28} className="mx-auto animate-spin text-brand-600" />
        <h1 className="mt-3 text-lg font-semibold text-[#26364a]">正在读取申请资料</h1>
        <p className="mt-2 text-sm text-[#66758a]">完成前不会先显示一份空白资料摘要。</p>
      </main>
    );
  }

  if (session.phase === "report" && session.report) {
    const report = session.report;
    const coveredTopics = new Set(session.exchanges.map((exchange) => exchange.question.parentId ?? exchange.question.id)).size;
    const completion = Math.round((coveredTopics / TOPICS.length) * 100);
    const needsPracticeTopics = Array.from(new Set(
      report.questionAnalysis.filter((item) => item.status !== "strong" || item.unclearPoints?.length).map((item) => item.topic),
    ));
    const stableTopics = report.questionAnalysis.filter((item) => item.status === "strong").length;
    const missingFactTopics = report.questionAnalysis.filter((item) => item.sourceGap === "application_missing").length;
    const vagueAnswerTopics = report.questionAnalysis.filter((item) => item.sourceGap === "answer_insufficient").length;
    const consistencyLabel = report.dimensions.consistency === null
      ? "未核验"
      : report.riskFlags.length
        ? "需要核对"
        : "资料一致";
    return (
      <div className="relative isolate -mx-4 min-h-[calc(100vh-8rem)] overflow-hidden px-4 pb-16 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 xl:-mx-20 xl:px-20">
        <InterviewBackdrop />
        <main className="mx-auto max-w-6xl space-y-6 pt-5">
          <header className="border-b border-[#dfe5ec] pb-5">
            <PhaseRail active={3} />
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-brand-600">美国 B1/B2 模拟面试</p>
                <h1 className="mt-1 text-3xl font-semibold text-[#172235]">练习报告</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66758a]">
                  复盘本轮覆盖、回答具体性和与已确认资料的一致性，不预测签证结果。
                </p>
              </div>
              {applicationId ? (
                <Link
                  href={`/client/application/long-form?country=united_states&visaType=${encodeURIComponent(visaType)}&applicationId=${encodeURIComponent(applicationId)}`}
                  className="text-sm font-medium text-brand-600 hover:underline"
                >
                  回到申请补资料
                </Link>
              ) : null}
            </div>
          </header>

          <section className="grid grid-cols-2 border border-[#dfe5ec] bg-white/90 sm:grid-cols-4">
            {[
              ["覆盖主题", `${coveredTopics}/${TOPICS.length}`],
              ["练习完成度", `${completion}%`],
              ["资料一致性", consistencyLabel],
              ["需要继续练习", `${needsPracticeTopics.length} 项`],
            ].map(([label, value], index) => (
              <div key={label} className={`min-w-0 p-4 ${index % 2 === 0 ? "border-r" : ""} ${index < 2 ? "border-b sm:border-b-0" : ""} border-[#e5eaf2] sm:border-r sm:last:border-r-0`}>
                <p className="text-xs text-[#7a8798]">{label}</p>
                <p className="mt-1 truncate text-xl font-semibold text-[#26364a] sm:text-2xl">{value}</p>
              </div>
            ))}
          </section>

          <section className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-5 lg:sticky lg:top-24">
              <section className="rounded-lg border border-[#dfe5ec] bg-white/95 p-5">
                <h2 className="text-lg font-semibold text-[#26364a]">总体洞察</h2>
                <p className="mt-3 text-sm leading-6 text-[#526173]">{report.summary}</p>
                <dl className="mt-5 divide-y divide-[#e9edf2] border-y border-[#e9edf2] text-sm">
                  {[
                    ["表现稳定", `${stableTopics} 个主题`],
                    ["申请资料待补", `${missingFactTopics} 个主题`],
                    ["回答需要具体", `${vagueAnswerTopics} 个主题`],
                    ["一致性核对", consistencyLabel],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-3">
                      <dt className="text-[#66758a]">{label}</dt>
                      <dd className="text-right font-medium text-[#26364a]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {report.strengths.length ? (
                <section className="border-l-2 border-emerald-500 bg-white/80 px-4 py-3">
                  <h2 className="font-semibold text-[#26364a]">本轮稳定表现</h2>
                  <div className="mt-3 space-y-3">
                    {report.strengths.map((item) => (
                      <div key={item.title}>
                        <p className="text-sm font-medium text-[#26364a]">{item.title}</p>
                        <p className="mt-1 text-sm leading-5 text-[#66758a]">{item.evidence}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {report.actions.length ? (
                <section className="border-l-2 border-amber-500 bg-white/80 px-4 py-3">
                  <h2 className="font-semibold text-[#26364a]">下一步练习</h2>
                  <ol className="mt-3 space-y-3">
                    {report.actions.map((item) => (
                      <li key={item.priority} className="text-sm leading-5 text-[#526173]">
                        <span className="font-medium text-[#26364a]">{item.priority}. {item.title}</span>
                        <span className="mt-1 block">{item.action}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {report.riskFlags.length ? (
                <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <h2 className="flex items-center gap-2 font-medium text-amber-900">
                    <WarningCircle size={20} />
                    需要核对
                  </h2>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900">
                    {report.riskFlags.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              ) : null}
            </aside>

            <section className="rounded-lg border border-[#dfe5ec] bg-white/95">
              <div className="border-b border-[#e5eaf2] px-5 py-4">
                <h2 className="text-xl font-semibold text-[#26364a]">逐题复盘</h2>
                <p className="mt-1 text-sm leading-6 text-[#66758a]">展开查看真实问题、原回答、追问与继续练习方向。</p>
              </div>
              <div className="divide-y divide-[#e5eaf2]">
                {report.questionAnalysis.map((item, index) => {
                  const exchange = session.exchanges.find((entry) => entry.question.prompt === item.question);
                  const rootQuestionId = exchange?.question.parentId ?? exchange?.question.id;
                  const followUps = rootQuestionId
                    ? session.exchanges.filter((entry) => entry.question.isFollowUp && entry.question.parentId === rootQuestionId)
                    : [];
                  return (
                    <details key={`${item.question}-${index}`} className="group px-5 py-4">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-brand-600">{item.topic}</p>
                          <p className="mt-1 font-medium leading-6 text-[#26364a]">{item.question}</p>
                        </div>
                        <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${scoreTone(item.score)}`}>
                          {item.status === "strong" ? "表现稳定" : item.status === "weak" ? "需补事实" : "可以更具体"}
                        </span>
                        <CaretDown className="mt-1 h-4 w-4 shrink-0 text-[#7a8798] transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-4 space-y-4 border-t border-[#eef2f6] pt-4 text-sm">
                        <div>
                          <p className="text-[#8a94a6]">你的原回答</p>
                          <p className="mt-1 leading-6 text-[#26364a]">{item.answer}</p>
                        </div>
                        {followUps.length ? (
                          <div>
                            <p className="text-[#8a94a6]">本主题追问</p>
                            <ul className="mt-1 space-y-2 leading-6 text-[#26364a]">
                              {followUps.map((entry) => <li key={entry.question.id}>{entry.question.prompt}</li>)}
                            </ul>
                          </div>
                        ) : null}
                        <dl className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <dt className="text-[#8a94a6]">已覆盖事实</dt>
                            <dd className="mt-1 leading-6 text-[#26364a]">{item.coveredFacts?.length ? item.coveredFacts.join("、") : "尚未覆盖关键事实"}</dd>
                          </div>
                          <div>
                            <dt className="text-[#8a94a6]">仍需澄清</dt>
                            <dd className="mt-1 leading-6 text-[#26364a]">{item.unclearPoints?.length ? item.unclearPoints.join("、") : "没有发现需要继续澄清的关键点"}</dd>
                          </div>
                          <div>
                            <dt className="text-[#8a94a6]">缺口来源</dt>
                            <dd className="mt-1 leading-6 text-[#26364a]">
                              {item.sourceGap === "application_missing"
                                ? "申请资料缺失"
                                : item.sourceGap === "answer_insufficient"
                                  ? "口头回答不够具体"
                                  : "未发现明显缺口"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[#8a94a6]">改进方向</dt>
                            <dd className="mt-1 leading-6 text-[#26364a]">{item.note}</dd>
                          </div>
                        </dl>
                        <div className="flex flex-col gap-3 border-l-2 border-brand-200 pl-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="leading-6 text-[#526173]">继续练习：{item.nextPracticeQuestion ?? item.responseFramework}</p>
                          <Button type="button" variant="outline" className="h-9 shrink-0 rounded-md" onClick={() => void restartFromTopic(Math.min(index, 7))}>
                            再练一次该主题
                          </Button>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          </section>

          <section className="border-l-4 border-[#cfd9e6] bg-white/80 px-4 py-3">
            <p className="text-sm leading-6 text-[#526173]">{report.disclaimer}</p>
            <p className="mt-1 text-xs leading-5 text-[#7a8798]">
              VIZA 不代表美国政府或领事馆。本练习不构成法律、移民或签证建议，也不预测任何签证结果。
            </p>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={restartWeakTopics} variant="outline" className="h-11 rounded-md px-6">
              <Target />
              回到资料准备
            </Button>
            <Button onClick={restart} className="h-11 rounded-md px-6">
              <ArrowCounterClockwise />
              完整重练
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (session.phase === "complete") {
    return (
      <main className="mx-auto max-w-3xl pb-14 pt-4">
        <section className="rounded-lg border border-[#e5eaf2] bg-white p-6 text-center">
          <CheckCircle size={40} className="mx-auto text-emerald-600" weight="fill" />
          <h1 className="mt-4 text-2xl font-semibold text-[#26364a]">本轮面试已结束</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#66758a]">
            已保存 {session.exchanges.length} 次回答。生成报告前，刷新页面也不会丢失进度。
          </p>
          <div className="mx-auto mt-5 max-w-xl">
            <ErrorNotice message={error} />
          </div>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button variant="outline" onClick={restart} className="h-11 rounded-full px-5">
              <ArrowCounterClockwise />
              重新开始
            </Button>
            <Button onClick={generateReport} disabled={submitting || !session.exchanges.length} className="h-11 rounded-full px-5">
              {submitting ? <CircleNotch className="animate-spin" /> : <Flag />}
              {session.reportStatus === "failed" ? "重试生成报告" : "生成个性化报告"}
            </Button>
          </div>
        </section>
      </main>
    );
  }

  if (session.phase === "interview" && session.currentQuestion) {
    const answeredMain = session.exchanges.filter((item) => !item.question.isFollowUp).length;
    const progress = Math.min((answeredMain / TOPICS.length) * 100, 100);
    const factFields = relevantFactFields(session.currentQuestion.parentId ?? session.currentQuestion.id);
    const availableFactFields = factFields.filter((field) => (
      fieldState(session.applicationContext, field).status !== "missing"
      && profileDisplayValue(session.profile, field)
    ));

    return (
      <div className="relative isolate -mx-4 min-h-[calc(100vh-5rem)] overflow-hidden bg-[#030914] px-4 pb-36 text-white sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 xl:-mx-20 xl:px-20">
        <InterviewBackdrop dark />
        <header className="relative z-10 mx-auto flex max-w-[1500px] items-center justify-between border-b border-white/10 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-xl font-semibold text-white">VIZA</span>
            <span className="hidden h-5 w-px bg-white/15 sm:block" />
            <span className="truncate text-xs text-white/55 sm:text-sm">数字领事窗口 · B1/B2 模拟面试</span>
          </div>
          <Button
            variant="outline"
            onClick={endEarly}
            disabled={submitting}
            className="h-9 shrink-0 rounded-md border-white/20 bg-white/[0.04] px-3 text-white hover:bg-white/10 hover:text-white"
          >
            <Stop />
            退出练习
          </Button>
        </header>

        <main className="relative z-10 mx-auto max-w-[1500px]">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 py-3 text-xs text-white/55">
            <p className="truncate">{session.officer.name} · {session.currentQuestion.topic}{session.currentQuestion.isFollowUp ? " · 自适应追问" : ""}</p>
            <p className="shrink-0">第 {Math.min(answeredMain + 1, TOPICS.length)} / {TOPICS.length} 个核心主题</p>
          </div>
          <div className="h-1 overflow-hidden bg-white/[0.06]">
            <div className="h-full bg-[#9fc5ef] transition-[width]" style={{ width: `${progress}%` }} />
          </div>

          <section className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 border-white/10 py-6 lg:border-r lg:pr-7">
              <section className="relative mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-lg border border-white/15 bg-[#071323] shadow-[0_28px_80px_rgba(0,0,0,0.48)]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-70"
                  style={{
                    backgroundImage: "linear-gradient(rgba(159,197,239,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(159,197,239,0.055) 1px,transparent 1px)",
                    backgroundSize: "34px 34px",
                  }}
                />
                <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,12,25,0.15),rgba(3,9,20,0.88))]" />
                <div aria-hidden="true" className="absolute inset-[8%] border border-[#9fc5ef]/10" />
                <div aria-hidden="true" className="absolute inset-[16%] border border-[#9fc5ef]/[0.07]" />
                <div aria-hidden="true" className="absolute left-1/2 top-[12%] h-[76%] w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[#9fc5ef]/15 to-transparent" />

                <div className="absolute left-4 top-4 flex items-center gap-2 rounded-md border border-white/10 bg-[#030914]/55 px-3 py-2 text-xs text-white/65 backdrop-blur-md">
                  <span className={`h-2 w-2 rounded-full ${isPaused ? "bg-amber-400" : speech.isListening ? "bg-emerald-400 motion-safe:animate-pulse" : "bg-[#9fc5ef]"}`} />
                  {isPaused ? "练习已暂停" : speech.isListening ? "正在聆听" : session.currentQuestion.isFollowUp ? "正在追问" : "面试官提问"}
                </div>

                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                  <div className="grid h-20 w-28 place-items-center rounded-md border border-[#9fc5ef]/20 bg-[#0a1a2d]/70 shadow-[0_0_36px_rgba(159,197,239,0.12)] backdrop-blur-md sm:h-24 sm:w-36">
                    <SpeakerHigh className="h-7 w-7 text-[#9fc5ef] sm:h-8 sm:w-8" />
                  </div>
                  <div className="mt-4 w-full max-w-sm">
                    <VoiceWaveform active={!isPaused} dark />
                  </div>
                  <p className="mt-1 text-xs font-medium text-[#9fc5ef]">数字面试官</p>
                </div>

                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#030914] to-transparent" />
              </section>

              <section className="mx-auto mt-7 max-w-4xl text-center">
                <p className="text-xs font-medium text-[#9fc5ef]">{session.currentQuestion.topic}{session.currentQuestion.isFollowUp ? " · 追问" : ""}</p>
                <h1 className="mx-auto mt-3 max-h-36 overflow-y-auto text-balance text-2xl font-medium leading-9 text-white sm:text-3xl sm:leading-[1.35]">
                  {session.currentQuestion.prompt}
                </h1>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/50">
                  请如实回答。只有事实缺失、回答含糊或与已确认资料不一致时，系统才会追问。
                </p>
              </section>

              <details className="mx-auto mt-5 max-w-4xl rounded-lg border border-white/15 bg-[#081425]/80 p-4 lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-white">
                  查看本题相关事实
                  <CaretDown className="h-4 w-4" />
                </summary>
                {availableFactFields.length ? (
                  <dl className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm">
                    {availableFactFields.map((field) => (
                      <div key={field}>
                        <dt className="text-white/45">{FIELD_LABELS[field]}</dt>
                        <dd className="mt-1 break-words leading-6 text-white/85">{profileDisplayValue(session.profile, field)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-white/50">本题没有可核对的已确认申请事实，请按真实情况回答。</p>
                )}
              </details>

              <section className="mx-auto mt-5 max-w-4xl rounded-lg border border-white/15 bg-[#071323]/[0.88] p-4 backdrop-blur-xl sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="interview-answer" className="font-medium text-white">实时回答</label>
                  <span className="text-xs text-white/45">文字输入始终可用</span>
                </div>
                <Textarea
                  id="interview-answer"
                  value={session.draftAnswer}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="输入真实回答，或使用底部麦克风进行语音输入。"
                  className="mt-3 h-28 min-h-28 max-h-44 resize-y overflow-y-auto border-white/15 bg-[#030914]/65 text-white placeholder:text-white/35 focus-visible:ring-[#9fc5ef]"
                  disabled={submitting || isPaused}
                />
                <div className="mt-3 min-h-6 text-left">
                  {speech.error === "unsupported" ? (
                    <span className="text-sm text-white/55">{speechErrorMessage(speech.error)}</span>
                  ) : speech.error ? (
                    <span className="text-sm text-red-300">{speechErrorMessage(speech.error)}</span>
                  ) : speech.isListening ? (
                    <span className="text-sm text-emerald-300">正在将语音转成文字，可随时停止并编辑。</span>
                  ) : isPaused ? (
                    <span className="text-sm text-amber-200">练习已暂停，继续后可回答。</span>
                  ) : null}
                </div>
                <ErrorNotice message={error} />
              </section>
            </div>

            <aside className="hidden min-h-full bg-[#0a1321]/[0.58] p-6 backdrop-blur-xl lg:block">
              <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                <CheckCircle size={20} className="text-[#9fc5ef]" />
                <div>
                  <p className="text-xs text-white/45">申请资料</p>
                  <h2 className="font-semibold text-white">本题相关事实</h2>
                </div>
              </div>
              {availableFactFields.length ? (
                <dl className="mt-2 divide-y divide-white/10 text-sm">
                  {availableFactFields.map((field) => (
                    <div key={field} className="py-5">
                      <dt className="text-xs text-[#9fc5ef]">{FIELD_LABELS[field]}</dt>
                      <dd className="mt-2 break-words leading-6 text-white/85">{profileDisplayValue(session.profile, field)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="py-8 text-sm leading-6 text-white/[0.48]">
                  本题没有可核对的已确认申请事实。请按真实情况回答，系统不会补造内容。
                </div>
              )}
              <p className="border-t border-white/10 pt-4 text-xs leading-5 text-white/[0.38]">这里只显示与当前问题真正相关的申请事实，不提供标准答案。</p>
            </aside>
          </section>
        </main>

        <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#060d18]/[0.92] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 text-white shadow-[0_-18px_55px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:px-6">
          <div className="mx-auto grid max-w-3xl grid-cols-5 items-center gap-1 sm:gap-4">
            <button
              type="button"
              onClick={togglePause}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-white/[0.72] transition-colors hover:bg-white/10 hover:text-white"
            >
              {isPaused ? <Play size={20} /> : <Pause size={20} />}
              <span className="text-[10px] sm:text-xs">{isPaused ? "继续" : "暂停"}</span>
            </button>
            <button
              type="button"
              onClick={() => interviewerTts.play(session.currentQuestion!.prompt)}
              disabled={!interviewerTts.supported || isPaused}
              title={interviewerTts.selectedVoiceName ? `当前语音：${interviewerTts.selectedVoiceName}` : "将使用与练习语言匹配的可用语音"}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-white/[0.72] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <SpeakerHigh size={20} />
              <span className="text-[10px] sm:text-xs">重听</span>
            </button>
            <button
              type="button"
              aria-label={speech.isListening ? "停止语音输入" : "开始语音输入"}
              title={speech.isListening ? "停止语音输入" : "开始语音输入"}
              onClick={() => speech.isListening ? speech.stop() : speech.start(session.draftAnswer)}
              disabled={!speech.supported || submitting || isPaused}
              className={`mx-auto grid h-14 w-14 place-items-center rounded-full border shadow-[0_0_22px_rgba(159,197,239,0.22)] transition-colors disabled:opacity-40 sm:h-16 sm:w-16 ${speech.isListening ? "border-emerald-300/70 bg-emerald-400/15 text-emerald-200" : "border-[#9fc5ef]/50 bg-[#0d2340] text-[#d6e8fb] hover:bg-[#153257]"}`}
            >
              {speech.isListening ? <Stop size={25} weight="fill" /> : <Microphone size={27} weight="fill" />}
            </button>
            <button
              type="button"
              onClick={submitAnswer}
              disabled={!session.draftAnswer.trim() || submitting || isPaused}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[#d6e8fb] transition-colors hover:bg-white/10 disabled:text-white/28"
            >
              {submitting ? <CircleNotch size={20} className="animate-spin" /> : <PaperPlaneTilt size={20} />}
              <span className="text-[10px] sm:text-xs">回答完成</span>
            </button>
            <button
              type="button"
              onClick={endEarly}
              disabled={submitting}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-40"
            >
              <Stop size={20} />
              <span className="text-[10px] sm:text-xs">结束练习</span>
            </button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="relative isolate -mx-4 min-h-[calc(100vh-8rem)] overflow-hidden px-4 pb-20 sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 xl:-mx-20 xl:px-20">
      <style>{`
        @keyframes viza-interview-scan {
          0% { transform: translateY(-12px); opacity: 0; }
          12% { opacity: 0.65; }
          88% { opacity: 0.65; }
          100% { transform: translateY(620px); opacity: 0; }
        }
        @keyframes viza-interview-glow {
          0%, 100% { box-shadow: 0 12px 28px rgba(0, 32, 96, 0.24); }
          50% { box-shadow: 0 16px 38px rgba(0, 32, 96, 0.38); }
        }
        @media (prefers-reduced-motion: reduce) {
          .viza-interview-scan, .viza-interview-glow { animation: none !important; }
        }
      `}</style>
      <InterviewBackdrop />
      <main className="mx-auto max-w-6xl space-y-7 pt-5 sm:pt-7">
        <header className="border-b border-[#dbe3ed] pb-5">
          <PhaseRail active={1} />
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-brand-600">美国 B1/B2 模拟面试</p>
              <h1 className="mt-1 text-3xl font-semibold text-[#172235]">面试准备就绪检查</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66758a]">
                核对少量关键事实并校准音频环境。申请资料不完整时，仍可使用现有资料开始基础练习。
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-md border border-[#cbd8e7] bg-white/75 px-4 py-3 shadow-sm backdrop-blur-xl">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-700">
                {preparationCounts.criticalMissing ? <WarningCircle size={20} /> : <CheckCircle size={20} weight="fill" />}
              </span>
              <div>
                <p className="text-xs text-[#718096]">资料准备度</p>
                <p className="text-lg font-semibold text-[#172235]">{preparationScore}%</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid items-start gap-6 lg:grid-cols-12">
          <aside
            id="critical-profile-fields"
            data-testid="applicant-dossier"
            className="relative overflow-hidden rounded-lg border border-white/80 bg-white/80 shadow-[0_18px_60px_rgba(15,35,64,0.13)] backdrop-blur-xl lg:col-span-4"
          >
            <div className="viza-interview-scan pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-brand-500/55 to-transparent shadow-[0_0_12px_rgba(0,32,96,0.3)] motion-safe:animate-[viza-interview-scan_4s_linear_infinite]" />
            <div className="border-b border-[#dfe6ee] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-brand-600">申请资料</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#172235]">申请档案</h2>
                </div>
                <span className="rounded border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">B1/B2</span>
              </div>
              {applicationId ? (
                <div className="mt-4 border-l-2 border-brand-300 pl-3 text-xs leading-5 text-[#66758a]">
                  <p className="font-medium text-[#26364a]">已关联申请</p>
                  <p className="truncate" title={applicationId}>申请编号：{applicationId}</p>
                  <Link
                    href={`/client/application/long-form?country=united_states&visaType=${encodeURIComponent(visaType)}&applicationId=${encodeURIComponent(applicationId)}`}
                    className="mt-1 inline-block font-medium text-brand-600 hover:underline"
                  >
                    回到申请补资料
                  </Link>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-5 text-[#66758a]">独立练习资料仅保存在当前浏览器会话。</p>
              )}
            </div>

            <div className="divide-y divide-[#e4e9ef]">
              {dossierItems.map((item) => {
                const status = dossierStatus(session.applicationContext, item.fields);
                const confirmedFields = item.fields.filter((field) => (
                  fieldState(session.applicationContext, field).status === "confirmed"
                  && profileDisplayValue(session.profile, field)
                ));
                const itemActionFields = item.fields.filter((field) => (
                  fieldState(session.applicationContext, field).status !== "confirmed"
                ));
                return (
                  <section key={item.id} data-testid="dossier-item" className="relative px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md ${status === "confirmed" ? "bg-emerald-50 text-emerald-700" : status === "needs_confirmation" ? "bg-amber-50 text-amber-700" : "bg-[#eef3f8] text-brand-700"}`}>
                        <DossierIcon id={item.id} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-[#26364a]">{item.label}</h3>
                          <FieldStatusBadge status={status} />
                        </div>

                        {confirmedFields.length ? (
                          <dl className="mt-2 space-y-1.5">
                            {confirmedFields.map((field) => (
                              <div key={field} className="min-w-0">
                                {confirmedFields.length > 1 ? <dt className="text-[11px] text-[#8a94a6]">{FIELD_LABELS[field]}</dt> : null}
                                <dd className="break-words text-sm leading-5 text-[#526173]">{profileDisplayValue(session.profile, field)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}

                        {itemActionFields.length ? (
                          <div className="mt-3 space-y-3">
                            {itemActionFields.map((field) => {
                              const fieldStatus = fieldState(session.applicationContext, field).status;
                              if (field === "purpose") {
                                return (
                                  <label key={field} className="block text-xs font-medium text-[#526173]">
                                    {FIELD_LABELS[field]}
                                    <select
                                      aria-label={FIELD_LABELS[field]}
                                      value={fieldStatus === "missing" ? "" : session.profile.purpose}
                                      onChange={(event) => updateProfile("purpose", event.target.value as ApplicantProfile["purpose"])}
                                      className="mt-1 h-9 w-full rounded-md border border-[#cfd8e3] bg-white/90 px-3 text-sm text-[#26364a]"
                                    >
                                      <option value="">请选择</option>
                                      <option value="tourism">旅游</option>
                                      <option value="business">商务</option>
                                      <option value="family_visit">探亲访友</option>
                                      <option value="medical">就医</option>
                                      <option value="other">其他短期访问</option>
                                    </select>
                                  </label>
                                );
                              }
                              return (
                                <SetupField
                                  key={field}
                                  label={FIELD_LABELS[field]}
                                  value={String(session.profile[field] ?? "")}
                                  onChange={(value) => updateProfile(field, value)}
                                  placeholder={FIELD_PLACEHOLDERS[field]}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle size={14} weight="fill" />
                            已从申请资料读取并确认
                          </p>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="border-t border-[#dfe6ee] bg-[#f7f9fb]/90 px-5 py-4 text-xs leading-5 text-[#66758a]">
              <p>已读取 {preparationCounts.confirmed + preparationCounts.needsConfirmation} 项 · 待确认 {preparationCounts.needsConfirmation} 项 · 关键缺失 {applicationId ? preparationCounts.criticalMissing : missingFields.length} 项</p>
              {hiddenActionCount ? <p className="mt-1">其余 {hiddenActionCount} 项保留在申请上下文中，不在本页重复追问。</p> : null}
            </div>
          </aside>

          <div className="space-y-6 lg:col-span-8">
            <section className="rounded-lg border border-white/80 bg-white/80 shadow-[0_18px_60px_rgba(15,35,64,0.11)] backdrop-blur-xl">
              <div className="flex items-start gap-3 border-b border-[#dfe6ee] px-5 py-5 sm:px-6">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700">
                  <Headphones size={21} />
                </span>
                <div>
                  <h2 className="text-xl font-semibold text-[#172235]">环境校准</h2>
                  <p className="mt-1 text-sm leading-6 text-[#66758a]">检查麦克风与面试官声音。语音不可用时，文字回答始终可用。</p>
                </div>
              </div>
              <div className="grid md:grid-cols-2">
                <div className="border-b border-[#e4e9ef] p-5 md:border-b-0 md:border-r sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-brand-600">麦克风输入</p>
                      <p className="mt-1 text-sm font-medium text-[#26364a]">
                        {calibrationSpeech.isListening ? "正在检测" : calibrationTranscript.trim() ? "已检测到语音" : calibrationSpeech.supported ? "等待测试" : "当前不可用"}
                      </p>
                    </div>
                    <span className={`h-2.5 w-2.5 rounded-full ${calibrationSpeech.isListening ? "bg-emerald-500 motion-safe:animate-pulse" : calibrationTranscript.trim() ? "bg-emerald-500" : "bg-[#a8b3c2]"}`} />
                  </div>
                  <div className="mt-4 rounded-md border border-brand-100 bg-brand-50/55 px-3 py-2">
                    <VoiceWaveform active={calibrationSpeech.isListening} />
                  </div>
                  <p className="mt-3 min-h-10 text-xs leading-5 text-[#66758a]">
                    {calibrationSpeech.isListening
                      ? "请说一句测试内容。检测结束后仍可编辑文字。"
                      : calibrationSpeech.error
                        ? speechErrorMessage(calibrationSpeech.error)
                        : calibrationTranscript.trim()
                          ? "语音输入已就绪。"
                          : "测试仅用于确认浏览器能接收声音，不会保存原始音频。"}
                  </p>
                  {calibrationSpeech.isListening ? (
                    <Button type="button" variant="outline" onClick={calibrationSpeech.stop} className="mt-3 h-10 w-full rounded-md">
                      <Stop />
                      停止测试
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => calibrationSpeech.start("")} disabled={!calibrationSpeech.supported} className="mt-3 h-10 w-full rounded-md">
                      <Microphone />
                      测试麦克风
                    </Button>
                  )}
                </div>

                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-brand-600">面试官声音</p>
                      <p className="mt-1 text-sm font-medium text-[#26364a]">{interviewerTts.supported ? "可试听" : "浏览器不支持"}</p>
                    </div>
                    <SpeakerHigh size={24} className="text-brand-600" />
                  </div>
                  <div className="mt-4 flex h-[84px] items-center justify-center rounded-md border border-[#dfe6ee] bg-[#f7f9fb] px-5 text-center">
                    <p className="text-sm leading-6 text-[#526173]">
                      {session.language === "zh-CN" ? "将使用与中文匹配的自然语音朗读问题。" : "将使用与英文匹配的自然语音朗读问题。"}
                    </p>
                  </div>
                  <p className="mt-3 min-h-10 text-xs leading-5 text-[#66758a]">
                    {interviewerTts.selectedVoiceName ? `当前可用语音：${interviewerTts.selectedVoiceName}` : "浏览器会自动选择与练习语言最匹配的可用语音。"}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => interviewerTts.play(session.language === "zh-CN" ? "您好，面试练习即将开始。" : "Hello. Your interview practice is ready to begin.")}
                    disabled={!interviewerTts.supported}
                    className="mt-3 h-10 w-full rounded-md"
                  >
                    <SpeakerHigh />
                    试听声音
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-white/80 bg-white/80 p-5 shadow-[0_16px_48px_rgba(15,35,64,0.09)] backdrop-blur-xl sm:p-6">
              <div>
                <p className="text-xs font-semibold text-brand-600">模拟参数</p>
                <h2 className="mt-1 text-xl font-semibold text-[#172235]">练习设置</h2>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-[#26364a]">练习语言</p>
                  <div className="mt-2 grid grid-cols-2 gap-1 rounded-md bg-[#edf1f5] p-1" role="group" aria-label="练习语言">
                    {([['zh-CN', '中文'], ['en-US', '英文']] as const).map(([language, label]) => (
                      <button
                        key={language}
                        type="button"
                        aria-pressed={session.language === language}
                        onClick={() => {
                          calibrationSpeech.stop();
                          interviewerTts.stop();
                          setCalibrationTranscript("");
                          setSession((current) => updateSession(current, { language }));
                        }}
                        className={`min-h-10 rounded px-3 text-sm font-medium transition-colors ${session.language === language ? "bg-white text-brand-700 shadow-sm" : "text-[#66758a] hover:text-[#26364a]"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-sm font-medium text-[#26364a]">
                  面试节奏
                  <select
                    value={session.officer.id}
                    onChange={(event) => {
                      const officer = INTERVIEW_OFFICERS.find((item) => item.id === event.target.value);
                      if (officer) setSession((current) => updateSession(current, { officer }));
                    }}
                    className="mt-2 h-12 w-full rounded-md border border-[#cfd8e3] bg-white/90 px-3 text-sm"
                  >
                    {INTERVIEW_OFFICERS.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}
                  </select>
                </label>
              </div>
            </section>

            {applicationId && preparationCounts.criticalMissing > 0 ? (
              <p className="border-l-2 border-amber-500 bg-amber-50/85 px-4 py-3 text-sm leading-6 text-amber-900 backdrop-blur-sm">
                当前仍有 {preparationCounts.criticalMissing} 项关键资料缺失。可以使用现有资料开始基础练习，但个性化程度会降低。
              </p>
            ) : null}

            <section className="border border-[#cfd9e6] bg-white/[0.72] p-4 backdrop-blur-xl">
              <p className="text-sm font-semibold text-[#26364a]">使用说明与免责声明</p>
              <p className="mt-2 text-[13px] leading-5 text-[#526173]">
                模拟面试仅用于帮助你熟悉常见问题并检查回答与申请资料的一致性。VIZA 不代表美国政府或领事馆，本练习不构成法律、移民或签证建议，也不预测或保证签证结果。请始终如实回答并以官方要求为准。
              </p>
              <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-[#26364a]">
                <input
                  type="checkbox"
                  checked={disclaimerAccepted}
                  onChange={(event) => setDisclaimerAccepted(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>我已阅读，并会始终如实回答，不背诵或编造所谓标准答案。</span>
              </label>
            </section>

            <ErrorNotice message={error} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                onClick={() => void begin("confirm")}
                disabled={submitting}
                className="viza-interview-glow h-12 w-full rounded-md bg-brand-700 px-6 shadow-[0_12px_28px_rgba(0,32,96,0.28)] motion-safe:animate-[viza-interview-glow_3.5s_ease-in-out_infinite] hover:bg-brand-800 sm:col-span-2"
              >
                {submitting ? <CircleNotch className="animate-spin" /> : <Play />}
                确认并开始
              </Button>
              {applicationId ? (
                <Button onClick={() => void begin("existing")} disabled={submitting} variant="outline" className="h-11 w-full rounded-md bg-white/70 px-6">
                  使用现有资料练习
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full rounded-md"
                onClick={() => {
                  document.getElementById("critical-profile-fields")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setError("只需补充档案中显示的关键事实，不需要填完整份 DS-160。");
                }}
              >
                先补关键资料
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
