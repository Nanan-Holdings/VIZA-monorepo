import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, shouldSkipTranslation } from "./route";

const translateWithGoogleV2Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/translation/google-translate-v2", () => ({
  translateWithGoogleV2: translateWithGoogleV2Mock,
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/translate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/translate", () => {
  beforeEach(() => {
    translateWithGoogleV2Mock.mockResolvedValue({
      ok: true,
      translatedText: "Software engineer",
      detectedSourceLanguage: "zh-CN",
      provider: "google",
    });
  });

  it("translates text through the backend provider", async () => {
    const response = await POST(jsonRequest({
      text: "软件工程师",
      source: "zh-CN",
      target: "en",
      fieldId: "occupation",
      context: "visa_form",
    }));

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      translatedText: "Software engineer",
      provider: "google_cloud_basic",
      cached: false,
    });
  });

  it("skips non-translatable fields without calling the provider", async () => {
    const response = await POST(jsonRequest({
      text: "E12345678",
      source: "en",
      target: "zh-CN",
      fieldId: "passport_number",
      context: "visa_form",
    }));

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      skipped: true,
      translatedText: "E12345678",
      reason: "non_translatable_field",
    });
  });

  it("rejects missing target language", async () => {
    const response = await POST(jsonRequest({ text: "软件工程师" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "invalid_request",
    });
  });

  it("returns a controlled provider error without exposing a key", async () => {
    translateWithGoogleV2Mock.mockResolvedValueOnce({
      ok: false,
      code: "provider_unavailable",
      error: "Google Translate API key is not configured",
      provider: "google",
    });

    const response = await POST(jsonRequest({
      text: "软件工程师",
      source: "zh-CN",
      target: "en",
      fieldId: "occupation",
      context: "visa_form",
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      code: "provider_unavailable",
    });
    expect(JSON.stringify(body)).not.toContain("AIza");
  });

  it("detects obvious non-translatable field ids and values", () => {
    expect(shouldSkipTranslation("email", "name@example.com")).toBe(true);
    expect(shouldSkipTranslation("arrival_date", "2026-06-10")).toBe(true);
    expect(shouldSkipTranslation("occupation", "软件工程师", "text")).toBe(false);
    expect(shouldSkipTranslation("security_answer", "蓝色", "text")).toBe(true);
    expect(shouldSkipTranslation("travel_purpose", "旅游", "select")).toBe(true);
  });
});
