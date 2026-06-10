/**
 * Canonical SubmissionResult — written by per-country runners to
 * applications.submission_result (JSONB). User-facing.
 *
 * MIRROR OF viza-be/submission-service/src/submission-result.ts.
 * Keep these two files byte-equivalent below the file-header comment.
 *
 * Also mirrored in viza-fe/internal-website/lib/submission-result.ts.
 *
 * Discriminated by `country`. Status semantics:
 *   - submitted              terminal success (form fully submitted on portal)
 *   - stopped_at_sign        US: reached sign-and-submit gate, halted intentionally
 *   - stopped_at_pay         FR/UK/VN: reached payment gate, halted per policy
 *   - stopped_at_review      AU: form filled to the Review page; user must
 *                            log in to ImmiAccount and click Submit themselves
 *                            (legal requirement — VIZA cannot submit on the
 *                            user's behalf for Subclass 600).
 *   - submitted_pending_email VN: data captured, user must complete payment
 *                            externally; PDF arrives by email post-approval
 *   - registered             UK: account registered, application not yet started
 *   - appointment_held       FR: appointment slot tentatively held pre-payment
 *   - final_review_required FR: official draft created; applicant/operator
 *                            must review before final validation/payment
 *   - submitted_mock         Dry-run only: internal lifecycle completed without
 *                            touching an official portal
 *   - unsupported            Controlled unsupported-country state
 *   - needs_user_action      Safe halt at a human checkpoint such as payment,
 *                            CAPTCHA, final review, or applicant submit
 */

export type SubmissionResult =
  | UsSubmissionResult
  | FrSubmissionResult
  | UkSubmissionResult
  | VnSubmissionResult
  | AuSubmissionResult
  | JpSubmissionResult
  | GenericSubmissionResult;

export interface UsSubmissionResult {
  country: "US";
  status: "stopped_at_sign" | "stopped_at_pay" | "submitted";
  applicationId: string;
  surnameFirst5: string;
  yearOfBirth: number;
  securityQuestion: string;
  securityAnswer?: string;
  securityAnswerCipher?: string;
  embassyOrConsulate: string;
  retrievalUrl: string;
  datStoragePath?: string;
  finalSubmissionMode?: "applicant_handoff" | "external_verified";
}

export interface FrSubmissionResult {
  country: "FR";
  status: "appointment_held" | "stopped_at_pay" | "final_review_required";
  mode?: "dry_run" | "live_assisted";
  provider?: "france_visas_dry_run" | "france_visas_live";
  applicationReference: string;
  reviewDiffStatus?: "not_run" | "passed" | "failed";
  manualAction?: {
    type:
      | "captcha"
      | "login_required"
      | "account_creation_required"
      | "email_verification_required"
      | "final_review_required"
      | "final_validation_required"
      | "payment_required"
      | "appointment_required"
      | "layout_changed"
      | "official_portal_error";
    status: "open" | "completed";
    instructions: string;
  };
  paymentStatus?: "not_required" | "manual_required" | "blocked" | "paid";
  appointmentStatus?: "not_required" | "manual_required" | "blocked" | "booked";
  officialStatus?:
    | "draft_prefilled"
    | "official_record_created"
    | "appointment_required"
    | "payment_required"
    | "lodged_at_visa_centre";
  appointment?: {
    centerName: string;
    address: string;
    atIso: string;
  };
  printablePdfStoragePath?: string;
}

export interface UkSubmissionResult {
  country: "UK";
  status: "registered" | "stopped_at_pay";
  portalUrl: string;
  portalUsername: string;
  generatedPasswordCipher: string;
  applicationReference?: string;
}

export interface VnSubmissionResult {
  country: "VN";
  status:
    | "official_landing_reached"
    | "note_modal_required"
    | "captcha_required"
    | "official_form_reached"
    | "stopped_at_pay"
    | "submitted_pending_email";
  mode?: "dry_run" | "live_assisted";
  provider?: "vietnam_evisa_dry_run" | "vietnam_evisa_live";
  portalUrl?: string;
  checkpoint?: string;
  registrationCode?: string;
  submittedAtIso?: string;
  noticeText?: "Your e-visa PDF will be emailed within ~3 working days.";
  manualAction?: {
    type:
      | "note_modal_required"
      | "captcha_required"
      | "payment_required"
      | "final_submit_required"
      | "layout_changed"
      | "official_portal_error";
    status: "open" | "completed";
    instructions: string;
    screenshotUrl?: string;
  };
  paymentStatus?: "not_required" | "manual_required" | "blocked" | "paid";
}

export interface AuSubmissionResult {
  country: "AU";
  status: "stopped_at_review";
  /** Transaction Reference Number assigned by ImmiAccount to the draft. */
  trn: string;
  /** ImmiAccount applications dashboard URL (resume + submit entry point). */
  portalUrl: string;
  /** ImmiAccount username surfaced back to the applicant for reference. */
  portalUsername: string;
  /** submission-artifacts bucket path; FE mints a signed URL on demand. */
  reviewScreenshotStoragePath?: string;
}

export interface JpSubmissionResult {
  country: "JP";
  /**
   * JP_TOURIST has no online submission portal — the schema is paper-form
   * only, delivered to a designated travel agency (JVAC China). When the
   * applicant finishes the wizard, VIZA renders the MOFA "Application for
   * Visa" Form A as a PDF and surfaces a download CTA. The terminal state
   * is "form_ready_for_agency": the applicant downloads, prints, hands to
   * the agency.
   */
  status: "form_ready_for_agency";
  applicationId: string;
  /**
   * URL the FE hits to stream the filled MOFA Form A PDF. Caller-facing —
   * resolved relative to the website origin.
   */
  formAPdfUrl: string;
}

export interface GenericSubmissionResult {
  country: "GENERIC";
  targetCountry: string;
  visaType: string;
  status: "submitted_mock" | "unsupported" | "action_required";
  mode: "dry_run" | "live_assisted";
  applicationId: string;
  confirmationNumber?: string;
  actionType?: string;
  actionInstructions?: string;
  implementationStatus:
    | "implemented"
    | "sandbox_only"
    | "dry_run_only"
    | "partial"
    | "not_started"
    | "blocked";
  message: string;
}

export type SubmissionResultStatus =
  | "waiting"
  | "processing"
  | "needs_user_action"
  | "completed"
  | "stalled"
  | "submitted"
  | "submitted_mock"
  | "unsupported"
  | "action_required"
  | "stopped_at_sign"
  | "stopped_at_pay"
  | "stopped_at_review"
  | "final_review_required"
  | "form_ready_for_agency"
  | "failed";
