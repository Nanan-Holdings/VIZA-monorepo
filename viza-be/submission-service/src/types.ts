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
    | "uk_blocked";
  attempts: number;
  last_error: string | null;
  /** Structured CEAC run result payload (JSON). Stores handoff_ready, failed,
   *  or blocked outcome metadata for operator diagnostics. */
  ceac_result_payload: Record<string, unknown> | null;
  /** Structured France-Visas run result payload (JSON). */
  fv_result_payload: Record<string, unknown> | null;
  /** France-Visas-assigned 13-digit application reference. */
  fv_application_reference: string | null;
  /** Structured UK Standard Visitor run result payload (JSON). */
  uk_result_payload: Record<string, unknown> | null;
  /** UKVI-assigned application reference once registered. */
  uk_application_reference: string | null;
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
