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
}

export const VN_FIELD_MAPPINGS: Record<string, VnFieldMapping> = {
  // Top-of-form uploads
  portrait_photo: { domId: "basic_anhMat", type: "upload", section: "", required: true },
  passport_photo: { domId: "basic_anhHoChieu", type: "upload", section: "", required: true },

  // 1. Personal Information
  surname: { domId: "basic_ttcnHo", type: "text", section: "1. PERSONAL INFORMATION", required: false },
  given_name: { domId: "basic_ttcnDemVaTen", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  date_of_birth: { domId: "basic_ttcnNgayThangNamSinhStr", type: "date", section: "1. PERSONAL INFORMATION", required: false },
  sex: { domId: "basic_ttcnGioiTinh", type: "select", section: "1. PERSONAL INFORMATION", required: true },
  nationality: { domId: "basic_ttcnMaQt", type: "country", section: "1. PERSONAL INFORMATION", required: true },
  identity_card_number: { domId: "basic_ttcnCccd", type: "text", section: "1. PERSONAL INFORMATION", required: false },
  email_address: { domId: "basic_ttcnEmail", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  re_enter_email_address: { domId: "basic_ttcnConfirmEmail", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  religion: { domId: "basic_ttcnTonGiao", type: "text", section: "1. PERSONAL INFORMATION", required: true },
  place_of_birth: { domId: "basic_ttcnNoiSinh", type: "text", section: "1. PERSONAL INFORMATION", required: true },

  // 2. Requested Information
  visa_type_requested: { domId: "basic_nddnTtdtLoai", type: "radio", section: "2. REQUESTED INFORMATION", required: true },
  visa_valid_from: { domId: "basic_nddnTtdtTuNgayStr", type: "date", section: "2. REQUESTED INFORMATION", required: true },
  visa_valid_to: { domId: "basic_nddnTtdtDenNgayStr", type: "date", section: "2. REQUESTED INFORMATION", required: true },

  // 3. Passport Information
  passport_number: { domId: "basic_hcSo", type: "text", section: "3. PASSPORT INFORMATION", required: true },
  passport_issuing_authority: { domId: "basic_hcNoiCap", type: "text", section: "3. PASSPORT INFORMATION", required: false },
  passport_type: { domId: "basic_hcLoai", type: "select", section: "3. PASSPORT INFORMATION", required: true },
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
  occupation: { domId: "basic_nnNgheNghiep", type: "select", section: "5. OCCUPATION", required: false },
  occupation_info: { domId: "basic_nnNgheNghiepHienTai", type: "text", section: "5. OCCUPATION", required: false },
  employer_name: { domId: "basic_nnTenCtyCq", type: "text", section: "5. OCCUPATION", required: false },
  employer_position: { domId: "basic_nnChucVu", type: "text", section: "5. OCCUPATION", required: false },
  employer_address: { domId: "basic_nnDiaChi", type: "text", section: "5. OCCUPATION", required: false },
  employer_phone: { domId: "basic_nnSdt", type: "text", section: "5. OCCUPATION", required: false },

  // 6. Information About the Trip
  purpose_of_entry: { domId: "basic_ttcdMucDich", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  intended_date_of_entry: { domId: "basic_ttcdThoiGianNcStr", type: "date", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  intended_length_of_stay: { domId: "basic_ttcdSoNgayTamTru", type: "text", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  vietnam_phone_number: { domId: "basic_ttcdSdt", type: "text", section: "6. INFORMATION ABOUT THE TRIP", required: false },
  residential_address_in_vietnam: { domId: "basic_ttcdDcTamTru", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  province_city: { domId: "basic_ttcdTinhTp", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  ward_commune: { domId: "basic_ttcdPhuongXa", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  intended_border_gate_entry: { domId: "basic_ttcdNcCuaKhau", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  intended_border_gate_exit: { domId: "basic_ttcdXcCuaKhau", type: "select", section: "6. INFORMATION ABOUT THE TRIP", required: true },
  organization_inviting: { domId: "basic_ttcdCqTcCamDoan", type: "text", section: "6. INFORMATION ABOUT THE TRIP", required: false },

  // 8. Trip's Expenses, Insurance
  intended_expenses_usd: { domId: "basic_kpbhDuTinh", type: "text", section: "8. TRIP'S EXPENSES, INSURANCE", required: false },
  did_you_buy_insurance: { domId: "basic_kpbhMuaBaoHiem", type: "select", section: "8. TRIP'S EXPENSES, INSURANCE", required: false },
  trip_expense_payer: { domId: "basic_kpbhNguoiDamBao", type: "select", section: "8. TRIP'S EXPENSES, INSURANCE", required: false },
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
