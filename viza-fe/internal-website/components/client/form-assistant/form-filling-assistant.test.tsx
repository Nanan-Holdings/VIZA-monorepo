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
    aiFilledFieldNames: ["given_name"],
    onSend: vi.fn(),
    onTranscribe: vi.fn().mockResolvedValue("A1234567"),
    onValidate: vi.fn(),
    onAcknowledgeWarnings: vi.fn(),
    onGoToField: vi.fn(),
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

  it("renders the expanded assistant with missing and AI-filled field summaries", () => {
    const { props } = renderAssistant();

    expect(screen.getByRole("region", { name: "Form filling assistant" })).toBeInTheDocument();
    expect(screen.getByText("Form filling assistant")).toBeInTheDocument();
    expect(screen.getByText("Details still needed")).toBeInTheDocument();
    expect(screen.getByText("Filled with your confirmed information")).toBeInTheDocument();
    expect(screen.getByText("2 of 5 fields complete")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Passport number/ }));
    expect(props.onGoToField).toHaveBeenCalledWith("passport_number");
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
