import { VN_COUNTRY_NAME_BY_ALPHA3 } from "./country-options.js";

/**
 * Vietnam e-Visa field-name → live DOM id mapping.
 *
 * Sourced from `viza-be/agent-backend/scripts/seed-vn-e-visa-form-fields.ts`
 * (the `live_dom_id` validation_rules key on each field) and verified against
 * the recon dump at `vn-recon-out-v3/canonical.json`. All ids are
 * Ant Design Vue control ids visible on `https://evisa.gov.vn/e-visa/foreigners`.
 *
 * Keep this map in lock-step with the seed — when adding a new field to the
 * seed, also add it here so the runner can fill it.
 */

export type VnFieldType =
  | "text"
  | "select"
  | "date"
  | "radio"
  | "country"
  | "checkbox"
  | "upload"
  | "textarea";

export interface VnFieldMapping {
  /** Ant Design Vue control id (e.g. "basic_ttcnHo"). */
  domId: string;
  type: VnFieldType;
  /** Section heading on the form (informational). */
  section: string;
  /** True when the portal flags the field as required. */
  required: boolean;
  /** Maps stored schema option values to portal-visible English labels. */
  optionLabels?: Record<string, string>;
}

export interface VnFieldFallbackRecord {
  fieldName: string;
  domId: string;
  type: VnFieldType;
  userValue: string;
  fallbackValue: string;
  reason: string;
  schemaRuleSuggestion: {
    pattern?: string;
    maxLength?: number;
    fallbackDefault: string;
    normalizeToUppercase?: boolean;
  };
}

const YES_NO_LABELS = { yes: "Yes", no: "No", true: "Yes", false: "No" };
const SEX_LABELS = { male: "Male", m: "Male", female: "Female", f: "Female" };
const COUNTRY_NAME_BY_NORMALIZED = Object.fromEntries(
  Object.values(VN_COUNTRY_NAME_BY_ALPHA3).map((name) => [normalizeCountryLookupKey(name), name]),
);
const NATIONALITY_DEMONYM_LABELS: Record<string, string> = {
  chinese: "China",
  hungarian: "Hungary",
  panamanian: "Panama",
  vietnamese: "Vietnam",
  american: VN_COUNTRY_NAME_BY_ALPHA3.USA,
  british: VN_COUNTRY_NAME_BY_ALPHA3.GBR,
};
const NATIONALITY_LABELS = buildCountryOptionLabels({
  cn: "China",
  prc: "China",
  chinese: "China",
});
const PASSPORT_TYPE_LABELS = {
  ordinary_passport: "Ordinary passport",
  diplomatic_passport: "Diplomatic passport",
  official_passport: "Official passport",
  other: "Other",
};
const VISA_TYPE_REQUESTED_LABELS = {
  single: "Single-entry",
  single_entry: "Single-entry",
  multiple: "Multiple-entry",
  multiple_entry: "Multiple-entry",
};
const PURPOSE_OF_ENTRY_LABELS = {
  tourist: "Tourist",
  tourism: "Tourist",
  visiting_relatives: "Visiting relatives",
  working: "Working",
  business: "Business",
  other: "Other",
};
const OCCUPATION_LABELS = {
  businessman: "Businessman",
  employee: "Employee",
  official: "Official",
  others: "Others",
  retired: "Retired",
  student: "Student",
  unemployed: "Unemployed",
};
const EXPENSE_COVERAGE_LABELS = {
  personal: "Personal",
  company: "Company",
};
const EXPENSE_PAYMENT_METHOD_LABELS = {
  cash: "Cash",
  credit_card: "Credit card",
  travellers_cheques: "Traveller's cheques",
  traveller_cheques: "Traveller's cheques",
  traveler_cheques: "Traveller's cheques",
};

const PROVINCE_LABELS: Record<string, string> = {
  an_giang: "AN GIANG",
  bac_ninh: "BAC NINH",
  cao_bang: "CAO BANG",
  ca_mau: "CA MAU",
  gia_lai: "GIA LAI",
  ha_tinh: "HA TINH",
  hung_yen: "HUNG YEN",
  khanh_hoa: "KHANH HOA",
  lai_chau: "LAI CHAU",
  lam_dong: "LAM DONG",
  lao_cai: "LAO CAI",
  lang_son: "LANG SON",
  nghe_an: "NGHE AN",
  quang_ngai: "QUANG NGAI",
  ninh_binh: "NINH BINH",
  quang_ninh: "QUANG NINH",
  phu_tho: "PHU THO",
  quang_tri: "QUANG TRI",
  hue_city: "HUE City",
  son_la: "SON LA",
  ha_noi_city: "HA NOI City",
  can_tho_city: "CAN THO City",
  hai_phong_city: "HAI PHONG City",
  thanh_hoa: "THANH HOA",
  ho_chi_minh_city: "HO CHI MINH City",
  thai_nguyen: "THAI NGUYEN",
  da_nang_city: "DA NANG City",
  tuyen_quang: "TUYEN QUANG",
  dien_bien: "DIEN BIEN",
  tay_ninh: "TAY NINH",
  dak_lak: "DAK LAK",
  vinh_long: "VINH LONG",
  dong_nai: "DONG NAI",
  dong_thap: "DONG THAP",
};

