import { describe, expect, it } from "vitest";
import { isAllowedTaiwanLiveViewUrl } from "@/lib/taiwan-handoff-url";

describe("isAllowedTaiwanLiveViewUrl", () => {
  it("accepts Browserbase HTTPS live views", () => {
    expect(isAllowedTaiwanLiveViewUrl("https://www.browserbase.com/live/session")).toBe(true);
    expect(isAllowedTaiwanLiveViewUrl("https://live.browserbase.io/session")).toBe(true);
  });

  it("rejects lookalike, insecure, and malformed URLs", () => {
    expect(isAllowedTaiwanLiveViewUrl("https://browserbase.com.evil.example/session")).toBe(false);
    expect(isAllowedTaiwanLiveViewUrl("http://www.browserbase.com/session")).toBe(false);
    expect(isAllowedTaiwanLiveViewUrl("not-a-url")).toBe(false);
  });
});
