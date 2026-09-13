import { describe, expect, it } from "vitest";
import {
  HELP_ARTICLES,
  loadAllHelpArticles,
  loadHelpArticle,
  searchHelpArticles,
} from "./index";

describe("localized help articles", () => {
  it("loads a complete English and Chinese article set", () => {
    const english = loadAllHelpArticles("en");
    const chinese = loadAllHelpArticles("zh");

    expect(english).toHaveLength(HELP_ARTICLES.length);
    expect(chinese).toHaveLength(HELP_ARTICLES.length);

    for (const [index, article] of english.entries()) {
      const translated = chinese[index];
      expect(translated.country).toBe(article.country);
      expect(translated.visaType).toBe(article.visaType);
      expect(translated.title).not.toBe(article.title);
      expect(translated.body).not.toBe(article.body);
      expect(translated.body).toMatch(/[\u3400-\u9fff]/);
    }
  });

  it("uses the selected locale for article lookup and search", () => {
    const english = loadHelpArticle("vietnam", "VN_E_VISA", "en");
    const chinese = loadHelpArticle("vietnam", "VN_E_VISA", "zh-CN");

    expect(english?.title).toBe("Vietnam e-Visa");
    expect(chinese?.title).toBe("越南电子签证");
    expect(chinese?.body).toContain("越南电子签证");
    expect(searchHelpArticles("电子", "zh")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          country: "vietnam",
          title: "越南电子签证",
        }),
      ]),
    );
  });
});
