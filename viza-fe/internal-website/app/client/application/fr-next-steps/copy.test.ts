import { describe, expect, it } from "vitest";
import { FR_OFFICIAL_LINKS, TLS_CENTRES, centreForDepositTown, getFrNextStepsCopy } from "./copy";

function allText(locale: string, options?: Parameters<typeof getFrNextStepsCopy>[1]): string {
  const copy = getFrNextStepsCopy(locale, options);
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

function centreParagraphs(locale: string, heading: string, options?: Parameters<typeof getFrNextStepsCopy>[1]) {
  const section = getFrNextStepsCopy(locale, options).sections.find((item) => item.heading === heading);
  return (section?.content ?? [])
    .filter((block) => block.type === "paragraph")
    .map((block) => (block.type === "paragraph" ? block.text : ""))
    .slice(1);
}

describe("France next-steps guide", () => {
  it("covers booking, fees, biometrics, tracking and passport return in both languages", () => {
    for (const locale of ["zh-CN", "en"]) {
      const text = allText(locale);
      for (const href of Object.values(FR_OFFICIAL_LINKS)) expect(text).toContain(href);
      expect(text).toContain("+86 (021) 60168668");
      expect(text).toMatch(/90/);
      expect(text).toMatch(/250/);
      expect(text).toMatch(/59/);
      expect(text).toContain("2026-11-19");
      for (const centre of TLS_CENTRES) expect(text).toContain(centre.address);
      expect(text).toContain("60 Tianze Lu");
    }
  });

  it("maps the France-Visas deposit town code to its centre", () => {
    expect(centreForDepositTown("1pe")?.key).toBe("beijing");
    expect(centreForDepositTown("changsha")?.key).toBe("changsha");
    expect(centreForDepositTown("XYZ")).toBeNull();
    expect(centreForDepositTown(null)).toBeNull();
  });

  it("puts the applicant's own centre first and marks it", () => {
    const zh = centreParagraphs("zh-CN", "签证中心地址和递交时间", { depositTown: "1PE" });
    expect(zh).toHaveLength(TLS_CENTRES.length);
    expect(zh[0]).toMatch(/^【你的签证中心】北京签证中心/);
    expect(zh.filter((text) => text.startsWith("【"))).toHaveLength(1);

    const en = centreParagraphs("en", "Visa centre addresses and filing hours", { depositTown: "1PE" });
    expect(en[0]).toMatch(/^\[Your centre\] Beijing/);
  });

  it("lists every centre without a marker when the deposit town is unknown", () => {
    const en = centreParagraphs("en", "Visa centre addresses and filing hours", { depositTown: "ZZZ" });
    expect(en).toHaveLength(TLS_CENTRES.length);
    expect(en.some((text) => text.startsWith("[Your"))).toBe(false);
  });

  it("shows the France-Visas reference when known", () => {
    expect(allText("zh-CN", { applicationReference: "FRA1PE20260000001" })).toContain("FRA1PE20260000001");
  });

  it("only links to official French, TLScontact or EU sites", () => {
    for (const href of Object.values(FR_OFFICIAL_LINKS)) {
      expect(new URL(href).hostname).toMatch(/(^|\.)(france-visas\.gouv\.fr|tlscontact\.com|europa\.eu)$/);
    }
  });
});
