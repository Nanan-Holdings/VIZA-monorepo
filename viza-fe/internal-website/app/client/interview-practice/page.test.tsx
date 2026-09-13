import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({ locale: "en" as "en" | "zh" }));

vi.mock("next-intl", () => ({
  useLocale: () => testState.locale,
}));

vi.mock("./_hooks/use-live-talking", () => ({
  useLiveTalking: () => ({
    status: "idle",
    stream: null,
    isSpeaking: false,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    speak: vi.fn().mockResolvedValue(false),
    interrupt: vi.fn().mockResolvedValue(undefined),
  }),
}));

import InterviewPracticePage from "./page";

function completeResponse(reply = "Thanks for the answer.") {
  const encoder = new TextEncoder();
  const chunks = [`data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`, "data: [DONE]\n\n"];
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: vi.fn(async () => {
          if (index >= chunks.length) return { done: true, value: undefined };
          return { done: false, value: encoder.encode(chunks[index++]) };
        }),
      }),
    },
  } as unknown as Response;
}

function setupFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    return url.includes("/api/interview/report")
      ? new Response(JSON.stringify({
          overallScore: 72,
          passLikelihood: "中",
          dimensions: { clarity: 75, confidence: 70, consistency: 68, narrativeAlignment: 76 },
          strengths: ["Good"],
          improvements: ["Improve"],
          questionAnalysis: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } })
      : completeResponse();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function advanceToOfficer() {
  fireEvent.click(screen.getByRole("button", { name: /Start practice interview|开始模拟面试/ }));
  const checklistItems = [
    /Passport|护照/,
    /DS-160/,
    /Interview appointment|面试预约/,
    /Recent color|近期白底/,
    /Bank statements|银行流水/,
    /Employment letter|在职证明/,
  ];
  for (const item of checklistItems) {
    fireEvent.click(screen.getByRole("button", { name: item }));
  }
  fireEvent.click(screen.getByRole("button", { name: /Next: choose|下一步：选择/ }));
  await waitFor(() => expect(screen.getByRole("heading", { name: /Who would you like|你想和谁/ })).toBeInTheDocument());
}

describe("Interview practice locale behavior", () => {
  beforeEach(() => {
    testState.locale = "en";
    vi.restoreAllMocks();
    setupFetch();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => []) },
    });
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders English start and checklist stages", async () => {
    render(<InterviewPracticePage />);
    expect(screen.getByRole("button", { name: "▶ Start practice interview" })).toBeInTheDocument();
    expect(screen.getByText("Key features")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "▶ Start practice interview" }));
    expect(await screen.findByRole("heading", { name: "Confirm your materials" })).toBeInTheDocument();
    expect(screen.getByText("Interview preparation")).toBeInTheDocument();
    expect(screen.getByText("Next: choose an officer")).toBeInTheDocument();
  });

  it("switches to Chinese without losing the selected officer or route stage", async () => {
    const view = render(<InterviewPracticePage />);
    await advanceToOfficer();

    fireEvent.click(screen.getByRole("button", { name: /Chen/ }));
    expect(screen.getAllByText("Chen · Fast-paced")).toHaveLength(2);

    act(() => {
      testState.locale = "zh";
      view.rerender(<InterviewPracticePage />);
    });

    expect(screen.getByRole("heading", { name: "你想和谁练习？" })).toBeInTheDocument();
    expect(screen.getByText("当前选择：")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chen.*快速型/ })).toBeInTheDocument();
  });

  it("uses the selected locale for speech recognition and interview requests", async () => {
    const fetchMock = setupFetch();
    const recognitionInstances: Array<{
      lang: string;
      start: ReturnType<typeof vi.fn>;
      onerror?: (event: unknown) => void;
    }> = [];
    class FakeSpeechRecognition {
      lang = "";
      start = vi.fn();
      stop = vi.fn();
      continuous = false;
      interimResults = false;
      onresult?: (event: unknown) => void;
      onend?: () => void;
      onerror?: (event: unknown) => void;

      constructor() {
        recognitionInstances.push(this);
      }
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: FakeSpeechRecognition });

    const view = render(<InterviewPracticePage />);
    await advanceToOfficer();
    act(() => {
      testState.locale = "zh";
      view.rerender(<InterviewPracticePage />);
    });
    fireEvent.click(screen.getByRole("button", { name: "开始模拟面试" }));
    expect(await screen.findByText("当前问题")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "开始说话" }));
    expect(recognitionInstances[0]?.lang).toBe("zh-CN");
    act(() => recognitionInstances[0]?.onerror?.({ error: "not-allowed" }));

    const input = screen.getByPlaceholderText("输入回答，Enter 发送，Shift+Enter 换行");
    fireEvent.change(input, { target: { value: "我计划去纽约旅行两周，费用由我自己承担。" } });
    fireEvent.click(screen.getByRole("button", { name: "发送回答" }));
    await waitFor(() => {
      const interviewCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/interview"));
      expect(interviewCall).toBeDefined();
      expect(JSON.parse(String((interviewCall?.[1] as RequestInit).body)).locale).toBe("zh");
    });
  });
});
