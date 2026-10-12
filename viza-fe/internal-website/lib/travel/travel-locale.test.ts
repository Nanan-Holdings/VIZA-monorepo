import { describe, expect, it } from "vitest";
import { localeFromRequest, parseTravelLocale, resolveRequestLocale } from "./travel-locale";

describe("Travel interface locale boundary", () => {
  it("normalizes supported regional tags only", () => {
    expect(parseTravelLocale(" EN_us ")).toBe("en");
    expect(parseTravelLocale("zh-CN")).toBe("zh");
    expect(parseTravelLocale("vi")).toBeNull();
  });

  it("matches the portal's Chinese default despite an English browser", () => {
    expect(localeFromRequest(new Request("http://localhost", {
      headers: { "accept-language": "en-US,en;q=0.9" },
    }))).toBe("zh");
  });

  it("honors the interface cookie and explicit current locale over other hints", () => {
    const request = new Request("http://localhost", {
      headers: { cookie: "session=unused; NEXT_LOCALE=zh-CN", "accept-language": "en" },
    });
    expect(localeFromRequest(request)).toBe("zh");
    expect(resolveRequestLocale(request, "en-US")).toBe("en");
    expect(resolveRequestLocale(request, "es")).toBe("zh");
  });
});
