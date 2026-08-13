import type { DocumentRequirement } from "@/app/client/documents/actions";

const ACCEPTED_DOCUMENT_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function requirement(
  key: string,
  documentType: string,
  labelEn: string,
  labelZh: string,
  required: boolean,
  sortOrder: number,
  applicability: DocumentRequirement["applicability"],
): DocumentRequirement {
  return {
    key,
    documentType,
    labelEn,
    labelZh,
    description: null,
    required,
    applicability,
    sortOrder,
    accept: ACCEPTED_DOCUMENT_TYPES,
    source: "document_requirements",
  };
}

const MAINLAND_TRAVEL_DOCUMENT = requirement(
  "mainland_travel_document",
  "travel_document",
  "Mainland travel document or HK/Macau non-permanent-resident travel document",
  "大陆地区所发尚余6个月以上效期之旅行证件或香港、澳门政府核发之非永久性居民旅行证件",
  true,
  20,
  "required",
);

const MAINLAND_ID_CARD = requirement(
  "mainland_id_card_scan",
  "identity_document",
  "Mainland ID card (front and back)",
  "大陆身份证（正、反面）",
  true,
  60,
  "required",
);

const ELIGIBILITY_REQUIREMENTS: Record<string, DocumentRequirement> = {
  "1": requirement(
    "eligibility_supporting_document_1",
    "eligibility_document",
    "Student visa or re-entry visa and school enrollment certificate",
    "有效学生签证（或再入国签证）及学校核发之3个月内在学证明",
    true,
    30,
    "required",
  ),
  "2": requirement(
    "eligibility_supporting_document_2",
    "eligibility_document",
    "Permanent residency proof",
    "永久居留权证明",
    true,
    31,
    "required",
  ),
  "3": requirement(
    "eligibility_supporting_document_3",
    "eligibility_document",
    "One-year residence, work authorization, and employment proof",
    "有现住地之出入境查验章戳之护照内页、工作签证及3个月内公司在职证明",
    true,
    32,
    "required",
  ),
  "4": requirement(
    "eligibility_supporting_document_4",
    "eligibility_document",
    "Dependent residency and financial proof",
    "现住地依亲居留权证明及等值新台币十万元以上存款证明",
    true,
    33,
    "required",
  ),
};

const HK_MACAU_STUDENT_DOCUMENT = requirement(
  "hk_macau_student_residency_document",
  "identity_document",
  "HK/Macau resident ID and valid visa for student applicants",
  "旅居香港或澳门之申请人，须附香港或澳门居民身份证（正、反面）及有效香港或澳门签证（11岁以下免附）",
  false,
  40,
  "conditional",
);

const HK_MACAU_DOCUMENT = requirement(
  "hk_macau_id_scan",
  "identity_document",
  "Hong Kong/Macau resident ID and valid visa",
  "旅居香港或澳门之申请人，须附香港或澳门居民身份证（正、反面）及有效香港或澳门签证（11岁以下免附）",
  false,
  40,
  "conditional",
);

const MINOR_GUARDIAN_DOCUMENT = requirement(
  "minor_guardian_consent_document",
  "guardian_consent_document",
  "Guardian consent and relationship proof for minors",
  "未成年且无法定代理人或监护人陪同来台者，应检附法定代理人同意书及亲属关系证明（如：出生证明、亲属关系公证书或同户之常住人口登记卡）或监护人同意书及监护证明文件。",
  false,
  45,
  "conditional",
);

const OTHER_NATIONALITY_DOCUMENT = requirement(
  "other_nationality_passport_scan",
  "passport",
  "Other-nationality passport/document",
  "具有他国国籍护（证）照文件",
  false,
  50,
  "conditional",
);

const OTHER_SUPPORTING_DOCUMENT = requirement(
  "other_supporting_document",
  "supporting_document",
  "Other supporting document",
  "其他相关证明文件（若无要求则免附，申请人如旅居日本，请上传3个月内住民票）",
  false,
  70,
  "conditional",
);

const CONDITIONAL_REQUIREMENTS_BY_CATEGORY: Record<string, DocumentRequirement[]> = {
  "1": [
    HK_MACAU_STUDENT_DOCUMENT,
    MINOR_GUARDIAN_DOCUMENT,
    OTHER_SUPPORTING_DOCUMENT,
    OTHER_NATIONALITY_DOCUMENT,
  ],
  "2": [
    MINOR_GUARDIAN_DOCUMENT,
    OTHER_SUPPORTING_DOCUMENT,
    OTHER_NATIONALITY_DOCUMENT,
  ],
  "3": [
    HK_MACAU_DOCUMENT,
    OTHER_SUPPORTING_DOCUMENT,
    OTHER_NATIONALITY_DOCUMENT,
  ],
  "4": [
    HK_MACAU_DOCUMENT,
    OTHER_SUPPORTING_DOCUMENT,
    OTHER_NATIONALITY_DOCUMENT,
  ],
};

export function getTaiwanEntryPermitExtraRequirements(
  answers: Record<string, string>,
): DocumentRequirement[] {
  const category = answers.eligibility_category?.trim();
  if (!category) return [];
  const eligibilityRequirement = ELIGIBILITY_REQUIREMENTS[category];
  if (!eligibilityRequirement) return [];
  return [
    MAINLAND_TRAVEL_DOCUMENT,
    eligibilityRequirement,
    ...(CONDITIONAL_REQUIREMENTS_BY_CATEGORY[category] ?? []),
    MAINLAND_ID_CARD,
  ];
}

export function getTaiwanEntryPermitRequiredDocumentKeys(
  answers: Record<string, string>,
): string[] {
  return getTaiwanEntryPermitExtraRequirements(answers)
    .filter((item) => item.required)
    .map((item) => item.key);
}

export function getTaiwanEntryPermitVisibleDocumentKeys(
  answers: Record<string, string>,
): string[] {
  return getTaiwanEntryPermitExtraRequirements(answers).map((item) => item.key);
}
