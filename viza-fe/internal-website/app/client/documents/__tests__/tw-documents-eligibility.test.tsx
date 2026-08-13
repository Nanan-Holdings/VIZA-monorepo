import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentCenterClient } from "../document-center-client";
import {
  getTaiwanEntryPermitExtraRequirements,
  getTaiwanEntryPermitRequiredDocumentKeys,
  getTaiwanEntryPermitVisibleDocumentKeys,
} from "@/lib/taiwan-entry-permit-document-requirements";
import type {
  DocumentApplication,
  DocumentCenterData,
  DocumentRequirement,
} from "../actions";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
}));

vi.mock("../actions", () => ({
  loadDocumentCenterData: vi.fn(),
  reuseUniversalProfileDocument: vi.fn(),
}));

vi.mock("@/app/actions/face-match", () => ({
  runFaceMatch: vi.fn(),
}));

vi.mock("@/lib/document-upload-client", () => ({
  uploadApplicationDocumentFromClient: vi.fn(),
}));

const application: DocumentApplication = {
  id: "app-tw-entry-permit",
  country: "taiwan",
  visaType: "TW_ENTRY_PERMIT",
  countryName: "Taiwan",
  countryNameZh: "中国台湾",
  countryFlag: "🇹🇼",
  visaTypeLabel: "Taiwan Online Entry Permit",
  visaTypeLabelZh: "台湾入境许可证",
  status: "draft",
  packageId: "package-tw-entry-permit",
  packageName: "Taiwan Entry Permit",
  updatedAt: null,
  createdAt: null,
};

const commonAndConditionalRequirements: DocumentRequirement[] = [
  requirement("photo", "photo", "证件照", true, 10),
  requirement("mainland_travel_document", "travel_document", "大陆地区旅行证件", true, 20),
  requirement("hk_macau_id_scan", "identity_document", "香港/澳门身份证明", false, 40),
  requirement("other_nationality_passport_scan", "passport", "其他国籍护照", false, 50),
  requirement("mainland_id_card_scan", "identity_document", "大陆身份证", false, 60),
];

const eligibilityRequirements = {
  "1": requirement("eligibility_supporting_document_1", "eligibility_document", "资格证明材料（留学生）", true, 31),
  "2": requirement("eligibility_supporting_document_2", "eligibility_document", "资格证明材料（永久居留权）", true, 32),
  "3": requirement("eligibility_supporting_document_3", "eligibility_document", "资格证明材料（工作证明）", true, 33),
  "4": requirement("eligibility_supporting_document_4", "eligibility_document", "资格证明材料（依亲居留权）", true, 34),
} satisfies Record<string, DocumentRequirement>;

const expectedEligibilityLabels = {
  "1": "有效学生签证（或再入国签证）及学校核发之3个月内在学证明",
  "2": "永久居留权证明",
  "3": "有现住地之出入境查验章戳之护照内页、工作签证及3个月内公司在职证明",
  "4": "现住地依亲居留权证明及等值新台币十万元以上存款证明",
} satisfies Record<string, string>;

const uploadRequirementTexts = [
  "文件格式为 JPG、JPEG、PNG、BMP、PDF；上传的文件须清晰，身份证及护照上不能加上任何字句或图样，如“影印本”“COPY”等。",
  "文件须小于 1024K。",
  "上传文件如为中文及英文以外的文件，请再上传中文译本。",
  "应检附文件请依原证件大小扫描后，将文件名称重新命名为符合该文件内容的名称（例如：居留证正面.JPG）。",
  "如证件双面均载有资料，正、反面均须扫描后上传。",
] as const;

function requirement(
  key: string,
  documentType: string,
  labelZh: string,
  required: boolean,
  sortOrder: number,
  applicability?: DocumentRequirement["applicability"],
): DocumentRequirement {
  return {
    key,
    documentType,
    labelEn: labelZh,
    labelZh,
    description: null,
    required,
    applicability,
    sortOrder,
    accept: ["image/jpeg", "image/png", "application/pdf"],
    source: "document_requirements",
  };
}

