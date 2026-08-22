"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  CheckCircle,
  CircleNotch,
  Flag,
  Microphone,
  PaperPlaneTilt,
  Play,
  Stop,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApplicantProfile, InterviewOfficer } from "@/app/api/interview/types";
import {
  DEFAULT_OFFICER,
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
  { id: "rapid", name: "Chen", style: "快速节奏，回答含糊时直接追问" },
  { id: "verification", name: "Williams", style: "重点核对日期、预算、工作和回国安排" },
  { id: "supportive", name: "Garcia", style: "自然、专业，适合建立回答节奏" },
];

const REQUIRED_FIELDS: Array<keyof ApplicantProfile> = [
  "purposeDetails", "destinations", "travelDates", "duration", "funding", "occupation", "homeTies",
];

function updateSession(session: InterviewSession, patch: Partial<InterviewSession>): InterviewSession {
  return { ...session, ...patch, updatedAt: new Date().toISOString() };
}

function fieldLabel(field: keyof ApplicantProfile) {
  return ({
    purposeDetails: "赴美目的", destinations: "目的地", travelDates: "出行时间", duration: "停留时长",
    funding: "资金来源", occupation: "职业或身份", homeTies: "回国安排",
  } as Partial<Record<keyof ApplicantProfile, string>>)[field] ?? field;
}

function scoreTone(score: number) {
  return score >= 78 ? "text-emerald-700 bg-emerald-50" : score < 60 ? "text-red-700 bg-red-50" : "text-amber-700 bg-amber-50";
}

