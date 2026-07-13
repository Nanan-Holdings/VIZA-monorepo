import type { SupabaseClient } from "@supabase/supabase-js";
import type { BilingualSeedField, BilingualSeedRow } from "./bilingual-seed-row";

const PAYMENT_METHOD_OPTIONS = [
  {
    value: "ONLINE",
    text: "CREDIT CARD / DEBIT CARD (Foreign Bank)",
    label_zh: "信用卡 / 借记卡（境外银行）",
    label_en: "CREDIT CARD / DEBIT CARD (Foreign Bank)",
    official_label: "CREDIT CARD / DEBIT CARD (Foreign Bank)",
  },
  {
    value: "OFFLINE",
    text: "INDONESIAN PAYMENT METHOD",
    label_zh: "印尼本地付款方式",
    label_en: "INDONESIAN PAYMENT METHOD",
    official_label: "INDONESIAN PAYMENT METHOD",
  },
];

const GENDER_OPTIONS = [
  { value: "M", text: "Male", label_zh: "男", label_en: "Male", official_label: "Male" },
  { value: "F", text: "Female", label_zh: "女", label_en: "Female", official_label: "Female" },
];

const TRAVEL_DOCUMENT_OPTIONS = [
  { value: "Passport", text: "Passport", label_zh: "护照", label_en: "Passport", official_label: "Passport" },
  {
    value: "Alien Travel Document",
    text: "Alien Travel Document",
    label_zh: "外国人旅行证件",
    label_en: "Alien Travel Document",
    official_label: "Alien Travel Document",
  },
  {
    value: "Certificate of Identity",
    text: "Certificate of Identity",
    label_zh: "身份证明书",
    label_en: "Certificate of Identity",
    official_label: "Certificate of Identity",
  },
  {
    value: "Document of Identity",
    text: "Document of Identity",
    label_zh: "身份证件",
    label_en: "Document of Identity",
    official_label: "Document of Identity",
  },
  {
    value: "Emergency Passport",
    text: "Emergency Passport",
    label_zh: "紧急护照",
    label_en: "Emergency Passport",
    official_label: "Emergency Passport",
  },
];

const RESIDENCE_TYPE_OPTIONS = [
  { value: "HOME", text: "HOME", label_zh: "住宅", label_en: "HOME", official_label: "HOME" },
  { value: "HOTEL", text: "HOTEL", label_zh: "酒店", label_en: "HOTEL", official_label: "HOTEL" },
  { value: "VILLA", text: "VILLA", label_zh: "别墅", label_en: "VILLA", official_label: "VILLA" },
  { value: "APARTMENT", text: "APARTMENT", label_zh: "公寓", label_en: "APARTMENT", official_label: "APARTMENT" },
  { value: "OTHERS", text: "OTHERS", label_zh: "其他", label_en: "OTHERS", official_label: "OTHERS" },
];