function titleizeOptionSlug(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => {
      if (part === "int") return "Int";
      if (part === "usa") return "USA";
      return `${part.charAt(0).toUpperCase()}${part.slice(1)}`;
    })
    .join(" ");
}

function provinceLabel(value: string): string {
  return value
    .replace(/_city$/, "")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

const VN_BORDER_GATE_LABELS: Record<string, string> = {
  noi_bai_int_airport_ha_noi: "Noi Bai Int Airport",
  noi_bai_int_airport: "Noi Bai Int Airport",
  noi_bai_international_airport: "Noi Bai Int Airport",
  tan_son_nhat_int_airport_ho_chi_minh_city: "Tan Son Nhat Int Airport (Ho Chi Minh City)",
  cat_bi_int_airport_hai_phong: "Cat Bi Int Airport (Hai Phong)",
  da_nang_int_airport_da_nang: "Da Nang Int Airport (Da Nang)",
  bo_y_landport: "Bo Y Landport",
  moc_bai_landport: "Moc Bai Landport",
  cha_lo_landport: "Cha Lo Landport",
  cau_treo_landport: "Cau Treo Landport",
};

export function getVnPortalOptionText(fieldName: string, rawValue: string): string {
  const mapping = VN_FIELD_MAPPINGS[fieldName];
  const normalized = rawValue.trim().toLowerCase();
  const normalizedSlug = normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const explicit = mapping?.optionLabels?.[normalized];
  if (explicit) return explicit;
  const countryText = normalizeVnCountryOptionText(rawValue);
  if (
    countryText &&
    (mapping?.type === "country" || fieldName.toLowerCase().includes("nationality"))
  ) {
    return countryText;
  }
  if (fieldName === "intended_province_city" && PROVINCE_LABELS[normalized]) {
    return PROVINCE_LABELS[normalized];
  }
  if (fieldName === "intended_province_city") return provinceLabel(normalized);
  if (fieldName === "intended_ward_commune") return titleizeOptionSlug(normalized).toUpperCase();
  if (
    fieldName === "intended_border_gate_of_entry" ||
    fieldName === "intended_border_gate_of_exit"
  ) {
    const explicitBorderGate = VN_BORDER_GATE_LABELS[normalized] ?? VN_BORDER_GATE_LABELS[normalizedSlug];
    if (explicitBorderGate) return explicitBorderGate;
    return titleizeOptionSlug(normalized)
      .replace(/\bInt Airport\b/g, "Int Airport")
      .replace(/\bInternational Airport\b/g, "International Airport")
      .replace(/\bPort Border Gate\b/g, "Port Border Gate")
      .replace(/\bInternational Border Gate\b/g, "international border gate")
      .replace(/\bLandport\b/g, "Landport")
      .replace(/\bSeaport\b/g, "Seaport");
  }
  return rawValue;
}

export function normalizeVnCountryOptionText(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const alpha3 = trimmed.toUpperCase();
  if (/^[A-Z]{3}$/.test(alpha3) && VN_COUNTRY_NAME_BY_ALPHA3[alpha3]) {
    return VN_COUNTRY_NAME_BY_ALPHA3[alpha3];
  }
  const lookup = normalizeCountryLookupKey(trimmed);
  return COUNTRY_NAME_BY_NORMALIZED[lookup] ?? NATIONALITY_DEMONYM_LABELS[lookup] ?? null;
}

function buildCountryOptionLabels(extra: Record<string, string> = {}): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [alpha3, name] of Object.entries(VN_COUNTRY_NAME_BY_ALPHA3)) {
    labels[alpha3.toLowerCase()] = name;
    labels[normalizeCountryLookupKey(name)] = name;
  }
  return { ...labels, ...extra };
}

function normalizeCountryLookupKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(citizen|national|nationality|passport|holder|of|the)\b/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getVnFieldFallbackValue(fieldName: string): string | null {
  void fieldName;
  return null;
}

