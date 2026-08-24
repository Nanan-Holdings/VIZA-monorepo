import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPracticePage from "./page";
import {
  createInterviewSession,
  getInterviewSessionKey,
  writeInterviewSession,
  type InterviewSession,
} from "./session";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

const speechStop = vi.fn();
const speechStart = vi.fn();
vi.mock("./_hooks/use-browser-speech", () => ({
  useBrowserSpeech: () => ({
    isListening: false,
    error: null,
    errorRecoverable: false,
    status: "idle",
    supported: true,
    language: "zh-CN",
    start: speechStart,
    stop: speechStop,
  }),
}));

function completeProfile(session: InterviewSession): InterviewSession {
  return {
    ...session,
    profile: {
      ...session.profile,
      purposeDetails: "去美国参加行业会议并短期旅游",
      destinations: "旧金山、洛杉矶",
      travelDates: "2026 年 10 月",
      duration: "12 天",
      funding: "本人承担",
      budget: "30000 元人民币",
      occupation: "产品经理",
      employer: "VIZA",
      homeTies: "回国后继续负责上线项目",
      previousTravel: "去过日本",
    },
  };
}

function seedSession(session: InterviewSession) {
  writeInterviewSession(window.localStorage, session, {
    applicationId: session.applicationId,
    visaType: session.visaType,
  });
}

