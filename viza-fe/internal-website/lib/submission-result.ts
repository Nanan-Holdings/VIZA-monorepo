/**
 * Canonical SubmissionResult — read from applications.submission_result.
 *
 * MIRROR OF viza-be/agent-backend/src/types/submission-result.ts.
 * Keep these two files byte-equivalent below the file-header comment.
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
 */

export type SubmissionResult =
  | UsSubmissionResult
  | FrSubmissionResult
  | UkSubmissionResult
  | VnSubmissionResult
  | AuSubmissionResult
  | JpSubmissionResult;

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

export type SubmissionResultStatus =
  | "waiting"
  | "processing"
  | "submitted"
  | "stopped_at_pay"
  | "stopped_at_review"
  | "form_ready_for_agency"
  | "failed";