export function normalizeVnProvinceKey(rawValue: string | null | undefined): string {
  return (rawValue ?? "")
    .trim()
    .toLowerCase()
    .replace(/\bcity\b/g, "_city")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getVnDependentFieldFallbackValue(
  fieldName: string,
  answers: Record<string, string>,
): string | null {
  void fieldName;
  void answers;
  return null;
}

export function buildVnFieldFallback(input: {
  fieldName: string;
  domId: string;
  type: VnFieldType;
  userValue: string;
  fallbackValue?: string | null;
  errorMessage: string;
}): VnFieldFallbackRecord | null {
  void input;
  return null;
}

export const VN_FIELD_MAPPINGS: Record<string, VnFieldMapping> = {
  // Top-of-form uploads
  portrait_photo: { domId: "basic_anhMat", type: "upload", section: "", required: true },
  passport_copy: { domId: "basic_anhHoChieu", type: "upload", section: "", required: true },
  passport_photo: { domId: "basic_anhHoChieu", type: "upload", section: "", required: true },

  // 1. Personal Information
  surname: { domId: "basic_ttcnHo", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  given_name: { domId: "basic_ttcnDemVaTen", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  date_of_birth: { domId: "basic_ttcnNgayThangNamSinhStr", type: "date", section: "1. PERSONAL INFORMATION", required: true },
  sex: { domId: "basic_ttcnGioiTinh", type: "select", section: "1. PERSONAL INFORMATION", required: true, optionLabels: SEX_LABELS },
  nationality: { domId: "basic_ttcnMaQt", type: "country", section: "1. PERSONAL INFORMATION", required: true, optionLabels: NATIONALITY_LABELS },
  identity_card_number: { domId: "basic_ttcnCccd", type: "text", section: "1. PERSONAL INFORMATION", required: false },
  email_address: { domId: "basic_ttcnEmail", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  re_enter_email_address: { domId: "basic_ttcnConfirmEmail", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  religion: { domId: "basic_ttcnTonGiao", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  place_of_birth: { domId: "basic_ttcnNoiSinh", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  has_multiple_nationalities: { domId: "basic_ttcnCoQtKhac", type: "radio", section: "1. PERSONAL INFORMATION", required: true, optionLabels: YES_NO_LABELS },
  has_other_passports_used_for_vietnam: { domId: "basic_ttcnDaDungHcKhacVaoVn", type: "radio", section: "1. PERSONAL INFORMATION", required: true, optionLabels: YES_NO_LABELS },
  has_violated_vietnam_laws: { domId: "basic_ttcnViPhamPl", type: "radio", section: "1. PERSONAL INFORMATION", required: true, optionLabels: YES_NO_LABELS },

  // 2. Requested Information
  visa_type_requested: { domId: "basic_nddnTtdtLoai", type: "radio", section: "2. REQUESTED INFORMATION", required: true, optionLabels: VISA_TYPE_REQUESTED_LABELS },
  visa_valid_from: { domId: "basic_nddnTtdtTuNgayStr", type: "date", section: "2. REQUESTED INFORMATION", required: true },
  visa_valid_to: { domId: "basic_nddnTtdtDenNgayStr", type: "date", section: "2. REQUESTED INFORMATION", required: true },

  // 3. Passport Information
  passport_number: { domId: "basic_hcSo", type: "text", section: "3. PASSPORT INFORMATION", required: true },
  passport_issuing_authority: { domId: "basic_hcNoiCap", type: "text", section: "3. PASSPORT INFORMATION", required: false },
  passport_type: { domId: "basic_hcLoai", type: "select", section: "3. PASSPORT INFORMATION", required: true, optionLabels: PASSPORT_TYPE_LABELS },
  passport_issue_date: { domId: "basic_hcNgayCapStr", type: "date", section: "3. PASSPORT INFORMATION", required: true },
  passport_expiry_date: { domId: "basic_hcGiaTriDenStr", type: "date", section: "3. PASSPORT INFORMATION", required: true },

  // 4. Contact Information
  permanent_residential_address: { domId: "basic_ttllDcThuongTru", type: "text", section: "4. CONTACT INFORMATION", required: true },
  contact_address: { domId: "basic_ttllDcLienHe", type: "text", section: "4. CONTACT INFORMATION", required: true },
  telephone_number: { domId: "basic_ttllSdt", type: "text", section: "4. CONTACT INFORMATION", required: true },
  emergency_contact_full_name: { domId: "basic_ttllLlHoTen", type: "text", section: "4. CONTACT INFORMATION", required: true },
  emergency_contact_current_address: { domId: "basic_ttllLlNoiOHienTai", type: "text", section: "4. CONTACT INFORMATION", required: true },
  emergency_contact_telephone: { domId: "basic_ttllLlSdt", type: "text", section: "4. CONTACT INFORMATION", required: true },
  emergency_contact_relationship: { domId: "basic_ttllLlQuanHe", type: "text", section: "4. CONTACT INFORMATION", required: true },

  // 5. Occupation
  occupation: { domId: "basic_nnNgheNghiep", type: "select", section: "5. OCCUPATION", required: false, optionLabels: OCCUPATION_LABELS },
  occupation_info: { domId: "basic_nnNgheNghiepHienTai", type: "text", section: "5. OCCUPATION", required: false },
  company_or_school_name: { domId: "basic_nnTenCtyCq", type: "text", section: "5. OCCUPATION", required: false },
  position_course: { domId: "basic_nnChucVu", type: "text", section: "5. OCCUPATION", required: false },
  company_address: { domId: "basic_nnDiaChi", type: "text", section: "5. OCCUPATION", required: false },
  company_phone: { domId: "basic_nnSdt", type: "text", section: "5. OCCUPATION", required: false },

  // 6. Information About the Trip
  purpose_of_entry: { domId: "basic_ttcdMucDich", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true, optionLabels: PURPOSE_OF_ENTRY_LABELS },
  intended_date_of_entry: { domId: "basic_ttcdThoiGianNcStr", type: "date", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  intended_length_of_stay: { domId: "basic_ttcdSoNgayTamTru", type: "text", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  phone_in_vietnam: { domId: "basic_ttcdSdt", type: "text", section: "6. INFORMATION ABOUT THE TRIP", required: false },
  residential_address_in_vietnam: { domId: "basic_ttcdDcTamTru", type: "text", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  intended_province_city: { domId: "basic_ttcdTinhTp", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  intended_ward_commune: { domId: "basic_ttcdPhuongXa", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  intended_border_gate_of_entry: { domId: "basic_ttcdNcCuaKhau", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  intended_border_gate_of_exit: { domId: "basic_ttcdXcCuaKhau", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  declaration_temporary_residence: { domId: "basic_ttcdCqTcCamDoan", type: "checkbox", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  has_contact_in_vietnam: { domId: "basic_ttcdCoCqTcCaNhanLienHe", type: "radio", section: "6. INFORMATION ABOUT THE TRIP", required: true, optionLabels: YES_NO_LABELS },
  visited_vietnam_in_last_year: { domId: "basic_ttcdDaDenVn", type: "radio", section: "6. INFORMATION ABOUT THE TRIP", required: true, optionLabels: YES_NO_LABELS },
  has_relatives_in_vietnam: { domId: "basic_ttcdCoThanNhan", type: "radio", section: "6. INFORMATION ABOUT THE TRIP", required: true, optionLabels: YES_NO_LABELS },

  // 8. Trip's Expenses, Insurance
  intended_expenses_usd: { domId: "basic_kpbhDuTinh", type: "text", section: "8. TRIP'S EXPENSES, INSURANCE", required: false },
  bought_travel_insurance: { domId: "basic_kpbhMuaBaoHiem", type: "select", section: "8. TRIP'S EXPENSES, INSURANCE", required: false, optionLabels: YES_NO_LABELS },
  expense_coverage: { domId: "basic_kpbhNguoiDamBao", type: "select", section: "8. TRIP'S EXPENSES, INSURANCE", required: false, optionLabels: EXPENSE_COVERAGE_LABELS },
  expense_payment_method: { domId: "basic_kpbhHinhThuc", type: "select", section: "8. TRIP'S EXPENSES, INSURANCE", required: true, optionLabels: EXPENSE_PAYMENT_METHOD_LABELS },
};

/** Selector for the registration-code element shown after a successful save
 *  (pre-payment review). The portal renders it as `Mã hồ sơ: <code>` near
 *  the top of the review screen. */
export const VN_REGISTRATION_CODE_SELECTOR = '[class*="ho-so"], [class*="registration-code"], [class*="mahsoreg"]';

/** Pay/submit button label patterns — runner halts as soon as one of these
 *  becomes the dominant CTA. */
export const VN_STOP_BUTTON_PATTERNS: readonly RegExp[] = [
  /^pay\b/i,
  /^thanh toán/i,
  /^submit\b/i,
  /^xác nhận và thanh toán/i,
  /^proceed to payment/i,
];
