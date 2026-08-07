import { describe, expect, it } from "vitest";
import type { Message } from "@/app/actions/companion-sessions";
import { buildLegacyApplicationBlocks } from "./legacy-application-blocks";

function agentMessage(content: string): Message {
  return {
    id: "legacy-agent-message",
    sessionId: "session-1",
    senderType: "agent",
    content,
    intent: null,
    riskLevel: null,
    createdAt: "2026-08-07T08:00:00.000Z",
  };
}

describe("buildLegacyApplicationBlocks", () => {
  it("upgrades an old official SGAC link into a VIZA application card", () => {
    const blocks = buildLegacyApplicationBlocks(
      [
        agentMessage(
          "如果准备好申请，请通过新加坡电子入境卡申请 https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card。"
        ),
      ],
      []
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.payload).toMatchObject({
      blockType: "application_redirect",
      title: "Complete the Singapore electronic arrival card",
      provider: "viza",
      visaType: "SG_ARRIVAL_CARD",
      redirectUrl:
        "/client/application?country=singapore&visaType=SG_ARRIVAL_CARD",
    });
  });

  it("does not duplicate a persisted Singapore arrival-card block", () => {
    const blocks = buildLegacyApplicationBlocks(
      [agentMessage("form link /client/application?country=singapore&visaType=SG_ARRIVAL_CARD")],
      [
        {
          blockType: "application_redirect",
          title: "填写新加坡电子入境卡",
          saveTarget: "application_redirect",
          visaType: "SG_ARRIVAL_CARD",
        },
      ]
    );

    expect(blocks).toEqual([]);
  });

  it("does not create a card from ordinary SGAC policy prose", () => {
    const blocks = buildLegacyApplicationBlocks(
      [agentMessage("您需要在抵达新加坡前填写新加坡电子入境卡。")],
      []
    );

    expect(blocks).toEqual([]);
  });

  it("does not create a card from a user-authored application link", () => {
    const message = agentMessage(
      "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card"
    );
    message.senderType = "user";

    expect(buildLegacyApplicationBlocks([message], [])).toEqual([]);
  });

  it("does not turn an unrelated government link into a form card", () => {
    const blocks = buildLegacyApplicationBlocks(
      [agentMessage("请查看法国签证官网 https://france-visas.gouv.fr。")],
      []
    );

    expect(blocks).toEqual([]);
  });
});