export const INDONESIA_OFFICIAL_EVISA_FIELDS: BilingualSeedField[] = [
  {
    field_name: "passport_bio_page_upload",
    label: "Passport",
    field_type: "file",
    required: true,
    step_number: 1,
    step_name: "Upload passport and photo",
    display_order: 1,
    placeholder: "Upload the passport bio page exactly as requested on the official portal.",
    validation_rules: {
      official_field_id: "passport-attachment",
      label_zh: "护照资料页",
      official_label_zh: "Passport",
      document_slot: "passport_bio_page",
      acceptedFileTypes: ["image/jpeg", "image/png", "application/pdf"],
    },
  },
  {
    field_name: "formal_photo_upload",
    label: "Newest formal photo",
    field_type: "file",
    required: true,
    step_number: 1,
    step_name: "Upload passport and photo",
    display_order: 2,
    placeholder: "Upload a recent formal photo that follows the official photo instructions.",
    validation_rules: {
      official_field_id: "picture",
      label_zh: "近期证件照",
      official_label_zh: "Newest formal photo",
      document_slot: "formal_photo",
      acceptedFileTypes: ["image/jpeg", "image/png"],
    },
  },
  {
    field_name: "payment_method",
    label: "Payment Method",
    field_type: "radio",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 1,
    options: PAYMENT_METHOD_OPTIONS,
    validation_rules: {
      official_field_name: "paymentMethod",
      official_field_ids: ["paymentMethod-ONLINE", "paymentMethod-OFFLINE"],
      defaultValue: "ONLINE",
      label_zh: "付款方式",
      official_label_zh: "Payment Method",
    },
  },
  {
    field_name: "full_name",
    label: "Full Name",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 2,
    placeholder: "As shown in passport",
    validation_rules: {
      official_field_id: "full_name",
      official_field_name: "full_name",
      label_zh: "姓名",
      official_label_zh: "Full Name",
      maxLength: 100,
    },
  },
  {
    field_name: "gender",
    label: "Gender",
    field_type: "radio",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 3,
    options: GENDER_OPTIONS,
    validation_rules: {
      official_field_name: "gender",
      official_field_ids: ["gender-M", "gender-F"],
      label_zh: "性别",
      official_label_zh: "Gender",
    },
  },
  {
    field_name: "birth_place",
    label: "Birth Place",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 4,
    validation_rules: {
      official_field_id: "birth_place",
      official_field_name: "birth_place",
      label_zh: "出生地",
      official_label_zh: "Birth Place",
      maxLength: 80,
    },
  },
  {
    field_name: "birthday",
    label: "Date of Birth",
    field_type: "date",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 5,
    placeholder: "DD/MM/YYYY",
    validation_rules: {
      official_field_id: "birthday",
      official_field_name: "birthday",
      label_zh: "出生日期",
      official_label_zh: "Date of Birth",
      format: "DD/MM/YYYY",
    },
  },
  {
    field_name: "mobile_phone",
    label: "Phone Number",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 6,
    placeholder: "+Country code and number",
    validation_rules: {
      official_field_id: "mobile_phone",
      official_field_name: "mobile_phone",
      label_zh: "手机号码",
      official_label_zh: "Phone Number",
      maxLength: 16,
      pattern: "^\\+\\d{6,15}$",
    },
  },
  {
    field_name: "document_travel_id",
    label: "Document Type",
    field_type: "select",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 7,
    options: TRAVEL_DOCUMENT_OPTIONS,
    validation_rules: {
      official_field_id: "document_travel_id",
      official_field_name: "document_travel_id",
      defaultValue: "Passport",
      label_zh: "旅行证件类型",
      official_label_zh: "Document Type",
    },
  },
  {
    field_name: "passport_number",
    label: "Document Number",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 8,
    validation_rules: {
      official_field_id: "number",
      official_field_name: "passport_number",
      label_zh: "证件号码",
      official_label_zh: "Document Number",
      maxLength: 30,
    },
  },
  {
    field_name: "passport_country",
    label: "Passport/Country/Region",
    field_type: "country",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 9,
    validation_rules: {
      official_field_id: "country_id",
      official_field_name: "country_id",
      label_zh: "护照所属国家/地区",
      official_label_zh: "Passport/Country/Region",
      source: "ISO3166-1",
      official_sync_targets: ["issuing_country"],
    },
  },
  {
    field_name: "passport_issue_date",
    label: "Date of Issue",
    field_type: "date",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 10,
    placeholder: "DD/MM/YYYY",
    validation_rules: {
      official_field_id: "release_date",
      official_field_name: "release_date",
      label_zh: "签发日期",
      official_label_zh: "Date of Issue",
      format: "DD/MM/YYYY",
    },
  },
  {
    field_name: "passport_expiry_date",
    label: "Date of Expiry",
    field_type: "date",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 11,
    placeholder: "DD/MM/YYYY",
    validation_rules: {
      official_field_id: "expired_date",
      official_field_name: "expired_date",
      label_zh: "有效期至",
      official_label_zh: "Date of Expiry",
      format: "DD/MM/YYYY",
    },
  },
  {
    field_name: "passport_place_of_issue",
    label: "Place of Issue",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 12,
    validation_rules: {
      official_field_id: "release_place",
      official_field_name: "release_place",
      label_zh: "签发地点",
      official_label_zh: "Place of Issue",
      maxLength: 80,
    },
  },
  {
    field_name: "residence_type",
    label: "Residence Type",
    field_type: "select",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 13,
    options: RESIDENCE_TYPE_OPTIONS,
    validation_rules: {
      official_field_id: "residence_type_id",
      official_field_name: "residence_type_id",
      defaultValue: "HOTEL",
      label_zh: "在印尼住宿类型",
      official_label_zh: "Residence Type",
    },
  },
  {
    field_name: "address_in_indonesia",
    label: "Address",
    field_type: "textarea",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 14,
    validation_rules: {
      official_field_id: "address",
      official_field_name: "address",
      label_zh: "在印尼地址",
      official_label_zh: "Address",
      maxLength: 300,
    },
  },
  {
    field_name: "postal_code",
    label: "Postal Code",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 15,
    validation_rules: {
      official_field_id: "postal_code",
      official_field_name: "postal_code",
      label_zh: "邮政编码",
      official_label_zh: "Postal Code",
      placeholder_zh: "输入 5 位邮编后自动填写地区",
      placeholder_en: "Enter 5 digits to auto-fill the region",
      maxLength: 5,
      pattern: "^\\d{5}$",
      official_lookup: "indonesia_postal_code",
    },
  },
  {
    field_name: "province_name",
    label: "Province",
    field_type: "text",
    required: false,
    step_number: 2,
    step_name: "Application form",
    display_order: 16,
    validation_rules: {
      official_field_id: "province_name",
      official_field_name: "province_name",
      label_zh: "省",
      official_label_zh: "Province",
      maxLength: 80,
      auto_filled_by: "postal_code",
    },
  },
  {
    field_name: "city_name",
    label: "City",
    field_type: "text",
    required: false,
    step_number: 2,
    step_name: "Application form",
    display_order: 17,
    validation_rules: {
      official_field_id: "city_name",
      official_field_name: "city_name",
      label_zh: "城市",
      official_label_zh: "City",
      maxLength: 80,
      auto_filled_by: "postal_code",
    },
  },
  {
    field_name: "district_name",
    label: "District",
    field_type: "text",
    required: false,
    step_number: 2,
    step_name: "Application form",
    display_order: 18,
    validation_rules: {
      official_field_id: "district_name",
      official_field_name: "district_name",
      label_zh: "区/县",
      official_label_zh: "District",
      maxLength: 80,
      auto_filled_by: "postal_code",
    },
  },
  {
    field_name: "village_name",
    label: "Village",
    field_type: "text",
    required: false,
    step_number: 2,
    step_name: "Application form",
    display_order: 19,
    validation_rules: {
      official_field_id: "village_name",
      official_field_name: "village_name",
      label_zh: "村/街区",
      official_label_zh: "Village",
      maxLength: 80,
      auto_filled_by: "postal_code",
    },
  },
  {
    field_name: "bank_statement_upload",
    label: "Immigration guarantee / bank statement",
    field_type: "file",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 20,
    placeholder: "Upload the required PDF supporting document for the official portal.",
    validation_rules: {
      official_field_id: "attachment-C1-1",
      official_field_name: "attachment-C1-1",
      label_zh: "资金证明 / 官方补充材料",
      official_label_zh: "Immigration guarantee / bank statement",
      document_slot: "bank_statement",
      acceptedFileTypes: ["application/pdf"],
    },
  },
  {
    field_name: "email",
    label: "Email",
    field_type: "text",
    required: true,
    step_number: 2,
    step_name: "Application form",
    display_order: 21,
    placeholder: "Managed official eVisa account email",
    validation_rules: {
      official_field_id: "email",
      official_field_name: "email",
      label_zh: "邮箱",
      official_label_zh: "Email",
      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    },
  },
  {
    field_name: "information_true_declaration",
    label: "I declare that the information I have provided in this visa application is true.",
    field_type: "checkbox",
    required: true,
    step_number: 3,
    step_name: "Review and submit",
    display_order: 1,
    options: [{ value: "yes", text: "I agree", label_zh: "我同意", label_en: "I agree" }],
    validation_rules: {
      official_section: "Review & Submit",
      label_zh: "我声明本签证申请中提供的信息真实无误。",
      official_label_zh: "I declare that the information I have provided in this visa application is true.",
    },
  },
  {
    field_name: "billing_responsibility_declaration",
    label: "I understand that the billing code/payment must be completed before the application can be processed.",
    field_type: "checkbox",
    required: true,
    step_number: 3,
    step_name: "Review and submit",
    display_order: 2,
    options: [{ value: "yes", text: "I agree", label_zh: "我同意", label_en: "I agree" }],
    validation_rules: {
      official_section: "Review & Submit",
      label_zh: "我理解必须完成官方付款后申请才会继续处理。",
      official_label_zh: "I understand that payment must be completed before the application can be processed.",
    },
  },
];

