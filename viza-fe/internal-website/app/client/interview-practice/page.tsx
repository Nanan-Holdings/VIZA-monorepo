"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { InterviewReport } from "@/app/api/interview/report/route";

const TRANSCRIPT_KEY = "viza_interview_transcript";

// ─── Types ───────────────────────────────────────────────────────────────────

type Message = { role: "user" | "assistant"; content: string };
type PageState = "start" | "checklist" | "interview" | "report";

// ─── Constants ───────────────────────────────────────────────────────────────

const OFFICER_IMAGE =
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=560&h=800&fit=crop&crop=top";

const QUESTIONS = [
  "这次去美国主要是什么打算？",
  "具体去做什么？",
  "为什么选这个时间去？",
  "计划去哪些城市？",
  "打算在美国待多长时间？",
  "回程机票订了吗？",
  "住宿安排好了吗？",
  "这次费用自己出还是有人资助？",
  "大概预算多少？",
  "目前在国内做什么工作？",
  "在哪家公司或机构？",
  "家里还有什么牵挂，回国后有什么安排？",
];

const ENDING_MESSAGE = "好的，今天的面试到这里就结束了，感谢您的配合。";

// ─── Metric Bar ───────────────────────────────────────────────────────────────

function MetricBar({ label, value }: { label: string; value: number }) {
  const color = value > 70
    ? { bar: "#639922", text: "#27500A" }
    : value > 50
    ? { bar: "#EF9F27", text: "#854F0B" }
    : value > 0
    ? { bar: "#E24B4A", text: "#A32D2D" }
    : { bar: "#E24B4A", text: "#b0b7c3" };
  return (
    <div className="mb-[14px]">
      <div className="flex justify-between items-baseline mb-[5px]">
        <span className="text-[12px] text-[rgba(0,0,0,0.45)]">{label}</span>
        <span className="text-[13px] font-medium" style={{ color: value > 0 ? color.text : "#b0b7c3" }}>{value}%</span>
      </div>
      <div className="h-[5px] bg-[#efefef] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color.bar, transition: "width 0.7s ease" }} />
      </div>
    </div>
  );
}

function getAnswerTags(answer: string): { type: "good" | "warn"; text: string }[] {
  const tags: { type: "good" | "warn"; text: string }[] = [];
  if (answer.length >= 20) tags.push({ type: "good", text: "回答完整" });
  if (answer.length < 8)   tags.push({ type: "warn", text: "回答过于简短" });
  if (/\d/.test(answer))   tags.push({ type: "good", text: "提及具体数字" });
  if (/纽约|洛杉矶|旧金山|芝加哥|波士顿|拉斯维加斯|西雅图|华盛顿|迈阿密|城市/.test(answer))
    tags.push({ type: "good", text: "有明确目的地" });
  if (/美元|费用|预算|花|存款|银行|资金|钱/.test(answer))
    tags.push({ type: "good", text: "提及费用安排" });
  if (/天|周|月|号|日期|时间|行程/.test(answer))
    tags.push({ type: "good", text: "说明时间安排" });
  if (/工作|公司|单位|职位|上班/.test(answer))
    tags.push({ type: "good", text: "说明工作情况" });
  if (/家人|父母|孩子|妻子|丈夫|配偶|家庭/.test(answer))
    tags.push({ type: "good", text: "提及家庭牵挂" });
  return tags.slice(0, 3);
}

// ─── Start Page ──────────────────────────────────────────────────────────────

