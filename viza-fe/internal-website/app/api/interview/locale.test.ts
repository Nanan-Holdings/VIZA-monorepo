import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as interview } from "./route";
import { POST as report } from "./report/route";

function request(path: string, body: unknown, locale: string) {
  return new NextRequest(`http://localhost/api/interview${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `NEXT_LOCALE=${locale}` },
    body: JSON.stringify(body),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("interview language alignment", () => {
  it.each(["en", "zh"])("uses the %s interface cookie for offline replies and validation", async (locale) => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await interview(request("", { messages: [] }, locale));
    const text = await response.text();
    expect(text).toContain(locale === "en" ? "What is the main purpose" : "这次去美国");
    const invalid = await report(request("/report", { messages: [] }, locale));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toContain(locale === "en" ? "not enough answers" : "对话记录不足");
  });

  it("sends the selected language to the interviewer despite earlier Chinese answers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await interview(request("", {
      locale: "en",
      messages: [{ role: "user", content: "我打算去纽约" }],
    }, "zh"));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Respond only in English");
    expect(body.messages[1].content).toBe("我打算去纽约");
  });

  it("localizes report fallback labels without rewriting the applicant's answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const body = { messages: [
      { role: "assistant", content: "Who will pay for your trip?" },
      { role: "user", content: "我使用自己的存款，预算是20000元。" },
    ] };
    const english = await (await report(request("/report", body, "en"))).json();
    const chinese = await (await report(request("/report", body, "zh"))).json();
    expect(english.questionAnalysis[0].topic).toBe("Funding");
    expect(chinese.questionAnalysis[0].topic).toBe("资金");
    expect(english.questionAnalysis[0].flagLabel).not.toMatch(/[\p{Script=Han}]/u);
    expect(english.questionAnalysis[0].answer).toBe(body.messages[1].content);
    expect(english.improvements.join(" ")).not.toMatch(/[\p{Script=Han}]/u);
  });
});