function dataForEligibility(category: keyof typeof eligibilityRequirements): DocumentCenterData {
  return {
    applicantId: "applicant-tw",
    applications: [application],
    selectedApplication: application,
    packageSummary: {
      id: "package-tw-entry-permit",
      name: "Taiwan Entry Permit",
      description: null,
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
      source: "document_requirements",
    },
    requirements: [
      ...commonAndConditionalRequirements,
      ...Object.values(eligibilityRequirements),
      requirement("other_supporting_document", "supporting_document", "旧的普通可选补充材料", false, 70),
    ].sort((a, b) => a.sortOrder - b.sortOrder),
    documents: [],
    ocrExtractions: [],
  };
}

function renderDocumentsForEligibility(category: keyof typeof eligibilityRequirements) {
  const answers = { eligibility_category: category };
  return render(
    <DocumentCenterClient
      initialData={dataForEligibility(category)}
      initialError={null}
      applicationId={application.id}
      country="taiwan"
      visaType="TW_ENTRY_PERMIT"
      embedded
      hideApplicationSelector
      onlyRequirementKeys={getTaiwanEntryPermitVisibleDocumentKeys(answers)}
      excludeRequirementKeys={["photo"]}
      extraRequirements={getTaiwanEntryPermitExtraRequirements(answers)}
      forceRequiredRequirementKeys={getTaiwanEntryPermitRequiredDocumentKeys(answers)}
      hideOptionalDocuments
      presentation="taiwan-inline"
    />,
  );
}

