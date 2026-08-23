import { describe, expect, it } from "vitest";
import {
  classifySpeechError,
  isRecoverableSpeechError,
  nextSpeechStatusAfterEnd,
  normalizeSpeechLanguage,
} from "./use-browser-speech";

describe("browser speech state helpers", () => {
  it("normalizes Chinese and English recognition language", () => {
    expect(normalizeSpeechLanguage("zh-CN")).toBe("zh-CN");
    expect(normalizeSpeechLanguage("zh-Hans")).toBe("zh-CN");
    expect(normalizeSpeechLanguage("en")).toBe("en-US");
    expect(normalizeSpeechLanguage("en-US")).toBe("en-US");
  });

  it("classifies recoverable browser speech failures", () => {
    expect(classifySpeechError("not-allowed")).toBe("permission_denied");
    expect(classifySpeechError("service-not-allowed")).toBe("permission_denied");
    expect(classifySpeechError("no-speech")).toBe("no_speech");
    expect(classifySpeechError("audio-capture")).toBe("audio_capture");
    expect(classifySpeechError("network")).toBe("network");
    expect(isRecoverableSpeechError("permission_denied")).toBe(true);
    expect(isRecoverableSpeechError("no_speech")).toBe(true);
    expect(isRecoverableSpeechError("unsupported")).toBe(false);
  });

  it("settles stop/onend races back to a text-input-safe idle state", () => {
    expect(nextSpeechStatusAfterEnd("listening")).toBe("idle");
    expect(nextSpeechStatusAfterEnd("stopping")).toBe("idle");
    expect(nextSpeechStatusAfterEnd("error")).toBe("idle");
    expect(nextSpeechStatusAfterEnd("unsupported")).toBe("unsupported");
  });
});
