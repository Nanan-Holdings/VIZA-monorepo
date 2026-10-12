import { describe, expect, it } from "vitest";
import { fillLinkPlaceholder, fillLinkPlaceholders } from "../captions";

const url = "https://viza.it.com/blog/sg-arrival-card-myica-app-september-30";

describe("fillLinkPlaceholder", () => {
  it("puts the real link into feed captions", () => {
    expect(fillLinkPlaceholder("facebook", "Update the app first. Details: {url}", url)).toBe(`Update the app first. Details: ${url}`);
    expect(fillLinkPlaceholder("linkedin", "Read more: {url}\n\n#visa", url)).toBe(`Read more: ${url}\n\n#visa`);
  });

  it("points Instagram at the bio, where links work", () => {
    expect(fillLinkPlaceholder("instagram", "Check official sources. More: {url}", url)).toBe("Check official sources. Link in bio.");
  });

  it("drops the phrase on Pinterest, whose pin carries the link", () => {
    expect(fillLinkPlaceholder("pinterest", "Confirm requirements with official sources. Read: {url}", url)).toBe("Confirm requirements with official sources.");
  });

  it("drops the phrase when there is no destination", () => {
    expect(fillLinkPlaceholder("facebook", "News. Details: {url}")).toBe("News.");
  });

  it("leaves captions without a placeholder alone", () => {
    expect(fillLinkPlaceholder("facebook", `Already linked ${url}`, url)).toBe(`Already linked ${url}`);
  });

  it("fills every platform of a composition", () => {
    const filled = fillLinkPlaceholders({ facebook: "A {url}", instagram: "B {url}", pinterest: "C {url}" }, url);
    expect(filled).toEqual({ facebook: `A ${url}`, instagram: "B Link in bio.", pinterest: "C" });
  });
});
