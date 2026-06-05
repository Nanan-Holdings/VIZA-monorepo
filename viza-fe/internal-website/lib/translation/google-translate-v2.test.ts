import { afterEach, describe, expect, it, vi } from "vitest";
import { translateWithGoogleV2 } from "@/lib/translation/google-translate-v2";

const ENV_KEYS = [
  "TRANSLATION_PROVIDER",
  "GOOGLE_TRANSLATE_API_VERSION",
  "GOOGLE_TRANSLATE_API_KEY",
  "TRANSLATION_MAX_CHARS_PER_REQUEST",
] as const;

const originalEnv = new Map<string, string | undefined>(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

function setEnv(key: (typeof ENV_KEYS)[number], value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    setEnv(key, originalEnv.get(key));
  }
  vi.unstubAllGlobals();
});

describe("translateWithGoogleV2", () => {
  it("returns provider_unavailable when the API key is missing", async () => {
    setEnv("TRANSLATION_PROVIDER", "google");
    setEnv("GOOGLE_TRANSLATE_API_VERSION", "v2");
    setEnv("GOOGLE_TRANSLATE_API_KEY", undefined);

    const result = await translateWithGoogleV2({
      text: "硬件工程师",
      sourceLanguage: "zh-CN",
      targetLanguage: "en",
      fieldType: "occupation",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "provider_unavailable",
      provider: "google",
    });
  });

  it("posts a Basic v2 translation request from the server boundary", async () => {
    setEnv("TRANSLATION_PROVIDER", "google");
    setEnv("GOOGLE_TRANSLATE_API_VERSION", "v2");
    setEnv("GOOGLE_TRANSLATE_API_KEY", "test-google-key");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("https://translation.googleapis.com/language/translate/v2");
      expect(String(input)).toContain("key=test-google-key");
      expect(JSON.parse(String(init?.body))).toEqual({
        q: "硬件工程师",
        source: "zh-CN",
        target: "en",
        format: "text",
      });

      return new Response(
        JSON.stringify({
          data: {
            translations: [
              {
                translatedText: "Hardware engineer",
                detectedSourceLanguage: "zh-CN",
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateWithGoogleV2({
      text: "硬件工程师",
      sourceLanguage: "zh-CN",
      targetLanguage: "en",
      fieldType: "occupation",
    });

    expect(result).toMatchObject({
      ok: true,
      translatedText: "Hardware engineer",
      detectedSourceLanguage: "zh-CN",
      provider: "google",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