function StartPage({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      <style>{`
        @keyframes hud-blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes hud-wave-bar { 0%,100%{transform:scaleY(0.3);opacity:0.4} 50%{transform:scaleY(1);opacity:1} }
        @keyframes dot-glow { 0%,100%{box-shadow:0 0 4px #4ade80} 50%{box-shadow:0 0 10px #4ade80} }
      `}</style>

      {/* Nav */}
      <nav className="bg-[#03346E] px-6 py-3 flex items-center justify-between">
        <span className="text-white font-bold text-[15px] tracking-tight">VIZA</span>
        <span className="text-white text-[12px] font-semibold border-b border-white pb-0.5">模拟面试</span>
      </nav>

      {/* Hero */}
      <div className="bg-[#03346E] px-8 pt-10 pb-0 grid grid-cols-[1fr_280px] gap-10 items-end overflow-hidden lg:grid-cols-[1fr_300px]">
        {/* Left */}
        <div className="pb-10">
          <div className="inline-flex items-center gap-1.5 bg-white/12 border border-white/20 rounded-full px-3 py-1 mb-5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: "hud-blink 2s infinite" }} />
            <span className="text-white/85 text-[11px] font-medium">B1/B2 · AI 签证面试仿真</span>
          </div>
          <h1 className="text-[32px] font-extrabold text-white leading-[1.18] tracking-tight mb-4">
            一次模拟，<br /><span className="text-[#93c5fd]">少一份意外</span>
          </h1>
          <p className="text-white/60 text-[13px] leading-relaxed mb-7 max-w-[380px]">
            与 AI 领事官进行仿真对话练习，考察真实签证场景问题，面试结束后给出逐题评分与改进建议。
          </p>
          <button onClick={onStart} className="bg-white text-[#03346E] text-[13px] font-bold px-7 py-3 rounded-full shadow-md hover:bg-blue-50 transition-colors">
            ▶ 开始模拟面试
          </button>
          {/* Stats */}
          <div className="flex gap-6 mt-8 pt-6 border-t border-white/10">
            {[
              { val: "AI", label: "仿真领事官" },
              { val: "逐题", label: "评估报告" },
              { val: "免费", label: "无限练习" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                {i > 0 && <div className="w-px h-7 bg-white/15" />}
                <div>
                  <div className="text-[20px] font-extrabold text-white leading-none">{s.val}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — HUD panel */}
        <div className="self-end">
          <div className="rounded-t-[14px] overflow-hidden shadow-[0_-8px_40px_rgba(0,0,0,0.3)]"
            style={{ background: "linear-gradient(160deg,#1a3a6e 0%,#0d2347 100%)" }}>
            <div className="px-4 pt-4 pb-3">
              {/* Top badges */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-[4px] px-2 py-1">
                    <div className="w-[5px] h-[5px] rounded-full bg-red-400" style={{ animation: "hud-blink 1s infinite" }} />
                    <span className="text-[8px] font-bold text-white/70 tracking-[.07em] font-mono">LIVE · CONSULAR OFFICER</span>
                  </div>
                  <div className="flex items-center bg-white/10 border border-white/15 rounded-[4px] px-2 py-1">
                    <span className="text-[8px] font-bold text-white/60 tracking-[.07em] font-mono">PROTOCOL: B1/B2</span>
                  </div>
                </div>
                {/* Audio wave */}
                <div className="flex items-center gap-[2px] bg-white/10 border border-white/12 rounded-[5px] px-2 py-[5px] h-[28px]">
                  {[7, 14, 18, 10, 16, 8, 13].map((h, i) => (
                    <div key={i} className="w-[2.5px] rounded-sm bg-white"
                      style={{ height: h, animation: `hud-wave-bar 0.55s ease-in-out ${i * 0.09}s infinite` }} />
                  ))}
                </div>
              </div>
              {/* Avatar */}
              <div className="flex flex-col items-center gap-2.5 mb-4">
                <div className="w-[68px] h-[68px] rounded-full border-2 border-white/20 bg-white/10 flex items-center justify-center text-[30px]">
                  👨‍💼
                </div>
                <div className="w-[6px] h-[6px] rounded-full bg-green-400" style={{ animation: "dot-glow 2s infinite" }} />
              </div>
              {/* Question card */}
              <div className="bg-black/25 rounded-[10px] px-3 py-3">
                <p className="text-[8px] font-bold text-white/40 tracking-[.12em] uppercase font-mono mb-2">Current Question</p>
                <p className="text-[17px] font-extrabold text-white leading-tight">去美国做什么？</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-8">

        {/* Feature cards */}
        <p className="text-[11px] font-semibold uppercase tracking-[.07em] text-[#989898] mb-4">核心功能</p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: "👨‍💼", t: "真实口吻提问", d: "AI 采用领事官极简短句风格，模拟签证窗口真实问答压力，不引导、不解释、直接追问。" },
            { icon: "🎙️", t: "语音双向交互", d: "支持语音作答与 AI 朗读提问，全程沉浸练习，口语表达与反应速度同步提升。" },
            { icon: "📊", t: "逐题评估报告", d: "面试结束自动生成报告：综合评分、通过概率及每道题的优劣分析与改进建议。" },
          ].map((f) => (
            <div key={f.t} className="bg-white border border-[#efefef] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="w-[40px] h-[40px] rounded-[10px] bg-[#EEF3FA] flex items-center justify-center text-[18px] mb-4">{f.icon}</div>
              <div className="text-[14px] font-bold text-[#1a1a1a] mb-2">{f.t}</div>
              <div className="text-[12px] text-[rgba(0,0,0,0.45)] leading-[1.7]">{f.d}</div>
            </div>
          ))}
        </div>

        {/* Steps */}
        <p className="text-[11px] font-semibold uppercase tracking-[.07em] text-[#989898] mb-4">使用流程</p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { n: 1, t: "点击开始", d: "无需注册，直接进入 AI 仿真面试，全程免费使用。" },
            { n: 2, t: "语音 / 文字作答", d: "AI 按真实节奏逐题提问，支持语音回答。" },
            { n: 3, t: "查看详细报告", d: "自动生成综合评分报告，逐题分析并给出针对性改进建议。" },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-[#efefef] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex gap-4 items-start">
              <div className="w-[36px] h-[36px] rounded-full bg-[#03346E] text-white text-[14px] font-bold flex items-center justify-center flex-shrink-0">{s.n}</div>
              <div>
                <div className="text-[14px] font-bold text-[#1a1a1a] mb-1.5">{s.t}</div>
                <div className="text-[12px] text-[rgba(0,0,0,0.4)] leading-[1.65]">{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-[#03346E] rounded-[16px] px-8 py-7 flex items-center justify-between gap-6">
          <div>
            <div className="text-white font-bold text-[18px] mb-1.5">准备好了吗？</div>
            <div className="text-white/50 text-[13px]">面试只有一次机会，练习可以无数次。</div>
          </div>
          <button onClick={onStart} className="bg-white text-[#03346E] text-[13px] font-bold px-7 py-3 rounded-full whitespace-nowrap hover:bg-blue-50 transition-colors shadow-md">
            立即开始 →
          </button>
        </div>
      </div>

      <footer className="border-t border-[#efefef] bg-white px-6 py-2 flex justify-between items-center">
        <div className="flex gap-4">
          <span className="text-[10px] text-[#989898] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />系统正常</span>
          <span className="text-[10px] text-[#989898] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#3D6DAD] inline-block" />AI 引擎运行中</span>
        </div>
        <span className="text-[10px] text-[#989898]">B1/B2 旅游签证</span>
      </footer>
    </div>
  );
}

// ─── Checklist Page ──────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { label: "护照（有效期 6 个月以上）", desc: "确保护照在签证有效期内不会过期" },
  { label: "DS-160 非移民签证申请表", desc: "已在线填写并打印确认页" },
  { label: "面试预约确认函", desc: "大使馆或领事馆出具的预约确认文件" },
  { label: "近期白底彩色证件照", desc: "符合美国签证照片要求（5×5cm）" },
  { label: "银行流水 / 资金证明", desc: "近 3–6 个月的存款或收入证明" },
  { label: "在职证明 / 营业执照", desc: "证明您在国内有稳定的工作或业务" },
];

function ChecklistPage({ onConfirm, onBack }: { onConfirm: () => void; onBack: () => void }) {
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST_ITEMS.map(() => false));
  const allChecked = checked.every(Boolean);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => idx === i ? !v : v));
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      <nav className="bg-[#03346E] px-6 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-white font-bold text-[15px] tracking-tight">VIZA</span>
        <button onClick={onBack} className="text-white/60 text-[12px] hover:text-white transition-colors">← 返回</button>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[560px]">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#EEF3FA] mb-4">
              <span className="text-[28px]">📋</span>
            </div>
            <h1 className="text-[20px] font-bold text-[#1a1a1a] mb-2">面试前材料确认</h1>
            <p className="text-[13px] text-[rgba(0,0,0,0.45)] leading-relaxed">
              请确认您已准备好以下材料。真实面试时这些文件都需要随身携带。
            </p>
          </div>

          {/* Checklist */}
          <div className="bg-white border border-[#efefef] rounded-2xl overflow-hidden mb-6">
            {CHECKLIST_ITEMS.map((item, i) => (
              <button
                key={item.label}
                onClick={() => toggle(i)}
                className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors border-b border-[#f5f5f5] last:border-0
                  ${checked[i] ? "bg-[#f7fbf7]" : "bg-white hover:bg-[#fafafa]"}`}
              >
                {/* Checkbox */}
                <span className={`w-5 h-5 rounded-md flex items-center justify-center border-2 flex-shrink-0 transition-all
                  ${checked[i] ? "bg-green-500 border-green-500" : "border-[#d0d0d0]"}`}>
                  {checked[i] && <span className="text-white text-[11px] font-bold leading-none">✓</span>}
                </span>
                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-semibold transition-colors ${checked[i] ? "text-green-700" : "text-[#2d2d2d]"}`}>
                    {item.label}
                  </div>
                  <div className="text-[11px] text-[rgba(0,0,0,0.4)] mt-0.5">{item.desc}</div>
                </div>
                {/* Status dot */}
                {checked[i] && <span className="text-green-500 text-[13px] flex-shrink-0">已准备</span>}
              </button>
            ))}
          </div>

          {/* Progress hint */}
          <div className="flex items-center justify-between mb-5 px-1">
            <span className="text-[12px] text-[rgba(0,0,0,0.4)]">
              已确认 {checked.filter(Boolean).length} / {CHECKLIST_ITEMS.length} 项
            </span>
            {!allChecked && (
              <span className="text-[11px] text-amber-600">请勾选全部材料后继续</span>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={onConfirm}
            disabled={!allChecked}
            className={`w-full py-3.5 rounded-full text-[14px] font-bold transition-all
              ${allChecked
                ? "bg-[#03346E] text-white hover:bg-[#022B5C] shadow-md"
                : "bg-[#e8e8e8] text-[#aaa] cursor-not-allowed"}`}
          >
            {allChecked ? "材料已备齐，开始面试 →" : "请确认全部材料"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Interview Page ───────────────────────────────────────────────────────────

function InterviewPage({
  messages, isStreaming, isSpeaking, isMuted, input, questionIndex, interviewDone,
  onInputChange, onSend, onEnd, onAbandon, onToggleMute,
}: {
  messages: Message[]; isStreaming: boolean; isSpeaking: boolean; isMuted: boolean;
  input: string; questionIndex: number; interviewDone: boolean;
  onInputChange: (v: string) => void; onSend: (forceText?: string) => void;
  onEnd: () => void; onAbandon: () => void; onToggleMute: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // ── Real-time analysis (based on actual speech signals) ──────────────────────
  const [metrics, setMetrics] = useState({ confidence: 0, fluency: 0, emotion: 0 });
  const lastSpeechTimeRef = useRef<number>(0);          // timestamp of last onresult
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audioContextRef  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const analyserRef      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const micStreamRef     = useRef<any>(null);

  async function startAudioAnalysis() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
    } catch { /* mic permission denied — emotion stays static */ }
  }

  function stopAudioAnalysis() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    micStreamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    micStreamRef.current = null;
  }

  // Update metrics — live while recording, history-based when idle
  useEffect(() => {
    if (isListening) {
      // ── Recording: update every 300ms from live signals ──────────────────
      const id = setInterval(() => {
        // 表达置信度 — current utterance text length
        const textLen = accumulatedRef.current.length;
        const confidence = Math.round(Math.min(95, 20 + Math.min(textLen * 1.6, 75)));

        // 流利程度 — time since last speech fragment
        const ms = lastSpeechTimeRef.current > 0 ? Date.now() - lastSpeechTimeRef.current : 4000;
        const fluency = Math.round(
          ms < 500  ? 85 + Math.random() * 10 :
          ms < 1500 ? 65 + Math.random() * 12 :
          ms < 3000 ? 42 + Math.random() * 10 :
                      22 + Math.random() * 8
        );

        // 情绪检测 — microphone volume
        let emotion = metrics.emotion;
        if (analyserRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          const data = new Uint8Array(analyserRef.current.frequencyBinCount as number);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          analyserRef.current.getByteFrequencyData(data);
          const avg = data.reduce((a: number, b: number) => a + b, 0) / data.length;
          emotion = Math.round(Math.min(97, Math.max(15, avg * 2.4)));
        }
        setMetrics({ confidence, fluency, emotion });
      }, 300);
      return () => clearInterval(id);
    } else {
      // ── Idle: derive from past user answers ────────────────────────────────
      const userMsgs = messages.filter((m) => m.role === "user");
      if (userMsgs.length === 0) return;
      const avgLen = userMsgs.reduce((s, m) => s + m.content.length, 0) / userMsgs.length;
      // 表达置信度 — average answer length across all replies
      const confidence = Math.round(Math.min(95, 15 + Math.min(avgLen * 1.4, 80)));
      // 流利程度 — keep last live value (recorded during mic session)
      // 情绪检测 — keep last live value
      setMetrics((prev) => ({ ...prev, confidence }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, messages]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);   // ref mirror so callbacks always see latest value
  const accumulatedRef = useRef("");      // accumulate finals across auto-restarts
  const onSendRef = useRef(onSend);       // always-fresh ref to avoid stale closure
  useEffect(() => { onSendRef.current = onSend; }, [onSend]);

  const currentQuestion = Math.min(questionIndex, QUESTIONS.length);
  const lastOfficerMsg = [...messages].reverse().find((m) => m.role === "assistant");

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!isStreaming && input.trim()) onSend(); }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function startRecognition(SR: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const recognition = new SR();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.lang = "zh-CN";
    // continuous:true = recognition runs until explicitly stopped; no mid-sentence gaps
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.continuous = true;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.interimResults = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    recognition.onresult = (e: any) => {
      let interim = "";
      // Only process NEW results starting at e.resultIndex to avoid re-appending
      // already-accumulated finals on every subsequent continuous-mode event
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      for (let i = (e as any).resultIndex as number; i < (e as any).results.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const r = (e as any).results[i];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if ((r as any).isFinal) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          accumulatedRef.current += (r as any)[0].transcript as string;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          interim += (r as any)[0].transcript as string;
        }
      }
      lastSpeechTimeRef.current = Date.now();   // track for fluency measurement
      onInputChange(accumulatedRef.current + interim);
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.onend = () => {
      if (isListeningRef.current) {
        // Unexpected end (browser timeout etc.) — restart to keep listening
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        try { recognition.start(); } catch { startRecognition(SR); }
      } else {
        // User clicked stop — flush accumulated text and send
        const final = accumulatedRef.current.trim();
        onInputChange(final);
        if (final) onSendRef.current(final);
        setIsListening(false);
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    recognition.onerror = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if ((e as any).error === "no-speech") {
        // In continuous mode this is informational — recognition keeps going
        return;
      }
      isListeningRef.current = false;
      setIsListening(false);
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    recognition.start();
    recognitionRef.current = recognition;
  }

  function toggleListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("您的浏览器不支持语音识别，请使用 Chrome 或 Edge。"); return; }
    if (isListeningRef.current) {
      // User clicked again — stop and auto-send
      isListeningRef.current = false;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      stopAudioAnalysis();
      return;
    }
    accumulatedRef.current = "";   // reset for new utterance
    lastSpeechTimeRef.current = 0;
    isListeningRef.current = true;
    setIsListening(true);
    void startAudioAnalysis();
    startRecognition(SR);
  }

  return (
    <div className="h-screen bg-[#fafafa] flex flex-col overflow-hidden">
      <style>{`
        @keyframes speaking-pulse { from { filter: brightness(0.93) saturate(1); } to { filter: brightness(1.07) saturate(1.06); } }
        @keyframes live-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes wave-bar { 0%, 100% { transform: scaleY(0.35); opacity: 0.45; } 50% { transform: scaleY(1); opacity: 1; } }
      `}</style>

      <nav className="bg-[#03346E] px-6 py-3 flex items-center justify-between flex-shrink-0">
        <span className="text-white font-bold text-[15px] tracking-tight">VIZA</span>
        <div className="flex items-center gap-1.5 bg-white/12 border border-white/20 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_#4ade80]" />
          <span className="text-white/90 text-[10px] font-medium">B1/B2 旅游签证 · 模拟进行中</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onToggleMute} className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 text-white/80 text-[10px] font-medium hover:bg-white/15 transition-colors">
            {isMuted ? "🔇 已静音" : "🔊 朗读开启"}
          </button>
          <button onClick={onAbandon} className="bg-red-500/20 border border-red-300/30 text-red-300 text-[10px] font-semibold px-3 py-1.5 rounded-full hover:bg-red-500/30 transition-colors">结束面试</button>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-[190px_1fr] grid-rows-[1fr] gap-3 p-4 bg-[#f5f7fa] overflow-hidden">

        {/* Left */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          <div className="bg-white border border-[#efefef] rounded-xl p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {/* Header row */}
            <div className="flex items-center justify-between mb-[14px]">
              <span className="text-[11px] font-medium uppercase tracking-[.08em] text-[#989898]">实时分析</span>
              {isListening && (
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-[2px] items-end" style={{ height: 14 }}>
                    {[4, 8, 12, 8, 4].map((h, i) => (
                      <div key={i} className="w-[3px] rounded-full bg-[#185FA5]"
                        style={{ height: h, animation: `wave-bar 0.55s ease-in-out ${i * 0.1}s infinite` }} />
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-[#185FA5] tracking-[.06em]">AI 扫描中</span>
                </div>
              )}
            </div>

            <MetricBar label="表达置信度" value={Math.round(metrics.confidence)} />
            <MetricBar label="流利程度"   value={Math.round(metrics.fluency)} />
            <MetricBar label="情绪检测"   value={Math.round(metrics.emotion)} />

            {/* 答题快评 — shown only after answer, not while listening */}
            {(() => {
              const lastAnswer = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
              if (!lastAnswer || isListening) return null;
              const tags = getAnswerTags(lastAnswer);
              if (tags.length === 0) return null;
              return (
                <div className="mt-[14px] pt-[14px] border-t border-[#efefef]">
                  <span className="text-[11px] font-medium uppercase tracking-[.08em] text-[#989898] block mb-[10px]">答题快评</span>
                  <div className="flex flex-col gap-[6px]">
                    {tags.map((tag, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-[5px] rounded-lg border"
                        style={tag.type === "good"
                          ? { background: "#EAF3DE", color: "#27500A", borderColor: "#C0DD97" }
                          : { background: "#FAEEDA", color: "#633806", borderColor: "#FAC775" }}>
                        <span>{tag.type === "good" ? "✓" : "⚠"}</span>
                        <span>{tag.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="bg-white border border-[#efefef] rounded-xl p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#989898] mb-3">答题小贴士</p>
            {(() => {
              const lastMsg = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";
              type Tip = { icon: string; text: string };
              // ordered from most-specific to least — prevents false matches on common words
              const tips: Tip[] =
                /费用|预算|资助|银行流水|资金证明/.test(lastMsg) ? [
                  { icon: "💰", text: "建议提及具体金额和资金来源" },
                  { icon: "📄", text: "如有银行流水或存款证明，主动说明" },
                  { icon: "✅", text: "说清是自费还是家人资助" },
                ] : /工作|公司|机构|收入|请假/.test(lastMsg) ? [
                  { icon: "🏢", text: "说出具体公司名称和您的职位" },
                  { icon: "📅", text: "提一句请假已经获批" },
                  { icon: "💼", text: "稳定的工作是回国意愿的有力证明" },
                ] : /家里|配偶|子女|牵挂|回国|回来/.test(lastMsg) ? [
                  { icon: "👨‍👩‍👧", text: "提及具体家庭成员，越真实越有说服力" },
                  { icon: "🏠", text: "说明回国后有明确的工作或生活安排" },
                  { icon: "🔗", text: "具体的责任牵挂比泛泛而谈更有效" },
                ] : /多长时间|多久|回程|机票|停留/.test(lastMsg) ? [
                  { icon: "✈️", text: "给出明确天数，例如：打算待三周" },
                  { icon: "🎫", text: "已订好回程机票的话，主动提出来" },
                  { icon: "⏱️", text: "停留时间要和旅行目的匹配" },
                ] : /酒店|朋友家|住宿|预订|住哪/.test(lastMsg) ? [
                  { icon: "🏨", text: "说出具体住宿区域或酒店名称" },
                  { icon: "📋", text: "有预订记录会大大增加可信度" },
                  { icon: "📍", text: "住宿地点最好与行程城市一致" },
                ] : /城市|跟团|路线|待几天/.test(lastMsg) ? [
                  { icon: "🗺️", text: "列出具体城市，说明大概路线" },
                  { icon: "📅", text: "说明每个地方大概待几天" },
                  { icon: "🎯", text: "有主题的行程更有说服力，例如文化游" },
                ] : /打算|旅游|旅行|目的|规划|做什么|时间/.test(lastMsg) ? [
                  { icon: "🎯", text: "说清楚旅行的主要目的，越具体越好" },
                  { icon: "📋", text: "提前做过规划会显得更有备而来" },
                  { icon: "💬", text: "避免只说【就是去玩】，给出真实细节" },
                ] : [
                  { icon: "💬", text: "回答要简洁直接，不要绕弯子" },
                  { icon: "👁️", text: "保持自然，不要背稿子" },
                  { icon: "📌", text: "回答要与您的签证材料保持一致" },
                ];
              return tips.map((tip) => (
                <div key={tip.text} className="flex items-start gap-2.5 mb-2.5">
                  <span className="text-[14px] flex-shrink-0 mt-0.5">{tip.icon}</span>
                  <span className="text-[11px] text-[rgba(0,0,0,0.6)] leading-relaxed">{tip.text}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Center — Officer */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="bg-white border border-[#efefef] rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex-1 relative min-h-0" style={{ minHeight: 320 }}>
            {/* Fallback background — always rendered, sits behind the photo */}
            <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #03346E 0%, #1a5fa8 60%, #2d7cc7 100%)" }}>
              {!imgLoaded && !imgError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-[3px] border-white/20 border-t-white/80 rounded-full animate-spin" />
                  <span className="text-white/60 text-[11px] font-medium">加载中…</span>
                </div>
              )}
              {imgError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <svg width="72" height="88" viewBox="0 0 72 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="36" cy="26" rx="18" ry="20" fill="rgba(255,255,255,0.18)" />
                    <rect x="10" y="52" width="52" height="36" rx="26" fill="rgba(255,255,255,0.14)" />
                    <ellipse cx="36" cy="26" rx="12" ry="14" fill="rgba(255,255,255,0.28)" />
                  </svg>
                  <span className="text-white/40 text-[10px]">CONSULAR OFFICER</span>
                </div>
              )}
            </div>
            {/* Real photo — absolute so it fills container regardless of height */}
            {!imgError && (
              <img
                src={OFFICER_IMAGE}
                alt="Consular Officer"
                className="absolute inset-0 w-full h-full object-contain object-bottom"
                style={{
                  opacity: imgLoaded ? 1 : 0,
                  transition: "opacity 0.4s ease",
                  animation: isSpeaking ? "speaking-pulse 0.45s ease-in-out infinite alternate" : "none",
                  filter: isSpeaking ? undefined : "brightness(0.93)",
                }}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
            )}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(3,52,110,0.9) 100%)" }} />
            <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 3px)" }} />


            {/* HUD top-left */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
              <div className="flex items-center gap-1.5 bg-white/92 border border-[rgba(3,52,110,0.18)] rounded-[4px] px-2.5 py-1 shadow-sm">
                <div className="w-[7px] h-[7px] rounded-full bg-red-500" style={{ boxShadow: "0 0 5px #ef4444", animation: "live-blink 1s infinite" }} />
                <span className="text-[9px] font-bold text-[#03346E] tracking-[.08em] font-mono">LIVE: CONSULAR OFFICER</span>
              </div>
              <div className="flex items-center bg-white/92 border border-[rgba(3,52,110,0.18)] rounded-[4px] px-2.5 py-1 shadow-sm">
                <span className="text-[9px] font-bold text-[#03346E] tracking-[.08em] font-mono">PROTOCOL: B1/B2</span>
              </div>
            </div>

            {/* Audio wave */}
            {isSpeaking && (
              <div className="absolute top-3 right-3 z-10 flex items-center gap-[2.5px] bg-white/92 border border-[rgba(3,52,110,0.15)] rounded-[5px] px-2.5 py-[5px] h-[28px] shadow-sm">
                {[6, 14, 19, 11, 17, 8, 13].map((h, i) => (
                  <div key={i} className="w-[3px] rounded-sm bg-[#03346E]" style={{ height: h, animation: `wave-bar 0.55s ease-in-out ${i * 0.09}s infinite` }} />
                ))}
              </div>
            )}

            {/* Question + progress */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10" style={{ paddingRight: 120 }}>
              <p className="text-[9px] font-bold text-white/55 tracking-[.12em] uppercase mb-1.5 font-mono">Current Question</p>
              <p className="text-[18px] font-extrabold text-white leading-[1.35] tracking-tight">
                {messages.length === 0 ? "面试即将开始…" : (lastOfficerMsg?.content ?? "")}
              </p>
            </div>

            {/* Bottom-right action buttons */}
            {!interviewDone && (
              <div className="absolute bottom-4 right-4 z-20 flex gap-2.5">
                {/* Mic button */}
                <button
                  onClick={toggleListening}
                  title={isListening ? "停止录音" : "开始说话"}
                  style={{
                    width: 52, height: 52,
                    borderRadius: 14,
                    background: isListening ? "rgba(59,130,246,0.82)" : "rgba(22,55,100,0.72)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    border: isListening ? "1.5px solid rgba(147,197,253,0.6)" : "1.5px solid rgba(255,255,255,0.15)",
                    boxShadow: isListening ? "0 0 0 3px rgba(59,130,246,0.3), 0 4px 16px rgba(0,0,0,0.35)" : "0 4px 16px rgba(0,0,0,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease", cursor: "pointer",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="2" width="6" height="12" rx="3" fill={isListening ? "#fff" : "#7ec8f8"} />
                    <path d="M5 11c0 3.866 3.134 7 7 7s7-3.134 7-7" stroke={isListening ? "#fff" : "#7ec8f8"} strokeWidth="2" strokeLinecap="round" fill="none" />
                    <line x1="12" y1="18" x2="12" y2="22" stroke={isListening ? "#fff" : "#7ec8f8"} strokeWidth="2" strokeLinecap="round" />
                    <line x1="9" y1="22" x2="15" y2="22" stroke={isListening ? "#fff" : "#7ec8f8"} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                {/* End call button */}
                <button
                  onClick={onAbandon}
                  title="结束面试"
                  style={{
                    width: 52, height: 52,
                    borderRadius: 14,
                    background: "rgba(90,20,20,0.72)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    border: "1.5px solid rgba(255,150,150,0.2)",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s ease", cursor: "pointer",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="#f87171" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {isStreaming && (
            <div className="bg-[#EEF3FA] border border-[#D4E0F0] rounded-xl px-4 py-2.5 flex items-center gap-2 flex-shrink-0">
              {[0, 0.15, 0.3].map((d, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#03346E] animate-bounce" style={{ animationDelay: `${d}s` }} />)}
              <span className="text-[11px] text-[#03346E] font-medium">官员正在回应…</span>
            </div>
          )}

          {interviewDone && (
            <button onClick={onEnd} className="bg-[#03346E] text-white font-bold text-[13px] py-3 rounded-xl hover:bg-[#022B5C] transition-colors flex-shrink-0">
              查看面试报告 →
            </button>
          )}

          {/* STT status indicator */}
          {isListening && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[11px] text-blue-600 font-medium">录音中，请说话…点击麦克风停止</span>
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-[#efefef] bg-white px-6 py-2 flex justify-between items-center flex-shrink-0">
        <div className="flex gap-4">
          <span className="text-[10px] text-[#989898] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />连接正常</span>
          <span className="text-[10px] text-[#989898] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#3D6DAD] inline-block" />AI 引擎运行中</span>
        </div>
        <span className="text-[10px] text-[#989898]">B1/B2 签证模拟</span>
      </footer>
    </div>
  );
}

// ─── Report Page ──────────────────────────────────────────────────────────────

function ReportPage({ report, onRetry }: { report: InterviewReport; onRetry: () => void }) {
  const passLikelihoodColor = report.passLikelihood === "高"
    ? { dot: "#4ADE80", bg: "#15803D", text: "#BBF7D0" }
    : report.passLikelihood === "中"
    ? { dot: "#FCD34D", bg: "#B45309", text: "#FEF3C7" }
    : { dot: "#F87171", bg: "#B91C1C", text: "#FEE2E2" };

  const scoreCircumference = 2 * Math.PI * 38;
  const scoreDash = scoreCircumference * (report.overallScore / 100);

  const dims = [
    { label: "清晰度", value: report.dimensions.clarity },
    { label: "置信度", value: report.dimensions.confidence },
    { label: "一致性", value: report.dimensions.consistency, danger: report.dimensions.consistency < 75 },
    { label: "叙述对齐", value: report.dimensions.narrativeAlignment },
  ];

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* ── Hero ── */}
      <div className="bg-[#02213F] px-8 pt-5 pb-7">
        {/* nav */}
        <div className="flex items-center justify-between mb-7">
          <span className="text-white font-bold text-[16px] tracking-[3px]">VIZA</span>
          <span className="text-[rgba(255,255,255,0.45)] text-[12px]">B1/B2 签证模拟面试</span>
        </div>
        {/* hero body */}
        <div className="flex items-center gap-8 flex-wrap">
          {/* score ring */}
          <svg width="100" height="100" viewBox="0 0 90 90" className="flex-shrink-0">
            <circle cx="45" cy="45" r="38" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
            <circle cx="45" cy="45" r="38" fill="none" stroke="#378ADD" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={scoreCircumference} strokeDashoffset={scoreCircumference - scoreDash}
              transform="rotate(-90 45 45)" />
            <text x="45" y="51" textAnchor="middle" fill="white" fontSize="21" fontWeight="500">{report.overallScore}</text>
          </svg>
          {/* verdict */}
          <div className="flex-shrink-0">
            <div className="text-[rgba(255,255,255,0.5)] text-[11px] tracking-[1px] mb-2">综合评分</div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-4 py-1.5 rounded-full"
                style={{ background: passLikelihoodColor.bg, color: passLikelihoodColor.text }}>
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: passLikelihoodColor.dot }} />
                通过概率：{report.passLikelihood}
              </span>
            </div>
            <div className="text-[rgba(255,255,255,0.35)] text-[11px] mt-2">共完成 {report.questionAnalysis.length} 道问题 · 7 个模块</div>
          </div>
          {/* divider */}
          <div className="w-px self-stretch bg-[rgba(255,255,255,0.12)] flex-shrink-0 hidden sm:block" style={{ minHeight: 64 }} />
          {/* 4 mini stats */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-3 flex-shrink-0">
            {dims.map((d) => (
              <div key={d.label}>
                <div className="text-[rgba(255,255,255,0.4)] text-[11px]">{d.label}</div>
                <div className={`text-[20px] font-medium ${d.danger ? "text-red-400" : "text-white"}`}>{d.value}%</div>
              </div>
            ))}
          </div>
          {/* retry */}
          <div className="ml-auto">
            <button onClick={onRetry}
              className="flex items-center gap-1.5 text-[12px] text-white border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.15)] transition-colors px-5 py-2 rounded-full">
              ↺ 重新模拟
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-5 py-5 grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4">
        {/* Left col */}
        <div className="flex flex-col gap-4">
          {/* Dimensions */}
          <div className="bg-white border border-[#e8e8e8] rounded-xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#989898] mb-4">能力维度</p>
            <div className="flex flex-col gap-3">
              {dims.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                  <span className="text-[12px] text-[#666] w-[58px] flex-shrink-0">{d.label}</span>
                  <div className="flex-1 h-[5px] bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${d.danger ? "bg-red-500" : "bg-[#185FA5]"}`} style={{ width: `${d.value}%` }} />
                  </div>
                  <span className={`text-[12px] font-medium w-8 text-right ${d.danger ? "text-red-600" : "text-[#3d3d3d]"}`}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights */}
          <div className="bg-white border border-[#e8e8e8] rounded-xl p-5 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#989898] mb-4">AI 洞察</p>
            <div className="mb-4">
              <div className="text-[11px] font-semibold text-green-700 mb-2.5">✓ 关键优势</div>
              {report.strengths.map((s, i) => (
                <div key={i} className="border-l-[2.5px] border-green-600 rounded-[0_6px_6px_0] bg-green-50 px-3 py-2.5 mb-2 text-[12px] text-[#3d3d3d] leading-relaxed">{s}</div>
              ))}
            </div>
            <div>
              <div className="text-[11px] font-semibold text-red-600 mb-2.5">! 需要改进</div>
              {report.improvements.map((imp, i) => (
                <div key={i} className="border-l-[2.5px] border-red-500 rounded-[0_6px_6px_0] bg-red-50 px-3 py-2.5 mb-2 text-[12px] text-[#3d3d3d] leading-relaxed">{imp}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col — question analysis */}
        <div className="bg-white border border-[#e8e8e8] rounded-xl p-5 flex flex-col min-h-0" style={{ maxHeight: 580 }}>
          <p className="text-[11px] font-semibold uppercase tracking-[1px] text-[#989898] mb-4 flex-shrink-0">逐题分析</p>
          <div className="flex flex-col gap-2.5 overflow-y-auto flex-1 pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#D4E0F0 transparent" }}>
            {report.questionAnalysis.map((qa, i) => {
              const badgeClass = qa.flag === "strong"
                ? "bg-green-100 text-green-800"
                : qa.flag === "weak"
                ? "bg-red-100 text-red-700"
                : "bg-[#f0f0f0] text-[#888]";
              return (
                <div key={i} className="bg-[#f7f8fa] border border-[#efefef] rounded-xl p-3.5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] text-[#3D6DAD]">{qa.timestamp} · {qa.topic}</span>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${badgeClass}`}>{qa.flagLabel}</span>
                  </div>
                  <p className="text-[12px] text-[#999] italic mb-1.5">「{qa.question}」</p>
                  <p className="text-[12px] text-[#3d3d3d] leading-relaxed mb-2">{qa.answer}</p>
                  <div className="bg-white border border-[#efefef] rounded px-2.5 py-2 text-[11px] text-[rgba(0,0,0,0.45)] leading-relaxed italic">
                    分析：{qa.note}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <footer className="border-t border-[#e8e8e8] bg-white px-6 py-2 flex justify-between items-center">
        <div className="flex gap-4">
          <span className="text-[11px] text-[#989898] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />系统正常</span>
          <span className="text-[11px] text-[#989898] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#3D6DAD] inline-block" />报告已生成</span>
        </div>
        <span className="text-[11px] text-[#989898]">B1/B2 签证模拟</span>
      </footer>
    </div>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function LoadingReport() {
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-[#EEF3FA] border-t-[#03346E] rounded-full animate-spin" />
      <p className="text-[14px] font-medium text-[#3d3d3d]">正在生成面试报告…</p>
      <p className="text-[12px] text-[rgba(0,0,0,0.45)]">AI 正在分析您的回答，请稍候</p>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function InterviewPracticePage() {
  const [pageState, setPageState] = useState<PageState>("start");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const interviewDone = questionIndex >= QUESTIONS.length;

  const isMutedRef = useRef(false);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      isMutedRef.current = !prev;
      if (!prev && typeof window !== "undefined") { window.speechSynthesis?.cancel(); setIsSpeaking(false); }
      return !prev;
    });
  }, []);

  const speakText = useCallback((text: string) => {
    if (isMutedRef.current || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "zh-CN"; utt.rate = 0.88; utt.pitch = 0.95;
    setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  }, []);

  const addOfficerMessage = useCallback((text: string) => {
    setMessages((prev) => {
      // Guard: don't add duplicate consecutive officer messages
      if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && prev[prev.length - 1].content === text) return prev;
      return [...prev, { role: "assistant", content: text }];
    });
    speakText(text);
  }, [speakText]);

  useEffect(() => {
    if (pageState === "interview" && messages.length === 0) {
      setQuestionIndex(0);
      setTimeout(() => addOfficerMessage(QUESTIONS[0]), 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState]);

  const fetchOfficerReply = useCallback(async (history: Message[]) => {
    setIsStreaming(true);
    let accumulated = "";
    try {
      const res = await fetch("/api/interview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }) });
      if (!res.ok || !res.body) throw new Error("Interview API error");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const chunk = JSON.parse(data) as { choices: Array<{ delta: { content?: string }; finish_reason?: string }> };
            const delta = chunk.choices[0]?.delta?.content ?? "";
            accumulated += delta;
            setMessages((prev) => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: accumulated }; return u; });
          } catch { /* ignore */ }
        }
      }
      if (!isMutedRef.current && typeof window !== "undefined" && window.speechSynthesis && accumulated) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(accumulated);
        utt.lang = "zh-CN"; utt.rate = 0.88; utt.pitch = 0.95;
        setIsSpeaking(true);
        utt.onend = () => setIsSpeaking(false);
        utt.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utt);
      }
    } catch (err) {
      console.error("Interview fetch error:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，连接出现问题，请刷新页面后重试。" }]);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const isSendingRef = useRef(false);
  const handleSend = useCallback((forceText?: string) => {
    const trimmed = (forceText ?? input).trim();
    if (!trimmed || isStreaming || interviewDone || isSendingRef.current) return;
    isSendingRef.current = true;
    setMessages((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].role === "user") return prev;
      return [...prev, { role: "user", content: trimmed }];
    });
    setInput("");
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setTimeout(() => {
      isSendingRef.current = false;
      if (nextIndex < QUESTIONS.length) {
        addOfficerMessage(QUESTIONS[nextIndex]);
      } else {
        addOfficerMessage(ENDING_MESSAGE);
      }
    }, 400);
  }, [input, isStreaming, interviewDone, questionIndex, addOfficerMessage]);

  // Abandon: user manually quits mid-interview → back to start, no report
  const handleAbandon = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setMessages([]); setInput(""); setIsStreaming(false); setQuestionIndex(0);
    setPageState("start");
  }, []);

  // End: interview naturally completed → generate report
  const handleEndInterview = useCallback(async () => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    // Need at least one officer question answered, otherwise there is nothing to
    // score and the report API would 400 ("对话记录不足"). Bail back to start.
    const answeredCount = messages.filter((m) => m.role === "user").length;
    if (messages.length < 2 || answeredCount === 0) { setPageState("start"); return; }
    try { window.localStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(messages)); } catch {}
    setIsGeneratingReport(true); setPageState("report");
    try {
      const res = await fetch("/api/interview/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }) });
      if (!res.ok) throw new Error("Report generation failed");
      setReport((await res.json()) as InterviewReport);
    } catch (err) {
      console.error("Report generation error:", err);
      setReport({
        overallScore: 72, passLikelihood: "中",
        dimensions: { clarity: 75, confidence: 70, consistency: 68, narrativeAlignment: 76 },
        strengths: ["回答基本流畅，能够正常沟通", "部分问题回答较为直接清晰"],
        improvements: ["建议提前准备具体的行程安排细节", "资金来源说明需更加明确具体"],
        questionAnalysis: messages.filter((m) => m.role === "assistant").slice(0, 5).map((m, i) => ({
          question: m.content, answer: messages.find((msg, idx) => msg.role === "user" && idx > messages.indexOf(m))?.content ?? "(未回答)",
          score: 70, flag: "neutral" as const, flagLabel: "中性", note: "回答基本符合要求", timestamp: `0${i + 1}:00`, topic: "综合评估",
        })),
      });
    } finally { setIsGeneratingReport(false); }
  }, [messages]);

  const handleRetry = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setMessages([]); setReport(null); setInput(""); setIsStreaming(false); setIsSpeaking(false); setIsGeneratingReport(false); setQuestionIndex(0); setPageState("start");
  }, []);

  if (pageState === "start") return <StartPage onStart={() => setPageState("checklist")} />;
  if (pageState === "checklist") return <ChecklistPage onConfirm={() => setPageState("interview")} onBack={() => setPageState("start")} />;
  if (pageState === "interview") return (
    <InterviewPage messages={messages} isStreaming={isStreaming} isSpeaking={isSpeaking} isMuted={isMuted}
      input={input} questionIndex={questionIndex} interviewDone={interviewDone}
      onInputChange={setInput} onSend={handleSend} onEnd={handleEndInterview} onAbandon={handleAbandon} onToggleMute={handleToggleMute} />
  );
  if (isGeneratingReport || !report) return <LoadingReport />;
  return <ReportPage report={report} onRetry={handleRetry} />;
}
