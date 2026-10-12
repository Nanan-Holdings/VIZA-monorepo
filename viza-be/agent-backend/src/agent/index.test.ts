import { afterEach, describe, expect, it, vi } from "vitest";

import { streamChat } from "./index.js";

const FALLBACK_EN =
  "I'm sorry, the AI service is not configured yet. Please contact support.";
const FALLBACK_ZH = "抱歉，AI 服务尚未配置。请联系支持团队。";

describe("streamChat configuration fallback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["English", "en", FALLBACK_EN],
    ["Simplified Chinese", "zh", FALLBACK_ZH],
    ["omitted locale", undefined, FALLBACK_EN],
  ] as const)("returns the %s fallback", async (_name, locale, expected) => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const callbacks = {
      onToken: vi.fn(),
      onComplete: vi.fn().mockResolvedValue(undefined),
      onError: vi.fn(),
    };

    await streamChat(
      [{ role: "user", content: "What visa do I need?" }],
      callbacks,
      undefined,
      undefined,
      locale
    );

    expect(callbacks.onToken).toHaveBeenCalledWith(expected);
    expect(callbacks.onComplete).toHaveBeenCalledWith(expected, []);
    expect(callbacks.onError).not.toHaveBeenCalled();
  });
});
