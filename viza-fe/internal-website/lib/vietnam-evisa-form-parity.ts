import { type VisaFormFieldOption, type VisaFormFieldRow, type WizardStep } from "@/types/visa-form-fields";

type FieldPatch = Partial<Omit<VisaFormFieldRow, "fieldName">> & {
  fieldName: string;
};

const YES_NO_OPTIONS: VisaFormFieldOption[] = [
  { value: "yes", text: "Yes", label_zh: "是", label_en: "Yes" },
  { value: "no", text: "No", label_zh: "否", label_en: "No" },
];

function mergeRules(
  field: VisaFormFieldRow,
  rules: Record<string, unknown>,
): VisaFormFieldRow {
  return {
    ...field,
    validationRules: {
      ...(field.validationRules ?? {}),
      ...rules,
    },
  };
}

function createField(patch: FieldPatch): VisaFormFieldRow {
  return {
    id: `vn-evisa-parity-${patch.fieldName}`,
    visaType: "VN_E_VISA",
    fieldName: patch.fieldName,
    label: patch.label ?? patch.fieldName,
    fieldType: patch.fieldType ?? "text",
    required: patch.required ?? false,
    stepNumber: patch.stepNumber ?? 1,
    stepName: patch.stepName ?? "Vietnam e-Visa",
    displayOrder: patch.displayOrder ?? 999,
    placeholder: patch.placeholder ?? null,
    validationRules: patch.validationRules ?? null,
    options: patch.options ?? null,
    conditionalLogic: patch.conditionalLogic ?? null,
  };
}

function applyFieldPatch(field: VisaFormFieldRow, patch: FieldPatch): VisaFormFieldRow {
  return {
    ...field,
    ...patch,
    id: field.id,
    visaType: field.visaType,
    fieldName: field.fieldName,
    validationRules: {
      ...(field.validationRules ?? {}),
      ...(patch.validationRules ?? {}),
    },
    options: patch.options ?? field.options,
    conditionalLogic: patch.conditionalLogic ?? field.conditionalLogic,
  };
}

