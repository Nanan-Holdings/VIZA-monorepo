import { describe, expect, it } from "vitest";
import type { StatusApplication, StatusFile } from "@/app/client/status/status-data";
import { isPostSubmission, uniqueFiles } from "../PostSubmissionInfoPanel";

function statusApplication(overrides: Partial<StatusApplication> = {}): StatusApplication {
  return {
    key: "app-1",
    countryKey: "thailand",
    id: "app-1",
    packageId: "package-1",
    country: "thailand",
    visaType: "tdac",
    countryName: "Thailand",
    countryNameZh: "泰国",
    countryFlag: "🇹🇭",
    visaTypeLabel: "TDAC",
    visaTypeLabelZh: "TDAC 入境卡",
    packageName: null,
    state: "in_progress",
    progressPercent: 50,
    createdAt: null,
    updatedAt: null,
    submittedAt: null,
    officialReference: null,
    officialReferenceKind: null,
    rawApplicationStatus: "draft",
    externalStatus: null,
    resultStatus: null,
    liveSubmission: null,
    officialTracking: null,
    governmentFee: { amountCents: null, currency: null, mode: null },
    officialFee: { status: null, quoteId: null, paymentIntentId: null, receiptId: null },
    payment: { status: null, amountCents: null, currency: null, updatedAt: null },
    consent: { accepted: false, signaturePresent: false, updatedAt: null },
    formAnswerCount: 0,
    documents: { total: 0, uploaded: 0, validated: 0, missing: 0, rejected: 0 },
    packet: { status: null, readyAt: null, storagePath: null },
    notifications: { total: 0, lastSentAt: null },
    steps: [],
    actions: [],
    files: [],
    events: [],
    applicationRecords: [],
    ...overrides,
  };
}

describe("post-submission information", () => {
  it("stays hidden for a draft even when a packet already exists", () => {
    expect(isPostSubmission(statusApplication({ packet: { status: "ready", readyAt: null, storagePath: "packet.pdf" } }))).toBe(false);
  });

  it("appears after a reliable submission signal", () => {
    expect(isPostSubmission(statusApplication({ submittedAt: "2026-08-13T00:00:00Z" }))).toBe(true);
    expect(isPostSubmission(statusApplication({ officialReference: "TH-2026-1" }))).toBe(true);
  });

  it("deduplicates repeated file links", () => {
    const files: StatusFile[] = [
      { key: "resultFile", href: "/result.pdf", reference: "one", createdAt: null },
      { key: "approvedResult", href: "/result.pdf", reference: "two", createdAt: null },
    ];
    expect(uniqueFiles(files)).toHaveLength(1);
  });
});
