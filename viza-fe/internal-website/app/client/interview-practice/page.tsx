"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  CheckCircle,
  CircleNotch,
  Flag,
  Microphone,
  PaperPlaneTilt,
  Play,
  Stop,
  Target,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  ApplicantProfile,
  InterviewContextSummary,
  InterviewOfficer,
  InterviewProfileField,
  InterviewProfileFieldStatus,
} from "@/app/api/interview/types";
import {
  DEFAULT_OFFICER,
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
import {
  INTERVIEW_DISCLAIMER_VERSION,
  KEY_INTERVIEW_FIELDS,
  PROFILE_GROUPS,
  captureMissingFactsFromAnswer,
  confirmExistingProfile,
  fieldState,
  mergeLoadedProfile,
  profilePreparationCounts,
  updatePracticeField,
} from "./profile-state";

const OFFICERS: InterviewOfficer[] = [
  DEFAULT_OFFICER,
  { id: "rapid", name: "快速节奏", style: "回答含糊时直接追问，适合临近面签前查漏。" },
  { id: "verification", name: "核验节奏", style: "重点核对日期、预算、工作和回国安排。" },
  { id: "supportive", name: "稳定节奏", style: "自然、专业，适合建立回答结构。" },
];

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

function profileValue(profile: ApplicantProfile, field: keyof ApplicantProfile) {
  return (profile[field] ?? "").trim() || "待补充";
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

function contextStatusLabel(status: InterviewContextSummary["consistencyStatus"]) {
  return ({
    unverified: "未关联可核验资料",
    verifiable: "资料可核验",
    partially_verifiable: "部分资料待补充",
  } satisfies Record<InterviewContextSummary["consistencyStatus"], string>)[status];
}

function LinkedApplicationSummary({
  applicationId,
  missingFields,
  verifiedFields,
  consistencyStatus,
}: {
  applicationId: string | null;
  missingFields: Array<keyof ApplicantProfile>;
  verifiedFields: Array<keyof ApplicantProfile>;
  consistencyStatus?: InterviewContextSummary["consistencyStatus"] | null;
}) {
  if (!applicationId) {
    return (
      <div className="rounded-lg border border-[#dfe7f1] bg-white p-4">
        <p className="text-[13px] font-semibold text-[#26364a]">手工练习</p>
        <p className="mt-1 text-[13px] leading-5 text-[#66758a]">
          当前没有关联申请。请只填写真实、可核验的信息；本页会把资料保存在本浏览器练习会话中。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-brand-100 bg-brand-50 p-4">
      <p className="text-[13px] font-semibold text-brand-700">已关联申请资料</p>
      <p className="mt-1 break-all text-[13px] leading-5 text-[#526173]">
        已从链接读取申请编号：{applicationId}
      </p>
      {consistencyStatus ? (
        <p className="mt-2 text-[13px] leading-5 text-[#526173]">
          核验状态：{contextStatusLabel(consistencyStatus)}
        </p>
      ) : null}
      {verifiedFields.length ? (
        <p className="mt-2 text-[13px] leading-5 text-[#526173]">
          已核验：{verifiedFields.map(fieldLabel).join("、")}
        </p>
      ) : null}
      <p className="mt-2 text-[13px] leading-5 text-[#526173]">
        {!consistencyStatus
          ? "开始后会读取申请资料并标出缺失与已核验字段。"
          : missingFields.length
          ? `开始前仍需确认：${missingFields.map(fieldLabel).join("、")}`
          : "练习资料已完整，请确认后开始。"}
      </p>
    </div>
  );
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

  const setDraft = useCallback((draftAnswer: string) => {
    setSession((current) => updateSession(current, { draftAnswer }));
  }, []);
  const speech = useBrowserSpeech(setDraft, session.language);

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

  useEffect(() => {
    const prompt = session.currentQuestion?.prompt;
    if (!prompt || speechQuestionRef.current === prompt || session.phase !== "interview") return;
    speechQuestionRef.current = prompt;
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(prompt);
    utterance.lang = session.language;
    window.speechSynthesis?.speak(utterance);
  }, [session.currentQuestion?.prompt, session.language, session.phase]);

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
      ? confirmExistingProfile(session.profile, session.applicationContext)
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
    window.speechSynthesis?.cancel();
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
    window.speechSynthesis?.cancel();
    setSession((current) => updateSession(current, { phase: "complete", stage: "complete", currentQuestion: null, draftAnswer: "" }));
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
    window.speechSynthesis?.cancel();
    clearInterviewSession(window.localStorage, sessionIdentity);
    speechQuestionRef.current = null;
    setError(null);
    setSession((current) => resetInterviewSession(current));
  };

  const restartWeakTopics = () => {
    speech.stop();
    window.speechSynthesis?.cancel();
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
      officer: OFFICERS.find((officer) => officer.id === "verification") ?? current.officer,
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
    return (
      <main className="mx-auto max-w-5xl space-y-6 pb-14 pt-4">
        <section className="border-b border-[#e5eaf2] pb-6">
          <p className="text-sm text-[#66758a]">美国 B1/B2 · 第 3 阶段 / 3</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-[#172235]">练习报告</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66758a]">
                这里评估本轮回答的覆盖度、具体性和与已确认资料的一致性，不预测签证结果。
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
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["覆盖主题", `${coveredTopics}/${TOPICS.length}`],
            ["练习完成度", `${completion}%`],
            ["回答一致性", report.dimensions.consistency === null ? "未核验" : `${report.dimensions.consistency}`],
            ["继续练习", `${needsPracticeTopics.length} 项`],
          ].map(([label, value]) => (
            <div key={label} className="border-y border-[#e5eaf2] bg-white p-4">
              <p className="text-sm text-[#66758a]">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-[#26364a]">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 border-y border-[#e5eaf2] py-5 md:grid-cols-2">
          <div className="rounded-lg border border-[#e5eaf2] bg-white p-5">
            <h2 className="text-xl font-semibold text-[#26364a]">强项</h2>
            <div className="mt-4 space-y-4">
              {report.strengths.map((item) => (
                <div key={item.title}>
                  <p className="font-medium text-[#26364a]">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#66758a]">{item.evidence}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[#e5eaf2] bg-white p-5">
            <h2 className="text-xl font-semibold text-[#26364a]">需要改进</h2>
            <ol className="mt-4 space-y-4">
              {report.actions.map((item) => (
                <li key={item.priority}>
                  <p className="font-medium text-[#26364a]">{item.priority}. {item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[#66758a]">{item.action}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {report.riskFlags.length > 0 ? (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="flex items-center gap-2 font-medium text-amber-900">
              <WarningCircle size={20} />
              需要留意
            </h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900">
              {report.riskFlags.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ) : null}

        <section className="border-l-4 border-[#cfd9e6] bg-[#f7f9fc] px-4 py-3">
          <p className="text-sm leading-6 text-[#526173]">{report.disclaimer}</p>
          <p className="mt-1 text-xs leading-5 text-[#7a8798]">
            VIZA is not the U.S. Government or a U.S. consulate. This practice does not provide legal or visa advice and does not predict any visa outcome.
          </p>
        </section>

        <section className="border-y border-[#e5eaf2] bg-white py-5">
          <h2 className="text-xl font-semibold text-[#26364a]">逐主题练习反馈</h2>
          <p className="mt-1 text-sm leading-6 text-[#66758a]">只指出已覆盖事实和仍需澄清的地方，不生成标准答案。</p>
          <div className="mt-4 divide-y divide-[#eef2f6]">
            {report.questionAnalysis.map((item, index) => (
              <article key={`${item.question}-${index}`} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[#26364a]">{index + 1}. {item.question}</p>
                  <span className={`rounded px-2 py-1 text-xs font-medium ${scoreTone(item.score)}`}>
                    {item.status === "strong" ? "信息较完整" : item.status === "weak" ? "需要澄清" : "可以更具体"}
                  </span>
                </div>
                <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <dt className="text-[#8a94a6]">你的回答摘要</dt>
                    <dd className="mt-1 leading-6 text-[#26364a]">{item.answer}</dd>
                  </div>
                  <div>
                    <dt className="text-[#8a94a6]">已覆盖事实</dt>
                    <dd className="mt-1 leading-6 text-[#26364a]">{item.coveredFacts?.length ? item.coveredFacts.join("、") : "尚未覆盖关键事实"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#8a94a6]">仍不清楚</dt>
                    <dd className="mt-1 leading-6 text-[#26364a]">
                      {item.unclearPoints?.length ? item.unclearPoints.join("、") : "本轮未发现需要继续澄清的关键点"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#8a94a6]">问题来源</dt>
                    <dd className="mt-1 leading-6 text-[#26364a]">
                      {item.sourceGap === "application_missing"
                        ? "申请资料缺失"
                        : item.sourceGap === "answer_insufficient"
                          ? "口头回答不够具体"
                          : "未发现明显缺口"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-col gap-3 border-l-2 border-brand-200 pl-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-[#526173]">继续练习：{item.nextPracticeQuestion ?? item.responseFramework}</p>
                  <Button type="button" variant="outline" className="h-9 shrink-0 rounded-full" onClick={() => void restartFromTopic(Math.min(index, 7))}>
                    再练一次该主题
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={restartWeakTopics} variant="outline" className="h-11 rounded-full px-6">
            <Target />
            回到资料准备
          </Button>
          <Button onClick={restart} className="h-11 rounded-full px-6">
            <ArrowCounterClockwise />
            完整重练
          </Button>
        </div>
      </main>
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

    return (
      <main className="mx-auto max-w-5xl space-y-5 pb-14 pt-4">
        <header className="flex flex-col gap-3 border-b border-[#e5eaf2] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-[#66758a]">B1/B2 模拟窗口 · {session.officer.name}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#172235]">第 {Math.min(answeredMain + 1, TOPICS.length)} / {TOPICS.length} 个核心主题</h1>
          </div>
          <Button variant="outline" onClick={endEarly} disabled={submitting} className="h-10 rounded-full">
            结束本轮
          </Button>
        </header>

        <section className="rounded-lg border border-[#e5eaf2] bg-white p-4">
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic, index) => (
              <span
                key={topic}
                className={`rounded-full px-3 py-1 text-xs font-medium ${index < answeredMain ? "bg-brand-50 text-brand-600" : "bg-[#f2f5f8] text-[#66758a]"}`}
              >
                {topic}
              </span>
            ))}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf1f6]">
            <div className="h-full bg-brand-500 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <section className="min-h-[190px] rounded-lg border border-[#e5eaf2] bg-white p-5">
              <p className="text-sm font-semibold text-brand-600">
                {session.currentQuestion.topic}{session.currentQuestion.isFollowUp ? " · 追问" : ""}
              </p>
              <h2 className="mt-3 text-[24px] leading-9 text-[#172235]">
                {session.currentQuestion.prompt}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#66758a]">
                请如实回答。系统会根据具体性和已确认资料决定是否追问。
              </p>
            </section>

            <section className="rounded-lg border border-[#e5eaf2] bg-white p-5">
              <label htmlFor="interview-answer" className="font-medium text-[#26364a]">你的回答</label>
              <Textarea
                id="interview-answer"
                value={session.draftAnswer}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="可直接输入，或使用浏览器语音输入。"
                className="mt-3 min-h-40 resize-y"
                disabled={submitting}
              />
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {speech.error === "unsupported" ? (
                    <span className="text-sm text-[#66758a]">{speechErrorMessage(speech.error)}</span>
                  ) : speech.error ? (
                    <span className="text-sm text-destructive">{speechErrorMessage(speech.error)}</span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {speech.isListening ? (
                    <Button variant="outline" onClick={speech.stop} className="h-10 rounded-full">
                      <Stop />
                      停止语音
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => speech.start(session.draftAnswer)} disabled={!speech.supported || submitting} className="h-10 rounded-full">
                      <Microphone />
                      语音输入
                    </Button>
                  )}
                  <Button onClick={submitAnswer} disabled={!session.draftAnswer.trim() || submitting} className="h-10 rounded-full">
                    {submitting ? <CircleNotch className="animate-spin" /> : <PaperPlaneTilt />}
                    提交回答
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <ErrorNotice message={error} />
              </div>
            </section>
          </div>

          <aside className="rounded-lg border border-[#e5eaf2] bg-white p-5">
            <h2 className="font-semibold text-[#26364a]">本轮资料摘要</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[#8a94a6]">目的</dt>
                <dd className="mt-1 text-[#26364a]">{profileValue(session.profile, "purposeDetails")}</dd>
              </div>
              <div>
                <dt className="text-[#8a94a6]">行程</dt>
                <dd className="mt-1 text-[#26364a]">{profileValue(session.profile, "destinations")} · {profileValue(session.profile, "duration")}</dd>
              </div>
              <div>
                <dt className="text-[#8a94a6]">资金</dt>
                <dd className="mt-1 text-[#26364a]">{profileValue(session.profile, "funding")}</dd>
              </div>
              <div>
                <dt className="text-[#8a94a6]">回国约束</dt>
                <dd className="mt-1 text-[#26364a]">{profileValue(session.profile, "homeTies")}</dd>
              </div>
            </dl>
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-7 pb-14 pt-4">
      <header className="border-b border-[#dfe5ec] pb-5">
        <p className="text-sm font-medium text-brand-600">美国 B1/B2 · 第 1 阶段 / 3</p>
        <h1 className="mt-1 text-3xl font-semibold text-[#172235]">资料准备</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66758a]">
          只整理本次面试会用到的关键事实。申请未填完也可以开始基础练习，缺失越多，个性化程度越低。
        </p>
      </header>

      <section className="grid grid-cols-2 border-y border-[#dfe5ec] bg-white sm:grid-cols-4">
        {[
          ["面试资料准备度", `${preparationScore}%`],
          ["已读取字段", String(preparationCounts.confirmed + preparationCounts.needsConfirmation)],
          ["待确认", String(preparationCounts.needsConfirmation)],
          ["关键缺失", String(applicationId ? preparationCounts.criticalMissing : missingFields.length)],
        ].map(([label, value]) => (
          <div key={label} className="border-b border-r border-[#e9edf2] p-4 last:border-r-0 sm:border-b-0">
            <p className="text-xs text-[#7a8798]">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[#26364a]">{value}</p>
          </div>
        ))}
      </section>

      {applicationId ? (
        <section className="flex flex-col gap-3 border-b border-[#e5eaf2] pb-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-[#26364a]">已关联美国 B1/B2 申请</p>
            <p className="mt-1 text-[#66758a]">申请编号：{applicationId}</p>
          </div>
          <Link
            href={`/client/application/long-form?country=united_states&visaType=${encodeURIComponent(visaType)}&applicationId=${encodeURIComponent(applicationId)}`}
            className="font-medium text-brand-600 hover:underline"
          >
            回到申请补资料
          </Link>
        </section>
      ) : null}

      <section id="critical-profile-fields" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="divide-y divide-[#e5eaf2] border-y border-[#dfe5ec] bg-white">
          {PROFILE_GROUPS.map((group) => (
            <section key={group.title} className="px-5 py-6">
              <h2 className="text-lg font-semibold text-[#26364a]">{group.title}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {group.fields.map((field) => {
                  const status = fieldState(session.applicationContext, field).status;
                  const label = `${FIELD_LABELS[field]}${KEY_INTERVIEW_FIELDS.includes(field) ? " · 关键" : ""}`;
                  if (field === "purpose") {
                    return (
                      <label key={field} className="text-sm font-medium text-[#26364a]">
                        <span className="flex items-center justify-between gap-3">
                          <span>{label}</span>
                          <FieldStatusBadge status={status} />
                        </span>
                        <select
                          value={status === "missing" ? "" : session.profile.purpose}
                          onChange={(event) => updateProfile("purpose", event.target.value as ApplicantProfile["purpose"])}
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
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
                      label={label}
                      value={String(session.profile[field] ?? "")}
                      onChange={(value) => updateProfile(field, value)}
                      placeholder={FIELD_PLACEHOLDERS[field]}
                      status={status}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="border-y border-[#dfe5ec] bg-white py-5">
            <h2 className="font-semibold text-[#26364a]">练习设置</h2>
            <div className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-[#f2f5f8] p-1" role="group" aria-label="练习语言">
              {([['zh-CN', '中文'], ['en-US', 'English']] as const).map(([language, label]) => (
                <button
                  key={language}
                  type="button"
                  aria-pressed={session.language === language}
                  onClick={() => setSession((current) => updateSession(current, { language }))}
                  className={`min-h-10 rounded px-3 text-sm font-medium ${session.language === language ? "bg-white text-brand-700 shadow-sm" : "text-[#66758a]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm font-medium text-[#26364a]">
              面试节奏
              <select
                value={session.officer.id}
                onChange={(event) => {
                  const officer = OFFICERS.find((item) => item.id === event.target.value);
                  if (officer) setSession((current) => updateSession(current, { officer }));
                }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
              >
                {OFFICERS.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}
              </select>
            </label>
          </section>

          <section className="border border-[#cfd9e6] bg-[#f7f9fc] p-4">
            <p className="text-sm font-semibold text-[#26364a]">使用说明与免责声明</p>
            <p className="mt-2 text-[13px] leading-5 text-[#526173]">
              模拟面试仅用于帮助您熟悉常见问题并检查回答与申请资料的一致性，不是美国政府或领事馆提供的服务，也不构成法律、移民或签证建议，不预测或保证签证结果。请始终如实回答并以官方要求为准。
            </p>
            <p className="mt-2 text-xs leading-5 text-[#7a8798]">
              This practice tool is not provided by or affiliated with the U.S. Government or any U.S. consulate. It does not provide legal, immigration, or visa advice and does not predict or guarantee any visa outcome.
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

          {applicationId && preparationCounts.criticalMissing > 0 ? (
            <p className="text-sm leading-6 text-amber-800">
              当前有 {preparationCounts.criticalMissing} 项关键资料缺失。仍可开始基础练习，但问题与报告的个性化程度会降低。
            </p>
          ) : null}
          <ErrorNotice message={error} />
          <div className="space-y-2">
            <Button onClick={() => void begin("confirm")} disabled={submitting} className="h-11 w-full rounded-full px-6">
              {submitting ? <CircleNotch className="animate-spin" /> : <Play />}
              确认并开始
            </Button>
            {applicationId ? (
              <Button onClick={() => void begin("existing")} disabled={submitting} variant="outline" className="h-11 w-full rounded-full px-6">
                使用现有资料练习
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full"
              onClick={() => {
                document.getElementById("critical-profile-fields")?.scrollIntoView({ behavior: "smooth", block: "start" });
                setError("请优先补充标记为“关键”的缺失资料；不需要填完整份 DS-160。");
              }}
            >
              先补关键资料
            </Button>
          </div>
        </aside>
      </section>
    </main>
  );
}
