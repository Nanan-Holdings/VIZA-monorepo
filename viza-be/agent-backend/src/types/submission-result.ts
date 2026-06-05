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
 *   - submitted_mock         Dry-run only: internal lifecycle completed without
 *                            touching an official portal
 *   - unsupported            Controlled unsupported-country state
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
  securityAnswer: string;
  embassyOrConsulate: string;
  retrievalUrl: string;
  datStoragePath?: string;
}

export interface FrSubmissionResult {
  country: "FR";
  status: "appointment_held" | "stopped_at_pay";
  applicationReference: string;
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
  status: "submitted_pending_email";
  registrationCode: string;
  submittedAtIso: string;
  noticeText: "Your e-visa PDF will be emailed within ~3 working days.";
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
  status: "submitted_mock" | "unsupported";
  mode: "dry_run";
  applicationId: string;
  confirmationNumber?: string;
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
  | "submitted"
  | "submitted_mock"
  | "unsupported"
  | "stopped_at_pay"
  | "stopped_at_review"
  | "form_ready_for_agency"
  | "failed";
