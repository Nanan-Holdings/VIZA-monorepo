/**
 * Canonical SubmissionResult — written by per-country runners to
 * applications.submission_result (JSONB). User-facing.
 *
 * MIRROR THIS FILE in:
 *   - viza-be/agent-backend/src/types/submission-result.ts
 *   - viza-fe/internal-website/lib/submission-result.ts
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
  applicationId: string;        // CEAC App ID, AA\w{8,10}
  surnameFirst5: string;        // uppercased first 5 chars of surname
  yearOfBirth: number;
  securityQuestion: string;
  securityAnswer: string;
  embassyOrConsulate: string;
  retrievalUrl: string;         // canonical CEAC retrieval entry URL
  datStoragePath?: string;      // bucket path; FE mints signed URL on demand
}

export interface FrSubmissionResult {
  country: "FR";
  status: "appointment_held" | "stopped_at_pay";
  applicationReference: string; // 13-digit FV reference
  appointment?: {
    centerName: string;
    address: string;
    atIso: string;              // ISO-8601
  };
  printablePdfStoragePath?: string; // bucket path
}

export interface UkSubmissionResult {
  country: "UK";
  status: "registered" | "stopped_at_pay";
  portalUrl: string;
  portalUsername: string;
  /**
   * Encrypted at rest. Cipher format: `<saltHex>:<ciphertextHex>`,
   * scrypt-derived key from SUBMISSION_RESULT_SECRET_KEY env.
   * Decrypt only via /api/applications/:id/uk-portal-credentials with
   * the owning user's session.
   */
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
