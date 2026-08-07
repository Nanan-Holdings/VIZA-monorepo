import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../messages/en.json";
import {
  FormFillingAssistant,
  type FormFillingAssistantProps,
} from "./form-filling-assistant";

function renderAssistant(overrides: Partial<FormFillingAssistantProps> = {}) {
  const props: FormFillingAssistantProps = {
    applicationId: "application-id",
    locale: "en",
    progress: { completed: 2, total: 5 },
    messages: [{ id: "assistant-1", role: "assistant", content: "What is your passport number?" }],
    missingFields: [{ fieldName: "passport_number", label: "Passport number", required: true }],
    aiFilledFieldLabels: ["Given name"],
    onSend: vi.fn(),
    onTranscribe: vi.fn().mockResolvedValue("A1234567"),
    onValidate: vi.fn(),
    onAcknowledgeWarnings: vi.fn(),
    onGoToReview: vi.fn(),
    ...overrides,
  };

  return {
    ...render(
      <NextIntlClientProvider locale="en" messages={messages}>
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
  });

  it("keeps missing fields inside the conversation instead of rendering a jump list", () => {
    renderAssistant();

    expect(screen.getByRole("region", { name: "Form filling assistant" })).toBeInTheDocument();
    expect(screen.getByText("Form filling assistant")).toBeInTheDocument();
    expect(screen.queryByText("Details still needed")).not.toBeInTheDocument();
    expect(screen.getByText("Completed: Given name")).toBeInTheDocument();
    expect(screen.queryByText("given_name")).not.toBeInTheDocument();
    expect(screen.getByText("2 of 5 fields complete")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Passport number/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check my answers" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Press Enter to send/)).not.toBeInTheDocument();
  });

  it("does not render a loading answer-check action before assistant state is ready", () => {
    renderAssistant({
      loading: true,
      progress: { completed: 0, total: 0 },
      missingFields: [],
      aiFilledFieldLabels: [],
    });

    expect(screen.queryByRole("button", { name: "Checking answers..." })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check my answers" })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Jump to latest message" }));
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

  it("offers final checking only after required fields are complete", () => {
    const { props, rerender } = renderAssistant({ missingFields: [] });

    fireEvent.click(screen.getByRole("button", { name: "Check my answers" }));
    expect(props.onValidate).toHaveBeenCalledOnce();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <FormFillingAssistant
          {...props}
          missingFields={[]}
          validationResult={{ errors: [], warnings: [], warningsAcknowledged: true }}
        />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue to review" }));
    expect(props.onGoToReview).toHaveBeenCalledOnce();
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
