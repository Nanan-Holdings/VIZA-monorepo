import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { linkifyText } from "../help-article";

function links(text: string) {
  const { container } = render(<p>{linkifyText(text)}</p>);
  return [...container.querySelectorAll("a")].map((a) => ({ text: a.textContent, href: a.getAttribute("href"), target: a.getAttribute("target") }));
}

describe("linkifyText", () => {
  it("links bare official domains in Chinese text without swallowing punctuation", () => {
    expect(links("信息网站 ustraveldocs.com/cn，登录、缴费和预约在 usvisascheduling.com。")).toEqual([
      { text: "ustraveldocs.com/cn", href: "https://ustraveldocs.com/cn", target: "_blank" },
      { text: "usvisascheduling.com", href: "https://usvisascheduling.com", target: "_blank" },
    ]);
  });

  it("links emails as mailto and leaves ordinary text alone", () => {
    expect(links("邮箱：support-china@usvisascheduling.com")).toEqual([
      { text: "support-china@usvisascheduling.com", href: "mailto:support-china@usvisascheduling.com", target: null },
    ]);
    expect(links("No. 55 An Jia Lou Lu, B1/B2, U.S. Embassy, 5cm × 5cm")).toEqual([]);
  });

  it("keeps an existing https URL as-is", () => {
    expect(links("Prepay at https://vfs.gtspremium.com/ now")[0]?.href).toBe("https://vfs.gtspremium.com/");
  });
});