const OFFICIAL_PARITY_FIELDS: FieldPatch[] = [
  {
    fieldName: "has_other_passports_used_for_vietnam",
    label: "Have you ever used any other passports to enter into Viet Nam?",
    fieldType: "radio",
    required: true,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: 11,
    options: YES_NO_OPTIONS,
    validationRules: {
      label_zh: "是否曾使用其他护照进入越南？",
      helper_zh: "如曾使用其他护照入境越南，请选择“是”并补充护照信息。",
    },
  },
  {
    fieldName: "other_vietnam_passport_number",
    label: "Passport",
    fieldType: "text",
    required: true,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: 11.1,
    placeholder: "Enter passport",
    validationRules: {
      label_zh: "曾用于入境越南的其他护照号码",
      repeatable: true,
      repeat_group: "other_passports_used_for_vietnam",
      max_items: 5,
      maxLength: 64,
    },
    conditionalLogic: { showIf: "has_other_passports_used_for_vietnam === yes" },
  },
  {
    fieldName: "other_vietnam_passport_full_name",
    label: "Full name",
    fieldType: "text",
    required: true,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: 11.2,
    placeholder: "Enter full name",
    validationRules: {
      label_zh: "其他护照上的姓名",
      repeatable: true,
      repeat_group: "other_passports_used_for_vietnam",
      max_items: 5,
      maxLength: 120,
    },
    conditionalLogic: { showIf: "has_other_passports_used_for_vietnam === yes" },
  },
  {
    fieldName: "other_vietnam_passport_date_of_birth",
    label: "Date of birth",
    fieldType: "date",
    required: true,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: 11.3,
    placeholder: "DD/MM/YYYY",
    validationRules: {
      label_zh: "出生日期",
      repeatable: true,
      repeat_group: "other_passports_used_for_vietnam",
      max_items: 5,
      allow_year_only: true,
    },
    conditionalLogic: { showIf: "has_other_passports_used_for_vietnam === yes" },
  },
  {
    fieldName: "other_vietnam_passport_nationality",
    label: "Nationality",
    fieldType: "country",
    required: true,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: 11.4,
    placeholder: "Choose nationality",
    validationRules: {
      label_zh: "国籍",
      repeatable: true,
      repeat_group: "other_passports_used_for_vietnam",
      max_items: 5,
      source: "ISO3166-1",
    },
    conditionalLogic: { showIf: "has_other_passports_used_for_vietnam === yes" },
  },
  {
    fieldName: "vietnam_law_violation_act",
    label: "Act of violation",
    fieldType: "text",
    required: true,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: 19.1,
    placeholder: "Enter act of violation",
    validationRules: {
      label_zh: "违法行为",
      repeatable: true,
      repeat_group: "vietnam_law_violations",
      max_items: 5,
      maxLength: 200,
    },
    conditionalLogic: { showIf: "has_violated_vietnam_laws === yes" },
  },
  {
    fieldName: "vietnam_law_violation_time",
    label: "Time of violation",
    fieldType: "date",
    required: true,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: 19.2,
    placeholder: "DD/MM/YYYY",
    validationRules: {
      label_zh: "违法时间",
      repeatable: true,
      repeat_group: "vietnam_law_violations",
      max_items: 5,
    },
    conditionalLogic: { showIf: "has_violated_vietnam_laws === yes" },
  },
  {
    fieldName: "vietnam_law_violation_sanction",
    label: "Form of sanction",
    fieldType: "text",
    required: true,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: 19.3,
    placeholder: "Enter form of sanction",
    validationRules: {
      label_zh: "处罚形式",
      repeatable: true,
      repeat_group: "vietnam_law_violations",
      max_items: 5,
      maxLength: 200,
    },
    conditionalLogic: { showIf: "has_violated_vietnam_laws === yes" },
  },
  {
    fieldName: "vietnam_law_violation_authority",
    label: "Authority imposed sanction",
    fieldType: "text",
    required: true,
    stepNumber: 1,
    stepName: "Personal Information",
    displayOrder: 19.4,
    placeholder: "Enter authority imposed sanction",
    validationRules: {
      label_zh: "作出处罚的机关",
      repeatable: true,
      repeat_group: "vietnam_law_violations",
      max_items: 5,
      maxLength: 200,
    },
    conditionalLogic: { showIf: "has_violated_vietnam_laws === yes" },
  },
  {
    fieldName: "passport_type_other_specify",
    label: "If “Others”, please specify",
    fieldType: "text",
    required: true,
    stepNumber: 3,
    stepName: "Passport Information",
    displayOrder: 3.1,
    placeholder: "Enter specify others type",
    validationRules: { label_zh: "如选择“其他”，请说明", maxLength: 120 },
    conditionalLogic: { showIf: "passport_type in [other, others]" },
  },
  {
    fieldName: "has_contact_in_vietnam",
    label: "Agency/Organization/Individual that the applicant plans to contact when enter into Viet Nam?",
    fieldType: "radio",
    required: true,
    stepNumber: 6,
    stepName: "Trip Information",
    displayOrder: 17,
    options: YES_NO_OPTIONS,
    validationRules: { label_zh: "入境越南后计划联系的机构、组织或个人？" },
  },
  {
    fieldName: "contact_hosting_organization_name",
    label: "Name of hosting organization",
    fieldType: "text",
    required: true,
    stepNumber: 6,
    stepName: "Trip Information",
    displayOrder: 17.1,
    placeholder: "Enter name of hosting organization",
    validationRules: {
      label_zh: "接待机构/组织/个人名称",
      repeatable: true,
      repeat_group: "vietnam_contacts",
      max_items: 5,
      maxLength: 200,
    },
    conditionalLogic: { showIf: "has_contact_in_vietnam === yes" },
  },
  {
    fieldName: "contact_hosting_organization_phone",
    label: "Telephone number",
    fieldType: "text",
    required: true,
    stepNumber: 6,
    stepName: "Trip Information",
    displayOrder: 17.2,
    placeholder: "Enter telephone number",
    validationRules: {
      label_zh: "联系电话",
      repeatable: true,
      repeat_group: "vietnam_contacts",
      max_items: 5,
      maxLength: 40,
    },
    conditionalLogic: { showIf: "has_contact_in_vietnam === yes" },
  },
  {
    fieldName: "contact_hosting_organization_address",
    label: "Address",
    fieldType: "text",
    required: true,
    stepNumber: 6,
    stepName: "Trip Information",
    displayOrder: 17.3,
    placeholder: "Enter address",
    validationRules: {
      label_zh: "地址",
      repeatable: true,
      repeat_group: "vietnam_contacts",
      max_items: 5,
      maxLength: 300,
    },
    conditionalLogic: { showIf: "has_contact_in_vietnam === yes" },
  },
  {
    fieldName: "contact_hosting_organization_purpose",
    label: "Purpose",
    fieldType: "text",
    required: true,
    stepNumber: 6,
    stepName: "Trip Information",
    displayOrder: 17.4,
    placeholder: "Enter purpose",
    validationRules: {
      label_zh: "联系目的",
      repeatable: true,
      repeat_group: "vietnam_contacts",
      max_items: 5,
      maxLength: 200,
    },
    conditionalLogic: { showIf: "has_contact_in_vietnam === yes" },
  },
  {
    fieldName: "visited_vietnam_from_date",
    label: "From date",
    fieldType: "date",
    required: true,
    stepNumber: 6,
    stepName: "Trip Information",
    displayOrder: 16.1,
    placeholder: "DD/MM/YYYY",
    validationRules: {
      label_zh: "上次赴越开始日期",
      repeatable: true,
      repeat_group: "visited_vietnam_last_year",
      max_items: 5,
    },
    conditionalLogic: { showIf: "visited_vietnam_in_last_year === yes" },
  },
  {
    fieldName: "visited_vietnam_to_date",
    label: "To date",
    fieldType: "date",
    required: true,
    stepNumber: 6,
    stepName: "Trip Information",
    displayOrder: 16.2,
    placeholder: "DD/MM/YYYY",
    validationRules: {
      label_zh: "上次赴越结束日期",
      repeatable: true,
      repeat_group: "visited_vietnam_last_year",
      max_items: 5,
      not_before_field: "visited_vietnam_from_date",
    },
    conditionalLogic: { showIf: "visited_vietnam_in_last_year === yes" },
  },
  {
    fieldName: "visited_vietnam_trip_purpose",
    label: "Purpose of trip",
    fieldType: "text",
    required: true,
    stepNumber: 6,
    stepName: "Trip Information",
    displayOrder: 16.3,
    placeholder: "Enter purpose",
    validationRules: {
      label_zh: "上次赴越目的",
      repeatable: true,
      repeat_group: "visited_vietnam_last_year",
      max_items: 5,
      maxLength: 200,
    },
    conditionalLogic: { showIf: "visited_vietnam_in_last_year === yes" },
  },
  {
    fieldName: "accompanying_child_portrait_photo",
    label: "Portrait photography",
    fieldType: "file",
    required: true,
    stepNumber: 7,
    stepName: "Accompanying Children",
    displayOrder: 4,
    placeholder: "Upload portrait photo",
    validationRules: {
      label_zh: "同行儿童证件照片",
      repeatable: true,
      repeat_group: "accompanying_children",
      max_items: 10,
      accept: [".jpg", ".jpeg", ".png"],
      helper_zh: "官方表单要求每名同行儿童上传照片。",
    },
    conditionalLogic: { showIf: "has_accompanying_children === yes" },
  },
  {
    fieldName: "travel_insurance_specify",
    label: "Specify",
    fieldType: "text",
    required: true,
    stepNumber: 8,
    stepName: "Travel Expenses and Insurance",
    displayOrder: 2.1,
    placeholder: "Enter specify",
    validationRules: { label_zh: "保险说明", maxLength: 200 },
    conditionalLogic: { showIf: "bought_travel_insurance === yes" },
  },
  {
    fieldName: "expense_payment_method",
    label: "Payment method",
    fieldType: "select",
    required: true,
    stepNumber: 8,
    stepName: "Travel Expenses and Insurance",
    displayOrder: 4.1,
    placeholder: "Choose one",
    options: [
      { value: "cash", text: "Cash", label_zh: "现金", label_en: "Cash" },
      { value: "credit_card", text: "Credit card", label_zh: "信用卡", label_en: "Credit card" },
      { value: "travellers_cheques", text: "Traveller's cheques", label_zh: "旅行支票", label_en: "Traveller's cheques" },
    ],
    validationRules: { label_zh: "付款方式", live_dom_id: "basic_kpbhHinhThuc" },
    conditionalLogic: { showIf: "expense_coverage in [personal, company]" },
  },
  {
    fieldName: "expense_company_name",
    label: "Name of Company/Agency",
    fieldType: "text",
    required: true,
    stepNumber: 8,
    stepName: "Travel Expenses and Insurance",
    displayOrder: 4.2,
    placeholder: "Enter name of Company/Agency",
    validationRules: { label_zh: "承担费用的公司/机构名称", maxLength: 200 },
    conditionalLogic: { showIf: "expense_coverage === company" },
  },
  {
    fieldName: "expense_company_address",
    label: "Address",
    fieldType: "text",
    required: true,
    stepNumber: 8,
    stepName: "Travel Expenses and Insurance",
    displayOrder: 4.3,
    placeholder: "Enter address",
    validationRules: { label_zh: "公司/机构地址", maxLength: 300 },
    conditionalLogic: { showIf: "expense_coverage === company" },
  },
  {
    fieldName: "expense_company_telephone",
    label: "Telephone number",
    fieldType: "text",
    required: true,
    stepNumber: 8,
    stepName: "Travel Expenses and Insurance",
    displayOrder: 4.4,
    placeholder: "Enter telephone number",
    validationRules: { label_zh: "公司/机构电话", maxLength: 40 },
    conditionalLogic: { showIf: "expense_coverage === company" },
  },
];

