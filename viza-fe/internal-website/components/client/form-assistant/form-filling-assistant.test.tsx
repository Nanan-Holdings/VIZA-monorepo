import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import zhMessages from "../../../messages/zh.json";
import {
  FormFillingAssistant,
  type FormFillingAssistantProps,
} from "./form-filling-assistant";

function renderAssistant(
  overrides: Partial<FormFillingAssistantProps> = {},
  provider: { locale: string; messages: typeof messages } = { locale: "en", messages },
) {
  const props: FormFillingAssistantProps = {
    applicationId: "application-id",
    locale: "en",
    progress: { completed: 2, total: 5 },
    messages: [{ id: "assistant-1", role: "assistant", content: "What is your passport number?" }],
    missingFields: [{ fieldName: "passport_number", label: "Passport number", required: true }],
    fillNotice: {
      id: "notice-1",
      items: [{ fieldName: "given_name", label: "Given name", value: "Chen", displayValue: "Chen" }],
    },
    onSend: vi.fn(),
    onTranscribe: vi.fn().mockResolvedValue("A1234567"),
    onAcknowledgeWarnings: vi.fn(),
    onUndoFill: vi.fn(),
    onDismissFillNotice: vi.fn(),
    onValidate: vi.fn(),
    onGoToReview: vi.fn(),
    ...overrides,
  };

  return {
    ...render(
      <NextIntlClientProvider locale={provider.locale} messages={provider.messages}>
        <FormFillingAssistant {...props} />
      </NextIntlClientProvider>,
    ),
    props,
  };
}

