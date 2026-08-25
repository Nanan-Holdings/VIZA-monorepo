import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildTaiwanEntryPermitSections,
  getTaiwanEntryPermitInlineDocumentStepId,
  isTaiwanEntryPermitQualificationStepSource,
  shouldShowStandaloneDocumentStep,
} from "@/lib/taiwan-entry-permit-layout";
import {
  getTaiwanEntryPermitExtraRequirements,
  getTaiwanEntryPermitVisibleDocumentKeys,
} from "@/lib/taiwan-entry-permit-document-requirements";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

function step(id: number, sourceName: string) {
  return {
    id,
    name: sourceName,
    description: "",
    sourceName,
  };
}

describe("Taiwan entry permit long-form layout", () => {
  it("requires and forwards all VIZA and official-site authorizations at final confirmation", () => {
    const source = readFileSync(
      join(process.cwd(), "app/client/application/long-form/page.tsx"),
      "utf8",
    );

    expect(source).toContain('id="tw-entry-prompt-consent"');
    expect(source).toContain('id="tw-terms-modal-consent"');
    expect(source).toContain('id="tw-truth-declaration"');
    expect(source).toContain('id="tw-electronic-submission-authorization"');
    expect(source).toContain('id="tw-official-fee-responsibility"');
    expect(source).toContain("taiwanEntryPromptAccepted &&");
    expect(source).toContain("taiwanTermsModalAccepted &&");
    expect(source).toContain("taiwanTruthAccepted &&");
    expect(source).toContain("taiwanSubmissionAuthorized &&");
    expect(source).toContain("taiwanFeeResponsibilityAccepted");
    expect(source).toContain("提交后，部分资料可能无法修改");
    expect(source).toContain("确认并授权提交");
    expect(source).toContain(
      "onSubmit(submitMode, officialPaymentCard, taiwanOfficialTermsConsent)",
    );
    expect(source).toContain(
      "taiwanOfficialTermsConsent: input.taiwanOfficialTermsConsent",
    );
  });

  it("keeps supporting documents embedded on the qualification step instead of adding a standalone sidebar item", () => {
    expect(shouldShowStandaloneDocumentStep(true, "TW_ENTRY_PERMIT")).toBe(false);
    expect(shouldShowStandaloneDocumentStep(true, "VN_E_VISA")).toBe(true);

    const sections = buildTaiwanEntryPermitSections([
      step(0, "Delivery Location"),
      step(1, "Photo & Basic Status"),
      step(2, "Supporting Documents"),
      step(3, "Applicant Identity"),
      step(4, "Review"),
      step(5, "Confirmation"),
    ]);

    expect(sections.map((section) => section.title)).not.toContain("应检附文件");
    expect(sections.flatMap((section) => section.steps.map((sectionStep) => sectionStep.sourceName))).not.toContain(
      "Supporting Documents",
    );
    expect(sections.flatMap((section) => section.steps.map((sectionStep) => sectionStep.name))).toContain(
      "申请资格与证别",
    );
  });

  it("uses the qualification step as the inline document host and keeps review/status indices after DB steps", () => {
    const dbStepCount = 6;
    const standaloneDocuments = shouldShowStandaloneDocumentStep(true, "TW_ENTRY_PERMIT");
    const reviewStepIndex = dbStepCount + (standaloneDocuments ? 1 : 0);
    const teamStepIndex = reviewStepIndex + 1;
    const statusStepIndex = reviewStepIndex + 2;

    expect(reviewStepIndex).toBe(6);
    expect(teamStepIndex).toBe(7);
    expect(statusStepIndex).toBe(8);
    expect(getTaiwanEntryPermitInlineDocumentStepId([
      step(0, "Delivery Location"),
      step(1, "Photo & Basic Status"),
      step(6, "Review"),
    ])).toBe(1);
    expect(getTaiwanEntryPermitInlineDocumentStepId([
      step(0, "Delivery Location"),
      step(6, "Review"),
    ])).toBeNull();
    expect(isTaiwanEntryPermitQualificationStepSource("Photo & Basic Status")).toBe(true);
  });

  it.each([
    ["1", "eligibility_supporting_document_1"],
    ["2", "eligibility_supporting_document_2"],
    ["3", "eligibility_supporting_document_3"],
    ["4", "eligibility_supporting_document_4"],
  ] as const)("switches inline document requirements when eligibility category changes to %s", (category, expectedKey) => {
    const answers = { eligibility_category: category };
    const keys = getTaiwanEntryPermitVisibleDocumentKeys(answers);
    const requirements = getTaiwanEntryPermitExtraRequirements(answers);

    expect(keys).toContain(expectedKey);
    expect(keys).toContain("mainland_travel_document");
    expect(keys).toContain("mainland_id_card_scan");
    expect(keys).not.toContain("photo");
    expect(requirements.some((requirement) => requirement.key === "photo")).toBe(false);
  });
});