export async function seedIndonesiaOfficialEVisaFields(input: {
  supabase: SupabaseClient;
  visaType: "ID_C1_TOURIST" | "ID_B1_EVOA";
  fields: BilingualSeedRow[];
}) {
  console.log(`Seeding ${input.fields.length} fields for visa_type="${input.visaType}"...\n`);

  const { error: delError } = await input.supabase
    .from("visa_form_fields")
    .delete()
    .eq("visa_type", input.visaType);
  if (delError) {
    throw new Error(`Error deleting existing ${input.visaType} fields: ${delError.message}`);
  }
  console.log(`Cleared existing ${input.visaType} fields`);

  const batchSize = 20;
  let total = 0;
  for (let i = 0; i < input.fields.length; i += batchSize) {
    const batch = input.fields.slice(i, i + batchSize);
    const { data, error } = await input.supabase
      .from("visa_form_fields")
      .insert(batch)
      .select("id");
    if (error) {
      throw new Error(`Batch ${Math.floor(i / batchSize) + 1} error: ${error.message}`);
    }
    total += data?.length ?? 0;
    process.stdout.write(`Batch ${Math.floor(i / batchSize) + 1}: ${data?.length ?? 0} inserted\n`);
  }

  console.log(`\nDone: ${total} rows seeded (${input.fields.length} defined)`);
}
