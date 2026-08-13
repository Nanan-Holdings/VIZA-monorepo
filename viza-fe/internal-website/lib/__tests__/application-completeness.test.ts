import { describe, expect, it } from "vitest";
import {
  computeApplicationCompleteness,
  type ApplicationCompletenessDocument,
  type ApplicationCompletenessDocumentRequirement,
} from "@/lib/application-completeness";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: overrides.fieldName ?? "field",
    visaType: "TW_ENTRY_PERMIT",
    fieldName: "household_revoked",
    label: "Household registration revoked",
    fieldType: "radio",
    required: true,
    stepNumber: 2,
    stepName: "Photo & Basic Status",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

function twSteps(fields: VisaFormFieldRow[]): WizardStep[] {
  return [{ stepNumber: 2, stepName: "Photo & Basic Status", fields }];
}

function kinField(fieldName: string, label: string): VisaFormFieldRow {
  return field({
    fieldName,
    label,
    stepNumber: 5,
    stepName: "Kinship Information",
    required: false,
  });
}

function twApplicantAndKinshipSteps(): WizardStep[] {
  return [
    {
      stepNumber: 2,
      stepName: "Applicant Identity",
      fields: [
        field({ fieldName: "name_chinese", label: "Chinese name", stepNumber: 2, stepName: "Applicant Identity" }),
        field({ fieldName: "birth_place_is_mainland", label: "Birthplace", stepNumber: 2, stepName: "Applicant Identity" }),
        field({
          fieldName: "birth_place_mainland_region",
          label: "Mainland birth region",
          stepNumber: 2,
          stepName: "Applicant Identity",
          conditionalLogic: { showIf: "birth_place_is_mainland === mainland" },
        }),
        field({
          fieldName: "company_name",
          label: "Company or school name",
          stepNumber: 2,
          stepName: "Applicant Identity",
          required: true,
          validationRules: { required_when: "current_occupation not in [61,62]" },
          conditionalLogic: { showIf: "current_occupation not in [61,62]" },
        }),
      ],
    },
    {
      stepNumber: 5,
      stepName: "Kinship Information",
      fields: [
        kinField("kin_father_status", "Father status"),
        kinField("kin_father_name", "Father name"),
        kinField("kin_father_date_of_birth", "Father birth date"),
        kinField("kin_father_phone", "Father phone"),
        kinField("kin_father_occupation", "Father occupation"),
        kinField("kin_father_service_unit", "Father service unit"),
        kinField("kin_father_job_title", "Father job title"),
        kinField("kin_father_current_address_same_as_overseas", "Father same address"),
        kinField("kin_father_current_address", "Father current address"),
        kinField("kin_mother_status", "Mother status"),
        kinField("kin_mother_name", "Mother name"),
        kinField("kin_mother_date_of_birth", "Mother birth date"),
        kinField("kin_mother_phone", "Mother phone"),
        kinField("kin_mother_occupation", "Mother occupation"),
        kinField("kin_mother_service_unit", "Mother service unit"),
        kinField("kin_mother_job_title", "Mother job title"),
        kinField("kin_mother_current_address_same_as_overseas", "Mother same address"),
        kinField("kin_mother_current_address", "Mother current address"),
      ],
    },
  ];
}

function requirement(
  requirementKey: string,
  labelZh: string,
  required: boolean,
): ApplicationCompletenessDocumentRequirement {
  return {
    requirement_key: requirementKey,
    document_type: requirementKey,
    label_zh: labelZh,
    label_en: labelZh,
    description: `${labelZh}上传要求`,
    required,
    sort_order: 1,
  };
}

function uploaded(requirementKey: string): ApplicationCompletenessDocument {
  return {
    requirement_key: requirementKey,
    document_type: requirementKey,
    status: "uploaded",
  };
}

