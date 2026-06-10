import { describe, expect, it, vi } from "vitest";
import { POST, shouldSkipTranslation } from "./route";

vi.mock("@/lib/translation/google-translate-v2", () => ({
  translateWithGoogleV2: vi.fn(async () => ({
    ok: true,
    translatedText: "Software engineer",
    detectedSourceLanguage: "zh-CN",
    provider: "google",
  })),
}));

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/translate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/translate", () => {
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
      provider: "google",
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

  it("detects obvious non-translatable field ids and values", () => {
    expect(shouldSkipTranslation("email", "name@example.com")).toBe(true);
    expect(shouldSkipTranslation("arrival_date", "2026-06-10")).toBe(true);
    expect(shouldSkipTranslation("occupation", "软件工程师")).toBe(false);
  });
});
