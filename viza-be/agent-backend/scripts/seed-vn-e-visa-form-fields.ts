/**
 * Seed script: visa_form_fields for Vietnam E-Visa — v2 (live-portal aligned).
 *
 * Field definitions mirror the live Vietnam Immigration Department e-Visa
 * portal at https://evisa.gov.vn/e-visa/foreigners as captured by the
 * Playwright recon in viza-be/submission-service/src/vietnam/form-recon.ts
 * on 2026-04-24. Every field_name carries the live DOM `id` in a
 * `live_dom_id` validation_rules key so downstream submission automation
 * can locate it without a separate mapping.
 *
 * Scope: single e-Visa product (up to 90 days, single/multiple entry,
 * all nationalities eligible under Resolution 127/NQ-CP of 15 Aug 2023).
 * Step numbers (1-9) mirror the live section order 1-8 + a declaration
 * trailer. The live form is single-page — steps are a UI grouping, not
 * a wizard.
 *
 * Document uploads (passport photo, passport data page) are intentionally
 * out-of-schema per playbook §5.6 — they live in application_documents.
 *
 * Run: npx tsx scripts/seed-vn-e-visa-form-fields.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env.local") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const VISA_TYPE = "VN_E_VISA";

interface FieldDef {
  field_name: string;
  label: string;
  field_type: string;
  required: boolean;
  step_number: number;
  step_name: string;
  display_order: number;
  placeholder?: string;
  validation_rules?: Record<string, unknown>;
  options?: Array<{ value: string; text: string }>;
  conditional_logic?: Record<string, unknown>;
}

const YES_NO = [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }];

// Reusable gate constants
const HAS_MULTIPLE_NATIONALITIES = "has_multiple_nationalities === yes";
const VIOLATED_LAWS = "has_violated_vietnam_laws === yes";
const HAS_RELATIVES_VN = "has_relatives_in_vietnam === yes";
const VISITED_VN_LAST_YEAR = "visited_vietnam_in_last_year === yes";

// ── Enum option tables ─────────────────────────────────────────────────────
// Values reflect the live form surface where scraped; where only partial
// capture was possible, best-effort values from the in-repo
// vietnam-visa-helper-v1 extension are used. Gap report §5.1 tracks the
// live-portal option scrape that is still pending.

// ── All option lists below are LIVE-SCRAPED from evisa.gov.vn on 2026-04-24
// via viza-be/submission-service/src/vietnam/form-recon-v3.ts (canonical.json).
// See docs/vietnam-visa-qa-report-2026-04-24.md for the capture methodology.

const SEX_OPTIONS = [
  { value: "male", text: "Male" },
  { value: "female", text: "Female" },
];

// Live list: 4 options (includes an "Other" fallback not commonly documented).
const PASSPORT_TYPE_OPTIONS = [
  { value: "ordinary_passport", text: "Ordinary passport" },
  { value: "diplomatic_passport", text: "Diplomatic passport" },
  { value: "official_passport", text: "Official passport" },
  { value: "other", text: "Other" },
];

// Live list: 7 options (no "Housewife" category on the live form).
const OCCUPATION_OPTIONS = [
  { value: "businessman", text: "Businessman" },
  { value: "employee", text: "Employee" },
  { value: "official", text: "Official" },
  { value: "others", text: "Others" },
  { value: "retired", text: "Retired" },
  { value: "student", text: "Student" },
  { value: "unemployed", text: "Unemployed" },
];

// Live list: 5 options in exact live order.
const PURPOSE_OF_ENTRY_OPTIONS = [
  { value: "tourist", text: "Tourist" },
  { value: "visiting_relatives", text: "Visiting relatives" },
  { value: "working", text: "Working" },
  { value: "business", text: "Business" },
  { value: "other", text: "Other" },
];

const VISA_TYPE_REQUESTED_OPTIONS = [
  { value: "single", text: "Single-entry" },
  { value: "multiple", text: "Multiple-entry" },
];

// Live list: 2 options (no "Sponsor" / "Other" on the live form — trip is
// either personally funded or company-funded).
const EXPENSE_COVERAGE_OPTIONS = [
  { value: "personal", text: "Personal" },
  { value: "company", text: "Company" },
];

// Live list: 34 province-level administrative units. Vietnam reorganised
// from 63 provinces to 34 in the June 2025 consolidation (Resolution
// 60/NQ-TW). Order is the exact live render order (alphabetically grouped
// but non-strict — preserved verbatim for UX parity).
const PROVINCE_OPTIONS = [
  { value: "an_giang", text: "AN GIANG" },
  { value: "bac_ninh", text: "BAC NINH" },
  { value: "cao_bang", text: "CAO BANG" },
  { value: "ca_mau", text: "CA MAU" },
  { value: "gia_lai", text: "GIA LAI" },
  { value: "ha_tinh", text: "HA TINH" },
  { value: "hung_yen", text: "HUNG YEN" },
  { value: "khanh_hoa", text: "KHANH HOA" },
  { value: "lai_chau", text: "LAI CHAU" },
  { value: "lam_dong", text: "LAM DONG" },
  { value: "lao_cai", text: "LAO CAI" },
  { value: "lang_son", text: "LANG SON" },
  { value: "nghe_an", text: "NGHE AN" },
  { value: "quang_ngai", text: "QUANG NGAI" },
  { value: "ninh_binh", text: "NINH BINH" },
  { value: "quang_ninh", text: "QUANG NINH" },
  { value: "phu_tho", text: "PHU THO" },
  { value: "quang_tri", text: "QUANG TRI" },
  { value: "hue_city", text: "HUE City" },
  { value: "son_la", text: "SON LA" },
  { value: "ha_noi_city", text: "HA NOI City" },
  { value: "can_tho_city", text: "CAN THO City" },
  { value: "hai_phong_city", text: "HAI PHONG City" },
  { value: "thanh_hoa", text: "THANH HOA" },
  { value: "ho_chi_minh_city", text: "HO CHI MINH City" },
  { value: "thai_nguyen", text: "THAI NGUYEN" },
  { value: "da_nang_city", text: "DA NANG City" },
  { value: "tuyen_quang", text: "TUYEN QUANG" },
  { value: "dien_bien", text: "DIEN BIEN" },
  { value: "tay_ninh", text: "TAY NINH" },
  { value: "dak_lak", text: "DAK LAK" },
  { value: "vinh_long", text: "VINH LONG" },
  { value: "dong_nai", text: "DONG NAI" },
  { value: "dong_thap", text: "DONG THAP" },
];

// Live list: 79 border gates (air + land + sea combined). Exact live
// render order preserved. Labels match the government's Vietnamese-English
// shipping-and-border-gate nomenclature.
const BORDER_GATE_OPTIONS = [
  { value: "an_thoi_port_border_gate_an_giang_province", text: "An Thoi Port Border Gate, An Giang province" },
  { value: "ben_luc_port_border_gate_tay_ninh_province", text: "Ben Luc Port Border Gate, Tay Ninh province" },
  { value: "ben_thuy_port_border_gate_nghe_an_province", text: "Ben Thuy Port Border Gate, Nghe An province" },
  { value: "binh_hiep_international_border_gate_tay_ninh_province", text: "Binh Hiep international border gate, Tay Ninh province" },
  { value: "bo_y_landport", text: "Bo Y Landport" },
  { value: "ca_na_port_border_gate_khanh_hoa_province", text: "Ca Na Port Border Gate, Khanh Hoa province" },
  { value: "cam_pha_seaport", text: "Cam Pha Seaport" },
  { value: "cam_ranh_int_airport_khanh_hoa", text: "Cam Ranh Int Airport (Khanh Hoa)" },
  { value: "can_tho_international_airport", text: "Can Tho International Airport" },
  { value: "cau_treo_landport", text: "Cau Treo Landport" },
  { value: "cat_bi_int_airport_hai_phong", text: "Cat Bi Int Airport (Hai Phong)" },
  { value: "cha_lo_landport", text: "Cha Lo Landport" },
  { value: "chan_may_seaport", text: "Chan May Seaport" },
  { value: "da_nang_international_airport", text: "Da Nang International Airport" },
  { value: "chu_lai_airport_border_gate", text: "Chu Lai Airport Border Gate" },
  { value: "da_nang_seaport", text: "Da Nang Seaport" },
  { value: "cua_viet_port_border_gate_quang_tri_province", text: "Cua Viet Port Border Gate, Quang Tri province" },
  { value: "diem_dien_port_border_gate_hung_yen_province", text: "Diem Dien Port Border Gate, Hung Yen province" },
  { value: "dong_hoi_int_airport_quang_binh", text: "Dong Hoi Int Airport (Quang Binh)" },
  { value: "dinh_ba_international_border_gate_dong_thap_province", text: "Dinh Ba international border gate, Dong Thap province" },
  { value: "dong_thap_port_border_gate_dong_thap_province", text: "Dong Thap Port Border Gate, Dong Thap province" },
  { value: "dong_dang_international_border_gate_lang_son_province", text: "Dong Dang international border gate, Lang Son province" },
  { value: "dung_quat_seaport", text: "Dung Quat Seaport" },
  { value: "giao_long_port_border_gate_vinh_long_province", text: "Giao Long Port Border Gate, Vinh Long province" },
  { value: "duong_dong_seaport", text: "Duong Dong Seaport" },
  { value: "ha_tien_landport", text: "Ha Tien Landport" },
  { value: "gianh_port_border_gate_quang_tri_province", text: "Gianh Port Border Gate, Quang Tri province" },
  { value: "hai_phong_seaport", text: "Hai Phong Seaport" },
  { value: "hon_chong_port_border_gate_an_giang_province", text: "Hon Chong Port Border Gate, An Giang province" },
  { value: "hai_thinh_port_border_gate_ninh_binh_province", text: "Hai Thinh Port Border Gate, Ninh Binh province" },
  { value: "hon_gai_seaport", text: "Hon Gai Seaport" },
  { value: "ho_chi_minh_city_seaport", text: "Ho Chi Minh City Seaport" },
  { value: "hon_la_port_border_gate_quang_tri_province", text: "Hon La Port Border Gate, Quang Tri province" },
  { value: "la_lay_landport", text: "La Lay Landport" },
  { value: "huu_nghi_landport", text: "Huu Nghi Landport" },
  { value: "lao_bao_landport", text: "Lao Bao Landport" },
  { value: "ky_ha_port_border_gate_da_nang_province", text: "Ky Ha Port Border Gate, Da Nang province" },
  { value: "lao_cai_landport", text: "Lao Cai Landport" },
  { value: "lien_huong_port_border_gate_lam_dong_province", text: "Lien Huong Port Border Gate, Lam Dong province" },
  { value: "lao_cai_international_border_gate_railway_lao_cai_province", text: "Lao Cai international border gate (Railway), Lao Cai province" },
  { value: "lien_khuong_international_airport", text: "Lien Khuong International Airport" },
  { value: "le_thanh_international_border_gate_gia_lai_province", text: "Le Thanh international border gate, Gia Lai province" },
  { value: "long_sap_international_border_gate_son_la_province", text: "Long Sap international border gate, Son La province" },
  { value: "my_thoi_port_border_gate_an_giang_province", text: "My Thoi Port Border Gate, An Giang province" },
  { value: "moc_bai_landport", text: "Moc Bai Landport" },
  { value: "na_meo_landport", text: "Na Meo Landport" },
  { value: "mong_cai_landport", text: "Mong Cai Landport" },
  { value: "nam_can_landport", text: "Nam Can Landport" },
  { value: "nghi_son_seaport", text: "Nghi Son Seaport" },
  { value: "nam_can_port_border_gate_ca_mau_province", text: "Nam Can Port Border Gate, Ca Mau province" },
  { value: "nha_trang_seaport", text: "Nha Trang Seaport" },
  { value: "nam_giang_international_border_gate_da_nang_province", text: "Nam Giang international border gate, Da Nang province" },
  { value: "ninh_chu_port_border_gate_khanh_hoa_province", text: "Ninh Chu Port Border Gate, Khanh Hoa province" },
  { value: "phu_bai_int_airport", text: "Phu Bai Int Airport" },
  { value: "ninh_phuc_port_border_gate_ninh_binh_province", text: "Ninh Phuc Port Border Gate, Ninh Binh province" },
  { value: "phu_cat_int_airport", text: "Phu Cat Int Airport" },
  { value: "noi_bai_int_airport", text: "Noi Bai Int Airport" },
  { value: "phu_quoc_international_airport", text: "Phu Quoc International Airport" },
  { value: "sa_ky_port_border_gate_quang_ngai_province", text: "Sa Ky Port Border Gate, Quang Ngai province" },
  { value: "phu_quy_port_border_gate_lam_dong_province", text: "Phu Quy Port Border Gate, Lam Dong province" },
  { value: "soai_riep_hiep_phuoc_port_border_gate_dong_thap_province", text: "Soai Riep - Hiep Phuoc Port Border Gate, Dong Thap province" },
  { value: "quy_nhon_seaport", text: "Quy Nhon Seaport" },
  { value: "son_duong_port_border_gate_ha_tinh_province", text: "Son Duong Port Border Gate Ha Tinh province" },
  { value: "tay_trang_landport", text: "Tay Trang Landport" },
  { value: "tan_nam_international_border_gate_tay_ninh_province", text: "Tan Nam international border gate, Tay Ninh province" },
  { value: "thanh_thuy_international_border_gate_tuyen_quang_province", text: "Thanh Thuy international border gate, Tuyen Quang province" },
  { value: "tan_son_nhat_int_airport_ho_chi_minh_city", text: "Tan Son Nhat Int Airport (Ho Chi Minh City)" },
  { value: "thuan_an_port_border_gate_hue_city", text: "Thuan An Port Border Gate, Hue City" },
  { value: "tra_linh_international_border_gate_cao_bang_province", text: "Tra Linh international border gate, Cao Bang province" },
  { value: "thuong_phuoc_international_border_gate_dong_thap_province", text: "Thuong Phuoc international border gate, Dong Thap province" },
  { value: "truong_long_hoa_port_border_gate_vinh_long_province", text: "Truong Long Hoa Port Border Gate, Vinh Long province" },
  { value: "tinh_bien_landport", text: "Tinh Bien Landport" },
  { value: "van_don_int_airport", text: "Van Don Int Airport" },
  { value: "vinh_xuong_landport", text: "Vinh Xuong Landport" },
  { value: "van_gia_port_border_gate_quang_ninh_province", text: "Van Gia Port Border Gate, Quang Ninh province" },
  { value: "vung_ro_port_border_gate_dak_lak_province", text: "Vung Ro Port Border Gate Dak Lak province" },
  { value: "vinh_airport_border_gate", text: "Vinh Airport Border Gate" },
  { value: "vung_tau_seaport", text: "Vung Tau Seaport" },
  { value: "xa_mat_landport", text: "Xa Mat Landport" },
];

const INSURANCE_OPTIONS = [
  { value: "yes", text: "Yes" },
  { value: "no", text: "No" },
];

const FIELDS: FieldDef[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Personal Information  (live section "1. PERSONAL INFORMATION")
  // Live captured 10 ant-form-items + 2 inline Yes/No toggles.
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "surname", label: "Surname (Last name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 1, placeholder: "Enter surname", validation_rules: { maxLength: 50, live_dom_id: "basic_ttcnHo" } },
  { field_name: "given_name", label: "Middle and given name (First name)", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 2, placeholder: "Enter middle and given name", validation_rules: { maxLength: 50, live_dom_id: "basic_ttcnDemVaTen" } },
  { field_name: "date_of_birth", label: "Date of birth", field_type: "date", required: true, step_number: 1, step_name: "Personal Information", display_order: 3, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", live_dom_id: "basic_ttcnNgayThangNamSinhStr" } },
  { field_name: "sex", label: "Sex", field_type: "select", required: true, step_number: 1, step_name: "Personal Information", display_order: 4, placeholder: "Choose one", options: SEX_OPTIONS, validation_rules: { live_dom_id: "basic_ttcnGioiTinh" } },
  { field_name: "nationality", label: "Nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 5, placeholder: "Choose nationality", validation_rules: { source: "ISO3166-1", live_dom_id: "basic_ttcnMaQt" } },
  { field_name: "identity_card_number", label: "Identity Card", field_type: "text", required: false, step_number: 1, step_name: "Personal Information", display_order: 6, placeholder: "ID Card", validation_rules: { maxLength: 30, live_dom_id: "basic_ttcnCccd" } },
  { field_name: "email_address", label: "Email", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 7, placeholder: "Enter email", validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", live_dom_id: "basic_ttcnEmail" } },
  { field_name: "re_enter_email_address", label: "Re-enter Email", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 8, placeholder: "Re-enter email", validation_rules: { maxLength: 100, pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", live_dom_id: "basic_ttcnConfirmEmail" } },
  { field_name: "religion", label: "Religion", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 9, placeholder: "Enter religion", validation_rules: { maxLength: 40, live_dom_id: "basic_ttcnTonGiao" } },
  { field_name: "place_of_birth", label: "Place of birth", field_type: "text", required: true, step_number: 1, step_name: "Personal Information", display_order: 10, placeholder: "Enter place of birth", validation_rules: { maxLength: 80, live_dom_id: "basic_ttcnNoiSinh" } },

  // Inline Yes/No toggles rendered outside ant-form-item on live (screenshot-confirmed)
  { field_name: "has_multiple_nationalities", label: "Have you ever held any other nationalities?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 11, options: YES_NO, validation_rules: { live_dom_id: "basic_ttcnCoQtKhac" } },
  { field_name: "other_nationality", label: "Other nationality", field_type: "country", required: true, step_number: 1, step_name: "Personal Information", display_order: 12, conditional_logic: { showIf: HAS_MULTIPLE_NATIONALITIES }, validation_rules: { source: "ISO3166-1", repeatable: true, repeat_group: "other_nationalities", max_items: 3 } },
  { field_name: "has_violated_vietnam_laws", label: "Have you violated Vietnamese laws/regulations?", field_type: "radio", required: true, step_number: 1, step_name: "Personal Information", display_order: 13, options: YES_NO, validation_rules: { live_dom_id: "basic_ttcnViPhamPl" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Requested Information  (live section "2. REQUESTED INFORMATION")
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "visa_type_requested", label: "Type of visa requested", field_type: "radio", required: true, step_number: 2, step_name: "Requested Information", display_order: 1, options: VISA_TYPE_REQUESTED_OPTIONS, validation_rules: { live_dom_id: "basic_nddnTtdtLoai" } },
  { field_name: "visa_valid_from", label: "Grant e-Visa valid from", field_type: "date", required: true, step_number: 2, step_name: "Requested Information", display_order: 2, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "visa_validity", live_dom_id: "basic_nddnTtdtTuNgayStr" } },
  { field_name: "visa_valid_to", label: "To", field_type: "date", required: true, step_number: 2, step_name: "Requested Information", display_order: 3, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "visa_validity", live_dom_id: "basic_nddnTtdtDenNgayStr" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Passport Information  (live section "3. PASSPORT INFORMATION")
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "passport_number", label: "Passport", field_type: "text", required: true, step_number: 3, step_name: "Passport Information", display_order: 1, placeholder: "Enter passport", validation_rules: { maxLength: 20, live_dom_id: "basic_hcSo" } },
  { field_name: "passport_issuing_authority", label: "Issuing Authority/Place of issue", field_type: "text", required: false, step_number: 3, step_name: "Passport Information", display_order: 2, placeholder: "Enter Issuing Authority/Place of issue", validation_rules: { maxLength: 100, live_dom_id: "basic_hcNoiCap" } },
  { field_name: "passport_type", label: "Type", field_type: "select", required: true, step_number: 3, step_name: "Passport Information", display_order: 3, placeholder: "Choose one", options: PASSPORT_TYPE_OPTIONS, validation_rules: { live_dom_id: "basic_hcLoai" } },
  { field_name: "passport_issue_date", label: "Date of issue", field_type: "date", required: true, step_number: 3, step_name: "Passport Information", display_order: 4, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates", live_dom_id: "basic_hcNgayCapStr" } },
  { field_name: "passport_expiry_date", label: "Expiry date", field_type: "date", required: true, step_number: 3, step_name: "Passport Information", display_order: 5, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", inline_group: "passport_dates", live_dom_id: "basic_hcGiaTriDenStr" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Contact Information  (live section "4. CONTACT INFORMATION")
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "permanent_residential_address", label: "Permanent residential address", field_type: "text", required: true, step_number: 4, step_name: "Contact Information", display_order: 1, placeholder: "Enter permanent residential address", validation_rules: { maxLength: 200, live_dom_id: "basic_ttllDcThuongTru" } },
  { field_name: "contact_address", label: "Contact address", field_type: "text", required: true, step_number: 4, step_name: "Contact Information", display_order: 2, placeholder: "Enter contact address", validation_rules: { maxLength: 200, live_dom_id: "basic_ttllDcLienHe" } },
  { field_name: "telephone_number", label: "Telephone number", field_type: "text", required: true, step_number: 4, step_name: "Contact Information", display_order: 3, placeholder: "Enter telephone number", validation_rules: { maxLength: 20, live_dom_id: "basic_ttllSdt" } },
  // Emergency contact sub-block — live form renders these as 4 plain form-items with bold "Emergency contact" divider above
  { field_name: "emergency_contact_full_name", label: "Full name", field_type: "text", required: true, step_number: 4, step_name: "Contact Information", display_order: 4, placeholder: "Enter name", validation_rules: { maxLength: 100, block_group: "emergency_contact", live_dom_id: "basic_ttllLlHoTen" } },
  { field_name: "emergency_contact_current_address", label: "Current residential address", field_type: "text", required: true, step_number: 4, step_name: "Contact Information", display_order: 5, placeholder: "Enter current residential address", validation_rules: { maxLength: 200, block_group: "emergency_contact", live_dom_id: "basic_ttllLlNoiOHienTai" } },
  { field_name: "emergency_contact_telephone", label: "Telephone number", field_type: "text", required: true, step_number: 4, step_name: "Contact Information", display_order: 6, placeholder: "Enter telephone number", validation_rules: { maxLength: 20, block_group: "emergency_contact", live_dom_id: "basic_ttllLlSdt" } },
  { field_name: "emergency_contact_relationship", label: "Relationship", field_type: "text", required: true, step_number: 4, step_name: "Contact Information", display_order: 7, placeholder: "Enter relationship", validation_rules: { maxLength: 40, block_group: "emergency_contact", live_dom_id: "basic_ttllLlQuanHe" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Occupation  (live section "5. OCCUPATION")
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "occupation", label: "Occupation", field_type: "select", required: false, step_number: 5, step_name: "Occupation", display_order: 1, placeholder: "Enter occupation", options: OCCUPATION_OPTIONS, validation_rules: { live_dom_id: "basic_nnNgheNghiep" } },
  { field_name: "occupation_info", label: "Occupation Info", field_type: "text", required: false, step_number: 5, step_name: "Occupation", display_order: 2, placeholder: "Enter occupation info", validation_rules: { maxLength: 100, live_dom_id: "basic_nnNgheNghiepHienTai" } },
  { field_name: "company_or_school_name", label: "Name of Company/Agency/School", field_type: "text", required: false, step_number: 5, step_name: "Occupation", display_order: 3, placeholder: "Enter name of Company/Agency/School", validation_rules: { maxLength: 120, live_dom_id: "basic_nnTenCtyCq" } },
  { field_name: "position_course", label: "Position/Course of study", field_type: "text", required: false, step_number: 5, step_name: "Occupation", display_order: 4, placeholder: "Enter position/Course of study", validation_rules: { maxLength: 80, live_dom_id: "basic_nnChucVu" } },
  { field_name: "company_address", label: "Address of Company/Agency/School", field_type: "text", required: false, step_number: 5, step_name: "Occupation", display_order: 5, placeholder: "Enter address of Company/Agency/School", validation_rules: { maxLength: 200, live_dom_id: "basic_nnDiaChi" } },
  { field_name: "company_phone", label: "Company/agency/school phone number", field_type: "text", required: false, step_number: 5, step_name: "Occupation", display_order: 6, placeholder: "Enter telephone number", validation_rules: { maxLength: 20, live_dom_id: "basic_nnSdt" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: Information About the Trip  (live section "6. INFORMATION ABOUT THE TRIP")
  // Live captured 9 ant-form-items + 1 checkbox + 2 inline Yes/No toggles.
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "purpose_of_entry", label: "Purpose of entry", field_type: "select", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 1, placeholder: "Choose one", options: PURPOSE_OF_ENTRY_OPTIONS, validation_rules: { live_dom_id: "basic_ttcdMucDich" } },
  { field_name: "intended_date_of_entry", label: "Intended date of entry", field_type: "date", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 2, placeholder: "DD/MM/YYYY", validation_rules: { format: "DD/MM/YYYY", live_dom_id: "basic_ttcdThoiGianNcStr" } },
  { field_name: "intended_length_of_stay", label: "Intended length of stay in Viet Nam (days)", field_type: "text", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 3, placeholder: "Enter number of days", validation_rules: { pattern: "^(?:[1-9][0-9]?|90)$", live_dom_id: "basic_ttcdSoNgayTamTru" } },
  { field_name: "phone_in_vietnam", label: "Phone number (in Viet Nam)", field_type: "text", required: false, step_number: 6, step_name: "Information About the Trip", display_order: 4, placeholder: "Enter phone number", validation_rules: { maxLength: 20, live_dom_id: "basic_ttcdSdt" } },
  // Residential address in Viet Nam is a SELECT on the live form but its
  // option list is loaded lazily (server-side autocomplete based on typing).
  // We surface it as a text field since we can't enumerate options statically;
  // the live DOM ID is preserved so a submission bot can locate it.
  { field_name: "residential_address_in_vietnam", label: "Residential address in Viet Nam", field_type: "text", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 5, placeholder: "Enter address", validation_rules: { maxLength: 200, live_dom_id: "basic_ttcdDcTamTru", live_control: "dependent_select" } },
  { field_name: "intended_province_city", label: "Province/city", field_type: "select", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 6, placeholder: "Enter City/Province", options: PROVINCE_OPTIONS, validation_rules: { live_dom_id: "basic_ttcdTinhTp" } },
  // Ward/commune is a province-dependent SELECT on the live form — type-flipped from v1.
  // We cannot enumerate options statically (they depend on province), so we store as select
  // with an empty option list and rely on the province selection to populate at render time.
  // A future enhancement: wire up a dependent-select loader.
  { field_name: "intended_ward_commune", label: "Ward / commune", field_type: "select", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 7, placeholder: "Enter Ward / Commune", options: [], validation_rules: { dependent_on: "intended_province_city", live_dom_id: "basic_ttcdPhuongXa" } },
  { field_name: "intended_border_gate_of_entry", label: "Intended border gate of entry", field_type: "select", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 8, placeholder: "Choose one", options: BORDER_GATE_OPTIONS, validation_rules: { live_dom_id: "basic_ttcdNcCuaKhau" } },
  { field_name: "intended_border_gate_of_exit", label: "Intended border gate of exit", field_type: "select", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 9, placeholder: "Choose one", options: BORDER_GATE_OPTIONS, validation_rules: { live_dom_id: "basic_ttcdXcCuaKhau" } },
  { field_name: "declaration_temporary_residence", label: "Committed to declare temporary residence according to the provisions of Vietnamese law", field_type: "checkbox", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 10, options: [{ value: "yes", text: "I agree" }] },
  // Inline Yes/No toggles (screenshot-confirmed)
  { field_name: "visited_vietnam_in_last_year", label: "Have you ever been to Viet Nam in the last 01 year?", field_type: "radio", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 11, options: YES_NO, validation_rules: { live_dom_id: "basic_ttcdDaDenVn" } },
  { field_name: "visited_vietnam_purpose_detail", label: "Purpose of the last visit and date of arrival", field_type: "textarea", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 12, conditional_logic: { showIf: VISITED_VN_LAST_YEAR }, validation_rules: { maxLength: 500 } },
  { field_name: "has_relatives_in_vietnam", label: "Do you have relatives currently residing in Viet Nam?", field_type: "radio", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 13, options: YES_NO, validation_rules: { live_dom_id: "basic_ttcdCoThanNhan" } },
  { field_name: "relative_full_name_in_vn", label: "Relative's full name", field_type: "text", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 14, conditional_logic: { showIf: HAS_RELATIVES_VN }, validation_rules: { maxLength: 100, block_group: "relatives_in_vn" } },
  { field_name: "relative_date_of_birth", label: "Relative's date of birth", field_type: "date", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 15, conditional_logic: { showIf: HAS_RELATIVES_VN }, validation_rules: { format: "DD/MM/YYYY", block_group: "relatives_in_vn" } },
  { field_name: "relative_nationality", label: "Relative's nationality", field_type: "country", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 16, conditional_logic: { showIf: HAS_RELATIVES_VN }, validation_rules: { source: "ISO3166-1", block_group: "relatives_in_vn" } },
  { field_name: "relative_relationship", label: "Relationship to you", field_type: "text", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 17, conditional_logic: { showIf: HAS_RELATIVES_VN }, placeholder: "e.g., Brother, Uncle, Cousin", validation_rules: { maxLength: 40, block_group: "relatives_in_vn" } },
  { field_name: "relative_address_in_vn", label: "Relative's address in Vietnam", field_type: "text", required: true, step_number: 6, step_name: "Information About the Trip", display_order: 18, conditional_logic: { showIf: HAS_RELATIVES_VN }, validation_rules: { maxLength: 200, block_group: "relatives_in_vn" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: Accompanying Children Under 14  (live section "7. ACCOMPANYING CHILDREN")
  // Live form renders this as an <a-table> with columns: Full name / Sex /
  // Date of birth (DD/MM/YYYY) / Portrait photography / Add-delete. Modelled
  // as a repeatable group of 3 data fields (the portrait photo is a document
  // upload — out-of-schema per playbook §5.6, lives in application_documents).
  // Not conditional: the table is always visible; empty if no children.
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "child_full_name", label: "Full name (child under 14 on same passport)", field_type: "text", required: false, step_number: 7, step_name: "Accompanying Children Under 14", display_order: 1, validation_rules: { maxLength: 100, repeatable: true, repeat_group: "accompanying_children", max_items: 10 } },
  { field_name: "child_sex", label: "Sex", field_type: "select", required: false, step_number: 7, step_name: "Accompanying Children Under 14", display_order: 2, options: SEX_OPTIONS, validation_rules: { repeatable: true, repeat_group: "accompanying_children" } },
  { field_name: "child_date_of_birth", label: "Date of birth", field_type: "date", required: false, step_number: 7, step_name: "Accompanying Children Under 14", display_order: 3, validation_rules: { format: "DD/MM/YYYY", repeatable: true, repeat_group: "accompanying_children" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8: Trip Expenses & Insurance  (live section "8. TRIP'S EXPENSES, INSURANCE")
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "intended_expenses_usd", label: "Intended expenses (in USD)", field_type: "text", required: false, step_number: 8, step_name: "Trip Expenses & Insurance", display_order: 1, placeholder: "Enter intended expenses", validation_rules: { pattern: "^[0-9]{1,6}$", live_dom_id: "basic_kpbhDuTinh" } },
  { field_name: "bought_travel_insurance", label: "Did you buy insurance?", field_type: "select", required: false, step_number: 8, step_name: "Trip Expenses & Insurance", display_order: 2, placeholder: "Choose one", options: INSURANCE_OPTIONS, validation_rules: { live_dom_id: "basic_kpbhMuaBaoHiem" } },
  { field_name: "expense_coverage", label: "Who will cover the trip's expenses of the applicant", field_type: "select", required: false, step_number: 8, step_name: "Trip Expenses & Insurance", display_order: 3, placeholder: "Choose one", options: EXPENSE_COVERAGE_OPTIONS, validation_rules: { live_dom_id: "basic_kpbhNguoiDamBao" } },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 9: Declaration  (live form footer)
  // Single consent checkbox above the Submit button.
  // ═══════════════════════════════════════════════════════════════════════════
  { field_name: "violation_of_vietnam_laws_details", label: "Please give details of the violation", field_type: "textarea", required: true, step_number: 9, step_name: "Declaration", display_order: 1, conditional_logic: { showIf: VIOLATED_LAWS }, validation_rules: { maxLength: 1000 } },
  { field_name: "final_declaration", label: "I hereby declare that the above statements are true, accurate, and complete, and I accept responsibility under Vietnamese law for any false declaration", field_type: "checkbox", required: true, step_number: 9, step_name: "Declaration", display_order: 2, options: [{ value: "yes", text: "I agree" }] },
];

// ─── Seed Runner ────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${FIELDS.length} fields for visa_type="${VISA_TYPE}"...\n`);

  const { error: delError } = await supabase
    .from("visa_form_fields")
    .delete()
    .eq("visa_type", VISA_TYPE);
  if (delError) {
    console.error(`Error deleting existing ${VISA_TYPE} fields:`, delError.message);
  } else {
    console.log(`Cleared existing ${VISA_TYPE} fields`);
  }

  const rows = FIELDS.map((f) => ({
    visa_type: VISA_TYPE,
    field_name: f.field_name,
    label: f.label,
    field_type: f.field_type,
    required: f.required,
    step_number: f.step_number,
    step_name: f.step_name,
    display_order: f.display_order,
    placeholder: f.placeholder ?? null,
    validation_rules: f.validation_rules ?? null,
    options: f.options ?? null,
    conditional_logic: f.conditional_logic ?? null,
  }));

  const BATCH = 20;
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("visa_form_fields")
      .insert(batch)
      .select("id");
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      total += data?.length ?? 0;
      process.stdout.write(`Batch ${Math.floor(i / BATCH) + 1}: ${data?.length ?? 0} inserted\n`);
    }
  }
  console.log(`\nDone: ${total} rows seeded (${FIELDS.length} defined)`);
}

seed().catch((err) => { console.error(err); process.exit(1); });