describe("application completeness", () => {
  it("lists triggered required fields and omits hidden or untriggered conditional fields", () => {
    const result = computeApplicationCompleteness({
      steps: twSteps([
        field({
          fieldName: "household_revoked",
          label: "Household registration revoked",
          required: false,
          validationRules: { required_when: "eligibility_category === 2 && embassy_office in [50, 51]" },
          conditionalLogic: { showIf: "eligibility_category === 2 && embassy_office in [50, 51]" },
        }),
        field({
          fieldName: "mainland_id_number",
          label: "Mainland ID number",
          required: false,
          validationRules: { required_when: "mainland_id_number_not_applicable !== true" },
        }),
        field({
          fieldName: "other_passport_number",
          label: "Other passport number",
          required: true,
          conditionalLogic: { showIf: "has_other_nationality_passport === yes" },
        }),
      ]),
      answers: {
        household_revoked: "",
        eligibility_category: "2",
        embassy_office: "50",
        mainland_id_number_not_applicable: "",
        has_other_nationality_passport: "no",
      },
      requirements: [],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.missingInfo.map((item) => item.fieldName)).toEqual([
      "household_revoked",
      "mainland_id_number",
    ]);
    expect(result.missingInfo.map((item) => item.fieldName)).not.toContain("other_passport_number");
  });

  it("does not list mainland ID field or scan when the no-mainland-ID condition is checked", () => {
    const result = computeApplicationCompleteness({
      steps: twSteps([
        field({
          fieldName: "mainland_id_number",
          label: "Mainland ID number",
          required: false,
          validationRules: { required_when: "mainland_id_number_not_applicable !== true" },
        }),
      ]),
      answers: { mainland_id_number_not_applicable: "true" },
      requirements: [requirement("mainland_id_card_scan", "大陆身份证", false)],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.missingInfo).toEqual([]);
    expect(result.missingDocuments).toEqual([]);
    expect(result.complete).toBe(true);
  });

  it("does not list household_revoked for the current Singapore student path", () => {
    const result = computeApplicationCompleteness({
      steps: twSteps([
        field({
          fieldName: "household_revoked",
          label: "Household registration revoked",
          required: false,
          validationRules: { required_when: "eligibility_category === 2 && embassy_office in [50, 51]" },
          conditionalLogic: { showIf: "eligibility_category === 2 && embassy_office in [50, 51]" },
        }),
      ]),
      answers: {
        eligibility_category: "1",
        embassy_office: "53",
        household_revoked: "",
      },
      requirements: [],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.missingInfo.map((item) => item.fieldName)).not.toContain("household_revoked");
    expect(result.complete).toBe(true);
  });

  it("does not block Taiwan completeness on occupation-hidden company/title fields", () => {
    const fields = [
      field({
        fieldName: "company_name",
        label: "Company name",
        required: true,
        conditionalLogic: { showIf: "current_occupation not in [61,62]" },
        validationRules: { required_when: "current_occupation not in [61,62]" },
      }),
      field({
        fieldName: "job_title",
        label: "Job title",
        required: true,
        conditionalLogic: { showIf: "current_occupation not in [14,61,62]" },
        validationRules: { required_when: "current_occupation not in [14,61,62]" },
      }),
    ];

    const missingForOccupation = (currentOccupation: string) =>
      computeApplicationCompleteness({
        steps: twSteps(fields),
        answers: { current_occupation: currentOccupation },
        requirements: [],
        documents: [],
        country: "taiwan",
        visaType: "TW_ENTRY_PERMIT",
      }).missingInfo.map((item) => item.fieldName);

    expect(missingForOccupation("14")).toEqual(["company_name"]);
    expect(missingForOccupation("62")).toEqual([]);
    expect(missingForOccupation("61")).toEqual([]);
    expect(missingForOccupation("52")).toEqual(["company_name", "job_title"]);
  });

  it("does not require a job title for a Taiwan student when production metadata marks it globally required", () => {
    const fields = [
      field({
        fieldName: "company_name",
        label: "Company or school name",
        required: true,
      }),
      field({
        fieldName: "job_title",
        label: "Job title",
        required: true,
        conditionalLogic: null,
        validationRules: null,
      }),
    ];

    const student = computeApplicationCompleteness({
      steps: twSteps(fields),
      answers: {
        current_occupation: "14",
        company_name: "National University of Singapore",
        job_title: "",
      },
      requirements: [],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });
    const ordinaryOccupation = computeApplicationCompleteness({
      steps: twSteps(fields),
      answers: {
        current_occupation: "52",
        company_name: "Example Company",
        job_title: "",
      },
      requirements: [],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(student.complete).toBe(true);
    expect(student.missingInfo).toEqual([]);
    expect(ordinaryOccupation.missingInfo.map((item) => item.fieldName)).toContain("job_title");
  });

  it("blocks Taiwan readiness for invalid Chinese name, mainland birthplace branch, living parents, and student school placeholder", () => {
    const result = computeApplicationCompleteness({
      steps: twApplicantAndKinshipSteps(),
      answers: {
        name_chinese: "ZHANG SAN",
        birth_place_is_mainland: "mainland",
        birth_place_mainland_region: "",
        current_occupation: "14",
        company_name: "学生",
        kin_father_status: "1",
        kin_mother_status: "存",
      },
      requirements: [],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    const missingKeys = result.missingInfo.map((item) => item.fieldName);
    expect(result.complete).toBe(false);
    expect(missingKeys).toEqual(expect.arrayContaining([
      "name_chinese",
      "birth_place_mainland_region",
      "company_name",
      "kin_father_name",
      "kin_father_date_of_birth",
      "kin_father_phone",
      "kin_father_occupation",
      "kin_father_service_unit",
      "kin_father_job_title",
      "kin_father_current_address",
      "kin_mother_name",
      "kin_mother_date_of_birth",
      "kin_mother_phone",
      "kin_mother_occupation",
      "kin_mother_service_unit",
      "kin_mother_job_title",
      "kin_mother_current_address",
    ]));
    expect(result.missingInfo.find((item) => item.fieldName === "birth_place_mainland_region")).toMatchObject({
      stepNumber: 2,
      stepName: "Applicant Identity",
    });
    expect(result.missingInfo.find((item) => item.fieldName === "kin_father_name")).toMatchObject({
      stepNumber: 5,
      stepName: "Kinship Information",
    });
  });

  it("allows a real English student school name and completed triggered Taiwan fields", () => {
    const result = computeApplicationCompleteness({
      steps: twApplicantAndKinshipSteps(),
      answers: {
        name_chinese: "張三",
        birth_place_is_mainland: "mainland",
        birth_place_mainland_region: "湖南",
        current_occupation: "14",
        company_name: "National University of Singapore",
        kin_father_status: "1",
        kin_father_name: "張父",
        kin_father_date_of_birth: "1960-01-01",
        kin_father_phone: "61234567",
        kin_father_occupation: "1",
        kin_father_service_unit: "Acme Pte Ltd",
        kin_father_job_title: "Manager",
        kin_father_current_address_same_as_overseas: "true",
        kin_mother_status: "2",
      },
      requirements: [],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.complete).toBe(true);
    expect(result.missingInfo).toEqual([]);
  });

  it("lists mainland ID scan and selected eligibility document when triggered and missing", () => {
    const result = computeApplicationCompleteness({
      steps: [],
      answers: {
        mainland_id_number_not_applicable: "",
        eligibility_category: "3",
      },
      requirements: [
        requirement("mainland_id_card_scan", "大陆身份证", false),
        requirement("eligibility_supporting_document_1", "资格证明材料（留学生）", true),
        requirement("eligibility_supporting_document_3", "资格证明材料（工作证明）", true),
      ],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.missingDocuments.map((item) => item.requirementKey)).toEqual([
      "mainland_id_card_scan",
      "eligibility_supporting_document_3",
    ]);
  });

  it("requires the current Taiwan eligibility proof even when stale requirements point at another category", () => {
    const baseInput = {
      steps: [],
      answers: {
        eligibility_category: "2",
        mainland_id_number_not_applicable: "",
      },
      requirements: [
        requirement("photo", "证件照", true),
        requirement("mainland_travel_document", "大陆地区旅行证件", true),
        requirement("eligibility_supporting_document_1", "资格证明材料（留学生）", true),
        requirement("eligibility_supporting_document_2", "资格证明材料（永久居留权）", false),
        requirement("mainland_id_card_scan", "大陆身份证", true),
      ],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    } satisfies Omit<Parameters<typeof computeApplicationCompleteness>[0], "documents">;

    const missingCategory2 = computeApplicationCompleteness({
      ...baseInput,
      documents: [
        uploaded("photo"),
        uploaded("mainland_travel_document"),
        uploaded("eligibility_supporting_document_1"),
        uploaded("mainland_id_card_scan"),
      ],
    });

    expect(missingCategory2.complete).toBe(false);
    expect(missingCategory2.missingDocuments.map((item) => item.requirementKey)).toEqual([
      "eligibility_supporting_document_2",
    ]);
    expect(missingCategory2.missingDocuments.map((item) => item.requirementKey)).not.toContain(
      "eligibility_supporting_document_1",
    );

    const completeWithCategory2 = computeApplicationCompleteness({
      ...baseInput,
      documents: [
        uploaded("photo"),
        uploaded("mainland_travel_document"),
        uploaded("eligibility_supporting_document_1"),
        uploaded("eligibility_supporting_document_2"),
        uploaded("mainland_id_card_scan"),
      ],
    });

    expect(completeWithCategory2.complete).toBe(true);
    expect(completeWithCategory2.missingDocuments).toEqual([]);
  });

  it("requires eligibility 4 red-star mainland ID scan even when no-mainland-ID is checked", () => {
    const result = computeApplicationCompleteness({
      steps: [],
      answers: {
        mainland_id_number_not_applicable: "true",
        eligibility_category: "4",
        embassy_office: "53",
        has_other_nationality_passport: "no",
      },
      requirements: [
        requirement("mainland_travel_document", "大陆地区旅行证件", true),
        requirement("eligibility_supporting_document_4", "依亲居留权及财力证明", true),
        requirement("mainland_id_card_scan", "大陆身份证", false),
        requirement("hk_macau_id_scan", "港澳身份证明", false),
        requirement("other_nationality_passport_scan", "他国护照", false),
        requirement("other_supporting_document", "其他相关证明文件", false),
      ],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.missingDocuments.map((item) => item.requirementKey)).toEqual([
      "mainland_travel_document",
      "eligibility_supporting_document_4",
      "mainland_id_card_scan",
    ]);
    expect(result.missingDocuments.map((item) => item.requirementKey)).not.toContain("hk_macau_id_scan");
    expect(result.missingDocuments.map((item) => item.requirementKey)).not.toContain("other_nationality_passport_scan");
    expect(result.missingDocuments.map((item) => item.requirementKey)).not.toContain("other_supporting_document");
  });

  it("adds eligibility 4 same-table condition documents only when their answer trigger is active", () => {
    const result = computeApplicationCompleteness({
      steps: [],
      answers: {
        eligibility_category: "4",
        embassy_office: "50",
        has_other_nationality_passport: "yes",
      },
      requirements: [
        requirement("hk_macau_id_scan", "港澳身份证明", false),
        requirement("other_nationality_passport_scan", "他国护照", false),
        requirement("other_supporting_document", "其他相关证明文件", false),
      ],
      documents: [],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.missingDocuments.map((item) => item.requirementKey)).toEqual([
      "hk_macau_id_scan",
      "other_nationality_passport_scan",
    ]);
  });

  it("removes missing items after answers and documents are present", () => {
    const result = computeApplicationCompleteness({
      steps: twSteps([
        field({
          fieldName: "household_revoked",
          label: "Household registration revoked",
          required: false,
          validationRules: { required_when: "eligibility_category === 2 && embassy_office in [50, 51]" },
          conditionalLogic: { showIf: "eligibility_category === 2 && embassy_office in [50, 51]" },
        }),
      ]),
      answers: {
        household_revoked: "no",
        eligibility_category: "1",
        embassy_office: "53",
        mainland_id_number_not_applicable: "",
      },
      requirements: [
        requirement("mainland_id_card_scan", "大陆身份证", false),
        requirement("eligibility_supporting_document_1", "资格证明材料（留学生）", true),
      ],
      documents: [
        uploaded("mainland_id_card_scan"),
        uploaded("eligibility_supporting_document_1"),
      ],
      country: "taiwan",
      visaType: "TW_ENTRY_PERMIT",
    });

    expect(result.complete).toBe(true);
    expect(result.missingInfo).toEqual([]);
    expect(result.missingDocuments).toEqual([]);
  });

  it("keeps generic required document handling for other countries without Taiwan-only conditions", () => {
    const result = computeApplicationCompleteness({
      steps: [],
      answers: {},
      requirements: [
        requirement("passport_copy", "Passport copy", true),
        requirement("mainland_id_card_scan", "Mainland ID", false),
      ],
      documents: [],
      country: "vietnam",
      visaType: "VN_E_VISA",
    });

    expect(result.missingDocuments.map((item) => item.requirementKey)).toEqual(["passport_copy"]);
  });
});
