import type { VisaFormFieldRow } from "@/types/visa-form-fields";

type AgreementRules = {
  agreement_content_en?: unknown;
  agreement_content_zh?: unknown;
  agreement_source_url?: unknown;
  agreement_source_label?: unknown;
  agreement_version?: unknown;
  agreement_kind?: unknown;
  label_en?: unknown;
  label_zh?: unknown;
  mustBeTrue?: unknown;
};

export type ApplicationAgreement = {
  contentEn: string;
  contentZh: string | null;
  sourceUrl: string | null;
  sourceLabel: string | null;
  version: string;
};

const AGREEMENT_LANGUAGE = /\b(agree|agreement|consent|declare|declaration|certif(?:y|ication)|undertaking|acknowledge|affirm|authorize)\b/i;

const OFFICIAL_SOURCES: Record<string, { url: string; label: string }> = {
  "SG_ARRIVAL_CARD:ica_declaration_accepted": {
    url: "https://eservices.ica.gov.sg/sgac-services/common/code/toggleLang?lang=EN",
    label: "ICA SG Arrival Card e-service",
  },
  "IN_E_VISA:final_declaration": {
    url: "https://www.indianvisaonline.gov.in/evisa/images/SampleForm.pdf",
    label: "Government of India e-Visa sample form",
  },
  "CA_TRV:imm5707_no_spouse_or_partner_certification": {
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5707.html",
    label: "IRCC IMM 5707 instructions",
  },
  "CA_TRV:imm5707_no_children_certification": {
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5707.html",
    label: "IRCC IMM 5707 instructions",
  },
  "CA_TRV:imm5707_declaration": {
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/imm5707.html",
    label: "IRCC IMM 5707 instructions",
  },
  "CA_TRV:applicant_declaration": {
    url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/guide-5256-applying-visitor-visa-temporary-resident-visa.html",
    label: "IRCC visitor-visa application guide",
  },
  "NZ_VISITOR_VISA:final_declaration": {
    url: "https://www.immigration.govt.nz/assets/inz/documents/forms-and-guides/Visitor-Visa-Declaration-Form-INZ-1224.pdf",
    label: "Immigration New Zealand Visitor Visa Declaration Form INZ 1224",
  },
  "MY_TOURIST_E_VISA:final_declaration": {
    url: "https://malaysiavisa.imi.gov.my/terms-and-conditions",
    label: "Malaysia Immigration MYVISA terms and conditions",
  },
  "VN_E_VISA:final_declaration": {
    url: "https://evisa.xuatnhapcanh.gov.vn/en_US/khai-thi-thuc-dien-tu/cap-thi-thuc-dien-tu?type=edit",
    label: "Vietnam Immigration e-Visa application",
  },
  "KR_E_ARRIVAL_CARD:declaration_confirmed": {
    url: "https://www.e-arrivalcard.go.kr/portal/apply/agreementPolicy.do",
    label: "Korea e-Arrival Card agreement policy",
  },
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isApplicationAgreementField(field: Pick<VisaFormFieldRow, "fieldType" | "required" | "label" | "validationRules">): boolean {
  if (field.fieldType !== "checkbox" || !field.required) return false;

  const rules = (field.validationRules ?? {}) as AgreementRules;
  return rules.agreement_kind === "official_statement"
    || rules.mustBeTrue === true
    || AGREEMENT_LANGUAGE.test(field.label)
    || AGREEMENT_LANGUAGE.test(text(rules.label_en) ?? "");
}

export function resolveApplicationAgreement(
  field: Pick<VisaFormFieldRow, "visaType" | "fieldName" | "fieldType" | "required" | "label" | "validationRules">,
): ApplicationAgreement | null {
  if (!isApplicationAgreementField(field)) return null;

  const rules = (field.validationRules ?? {}) as AgreementRules;
  const contentEn = text(rules.agreement_content_en) ?? text(rules.label_en) ?? field.label.trim();
  if (!contentEn) return null;
  const source = OFFICIAL_SOURCES[`${field.visaType}:${field.fieldName}`];

  return {
    contentEn,
    contentZh: text(rules.agreement_content_zh) ?? text(rules.label_zh),
    sourceUrl: text(rules.agreement_source_url) ?? source?.url ?? null,
    sourceLabel: text(rules.agreement_source_label) ?? source?.label ?? null,
    version: text(rules.agreement_version) ?? "schema-statement-v1",
  };
}

export function buildApplicationAgreementHref(visaType: string, fieldName: string): string {
  return `/client/application/agreements/${encodeURIComponent(visaType)}/${encodeURIComponent(fieldName)}`;
}