export default function InterviewPracticePage() {
  const [session, setSession] = useState<InterviewSession>(() => createInterviewSession());
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speechQuestionRef = useRef<string | null>(null);
  const requestInFlightRef = useRef(false);

  useEffect(() => {
    const saved = readInterviewSession(window.localStorage);
    if (saved) setSession(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeInterviewSession(window.localStorage, session);
  }, [hydrated, session]);

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
    requestInFlightRef.current = true; setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/interview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", profile: session.profile }),
      });
      if (!response.ok) throw new Error("无法开始面试");
      const data = await response.json() as { question: InterviewSession["currentQuestion"]; questionIndex: number };
      speechQuestionRef.current = null;
      setSession((current) => updateSession(current, {
        phase: "interview", currentQuestion: data.question, questionIndex: data.questionIndex,
        exchanges: [], draftAnswer: "", followUpQuestionIds: [], report: null, reportStatus: "idle",
      }));
    } catch { setError("暂时无法开始，请稍后重试。"); } finally { requestInFlightRef.current = false; setSubmitting(false); }
  };

  const submitAnswer = async () => {
    const question = session.currentQuestion;
    const answer = session.draftAnswer.trim();
    if (!question || !answer || submitting || requestInFlightRef.current) return;
    requestInFlightRef.current = true; speech.stop(); window.speechSynthesis?.cancel(); setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/interview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "answer", profile: session.profile, question, answer, questionIndex: session.questionIndex,
          idempotencyKey: `${session.id}:${question.id}:${session.exchanges.length}`,
          followUpUsed: session.followUpQuestionIds.includes(question.parentId ?? question.id),
        }),
      });
      if (!response.ok) throw new Error("无法提交回答");
      const data = await response.json() as {
        assessment: InterviewSession["exchanges"][number]["assessment"];
        nextQuestion: InterviewSession["currentQuestion"]; nextQuestionIndex: number; completed: boolean;
      };
      speechQuestionRef.current = null;
      setSession((current) => updateSession(current, {
        exchanges: [...current.exchanges, { question, answer, assessment: data.assessment, submittedAt: new Date().toISOString() }],
        currentQuestion: data.nextQuestion, questionIndex: data.nextQuestionIndex, draftAnswer: "",
        followUpQuestionIds: question.isFollowUp
          ? current.followUpQuestionIds
          : [...current.followUpQuestionIds, ...(data.nextQuestion?.isFollowUp ? [question.id] : [])],
        phase: data.completed ? "complete" : "interview",
      }));
    } catch { setError("回答没有保存。请检查网络后再次提交。"); } finally { requestInFlightRef.current = false; setSubmitting(false); }
  };

  const endEarly = () => {
    speech.stop(); window.speechSynthesis?.cancel();
    setSession((current) => updateSession(current, { phase: "complete", currentQuestion: null, draftAnswer: "" }));
  };

  const generateReport = async () => {
    if (!session.exchanges.length || submitting || requestInFlightRef.current) return;
    const key = reportIdempotencyKey(session);
    requestInFlightRef.current = true; setSubmitting(true); setError(null);
    setSession((current) => updateSession(current, { reportStatus: "generating" }));
    try {
      const response = await fetch("/api/interview/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: key, profile: session.profile, exchanges: session.exchanges }),
      });
      if (!response.ok) throw new Error("无法生成报告");
      const report = await response.json();
      setSession((current) => updateSession(current, { phase: "report", report, reportStatus: "ready" }));
    } catch {
      setError("报告暂时无法生成，已保留本次面试，稍后可再次尝试。");
      setSession((current) => updateSession(current, { reportStatus: "failed" }));
    } finally { requestInFlightRef.current = false; setSubmitting(false); }
  };

  const restart = () => {
    speech.stop(); window.speechSynthesis?.cancel(); clearInterviewSession(window.localStorage);
    speechQuestionRef.current = null; setError(null); setSession(createInterviewSession());
  };

  if (!hydrated) return <main className="py-10 text-center text-muted-foreground">正在恢复面试…</main>;
  const report = session.report;
  if (session.phase === "report" && report) return (
    <main className="mx-auto max-w-4xl space-y-6 py-8">
      <section className="rounded-xl border bg-white p-6 shadow-sm"><p className="text-sm text-muted-foreground">B1/B2 模拟面试报告</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl">{report.readiness}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{report.summary}</p></div><div className="rounded-xl bg-brand-50 px-5 py-3 text-center"><div className="text-3xl font-semibold text-brand-500">{report.overallScore}</div><div className="text-xs text-muted-foreground">准备度评分</div></div></div></section>
      <section className="grid gap-3 sm:grid-cols-4">{Object.entries(report.dimensions).map(([key, score]) => <div key={key} className="rounded-xl border bg-white p-4 shadow-sm"><p className="text-sm text-muted-foreground">{({ clarity: "清晰度", specificity: "具体性", consistency: "一致性", returnIntent: "回国意图" } as Record<string, string>)[key]}</p><p className="mt-1 text-2xl font-semibold">{score}</p></div>)}</section>
      <section className="grid gap-6 md:grid-cols-2"><div className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl">表现优势</h2><div className="mt-4 space-y-4">{report.strengths.map((item) => <div key={item.title}><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.evidence}</p></div>)}</div></div><div className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl">下一轮行动</h2><ol className="mt-4 space-y-4">{report.actions.map((item) => <li key={item.priority}><p className="font-medium">{item.priority}. {item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.action}</p></li>)}</ol></div></section>
      {report.riskFlags.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="flex items-center gap-2 font-medium text-amber-900"><WarningCircle size={20} />需要留意</h2><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900">{report.riskFlags.map((item) => <li key={item}>{item}</li>)}</ul></section>}
      <section className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl">逐题回顾</h2><div className="mt-4 space-y-4">{report.questionAnalysis.map((item, index) => <article key={`${item.question}-${index}`} className="border-b pb-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{index + 1}. {item.question}</p><span className={`rounded-full px-2 py-1 text-xs font-medium ${scoreTone(item.score)}`}>{item.score} 分</span></div><p className="mt-2 text-sm">{item.answer}</p><p className="mt-2 text-sm text-muted-foreground">{item.note} · {item.responseFramework}</p></article>)}</div></section>
      <Button onClick={restart} className="h-11 rounded-full px-6"><ArrowCounterClockwise />重新练习</Button>
    </main>
  );

  if (session.phase === "complete") return <main className="mx-auto max-w-2xl py-12"><section className="rounded-xl border bg-white p-8 text-center shadow-sm"><CheckCircle size={40} className="mx-auto text-emerald-600" weight="fill"/><h1 className="mt-4 text-2xl">本轮面试已结束</h1><p className="mt-2 text-muted-foreground">已保存 {session.exchanges.length} 次回答。生成报告前，刷新页面也不会丢失进度。</p>{error && <p className="mt-4 text-sm text-destructive">{error}</p>}<div className="mt-6 flex justify-center gap-3"><Button variant="outline" onClick={restart}><ArrowCounterClockwise />重新开始</Button><Button onClick={generateReport} disabled={submitting || !session.exchanges.length}>{submitting ? <CircleNotch className="animate-spin" /> : <Flag />}{session.reportStatus === "failed" ? "重试生成报告" : "生成个性化报告"}</Button></div></section></main>;

  if (session.phase === "interview" && session.currentQuestion) {
    const answeredMain = session.exchanges.filter((item) => !item.question.isFollowUp).length;
    return <main className="mx-auto max-w-3xl space-y-6 py-8"><header className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">B1/B2 模拟窗口 · {session.officer.name}</p><h1 className="text-2xl">第 {Math.min(answeredMain + 1, 7)} / 7 个核心主题</h1></div><Button variant="outline" onClick={endEarly} disabled={submitting}>结束本轮</Button></header><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand-500 transition-transform" style={{ width: `${Math.min(answeredMain / 7 * 100, 100)}%` }} /></div><section className="rounded-xl border bg-white p-6 shadow-sm"><p className="text-sm font-medium text-brand-500">{session.currentQuestion.topic}{session.currentQuestion.isFollowUp ? " · 追问" : ""}</p><h2 className="mt-3 text-2xl leading-relaxed">{session.currentQuestion.prompt}</h2><p className="mt-3 text-sm text-muted-foreground">请如实回答。系统会根据具体性和已确认资料决定是否追问。</p></section><section className="rounded-xl border bg-white p-6 shadow-sm"><label htmlFor="interview-answer" className="font-medium">你的回答</label><Textarea id="interview-answer" value={session.draftAnswer} onChange={(event) => setDraft(event.target.value)} placeholder="可直接输入，或使用浏览器语音输入。" className="mt-3 min-h-36" disabled={submitting}/><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div>{speech.error === "unsupported" ? <span className="text-sm text-muted-foreground">当前浏览器不支持语音输入，可继续文字回答。</span> : speech.error ? <span className="text-sm text-destructive">语音输入出现问题，请改用文字。</span> : null}</div><div className="flex gap-2">{speech.isListening ? <Button variant="outline" onClick={speech.stop}><Stop />停止语音</Button> : <Button variant="outline" onClick={() => speech.start(session.draftAnswer)} disabled={!speech.supported || submitting}><Microphone />语音输入</Button>}<Button onClick={submitAnswer} disabled={!session.draftAnswer.trim() || submitting}>{submitting ? <CircleNotch className="animate-spin" /> : <PaperPlaneTilt />}提交回答</Button></div></div>{error && <p className="mt-3 text-sm text-destructive">{error}</p>}</section></main>;
  }

  return <main className="mx-auto max-w-4xl space-y-6 py-8"><header><p className="text-sm text-muted-foreground">美国 B1/B2</p><h1 className="text-3xl">模拟面试练习</h1><p className="mt-2 max-w-2xl text-muted-foreground">先确认真实资料，再以文字或浏览器语音完成面试。系统会追问缺少的关键信息，并在结束后给出个性化复盘。</p></header><section className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl">资料确认</h2><p className="mt-1 text-sm text-muted-foreground">仅用于本浏览器的本次练习，请只填写真实、可核验的信息。</p><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">访问目的<select value={session.profile.purpose} onChange={(event) => updateProfile("purpose", event.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3"><option value="tourism">旅游</option><option value="business">商务</option><option value="family_visit">探亲访友</option><option value="medical">就医</option><option value="other">其他短期访问</option></select></label><Field label="赴美目的与具体活动 *" value={session.profile.purposeDetails} onChange={(value) => updateProfile("purposeDetails", value)} placeholder="例如：参加某展会并拜访客户"/><Field label="目的城市 *" value={session.profile.destinations} onChange={(value) => updateProfile("destinations", value)} placeholder="例如：旧金山、洛杉矶"/><Field label="出行时间 *" value={session.profile.travelDates} onChange={(value) => updateProfile("travelDates", value)} placeholder="例如：2026 年 10 月"/><Field label="预计停留时长 *" value={session.profile.duration} onChange={(value) => updateProfile("duration", value)} placeholder="例如：12 天"/><Field label="谁承担费用 *" value={session.profile.funding} onChange={(value) => updateProfile("funding", value)} placeholder="例如：本人承担"/><Field label="预计预算（可选）" value={session.profile.budget} onChange={(value) => updateProfile("budget", value)} placeholder="例如：3 万元人民币"/><Field label="职业或当前身份 *" value={session.profile.occupation} onChange={(value) => updateProfile("occupation", value)} placeholder="例如：产品经理"/><Field label="单位/学校（可选）" value={session.profile.employer} onChange={(value) => updateProfile("employer", value)} placeholder="例如：VIZA 科技"/><Field label="回国后的具体安排 *" value={session.profile.homeTies} onChange={(value) => updateProfile("homeTies", value)} placeholder="例如：项目交接后继续负责上线"/><Field label="既往出境记录（可选）" value={session.profile.previousTravel} onChange={(value) => updateProfile("previousTravel", value)} placeholder="例如：2024 年去过日本；或第一次出境"/></div></section><section className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl">选择面试官节奏</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{OFFICERS.map((officer) => <button type="button" key={officer.id} onClick={() => setSession((current) => updateSession(current, { officer }))} className={`rounded-lg border p-4 text-left transition-colors ${session.officer.id === officer.id ? "border-brand-500 bg-brand-50" : "hover:bg-muted"}`}><p className="font-medium">{officer.name}</p><p className="mt-1 text-sm text-muted-foreground">{officer.style}</p></button>)}</div></section>{error && <p className="text-sm text-destructive">{error}</p>}<Button onClick={begin} disabled={submitting} className="h-11 rounded-full px-6">{submitting ? <CircleNotch className="animate-spin" /> : <Play />}开始模拟面试</Button></main>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-sm font-medium">{label}<Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1" /></label>;
}
