import { describe, expect, it } from "vitest";

import {
  categorizeInboundEmail,
  EMBASSY_FOLDER_CATEGORIES,
  isInboxCategory,
} from "./categorize";

describe("categorizeInboundEmail", () => {
  it("classifies a consulate document request as documents + needs action", () => {
    const result = categorizeInboundEmail({
      fromAddr: "visa.singapore@kemlu.go.id",
      subject: "B211A application BX-2291884 — additional document required",
      snippet:
        "Please provide a bank statement covering the last three consecutive months.",
    });
    expect(result).toEqual({ category: "documents", needsAction: true });
  });

  it("classifies a biometrics confirmation as appointment", () => {
    const result = categorizeInboundEmail({
      fromAddr: "no-reply@vfsglobal.com",
      subject: "Biometrics appointment confirmed — 4 September, 10:20",
    });
    expect(result.category).toBe("appointment");
  });

  it("classifies an issued visa as approved", () => {
    const result = categorizeInboundEmail({
      fromAddr: "visa@sn.mofa.go.jp",
      subject: "Visa issued — passport ready for collection",
      snippet: "Collection requires the original receipt slip.",
    });
    expect(result.category).toBe("approved");
  });

  it("classifies an evidence refusal as rejected + needs action", () => {
    const result = categorizeInboundEmail({
      fromAddr: "consular@thaiembassy.sg",
      subject: "DTV application — further evidence of income required",
    });
    expect(result).toEqual({ category: "rejected", needsAction: true });
  });

  it("classifies a receipt as payment without action", () => {
    const result = categorizeInboundEmail({
      fromAddr: "billing@stripe-partner.example.com",
      subject: "Receipt — Indonesia e-Visa government fee",
    });
    expect(result).toEqual({ category: "payment", needsAction: false });
  });

  it("classifies an airline confirmation as travel", () => {
    const result = categorizeInboundEmail({
      fromAddr: "confirmation@singaporeair.com",
      subject: "Booking confirmed — SIN → CGK, 12 September",
    });
    expect(result.category).toBe("travel");
  });

  it("classifies VIZA's own mail as viza", () => {
    const result = categorizeInboundEmail({
      fromAddr: "hello@viza.sg",
      subject: "Your VIZA mail address is live",
    });
    expect(result.category).toBe("viza");
  });

  it("falls back to embassy for uncategorised official senders", () => {
    const result = categorizeInboundEmail({
      fromAddr: "donotreply@ukvi-gov.uk",
      subject: "Your application is under consideration (GWF 5514 8827)",
    });
    expect(result.category).toBe("embassy");
    expect(result.needsAction).toBe(false);
  });

  it("falls back to other for unknown senders and content", () => {
    const result = categorizeInboundEmail({
      fromAddr: "newsletter@random-shop.example.com",
      subject: "Weekly deals inside",
    });
    expect(result).toEqual({ category: "other", needsAction: false });
  });

  it("handles Chinese-language official mail", () => {
    const result = categorizeInboundEmail({
      fromAddr: "notice@embassy-cn.example.org",
      subject: "签证申请 — 请提交补充材料",
      snippet: "请于 7 天内提交银行对账单。",
    });
    expect(result).toEqual({ category: "documents", needsAction: true });
  });

  it("keeps the embassy folder grouping stable", () => {
    expect(EMBASSY_FOLDER_CATEGORIES).toEqual([
      "embassy",
      "approved",
      "rejected",
    ]);
    expect(isInboxCategory("appointment")).toBe(true);
    expect(isInboxCategory("junk")).toBe(false);
  });
});
