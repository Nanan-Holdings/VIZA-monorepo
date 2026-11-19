import { describe, expect, it } from "vitest";
import { CHINA_POSTS, US_OFFICIAL_LINKS, getUsNextStepsCopy } from "./copy";

function allText(locale: string, options?: Parameters<typeof getUsNextStepsCopy>[1]): string {
  const copy = getUsNextStepsCopy(locale, options);
  return copy.sections
    .flatMap((section) => [
      section.heading,
      ...section.content.flatMap((block) =>
        block.type === "list"
          ? block.items
          : block.type === "links"
            ? block.items.map((item) => `${item.label} ${item.href}`)
            : [block.text],
      ),
    ])
    .join("\n");
}

describe("US DS-160 next-steps guide", () => {
  it("covers booking, interview day, after the interview and EVUS in both languages", () => {
    for (const locale of ["zh-CN", "en"]) {
      const text = allText(locale);
      expect(text).toContain(US_OFFICIAL_LINKS.scheduling);
      expect(text).toContain(US_OFFICIAL_LINKS.ceacStatus);
      expect(text).toContain(US_OFFICIAL_LINKS.evus);
      expect(text).toMatch(/185/);
      expect(text).toMatch(/31\.75/);
      expect(text).toMatch(/221\(g\)/);
      for (const post of CHINA_POSTS) expect(text).toContain(post.citicEn);
    }
  });

  it("puts the applicant's own interview post first and marks it", () => {
    const zh = getUsNextStepsCopy("zh-CN", { postCode: "shg", applicationId: "AA00TEST01" });
    const locations = zh.sections.find((section) => section.heading === "面签地点和开放时间");
    const first = locations?.content[0];
    expect(first?.type === "paragraph" ? first.text : "").toMatch(/^【你的面签地点】美国驻上海总领事馆/);
    expect(allText("zh-CN", { postCode: "SHG", applicationId: "AA00TEST01" })).toContain("AA00TEST01");
  });

  it("lists every post without a marker when the post is unknown", () => {
    const en = getUsNextStepsCopy("en", { postCode: "Pending - confirm at appointment" });
    const locations = en.sections.find((section) => section.heading === "Interview locations and hours");
    const paragraphs = locations?.content.filter((block) => block.type === "paragraph") ?? [];
    expect(paragraphs).toHaveLength(CHINA_POSTS.length);
    expect(paragraphs.some((block) => block.type === "paragraph" && block.text.startsWith("[Your"))).toBe(false);
  });

  it("only links to official U.S. government or authorized sites", () => {
    for (const href of Object.values(US_OFFICIAL_LINKS)) {
      expect(new URL(href).hostname).toMatch(/(^|\.)(ustraveldocs\.com|usvisascheduling\.com|state\.gov|evus\.gov|usembassy-china\.org\.cn)$/);
    }
  });
});
