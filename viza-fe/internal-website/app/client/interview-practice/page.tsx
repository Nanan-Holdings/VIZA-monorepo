"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import type { ApplicantProfile, InterviewOfficer } from "@/app/api/interview/types";
import {
  DEFAULT_OFFICER,
  applyInterviewSessionIdentity,
  clearInterviewSession,
  createInterviewSession,
  readInterviewSession,
  reportIdempotencyKey,
  writeInterviewSession,
  type InterviewSession,
} from "./session";
import { useBrowserSpeech } from "./_hooks/use-browser-speech";

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

const TOPICS = ["目的", "行程", "资金", "工作/学习", "回国约束", "过往记录", "一致性"];

function updateSession(session: InterviewSession, patch: Partial<InterviewSession>): InterviewSession {
  return { ...session, ...patch, updatedAt: new Date().toISOString() };
}

function fieldLabel(field: keyof ApplicantProfile) {
  return ({
    purposeDetails: "赴美目的",
    destinations: "目的地",
    travelDates: "出行时间",
    duration: "停留时长",
    funding: "资金来源",
    occupation: "职业或身份",
    homeTies: "回国安排",
  } as Partial<Record<keyof ApplicantProfile, string>>)[field] ?? field;
}

function profileValue(profile: ApplicantProfile, field: keyof ApplicantProfile) {
  return profile[field].trim() || "待补充";
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

function LinkedApplicationSummary({
  applicationId,
  missingFields,
}: {
  applicationId: string | null;
  missingFields: Array<keyof ApplicantProfile>;
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
      <p className="mt-2 text-[13px] leading-5 text-[#526173]">
        {missingFields.length
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="text-sm font-medium text-[#26364a]">
      {label}
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10"
      />
    </label>
  );
}

export default function InterviewPracticePage() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId")?.trim() || null;
  const sessionIdentity = useMemo(() => ({ applicationId, visaType: "US_B1_B2" }), [applicationId]);
  const [session, setSession] = useState<InterviewSession>(() =>
    applyInterviewSessionIdentity(createInterviewSession(), sessionIdentity)
  );
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speechQuestionRef = useRef<string | null>(null);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    const saved = readInterviewSession(window.localStorage, sessionIdentity);
    if (saved) setSession(saved);
    setHydrated(true);
  }, [sessionIdentity]);

  useEffect(() => {
    if (hydrated) writeInterviewSession(window.localStorage, session, sessionIdentity);
  }, [hydrated, session, sessionIdentity]);

  const setDraft = useCallback((draftAnswer: string) => {
    setSession((current) => updateSession(current, { draftAnswer }));
  }, []);
  const speech = useBrowserSpeech(setDraft, "zh-CN");

  const missingFields = useMemo(
    () => REQUIRED_FIELDS.filter((field) => !session.profile[field].trim()),
    [session.profile],
  );

  useEffect(() => {
    const prompt = session.currentQuestion?.prompt;
    if (!prompt || speechQuestionRef.current === prompt || session.phase !== "interview") return;
    speechQuestionRef.current = prompt;
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(prompt);
    utterance.lang = "zh-CN";
    window.speechSynthesis?.speak(utterance);
  }, [session.currentQuestion?.prompt, session.phase]);

  const updateProfile = (field: keyof ApplicantProfile, value: string) => {
    setSession((current) => updateSession(current, { profile: { ...current.profile, [field]: value } }));
  };

  const begin = async () => {
    if (requestInFlightRef.current) return;
    if (missingFields.length) {
      setError(`请先补全：${missingFields.map(fieldLabel).join("、")}`);
      return;
    }
    requestInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", profile: session.profile }),
      });
      if (!response.ok) throw new Error("start_failed");
      const data = await response.json() as { question: InterviewSession["currentQuestion"]; questionIndex: number };
      speechQuestionRef.current = null;
      setSession((current) => updateSession(current, {
        phase: "interview",
        currentQuestion: data.question,
        questionIndex: data.questionIndex,
        exchanges: [],
        draftAnswer: "",
        followUpQuestionIds: [],
        report: null,
        reportStatus: "idle",
      }));
    } catch {
      setError("暂时无法开始，请稍后重试。你的资料已保留。");
    } finally {
      requestInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const submitAnswer = async () => {
    const question = session.currentQuestion;
    const answer = session.draftAnswer.trim();
    if (!question || !answer || submitting || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    speech.stop();
    window.speechSynthesis?.cancel();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer",
          profile: session.profile,
          question,
          answer,
          questionIndex: session.questionIndex,
          idempotencyKey: `${session.id}:${question.id}:${session.exchanges.length}`,
          followUpUsed: session.followUpQuestionIds.includes(question.parentId ?? question.id),
        }),
      });
      if (!response.ok) throw new Error("answer_failed");
      const data = await response.json() as {
        assessment: InterviewSession["exchanges"][number]["assessment"];
        nextQuestion: InterviewSession["currentQuestion"];
        nextQuestionIndex: number;
        completed: boolean;
      };
      speechQuestionRef.current = null;
      setSession((current) => updateSession(current, {
        exchanges: [...current.exchanges, { question, answer, assessment: data.assessment, submittedAt: new Date().toISOString() }],
        currentQuestion: data.nextQuestion,
        questionIndex: data.nextQuestionIndex,
        draftAnswer: "",
        followUpQuestionIds: question.isFollowUp
          ? current.followUpQuestionIds
          : [...current.followUpQuestionIds, ...(data.nextQuestion?.isFollowUp ? [question.id] : [])],
        phase: data.completed ? "complete" : "interview",
      }));
    } catch {
      setError("回答没有保存。请检查网络后再次提交；当前文字回答不会丢失。");
    } finally {
      requestInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const endEarly = () => {
    speech.stop();
    window.speechSynthesis?.cancel();
    setSession((current) => updateSession(current, { phase: "complete", currentQuestion: null, draftAnswer: "" }));
  };

  const generateReport = async () => {
    if (!session.exchanges.length || submitting || requestInFlightRef.current) return;
    const key = reportIdempotencyKey(session);
    requestInFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    setSession((current) => updateSession(current, { reportStatus: "generating" }));
    try {
      const response = await fetch("/api/interview/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: key, profile: session.profile, exchanges: session.exchanges }),
      });
      if (!response.ok) throw new Error("report_failed");
      const report = await response.json();
      setSession((current) => updateSession(current, { phase: "report", report, reportStatus: "ready" }));
    } catch {
      setError("报告暂时无法生成。本轮回答已保留，稍后可再次尝试。");
      setSession((current) => updateSession(current, { reportStatus: "failed" }));
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
    setSession(applyInterviewSessionIdentity(createInterviewSession(), sessionIdentity));
  };

  const restartWeakTopics = () => {
    speech.stop();
    window.speechSynthesis?.cancel();
    speechQuestionRef.current = null;
    setError("已保留你的资料。下一轮请优先练习报告中分数较低的主题。");
    setSession((current) => updateSession(current, {
      phase: "setup",
      exchanges: [],
      currentQuestion: null,
      draftAnswer: "",
      questionIndex: 0,
      followUpQuestionIds: [],
      reportStatus: "idle",
      report: null,
      officer: OFFICERS.find((officer) => officer.id === "verification") ?? current.officer,
    }));
  };

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-5xl py-10 text-center text-sm text-muted-foreground">
        正在恢复练习会话…
      </main>
    );
  }

  if (session.phase === "report" && session.report) {
    const report = session.report;
    return (
      <main className="mx-auto max-w-5xl space-y-6 pb-14 pt-4">
        <section className="border-b border-[#e5eaf2] pb-6">
          <p className="text-sm text-[#66758a]">美国 B1/B2 模拟面试</p>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-[#172235]">练习报告</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66758a]">
                这是练习准备度评估，不代表签证结果，也不能替代真实材料和面签判断。
              </p>
            </div>
            <div className="w-fit rounded-lg border border-brand-100 bg-brand-50 px-5 py-3">
              <div className="text-3xl font-semibold text-brand-600">{report.overallScore}</div>
              <div className="text-xs text-[#66758a]">练习准备度 · {report.readiness}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          {Object.entries(report.dimensions).map(([key, score]) => (
            <div key={key} className="rounded-lg border border-[#e5eaf2] bg-white p-4">
              <p className="text-sm text-[#66758a]">
                {({ clarity: "清晰度", specificity: "具体性", consistency: "一致性", returnIntent: "回国意图" } as Record<string, string>)[key]}
              </p>
              <p className="mt-1 text-2xl font-semibold text-[#26364a]">{score}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
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

        <section className="rounded-lg border border-[#e5eaf2] bg-white p-5">
          <h2 className="text-xl font-semibold text-[#26364a]">逐题回答与建议</h2>
          <div className="mt-4 divide-y divide-[#eef2f6]">
            {report.questionAnalysis.map((item, index) => (
              <article key={`${item.question}-${index}`} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[#26364a]">{index + 1}. {item.question}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${scoreTone(item.score)}`}>{item.score} 分</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#26364a]">{item.answer}</p>
                <p className="mt-2 text-sm leading-6 text-[#66758a]">{item.note} · {item.responseFramework}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={restartWeakTopics} variant="outline" className="h-11 rounded-full px-6">
            <Target />
            只重练弱项
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
                    <span className="text-sm text-[#66758a]">当前浏览器不支持语音输入，可继续文字回答。</span>
                  ) : speech.error ? (
                    <span className="text-sm text-destructive">语音输入出现问题，请改用文字。</span>
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
    <main className="mx-auto max-w-5xl space-y-6 pb-14 pt-4">
      <header className="border-b border-[#e5eaf2] pb-5">
        <p className="text-sm font-medium text-brand-600">美国 B1/B2</p>
        <h1 className="mt-1 text-3xl font-semibold text-[#172235]">模拟面试练习</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66758a]">
          先确认资料，再选择练习语言和节奏。页面会复用已保存的练习会话；有申请编号时，会标出还缺哪些练习所需信息。
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-[#e5eaf2] bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#26364a]">资料摘要</h2>
                <p className="mt-1 text-sm leading-6 text-[#66758a]">
                  如果申请资料已同步到练习会话，这里不会重复要求填写；只需要补齐缺失项并确认。
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#f2f5f8] px-3 py-1 text-xs font-medium text-[#526173]">
                中文练习
              </span>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-[#26364a]">
                访问目的
                <select
                  value={session.profile.purpose}
                  onChange={(event) => updateProfile("purpose", event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="tourism">旅游</option>
                  <option value="business">商务</option>
                  <option value="family_visit">探亲访友</option>
                  <option value="medical">就医</option>
                  <option value="other">其他短期访问</option>
                </select>
              </label>
              <SetupField label="赴美目的与具体活动 *" value={session.profile.purposeDetails} onChange={(value) => updateProfile("purposeDetails", value)} placeholder="例如：参加某展会并拜访客户" />
              <SetupField label="目的城市 *" value={session.profile.destinations} onChange={(value) => updateProfile("destinations", value)} placeholder="例如：旧金山、洛杉矶" />
              <SetupField label="出行时间 *" value={session.profile.travelDates} onChange={(value) => updateProfile("travelDates", value)} placeholder="例如：2026 年 10 月" />
              <SetupField label="预计停留时长 *" value={session.profile.duration} onChange={(value) => updateProfile("duration", value)} placeholder="例如：12 天" />
              <SetupField label="谁承担费用 *" value={session.profile.funding} onChange={(value) => updateProfile("funding", value)} placeholder="例如：本人承担" />
              <SetupField label="预计预算（可选）" value={session.profile.budget} onChange={(value) => updateProfile("budget", value)} placeholder="例如：3 万元人民币" />
              <SetupField label="职业或当前身份 *" value={session.profile.occupation} onChange={(value) => updateProfile("occupation", value)} placeholder="例如：产品经理" />
              <SetupField label="单位/学校（可选）" value={session.profile.employer} onChange={(value) => updateProfile("employer", value)} placeholder="例如：公司或学校全称" />
              <SetupField label="回国后的具体安排 *" value={session.profile.homeTies} onChange={(value) => updateProfile("homeTies", value)} placeholder="例如：项目交接后继续负责上线" />
              <SetupField label="既往出境记录（可选）" value={session.profile.previousTravel} onChange={(value) => updateProfile("previousTravel", value)} placeholder="例如：2024 年去过日本；或第一次出境" />
            </div>
          </section>

          <section className="rounded-lg border border-[#e5eaf2] bg-white p-5">
            <h2 className="text-xl font-semibold text-[#26364a]">面试节奏</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {OFFICERS.map((officer) => (
                <button
                  type="button"
                  key={officer.id}
                  onClick={() => setSession((current) => updateSession(current, { officer }))}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    session.officer.id === officer.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-[#e5eaf2] hover:bg-[#f7f9fc]"
                  }`}
                >
                  <p className="font-medium text-[#26364a]">{officer.name}</p>
                  <p className="mt-1 text-sm leading-5 text-[#66758a]">{officer.style}</p>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <LinkedApplicationSummary applicationId={applicationId} missingFields={missingFields} />
          <section className="rounded-lg border border-[#e5eaf2] bg-white p-4">
            <h2 className="text-sm font-semibold text-[#26364a]">开始前确认</h2>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-[#66758a]">
              <li>语言：中文练习，后续可切换英文练习。</li>
              <li>题目：围绕 7 个核心主题，必要时追问。</li>
              <li>报告：评估练习准备度，不预测签证结果。</li>
            </ul>
          </section>
          <ErrorNotice message={error} />
          <Button onClick={begin} disabled={submitting} className="h-11 w-full rounded-full px-6">
            {submitting ? <CircleNotch className="animate-spin" /> : <Play />}
            开始模拟面试
          </Button>
        </aside>
      </section>
    </main>
  );
}