const LEGACY_PARITY_PATCHES: FieldPatch[] = [
  {
    fieldName: "visited_vietnam_in_last_year",
    label: "Have you ever been to Viet Nam in the last 01 year?",
    displayOrder: 16,
    options: YES_NO_OPTIONS,
    validationRules: { label_zh: "过去一年是否曾到访越南？" },
  },
  {
    fieldName: "has_contact_in_vietnam",
    displayOrder: 17,
  },
  {
    fieldName: "has_relatives",
    label: "Do you have relatives currently residing in Viet Nam?",
    displayOrder: 18,
    options: YES_NO_OPTIONS,
    validationRules: { label_zh: "是否有亲属目前居住在越南？" },
  },
  {
    fieldName: "relative_full_name",
    displayOrder: 18.1,
    validationRules: { repeatable: true, repeat_group: "vietnam_relatives", max_items: 5, label_zh: "亲属姓名" },
    conditionalLogic: { showIf: "has_relatives === yes" },
  },
  {
    fieldName: "relative_date_of_birth",
    displayOrder: 18.2,
    validationRules: { repeatable: true, repeat_group: "vietnam_relatives", max_items: 5, label_zh: "亲属出生日期" },
    conditionalLogic: { showIf: "has_relatives === yes" },
  },
  {
    fieldName: "relative_nationality",
    displayOrder: 18.3,
    validationRules: { repeatable: true, repeat_group: "vietnam_relatives", max_items: 5, label_zh: "亲属国籍" },
    conditionalLogic: { showIf: "has_relatives === yes" },
  },
  {
    fieldName: "relative_relationship",
    displayOrder: 18.4,
    validationRules: { repeatable: true, repeat_group: "vietnam_relatives", max_items: 5, label_zh: "亲属关系" },
    conditionalLogic: { showIf: "has_relatives === yes" },
  },
  {
    fieldName: "relative_residential_address",
    displayOrder: 18.5,
    validationRules: { repeatable: true, repeat_group: "vietnam_relatives", max_items: 5, label_zh: "亲属在越南住址" },
    conditionalLogic: { showIf: "has_relatives === yes" },
  },
];