describe("Taiwan documents eligibility requirements", () => {
  it.each([
    ["1"],
    ["2"],
    ["3"],
    ["4"],
  ] as const)(
    "shows only eligibility category %s proof while keeping common and conditional documents",
    (category) => {
      renderDocumentsForEligibility(category);

      expect(screen.getAllByText(expectedEligibilityLabels[category]).length).toBeGreaterThan(0);
      for (const [otherCategory, label] of Object.entries(expectedEligibilityLabels)) {
        if (otherCategory !== category) {
          expect(screen.queryByText(label)).not.toBeInTheDocument();
        }
      }

      expect(screen.queryByText("证件照")).not.toBeInTheDocument();
      expect(screen.getAllByText("大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件").length).toBeGreaterThan(0);
      expect(screen.getAllByText("具有他国国籍护（证）照文件").length).toBeGreaterThan(0);
      expect(screen.getAllByText("大陆身份证（正、反面）").length).toBeGreaterThan(0);
      expect(screen.queryByRole("heading", { name: "可选补充材料" })).not.toBeInTheDocument();

      const conditionalSection = screen.getByRole("heading", { name: "情形适用材料" }).closest("section");
      expect(conditionalSection).toHaveTextContent("其他相关证明文件");
      expect(conditionalSection).toHaveTextContent("具有他国国籍护（证）照文件");
      expect(conditionalSection).toHaveTextContent("情形适用");

      if (category === "1") {
        expect(conditionalSection).toHaveTextContent("旅居香港或澳门之申请人");
        expect(conditionalSection).toHaveTextContent("未成年且无法定代理人或监护人陪同来台者");
      } else if (category === "2") {
        expect(conditionalSection).not.toHaveTextContent("旅居香港或澳门之申请人");
        expect(conditionalSection).toHaveTextContent("未成年且无法定代理人或监护人陪同来台者");
      } else {
        expect(conditionalSection).toHaveTextContent("旅居香港或澳门之申请人");
        expect(conditionalSection).not.toHaveTextContent("未成年且无法定代理人或监护人陪同来台者");
      }
    },
  );

  it("marks the requested requirement key for missing document navigation", () => {
    render(
      <DocumentCenterClient
        initialData={dataForEligibility("1")}
        initialError={null}
        applicationId={application.id}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
        embedded
        hideApplicationSelector
        highlightRequirementKey="mainland_id_card_scan"
      />,
    );

    const card = document.querySelector('[data-requirement-key="mainland_id_card_scan"]');
    expect(card).toBeTruthy();
    expect(card).toHaveTextContent("大陆身份证");
    expect(card?.className).toContain("ring-amber-300");
  });

  it("uses the compact Taiwan inline presentation without standalone document-center headers", () => {
    renderDocumentsForEligibility("4");

    expect(screen.getByRole("heading", { name: "上传文件要求" })).toBeInTheDocument();
    for (const item of uploadRequirementTexts) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
    expect(screen.getByText("材料完成度")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "必需材料" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "情形适用材料" })).toBeInTheDocument();
    expect(screen.queryByText("当前表单材料")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /中国台湾\s*材料/u })).not.toBeInTheDocument();
    expect(screen.queryByText(/申请状态：/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/清单来源：/u)).not.toBeInTheDocument();
    expect(screen.queryByText("证件照")).not.toBeInTheDocument();
  });

  it("keeps the default embedded document center header outside the Taiwan inline presentation", () => {
    render(
      <DocumentCenterClient
        initialData={dataForEligibility("1")}
        initialError={null}
        applicationId={application.id}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
        embedded
        hideApplicationSelector
      />,
    );

    expect(screen.getByText("当前表单材料")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /中国台湾\s*材料/u })).toBeInTheDocument();
    expect(screen.getByText(/申请状态：/u)).toBeInTheDocument();
    expect(screen.getByText(/清单来源：/u)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "上传文件要求" })).not.toBeInTheDocument();
    for (const item of uploadRequirementTexts) {
      expect(screen.queryByText(item)).not.toBeInTheDocument();
    }
  });

  it("keeps eligibility 4 red-star documents required and same-table condition documents out of generic optional materials", () => {
    const eligibility4Data = dataForEligibility("4");
    eligibility4Data.requirements = [
      requirement("mainland_travel_document", "travel_document", "大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件", true, 20, "required"),
      requirement("eligibility_supporting_document_4", "eligibility_document", "现住地依亲居留权证明及等值新台币十万元以上存款证明", true, 33, "required"),
      requirement("hk_macau_id_scan", "identity_document", "香港或澳门居民身份证（正、反面）及有效香港或澳门签证", false, 40, "conditional"),
      requirement("other_nationality_passport_scan", "passport", "具有他国国籍护（证）照文件", false, 50, "conditional"),
      requirement("mainland_id_card_scan", "identity_document", "大陆身份证（正、反面）", true, 60, "required"),
      requirement("other_supporting_document", "supporting_document", "其他相关证明文件", false, 70, "conditional"),
    ];

    render(
      <DocumentCenterClient
        initialData={eligibility4Data}
        initialError={null}
        applicationId={application.id}
        country="taiwan"
        visaType="TW_ENTRY_PERMIT"
        embedded
        hideApplicationSelector
      />,
    );

    const requiredSection = screen.getByRole("heading", { name: "必需材料" }).closest("section");
    expect(requiredSection).toHaveTextContent("大陆地区所发尚余6个月以上效期之旅行证件");
    expect(requiredSection).toHaveTextContent("现住地依亲居留权证明及等值新台币十万元以上存款证明");
    expect(requiredSection).toHaveTextContent("大陆身份证（正、反面）");

    const conditionalSection = screen.getByRole("heading", { name: "情形适用材料" }).closest("section");
    expect(conditionalSection).toHaveTextContent("香港或澳门居民身份证");
    expect(conditionalSection).toHaveTextContent("具有他国国籍护（证）照文件");
    expect(conditionalSection).toHaveTextContent("其他相关证明文件");
    const optionalSection = screen.getByRole("heading", { name: "可选补充材料" }).closest("section");
    expect(optionalSection).not.toHaveTextContent("具有他国国籍护（证）照文件");
  });
});
