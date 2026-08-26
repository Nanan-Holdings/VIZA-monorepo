import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanInterviewerSpeechText,
  interviewerSpeechTuning,
  playInterviewerSpeech,
  selectInterviewerVoice,
  useInterviewerTts,
  type SpeechVoiceLike,
} from "./use-interviewer-tts";

function voice(input: Partial<SpeechVoiceLike> & Pick<SpeechVoiceLike, "lang" | "name">): SpeechVoiceLike {
  return {
    default: false,
    localService: true,
    voiceURI: input.name,
    ...input,
  };
}

describe("interviewer TTS", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("prefers an exact locale before a high-quality related locale", () => {
    const exact = voice({ name: "Standard Mandarin", lang: "zh-CN" });
    const related = voice({ name: "Natural Mandarin Online", lang: "zh-TW", localService: false });
    expect(selectInterviewerVoice([related, exact], "zh-CN")).toBe(exact);
  });

  it("prefers a natural or enhanced voice among exact locale matches", () => {
    const basic = voice({ name: "English US", lang: "en-US", default: true });
    const natural = voice({ name: "English US Natural Online", lang: "en-US", localService: false });
    expect(selectInterviewerVoice([basic, natural], "en-US")).toBe(natural);
  });

  it("falls back to the browser default when no language-compatible voice exists", () => {
    expect(selectInterviewerVoice([voice({ name: "Deutsch", lang: "de-DE" })], "en-US")).toBeNull();
  });

  it("uses calm locale-specific parameters and cancels before every playback", () => {
    expect(interviewerSpeechTuning("zh-CN")).toEqual({ rate: 0.92, pitch: 1, volume: 1 });
    expect(interviewerSpeechTuning("en-US")).toEqual({ rate: 0.96, pitch: 1, volume: 1 });
    const events: string[] = [];
    const utterances: Array<Record<string, unknown>> = [];
    const synthesis = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getVoices: vi.fn(() => []),
      cancel: vi.fn(() => events.push("cancel")),
      speak: vi.fn(() => events.push("speak")),
    };
    const createUtterance = (text: string) => {
      const utterance = { text, lang: "", rate: 1, pitch: 1, volume: 1, voice: null };
      utterances.push(utterance);
      return utterance;
    };

    playInterviewerSpeech({ synthesis, createUtterance, text: "中文问题？", language: "zh-CN" });
    playInterviewerSpeech({ synthesis, createUtterance, text: "English question?", language: "en-US" });

    expect(events).toEqual(["cancel", "speak", "cancel", "speak"]);
    expect(utterances).toEqual([
      expect.objectContaining({ lang: "zh-CN", rate: 0.92, pitch: 1, volume: 1 }),
      expect.objectContaining({ lang: "en-US", rate: 0.96, pitch: 1, volume: 1 }),
    ]);
  });

  it("cleans markdown and bullets without changing question punctuation", () => {
    expect(cleanInterviewerSpeechText("## **问题**\n- 请说明 [访问目的](https://example.invalid)。\n- Why now?"))
      .toBe("问题。请说明 访问目的。Why now?");
  });

  it("waits for voiceschanged when voices are initially unavailable", () => {
    vi.useFakeTimers();
    let voices: SpeechSynthesisVoice[] = [];
    let voicesChanged: (() => void) | null = null;
    const synthesis = {
      getVoices: vi.fn(() => voices),
      cancel: vi.fn(),
      speak: vi.fn(),
      addEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
        if (event === "voiceschanged") voicesChanged = listener as () => void;
      }),
      removeEventListener: vi.fn(),
    };
    class FakeUtterance {
      lang = "";
      pitch = 1;
      rate = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;
      constructor(public text: string) {}
    }
    vi.stubGlobal("speechSynthesis", synthesis);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    const { result } = renderHook(() => useInterviewerTts("zh-CN"));

    act(() => { result.current.play("请说明访问目的。"); });
    expect(synthesis.speak).not.toHaveBeenCalled();
    voices = [voice({ name: "Mandarin Natural", lang: "zh-CN" }) as SpeechSynthesisVoice];
    act(() => { voicesChanged?.(); });

    expect(synthesis.speak).toHaveBeenCalledTimes(1);
    expect(synthesis.speak.mock.calls[0]?.[0]).toMatchObject({
      lang: "zh-CN",
      rate: 0.92,
      voice: expect.objectContaining({ name: "Mandarin Natural" }),
    });
    expect(result.current.selectedVoiceName).toBe("Mandarin Natural");
  });
});