const PARITY_PATCH_BY_FIELD_NAME = new Map(
  [...OFFICIAL_PARITY_FIELDS, ...LEGACY_PARITY_PATCHES].map((patch) => [patch.fieldName, patch]),
);

export function augmentVietnamEVisaOfficialParitySteps(steps: WizardStep[]): WizardStep[] {
  const stepMap = new Map<number, WizardStep>();
  const fieldNames = new Set<string>();

  for (const step of steps) {
    stepMap.set(step.stepNumber, {
      ...step,
      fields: step.fields.map((field) => {
        fieldNames.add(field.fieldName);
        const parityPatch = PARITY_PATCH_BY_FIELD_NAME.get(field.fieldName);
        const patchedField = parityPatch ? applyFieldPatch(field, parityPatch) : field;

        if (patchedField.fieldName === "date_of_birth") {
          return mergeRules(patchedField, { allow_year_only: true });
        }
        if (patchedField.fieldName === "visa_valid_from") {
          return mergeRules(patchedField, { min_date: "today" });
        }
        if (patchedField.fieldName === "visa_valid_to") {
          return mergeRules(patchedField, { not_before_field: "visa_valid_from" });
        }
        if (patchedField.fieldName === "passport_expiry_date") {
          return mergeRules(patchedField, {
            min_after_field: "visa_valid_to",
            min_after_days: 30,
            helper_zh: "官方要求护照有效期至少晚于签证有效期结束日 30 天。",
          });
        }
        if (patchedField.fieldName === "intended_ward_commune") {
          return {
            ...mergeRules(patchedField, {
              dependent_on: "intended_province_city",
              dependent_options_key: "vietnam_wards_by_province",
            }),
            options: [],
          };
        }
        if (patchedField.fieldName === "has_multiple_nationalities") {
          return {
            ...mergeRules(patchedField, {
              label_zh: "是否拥有多个国籍？",
              label_en: "Do you have multiple nationalities?",
              official_label_en: "Do you have multiple nationalities?",
              helper_zh: "如拥有多个国籍，请选择“是”并逐项补充。",
              helper_en: "Select Yes if you currently hold more than one nationality.",
            }),
            label: "Do you have multiple nationalities?",
            displayOrder: 17,
          };
        }
        if (patchedField.fieldName === "other_nationality") {
          return {
            ...mergeRules(patchedField, {
              repeatable: true,
              repeat_group: "multiple_nationalities",
              max_items: 5,
              label_zh: "其他国籍",
            }),
            displayOrder: 18,
            conditionalLogic: { showIf: "has_multiple_nationalities === yes" },
          };
        }
        if (patchedField.fieldName === "has_violated_vietnam_laws") {
          return {
            ...patchedField,
            displayOrder: 19,
          };
        }
        if (patchedField.fieldName === "violation_of_vietnam_laws_details") {
          return {
            ...mergeRules(patchedField, { label_zh: "越南违法记录说明（旧字段）" }),
            required: false,
            conditionalLogic: { showIf: "has_violated_vietnam_laws === legacy_textarea" },
          };
        }
        if (patchedField.fieldName === "visited_vietnam_purpose_detail") {
          return {
            ...mergeRules(patchedField, { label_zh: "过去一年访问越南说明（旧字段）" }),
            required: false,
            conditionalLogic: { showIf: "visited_vietnam_in_last_year === legacy_textarea" },
          };
        }
        if (patchedField.fieldName === "bought_travel_insurance") {
          return { ...patchedField, displayOrder: 2 };
        }
        if (patchedField.fieldName === "expense_coverage") {
          return { ...patchedField, displayOrder: 4 };
        }

        return patchedField;
      }),
    });
  }

  for (const patch of OFFICIAL_PARITY_FIELDS) {
    if (fieldNames.has(patch.fieldName)) continue;
    const stepNumber = patch.stepNumber ?? 1;
    const existing = stepMap.get(stepNumber);
    const field = createField(patch);

    if (existing) {
      existing.fields.push(field);
    } else {
      stepMap.set(stepNumber, {
        stepNumber,
        stepName: field.stepName ?? `Step ${stepNumber}`,
        fields: [field],
      });
    }
  }

  return Array.from(stepMap.values())
    .map((step) => ({
      ...step,
      fields: [...step.fields].sort((a, b) => a.displayOrder - b.displayOrder),
    }))
    .sort((a, b) => a.stepNumber - b.stepNumber);
}
