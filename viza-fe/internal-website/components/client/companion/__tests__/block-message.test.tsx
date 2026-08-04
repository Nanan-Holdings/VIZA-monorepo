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
});
