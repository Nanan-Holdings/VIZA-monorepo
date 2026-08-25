import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import InterviewPracticePage from "./page";
import {
  createInterviewSession,
  getInterviewSessionKey,
  writeInterviewSession,
  type InterviewSession,
} from "./session";
import { mapDs160AnswersToInterviewProfile } from "@/lib/interview/profile-mapper";

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

function linkedContext(profile: InterviewSession["profile"]) {
  return {
    profile,
    context: {
      source: "application",
      applicationId: "00000000-0000-4000-8000-000000000123",
      missingFields: ["travelDates", "homeTies"],
      verifiedFields: ["destinations"],
      needsConfirmationFields: ["purpose", "purposeDetails", "funding"],
      fieldStates: [
        { field: "purpose", status: "needs_confirmation", source: "saved_application" },
        { field: "purposeDetails", status: "needs_confirmation", source: "saved_application" },
        { field: "destinations", status: "confirmed", source: "saved_application" },
        { field: "travelDates", status: "missing", source: null },
        { field: "duration", status: "missing", source: null },
        { field: "funding", status: "needs_confirmation", source: "saved_application" },
        { field: "budget", status: "missing", source: null },
        { field: "occupation", status: "missing", source: null },
        { field: "employer", status: "missing", source: null },
        { field: "homeTies", status: "missing", source: null },
        { field: "previousTravel", status: "needs_confirmation", source: "saved_application" },
        { field: "companions", status: "missing", source: null },
        { field: "usContact", status: "missing", source: null },
        { field: "refusalHistory", status: "needs_confirmation", source: "saved_application" },
      ],
      consistencyStatus: "partially_verifiable",
    },
  };
}

function acceptDisclaimer() {
  fireEvent.click(screen.getByRole("checkbox", { name: /我已阅读/u }));
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
    const applicationId = "00000000-0000-4000-8000-000000000123";
    searchParams = new URLSearchParams(`applicationId=${applicationId}&visaType=DS160_B1B2`);
    seedSession({
      ...createInterviewSession(),
      applicationId,
      visaType: "DS160_B1B2",
      applicationContext: {
        source: "application",
        applicationId,
        missingFields: ["purposeDetails"],
        verifiedFields: ["destinations"],
        consistencyStatus: "partially_verifiable",
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(linkedContext({
      ...createInterviewSession().profile,
      purposeDetails: "B1/B2 短期商务或旅游访问",
      destinations: "Seattle",
      funding: "本人承担",
      previousTravel: "无赴美记录",
      refusalHistory: "无拒签记录",
    })), { status: 200 }));

    render(<InterviewPracticePage />);

    expect(await screen.findByDisplayValue("Seattle")).toBeInTheDocument();
    expect(screen.getByDisplayValue("本人承担")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === `申请编号：${applicationId}`)).toBeInTheDocument();
    expect(screen.getAllByText("待确认").length).toBeGreaterThan(0);
    expect(screen.getAllByText("缺失").length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(getInterviewSessionKey({ applicationId, visaType: "DS160_B1B2" }))).toBeTruthy();
    expect(window.localStorage.getItem(getInterviewSessionKey({ applicationId, visaType: "US_B1_B2" }))).toBeNull();
  });

  it("maps a saved DS-160 payload into the linked summary without inventing missing facts", async () => {
    const applicationId = "00000000-0000-4000-8000-000000000123";
    searchParams = new URLSearchParams(`applicationId=${applicationId}&visaType=DS160`);
    const mapped = mapDs160AnswersToInterviewProfile({
      purpose_of_trip: { value: "B", source: null },
      purpose_of_trip_specify: { value: "B1/B2", source: null },
      trip_payer_type: { value: "self", source: null },
      has_been_in_us: { value: "no", source: null },
      has_been_refused: { value: "no", source: null },
      has_traveled_last_five_years: { value: "yes", source: null },
    }, {
      form: {
        travel: {
          placesToVisit: [],
          arrivalDate: "",
          departureDate: "",
          lengthValue: "",
        },
        work: { primaryOccupation: "", employerName: "", jobTitle: "" },
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      profile: mapped.profile,
      context: {
        source: "application",
        applicationId,
        missingFields: mapped.missingFields,
        verifiedFields: mapped.verifiedFields,
        needsConfirmationFields: mapped.needsConfirmationFields,
        fieldStates: mapped.fieldStates,
        consistencyStatus: "unverified",
      },
    }), { status: 200 }));

    render(<InterviewPracticePage />);

    expect(await screen.findByDisplayValue("B1/B2 短期商务或旅游访问")).toBeInTheDocument();
    expect(screen.getByLabelText(/访问目的/u)).toHaveValue("other");
    expect(screen.getByDisplayValue("本人承担")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/无赴美记录/u)).toBeInTheDocument();
    expect(screen.getByLabelText(/目的地/u)).toHaveValue("");
    expect(screen.getAllByText("待确认").length).toBeGreaterThan(0);
    expect(screen.getAllByText("缺失").length).toBeGreaterThan(0);
  });

  it("requires the short bilingual disclaimer acknowledgement before practice", async () => {
    const session = completeProfile(createInterviewSession());
    seedSession(session);
    render(<InterviewPracticePage />);

    expect(await screen.findByText(/不是美国政府或领事馆提供的服务/u)).toBeInTheDocument();
    expect(screen.getByText(/not provided by or affiliated with the U\.S\. Government/u)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认并开始" }));
    expect(await screen.findByText(/请先阅读并确认免责声明/u)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not render an empty setup form while linked data is loading", async () => {
    searchParams = new URLSearchParams("applicationId=00000000-0000-4000-8000-000000000123&visaType=DS160");
    let resolveFetch!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve; }));
    render(<InterviewPracticePage />);
    expect(await screen.findByText("正在读取申请资料")).toBeInTheDocument();
    expect(screen.queryByLabelText(/目的地/u)).not.toBeInTheDocument();
    resolveFetch(new Response(JSON.stringify(linkedContext(completeProfile(createInterviewSession()).profile)), { status: 200 }));
    expect(await screen.findByLabelText(/目的地/u)).toBeInTheDocument();
  });

  it("shows a retryable read error instead of treating failure as missing data", async () => {
    searchParams = new URLSearchParams("applicationId=00000000-0000-4000-8000-000000000123&visaType=DS160");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "暂时无法读取申请资料，请稍后重试。" }), { status: 500 }));
    render(<InterviewPracticePage />);
    expect(await screen.findByText("申请资料读取失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重新读取" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/目的地/u)).not.toBeInTheDocument();
  });

  it("keeps setup recoverable when required fields are missing", async () => {
    render(<InterviewPracticePage />);

    acceptDisclaimer();
    fireEvent.click(await screen.findByRole("button", { name: "确认并开始" }));

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

    acceptDisclaimer();
    fireEvent.click(await screen.findByRole("button", { name: "确认并开始" }));

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
    fireEvent.click(await screen.findByRole("button", { name: "English" }));
    acceptDisclaimer();
    fireEvent.click(screen.getByRole("button", { name: "确认并开始" }));

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
    expect(screen.getByRole("button", { name: "回到资料准备" })).toBeInTheDocument();
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
    expect(await screen.findByText("资料准备")).toBeInTheDocument();
  });
});