describe("InterviewPracticePage", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    window.localStorage.clear();
    speechStart.mockReset();
    speechStop.mockReset();
    vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak: vi.fn() });
    vi.stubGlobal("SpeechSynthesisUtterance", vi.fn(function SpeechSynthesisUtterance(this: { lang?: string; text?: string }, text: string) {
      this.text = text;
    }));
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows linked application context and missing practice fields", async () => {
    searchParams = new URLSearchParams("applicationId=app-123&visaType=DS160_B1B2");
    seedSession({
      ...createInterviewSession(),
      applicationId: "app-123",
      visaType: "DS160_B1B2",
      applicationContext: {
        source: "application",
        applicationId: "app-123",
        missingFields: ["purposeDetails"],
        verifiedFields: ["destinations"],
        consistencyStatus: "partially_verifiable",
      },
    });

    render(<InterviewPracticePage />);

    expect(await screen.findByText("已关联申请资料")).toBeInTheDocument();
    expect(screen.getByText(/app-123/u)).toBeInTheDocument();
    expect(screen.getByText(/开始前仍需确认/u)).toHaveTextContent("赴美目的");
    expect(screen.getByText(/已核验/u)).toHaveTextContent("目的地");
    expect(screen.getByText(/核验状态/u)).toHaveTextContent("部分资料待补充");
    expect(window.localStorage.getItem(getInterviewSessionKey({ applicationId: "app-123", visaType: "DS160_B1B2" }))).toBeTruthy();
    expect(window.localStorage.getItem(getInterviewSessionKey({ applicationId: "app-123", visaType: "US_B1_B2" }))).toBeNull();
  });

  it("keeps setup recoverable when required fields are missing", async () => {
    render(<InterviewPracticePage />);

    fireEvent.click(await screen.findByRole("button", { name: "开始模拟面试" }));

    expect(await screen.findByText(/请先补全/u)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts the interview with complete profile data", async () => {
    const session = completeProfile(createInterviewSession());
    seedSession(session);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        question: { id: "q1", topic: "赴美目的", prompt: "你为什么去美国？", isFollowUp: false },
        questionIndex: 0,
      }), { status: 200 }),
    );

    render(<InterviewPracticePage />);

    fireEvent.click(await screen.findByRole("button", { name: "开始模拟面试" }));

    expect(await screen.findByText("你为什么去美国？")).toBeInTheDocument();
    expect(screen.getByText(/第 1 \/ 8 个核心主题/u)).toBeInTheDocument();
  });

  it("starts a persisted English practice session", async () => {
    const session = completeProfile(createInterviewSession());
    seedSession(session);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        question: { id: "purpose", topic: "Purpose of travel", prompt: "Why are you traveling to the United States?", isFollowUp: false },
        questionIndex: 0,
        context: { source: "standalone", missingFields: [], verifiedFields: [], consistencyStatus: "unverified" },
      }), { status: 200 }),
    );

    render(<InterviewPracticePage />);
    fireEvent.click(await screen.findByRole("button", { name: "英文模拟面签" }));
    fireEvent.click(screen.getByRole("button", { name: "开始模拟面试" }));

    expect(await screen.findByText("Why are you traveling to the United States?")).toBeInTheDocument();
    const request = vi.mocked(fetch).mock.calls[0]?.[1];
    expect(JSON.parse(String(request?.body))).toMatchObject({ action: "start", language: "en-US" });
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(getInterviewSessionKey()) ?? "{}")).toMatchObject({ language: "en-US" });
    });
  });

  it("shows report disclaimer and retry options", async () => {
    const session = completeProfile(createInterviewSession());
    const reportSession: InterviewSession = {
      ...session,
      phase: "report",
      reportStatus: "ready",
      report: {
        overallScore: 72,
        readiness: "接近准备",
        summary: "整体回答可用，但仍需增加细节。",
        dimensions: {
          clarity: 72,
          completeness: 74,
          specificity: 68,
          consistency: 75,
          consistencyStatus: "verified",
          returnIntent: 70,
        },
        strengths: [{ title: "目的清楚", evidence: "能说明会议安排。" }],
        actions: [{ priority: 1, title: "补充资金说明", action: "准备预算和流水解释。" }],
        riskFlags: [],
        questionAnalysis: [{
          question: "你为什么去美国？",
          answer: "参加会议。",
          topic: "赴美目的",
          score: 68,
          status: "developing",
          note: "细节不足",
          responseFramework: "目的-行程-回国",
        }],
        generatedAt: "2026-08-23T00:00:00.000Z",
        idempotencyKey: "report-key",
        disclaimer: "这是练习准备度评估，不代表签证结果。",
      },
    };
    seedSession(reportSession);

    render(<InterviewPracticePage />);

    expect(await screen.findByText(/这是练习准备度评估，不代表签证结果/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "只重练弱项" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "完整重练" })).toBeInTheDocument();
  });

  it("persists answer idempotency and completed topic state after submitting", async () => {
    const session: InterviewSession = {
      ...completeProfile(createInterviewSession()),
      id: "session-answer",
      phase: "interview",
      stage: "question",
      currentQuestion: { id: "purpose", topic: "赴美目的", prompt: "你为什么去美国？", isFollowUp: false },
      questionIndex: 0,
      draftAnswer: "我去美国参加行业会议，并在会后短期旅游。",
    };
    seedSession(session);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({
        assessment: { score: 82, status: "strong", note: "回答具体", missingRequirements: [] },
        nextQuestion: { id: "itinerary", topic: "行程安排", prompt: "你怎么安排行程？", isFollowUp: false },
        nextQuestionIndex: 1,
        completed: false,
        context: { source: "standalone", missingFields: [], verifiedFields: [], consistencyStatus: "unverified" },
      }), { status: 200 }),
    );

    render(<InterviewPracticePage />);
    fireEvent.click(await screen.findByRole("button", { name: "提交回答" }));

    expect(await screen.findByText("你怎么安排行程？")).toBeInTheDocument();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      action: "answer",
      idempotencyKey: "session-answer:purpose:0",
    });
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(getInterviewSessionKey()) ?? "{}")).toMatchObject({
        phase: "interview",
        stage: "question",
        completedTopics: ["purpose"],
        lastAnswerIdempotencyKey: "session-answer:purpose:0",
        pendingRequestKey: null,
      });
    });
  });

  it("does not request another report after a ready report is restored", async () => {
    seedSession({
      ...completeProfile(createInterviewSession()),
      phase: "report",
      stage: "report_ready",
      reportStatus: "ready",
      report: {
        overallScore: 72,
        readiness: "接近准备",
        summary: "整体回答可用。",
        dimensions: {
          clarity: 72,
          completeness: 74,
          specificity: 68,
          consistency: null,
          consistencyStatus: "unverified",
          returnIntent: 70,
        },
        strengths: [{ title: "目的清楚", evidence: "能说明会议安排。" }],
        actions: [{ priority: 1, title: "补充资金说明", action: "准备预算解释。" }],
        riskFlags: [],
        questionAnalysis: [],
        generatedAt: "2026-08-23T00:00:00.000Z",
        idempotencyKey: "report-key",
        disclaimer: "本报告仅用于面试练习，不预测、保证或代表任何签证结果。",
      },
    });

    render(<InterviewPracticePage />);
    fireEvent.click(await screen.findByRole("button", { name: "完整重练" }));

    expect(fetch).not.toHaveBeenCalled();
    expect(await screen.findByText("模拟面试练习")).toBeInTheDocument();
  });
});
