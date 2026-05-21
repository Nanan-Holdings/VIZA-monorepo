export interface SubmissionQueueItem {
  id: string;
  application_id: string;
  status:
    | "pending"
    | "processing"
    | "done"
    | "failed"
    | "ds160_prefill_pending"
    | "ds160_prefill_processing"
    | "ds160_prefilled"
    | "ds160_prefill_failed"
    | "ds160_blocked"
    | "fv_prefill_pending"
    | "fv_prefill_processing"
    | "fv_prefilled"
    | "fv_prefill_failed"
    | "fv_blocked"
    | "uk_prefill_pending"
    | "uk_prefill_processing"
    | "uk_prefilled"
    | "uk_prefill_failed"
    | "uk_blocked"
    | "vn_prefill_pending"
    | "vn_prefill_processing"
    | "vn_prefilled"
    | "vn_prefill_failed"
    | "vn_blocked"
    | "au_prefill_pending"
    | "au_prefill_processing"
    | "au_prefilled"
    | "au_prefill_failed"
    | "au_blocked";
  attempts: number;
  last_error: string | null;
  /** Structured CEAC run result payload (JSON). Stores handoff_ready, failed,
   *  or blocked outcome metadata for operator diagnostics. */
  ceac_result_payload: Record<string, unknown> | null;
  /** Structured France-Visas run result payload (JSON). */
  fv_result_payload: Record<string, unknown> | null;
  /** France-Visas-assigned application reference (FRA-format after finalize). */
  fv_application_reference: string | null;
  /** Supabase Storage path to the downloaded CERFA PDF. */
  fv_pdf_storage_path: string | null;
  /** Structured UK Standard Visitor run result payload (JSON). */
  uk_result_payload: Record<string, unknown> | null;
  /** UKVI-assigned application reference once registered. */
  uk_application_reference: string | null;
  /** Structured AU Subclass 600 RunResult payload (JSON). */
  au_result_payload: Record<string, unknown> | null;
  /** ImmiAccount-assigned Transaction Reference Number for the draft. */
  au_trn: string | null;
  /** submission-artifacts bucket path for the captured Review-page screenshot. */
  au_review_screenshot_storage_path: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ImmiAccount credentials row from the `au_accounts` table for the AU
 * Subclass 600 runner. password_encrypted + totp_secret_encrypted decrypted
 * at runtime via secret-cipher.
 */
export interface AuAccount {
  id: string;
  applicant_id: string;
  username: string;
  password_encrypted: string;
  totp_secret_encrypted: string | null;
  resume_trn: string | null;
  storage_state_json: Record<string, unknown> | null;
  last_authenticated_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * UK Standard Visitor account credentials row from the `uk_accounts` table.
 * Mirrors FvAccount; password_encrypted decrypted at runtime via secret-cipher.
 */
export interface UkAccount {
  id: string;
  applicant_id: string;
  email: string;
  password_encrypted: string;
  resume_url: string;
  storage_state_json: Record<string, unknown> | null;
  last_authenticated_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Egypt e-Visa account credentials row from the `eg_accounts` table.
 * password_encrypted decrypted at runtime via secret-cipher.
 */
export interface EgAccount {
  id: string;
  applicant_id: string;
  email: string;
  password_encrypted: string;
  vistk_token: string | null;
  resume_url: string | null;
  storage_state_json: Record<string, unknown> | null;
  last_authenticated_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Italy Schengen VFS-CN appointment portal credentials row from the
 * `it_vfs_cn_accounts` table. Used for VFS appointment booking only — the
 * visa application form itself is the paper Annex I PDF.
 */
export interface ItVfsCnAccount {
  id: string;
  applicant_id: string;
  username: string;
  password_encrypted: string;
  preferred_centre: string | null;
  appointment_reference: string | null;
  appointment_at: string | null;
  storage_state_json: Record<string, unknown> | null;
  last_authenticated_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * France-Visas account credentials row from the `fv_accounts` table.
 * `password_encrypted` is stored encrypted at rest; callers must decrypt
 * before passing to `signInWithPassword()`.
 */
export interface FvAccount {
  id: string;
  applicant_id: string;
  email: string;
  password_encrypted: string;
  storage_state_json: Record<string, unknown> | null;
  last_authenticated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicantProfile {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  occupation: string | null;
  address: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  issuing_country: string | null;
  issuing_authority: string | null;
  email: string | null;
  phone: string | null;
  wechat: string | null;
}

export interface Application {
  id: string;
  applicant_id: string;
  country: string;
  visa_type: string;
  status: string;
  arrival_date: string | null;
  departure_date: string | null;
  port_of_entry: string | null;
  purpose: string | null;
  accommodation_name: string | null;
  accommodation_address: string | null;
  confirmation_number: string | null;
  submitted_at: string | null;
  visa_package_id: string | null;
  ds160_application_id: string | null;
  ds160_retrieval_url: string | null;
  ds160_dat_storage_path: string | null;
}

export interface VisaApplicationAnswer {
  field_name: string;
  value_text: string | null;
  value_json: unknown;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  document_type: string;
  storage_path: string | null;
  status: string;
  file_name: string | null;
}