describe("FormFillingAssistant", () => {
  const originalMediaRecorder = globalThis.MediaRecorder;
  const originalMediaDevices = navigator.mediaDevices;

  afterEach(() => {
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: originalMediaRecorder,
      writable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
      writable: true,
    });
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps missing fields inside the conversation instead of rendering a jump list", () => {
    renderAssistant();

    expect(screen.getByRole("region", { name: "Form filling assistant" })).toBeInTheDocument();
    expect(screen.getByText("Form filling assistant")).toBeInTheDocument();
    expect(screen.queryByText("Details still needed")).not.toBeInTheDocument();
    expect(screen.getByText("Filled Given name: Chen")).toBeInTheDocument();
    expect(screen.queryByText("given_name")).not.toBeInTheDocument();
    expect(screen.getByText("2 of 5 fields complete")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Passport number/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review answers" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Press Enter to send/)).not.toBeInTheDocument();
  });

  it("does not render a loading answer-check action before assistant state is ready", () => {
    renderAssistant({
      loading: true,
      progress: { completed: 0, total: 0 },
      missingFields: [],
      fillNotice: null,
    });

    expect(screen.queryByRole("button", { name: "Checking answers..." })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review answers" })).not.toBeInTheDocument();
  });

  it("keeps the full conversation history available", () => {
    renderAssistant({
      messages: [
        { id: "old-assistant", role: "assistant", content: "Old question" },
        { id: "old-user", role: "user", content: "Old answer" },
        { id: "current-assistant", role: "assistant", content: "Current question" },
      ],
    });

    expect(screen.getByText("Old question")).toBeInTheDocument();
    expect(screen.getByText("Old answer")).toBeInTheDocument();
    expect(screen.getByText("Current question")).toBeInTheDocument();
  });

  it("allows scrolling upward and jumping back to the latest message", () => {
    renderAssistant({
      messages: Array.from({ length: 8 }, (_, index) => ({
        id: `message-${index}`,
        role: index % 2 === 0 ? "assistant" as const : "user" as const,
        content: `Message ${index + 1}`,
      })),
    });

    const conversation = screen.getByRole("log", { name: "Form filling assistant conversation" });
    Object.defineProperties(conversation, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 800 },
      scrollTop: { configurable: true, value: 100, writable: true },
    });
    fireEvent.scroll(conversation);

    const jumpButton = screen.getByRole("button", { name: "Jump to latest message" });
    expect(jumpButton).toHaveClass("right-3");
    expect(jumpButton).not.toHaveClass("left-1/2", "-translate-x-1/2");
    fireEvent.click(jumpButton);
    expect(conversation.scrollTop).toBe(800);
  });

  it("uses a compact single-line composer at rest", () => {
    renderAssistant();

    const composer = screen.getByRole("textbox", { name: "Message for the form filling assistant" });
    expect(composer).toHaveAttribute("rows", "1");
    expect(composer.closest(".max-w-\\[760px\\]")).toBeInTheDocument();
  });

  it("uses the shared VIZA Agent message treatment", () => {
    renderAssistant({
      messages: [
        { id: "assistant", role: "assistant", content: "Current question" },
        { id: "user", role: "user", content: "Current answer" },
      ],
    });

    expect(screen.getByText("Current question").closest(".text-gray-700")).toBeInTheDocument();
    expect(screen.getByText("Current answer").parentElement).toHaveClass("bg-brand-500");
  });

  it("offers a real undo action for a recent fill", async () => {
    const { props } = renderAssistant();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => expect(props.onUndoFill).toHaveBeenCalledWith([
      { fieldName: "given_name", label: "Given name", value: "Chen", displayValue: "Chen" },
    ]));
    expect(props.onDismissFillNotice).toHaveBeenCalledWith("notice-1");
  });

  it("shows the recent fill as a viewport-level notice", () => {
    renderAssistant();

    const notice = screen.getByTestId("form-assistant-fill-notice");
    expect(notice).toHaveClass("fixed", "z-[80]");
    expect(notice).toHaveAttribute("aria-atomic", "true");
    expect(notice).toHaveTextContent("Filled Given name: Chen");
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("dismisses the fill notice after ten seconds", () => {
    vi.useFakeTimers();
    const { props } = renderAssistant();

    act(() => vi.advanceTimersByTime(9_999));
    expect(props.onDismissFillNotice).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(props.onDismissFillNotice).toHaveBeenCalledExactlyOnceWith("notice-1");
  });

  it("starts a fresh ten-second window for a newer fill notice", () => {
    vi.useFakeTimers();
    const { props, rerender } = renderAssistant();

    act(() => vi.advanceTimersByTime(9_999));
    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FormFillingAssistant
          {...props}
          fillNotice={{
            id: "notice-2",
            items: [{
              fieldName: "surname",
              label: "Surname",
              value: "Tan",
              displayValue: "Tan",
            }],
          }}
        />
      </NextIntlClientProvider>,
    );

    act(() => vi.advanceTimersByTime(1));
    expect(props.onDismissFillNotice).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(9_999));
    expect(props.onDismissFillNotice).toHaveBeenCalledExactlyOnceWith("notice-2");
  });

  it("reviews answers before offering final review", async () => {
    const { props, rerender } = renderAssistant({ missingFields: [] });
    const conversation = screen.getByRole("log", { name: "Form filling assistant conversation" });

    expect(within(conversation).getByTestId("form-assistant-review-action")).toBeInTheDocument();
    fireEvent.click(within(conversation).getByRole("button", { name: "Review answers" }));
    expect(props.onValidate).toHaveBeenCalledOnce();
    expect(props.onGoToReview).not.toHaveBeenCalled();
    await waitFor(() => expect(within(conversation).getByRole("button", { name: "Review answers" })).toBeEnabled());

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FormFillingAssistant
          {...props}
          missingFields={[]}
          validationResult={{ errors: [], warnings: [], warningsAcknowledged: true }}
        />
      </NextIntlClientProvider>,
    );
    expect(within(conversation).getByTestId("form-assistant-review-action")).toBeInTheDocument();
    fireEvent.click(within(conversation).getByRole("button", { name: "Go to final review" }));
    expect(props.onGoToReview).toHaveBeenCalledOnce();
    await waitFor(() => expect(within(conversation).getByRole("button", { name: "Go to final review" })).toBeEnabled());
  });

  it("uses the Chinese two-stage review labels", () => {
    renderAssistant(
      { missingFields: [], locale: "zh", isZh: true },
      { locale: "zh", messages: zhMessages },
    );

    expect(screen.getByRole("button", { name: "审核答案" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "进入最终审核页面" })).not.toBeInTheDocument();
  });

  it("shows a retryable error when the final-review action fails", async () => {
    const onValidate = vi.fn().mockRejectedValue(new Error("network failed"));
    renderAssistant({
      missingFields: [],
      onValidate,
    });
    const conversation = screen.getByRole("log", { name: "Form filling assistant conversation" });

    fireEvent.click(within(conversation).getByRole("button", { name: "Review answers" }));

    expect(await within(conversation).findByRole("alert")).toHaveTextContent(
      "We couldn't check your answers or open final review. Please try again.",
    );
    fireEvent.click(within(conversation).getByRole("button", { name: "Review answers" }));
    await waitFor(() => expect(onValidate).toHaveBeenCalledTimes(2));
  });

  it("shows validation failures beside the final-review action", () => {
    renderAssistant({
      missingFields: [],
      validationResult: {
        errors: [{ id: "invalid-option", message: "Nationality must use an official option." }],
        warnings: [],
      },
    });
    const conversation = screen.getByRole("log", { name: "Form filling assistant conversation" });

    expect(within(conversation).getByText("Answer check")).toBeInTheDocument();
    expect(within(conversation).getByText("Nationality must use an official option.")).toBeInTheDocument();
    expect(within(conversation).getByRole("button", { name: "Review final answers" })).toBeInTheDocument();
  });

  it("offers inline editing and an original-form jump for every field issue", () => {
    const onJumpToIssue = vi.fn();
    renderAssistant({
      missingFields: [],
      validationResult: {
        errors: [{
          id: "invalid-nationality",
          fieldName: "nationality",
          message: "Nationality must use an official option.",
          severity: "error",
        }],
        warnings: [],
      },
      renderIssueField: (issue) => (
        <label>
          Nationality
          <input aria-label="Nationality" defaultValue={issue.fieldName} />
        </label>
      ),
      onJumpToIssue,
    });

    expect(screen.getByRole("textbox", { name: "Nationality" })).toHaveValue("nationality");
    fireEvent.click(screen.getByRole("button", { name: "Edit in the original form" }));
    expect(onJumpToIssue).toHaveBeenCalledExactlyOnceWith("nationality");
  });

  it("requires another validation after an edited passing result", async () => {
    const { props } = renderAssistant({
      missingFields: [],
      validationResult: {
        errors: [],
        warnings: [],
        warningsAcknowledged: true,
        dirty: true,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Review final answers" }));
    await waitFor(() => expect(props.onValidate).toHaveBeenCalledOnce());
    expect(props.onGoToReview).not.toHaveBeenCalled();
  });

  it("revalidates an edited warning instead of acknowledging stale risk", async () => {
    const { props } = renderAssistant({
      missingFields: [],
      validationResult: {
        errors: [],
        warnings: [{ id: "timing", message: "Please confirm the timing." }],
        warningsAcknowledged: false,
        dirty: true,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Review final answers" }));
    await waitFor(() => expect(props.onValidate).toHaveBeenCalledOnce());
    expect(props.onAcknowledgeWarnings).not.toHaveBeenCalled();
  });

  it("keeps warning acknowledgement in the conversation before final review", async () => {
    const { props } = renderAssistant({
      missingFields: [],
      validationResult: {
        errors: [],
        warnings: [{ id: "warning", message: "Please confirm the timing warning." }],
        warningsAcknowledged: false,
      },
    });
    const conversation = screen.getByRole("log", { name: "Form filling assistant conversation" });

    fireEvent.click(within(conversation).getByRole("button", { name: "Keep these answers and continue" }));
    expect(props.onAcknowledgeWarnings).toHaveBeenCalledOnce();
    expect(props.onValidate).not.toHaveBeenCalled();
    expect(props.onGoToReview).not.toHaveBeenCalled();
    await waitFor(() => expect(within(conversation).getByRole("button", { name: "Keep these answers and continue" })).toBeEnabled());
  });

  it("sends only explicit text submissions", () => {
    const { props } = renderAssistant();
    const textarea = screen.getByRole("textbox", { name: "Message for the form filling assistant" });

    fireEvent.change(textarea, { target: { value: "My passport number is A1234567" } });
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

    expect(props.onSend).toHaveBeenCalledWith("My passport number is A1234567");
    expect(textarea).toHaveValue("");
  });

  it("transcribes a recording into the composer without sending it", async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });

    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state: RecordingState = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) } as BlobEvent);
        this.onstop?.();
      }
    }

    type RecordingState = "inactive" | "recording";
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: MockMediaRecorder,
      writable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
      writable: true,
    });

    const { props } = renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ audio: true }));
    fireEvent.click(screen.getByRole("button", { name: "Stop voice input" }));

    const textarea = screen.getByRole("textbox", { name: "Message for the form filling assistant" });
    await waitFor(() => expect(textarea).toHaveValue("A1234567"));
    expect(props.onSend).not.toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
  });

  it("keeps typing available when microphone permission is denied", async () => {
    class PermissionMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
    }
    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: PermissionMediaRecorder,
      writable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("NotAllowedError")) },
      writable: true,
    });

    renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Microphone access was not granted");
    expect(screen.getByRole("textbox", { name: "Message for the form filling assistant" })).toBeEnabled();
  });

  it("cancels recording without calling transcription", async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: trackStop }] });

    class CancelMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      state: "inactive" | "recording" = "inactive";
      mimeType = "audio/webm";
      onstop: (() => void) | null = null;
      ondataavailable: ((event: BlobEvent) => void) | null = null;

      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }

    Object.defineProperty(globalThis, "MediaRecorder", {
      configurable: true,
      value: CancelMediaRecorder,
      writable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
      writable: true,
    });

    const { props } = renderAssistant();
    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Start voice input" })).toBeInTheDocument());
    expect(props.onTranscribe).not.toHaveBeenCalled();
    expect(trackStop).toHaveBeenCalled();
  });
});
