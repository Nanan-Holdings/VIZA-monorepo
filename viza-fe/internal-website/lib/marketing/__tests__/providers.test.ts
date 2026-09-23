import { afterEach, describe, expect, it, vi } from "vitest";
import { createZernioPosts } from "../providers/zernio";
import { generateBlogDraft } from "../providers/openrouter";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

describe("marketing providers fail closed", () => {
  it("does not call Zernio without VIZA-owned configuration", async () => {
    delete process.env.ZERNIO_API_KEY;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(createZernioPosts({ compositionId: "00000000-0000-4000-8000-000000000000", title: "Test", platforms: ["x"], platformContent: { x: "hello" }, publishNow: true })).rejects.toThrow("ZERNIO_API_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires an explicit OpenRouter model", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    delete process.env.VIZA_MARKETING_OPENROUTER_MODEL;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(generateBlogDraft("en", "A cautious guide")).rejects.toThrow("VIZA_MARKETING_OPENROUTER_MODEL");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
