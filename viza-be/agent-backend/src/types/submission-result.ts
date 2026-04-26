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
 *   - submitted_pending_email VN: data captured, user must complete payment
 *                            externally; PDF arrives by email post-approval
 *   - registered             UK: account registered, application not yet started
 *   - appointment_held       FR: appointment slot tentatively held pre-payment
 */

export type SubmissionResult =
  | UsSubmissionResult
  | FrSubmissionResult
  | UkSubmissionResult
  | VnSubmissionResult;

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

export type SubmissionResultStatus =
  | "waiting"
  | "processing"
  | "submitted"
  | "stopped_at_pay"
  | "failed";
