export interface SubmissionQueueItem {
  id: string;
  application_id: string;
  user_id?: string | null;
  status:
    | "pending"
    | "processing"
    | "done"
    | "failed"
    | "stalled"
    | "ds160_prefill_pending"
    | "ds160_prefill_processing"
    | "ds160_prefilled"
    | "ds160_prefill_failed"
    | "ds160_live_assisted_pending"
    | "ds160_live_assisted_processing"
    | "ds160_live_assisted_failed"
    | "ds160_proof_pending"
    | "ds160_proof_processing"
    | "ds160_proof_failed"
    | "ds160_blocked"
    | "fv_prefill_pending"
    | "fv_prefill_processing"
    | "fv_prefilled"
    | "fv_prefill_failed"
    | "fv_blocked"
    | "france_live_assisted_pending"
    | "france_live_processing"
    | "france_live_official_portal_opened"
    | "action_required"
    | "needs_manual_verification"
    | "uk_prefill_pending"
    | "uk_prefill_processing"
    | "uk_prefilled"
    | "uk_prefill_failed"
    | "uk_blocked"
    | "vn_dry_run_pending"
    | "vn_dry_run_processing"
    | "vn_dry_run_failed"
    | "vn_live_assisted_pending"
    | "vn_live_assisted_processing"
    | "vn_live_assisted_failed"
    | "vn_prefill_pending"
    | "vn_prefill_processing"
    | "vn_prefilled"
    | "vn_prefill_failed"
    | "vn_payment_pending"
    | "vn_payment_processing"
    | "vn_payment_paid"
    | "vn_payment_failed"
    | "vn_blocked"
    | "sgac_dry_run_pending"
    | "sgac_dry_run_processing"
    | "sgac_dry_run_failed"
    | "sgac_live_assisted_pending"
    | "sgac_live_assisted_scheduled"
    | "sgac_live_assisted_processing"
    | "sgac_live_assisted_failed"
    | "sgac_live_assisted_cancelled"
    | "sgac_blocked"
    | "mdac_dry_run_pending"
    | "mdac_dry_run_processing"
    | "mdac_dry_run_failed"
    | "mdac_live_assisted_pending"
    | "mdac_live_assisted_scheduled"
    | "mdac_live_assisted_processing"
    | "mdac_live_assisted_failed"
    | "mdac_live_assisted_cancelled"
    | "mdac_blocked"
    | "tdac_dry_run_pending"
    | "tdac_dry_run_processing"
    | "tdac_dry_run_failed"
    | "tdac_live_assisted_pending"
    | "tdac_live_assisted_scheduled"
    | "tdac_live_assisted_processing"
    | "tdac_live_assisted_failed"
    | "tdac_live_assisted_cancelled"
    | "tdac_blocked"
    | "au_prefill_pending"
    | "au_prefill_processing"
    | "au_prefilled"
    | "au_prefill_failed"
    | "au_blocked";
  attempts: number;
  mode?: "dry_run" | "live_assisted" | string | null;
  provider?: string | null;
  last_error: string | null;
  official_application_id_encrypted?: string | null;
  official_application_reference_encrypted?: string | null;
  official_confirmation_number_encrypted?: string | null;
  official_security_question_encrypted?: string | null;
  official_security_answer_encrypted?: string | null;
  official_location?: string | null;
  official_account_email_encrypted?: string | null;
  official_receipt_url?: string | null;
  official_cerfa_pdf_url?: string | null;
  official_confirmation_url?: string | null;
  official_error_code?: string | null;
  official_error_message?: string | null;
  live_started_at?: string | null;
  live_submitted_at?: string | null;
  live_checkpoint?: string | null;
  live_trace_url?: string | null;
  live_screenshot_url?: string | null;
  official_confirmation_screenshot_url?: string | null;
  official_review_snapshot_id?: string | null;
  review_diff_status?: "not_run" | "passed" | "failed" | string | null;
  manual_action_status?: string | null;
  current_stage?: string | null;
  started_at?: string | null;
  heartbeat_at?: string | null;
  filing_location?: string | null;
  external_service_provider?: "VFS" | "TLS" | "CAPAGO" | "CONSULATE" | "UNKNOWN" | string | null;
  appointment_status?: string | null;
  payment_status?: string | null;
  official_status?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  final_user_confirmation_at?: string | null;
  final_user_confirmation_ip_hash?: string | null;
  final_user_confirmation_user_agent_hash?: string | null;
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
  /** Structured Vietnam e-Visa run result payload (JSON). */
  vn_result_payload?: Record<string, unknown> | null;
  /** Encrypted official Vietnam e-Visa registration code. */
  vn_registration_code_encrypted?: string | null;
  official_portal_url?: string | null;
  official_trace_url?: string | null;
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
  applicant_id?: string | null;
  application_id?: string | null;
  submission_queue_id?: string | null;
  user_id?: string | null;
  email: string;
  password_encrypted: string;
  official_account_email_encrypted?: string | null;
  official_account_password_encrypted?: string | null;
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
