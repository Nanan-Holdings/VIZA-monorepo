import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BlockMessage } from "../block-message";

vi.mock("next-intl", () => ({
  useLocale: () => "zh-CN",
}));

describe("BlockMessage", () => {
  it("localizes a stored Singapore arrival-card redirect for Chinese users", () => {
    render(
      <BlockMessage
        payload={{
          blockType: "application_redirect",
          title: "Open Singapore application form",
          description: "Continue to the SG Arrival Card form.",
          fields: [],
          saveTarget: "application_redirect",
          redirectUrl:
            "/client/application?country=singapore&visaType=SG_ARRIVAL_CARD",
          ctaLabel: "Open form",
          country: "singapore",
          visaType: "SG_ARRIVAL_CARD",
        }}
      />
    );

    expect(screen.getByText("填写新加坡电子入境卡")).toBeInTheDocument();
    expect(screen.getByText("开始填写")).toBeInTheDocument();
    expect(screen.queryByText(/SG Arrival Card/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /开始填写/ })).toHaveAttribute(
      "href",
      "/client/application?country=singapore&visaType=SG_ARRIVAL_CARD"
    );
  });

  it("marks an official-only travel authorization as an external government redirect", () => {
    render(
      <BlockMessage
        payload={{
          blockType: "application_redirect",
          title: "前往官方页面办理英国电子旅行许可",
          description: "VIZA 暂未提供该手续的内部表单，请在政府官方网站继续办理。",
          fields: [],
          saveTarget: "application_redirect",
          redirectUrl:
            "https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta",
          ctaLabel: "打开官方页面",
          country: "uk",
          visaType: "UK_ETA",
          productCode: "UK_ETA",
          productKind: "travel_authorization",
          provider: "official",
          requirement: "required",
          supportLevel: "official_redirect",
        }}
      />
    );

    expect(
      screen.getByText("该手续暂未提供 VIZA 内部代填，将前往官方页面办理。")
    ).toBeInTheDocument();
    expect(screen.queryByText("UK_ETA")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /打开官方页面/ })).toHaveAttribute(
      "target",
      "_blank"
    );
    expect(screen.getByRole("link", { name: /打开官方页面/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer"
    );
  });
});
