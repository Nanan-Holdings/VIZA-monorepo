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
 *   - submitted              FR: application lodged through the France-Visas
 *                            visa-center handoff; offline payment/biometrics
 *                            may still be due at the visa center
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
  | SgArrivalCardSubmissionResult
  | DigitalArrivalCardSubmissionResult
  | AuSubmissionResult
  | JpSubmissionResult
  | KrSubmissionResult
  | GenericSubmissionResult;

export interface UsSubmissionResult {
  country: "US";
  status: "stopped_at_sign" | "stopped_at_pay" | "submitted";
  applicationId: string;        // CEAC App ID, AA\w{8,10}
  confirmationNumber?: string;
  submittedAt?: string;
  surnameFirst5: string;        // uppercased first 5 chars of surname
  yearOfBirth: number;
  securityQuestion: string;
  /**
   * Legacy plaintext field kept optional for old rows only. New live-assisted
   * rows must write securityAnswerCipher and display a redacted placeholder.
   */
  securityAnswer?: string;
  securityAnswerCipher?: string;
  embassyOrConsulate: string;
  retrievalUrl: string;         // canonical CEAC retrieval entry URL
  datStoragePath?: string;      // bucket path; FE mints signed URL on demand
  confirmationPdfStoragePath?: string;
  applicationPdfStoragePath?: string;
  emailConfirmationPdfStoragePath?: string;
  finalSubmissionMode?: "applicant_handoff" | "external_verified";
  evidence?: {
    source?: "ceac_confirmation_page" | string;
    submittedAt?: string;
    confirmationText?: string;
    screenshotPath?: string;
  };
}

export interface FrSubmissionResult {
  country: "FR";
  status: "appointment_held" | "stopped_at_pay" | "final_review_required" | "submitted";
  mode?: "dry_run" | "live_assisted";
  provider?: "france_visas_dry_run" | "france_visas_live";
  applicationReference: string; // 13-digit FV reference; redacted for live-assisted rows
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
    | "official_record_confirmed"
    | "appointment_required"
    | "payment_required"
    | "lodged_at_visa_centre";
  appointment?: {
    centerName: string;
    address: string;
    atIso: string;              // ISO-8601
  };
  printablePdfStoragePath?: string; // bucket path
  fieldFallbacks?: Array<{
    step: "step2" | "step5";
    field: string;
    reason: "missing" | "contains_non_latin" | "invalid_format";
    originalPreview: string | null;
    fallbackValue: string;
    vizaRuleSuggestion: string;
  }>;
  postConfirmationContinue?: {
    clickedDeclare: boolean;
    clickedContinue: boolean;
    clickedImportantYes?: boolean;
    clickedRateContinue?: boolean;
    clickedVisaCenterCertification?: boolean;
    clickedSubmitToVisaCenter?: boolean;
    clickedFinalComplete?: boolean;
    finalPdfPath?: string | null;
    feeText?: string | null;
    visaCenterText?: string | null;
    resultingUrl: string;
  };
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
  status:
    | "official_landing_reached"
    | "note_modal_required"
    | "captcha_required"
    | "upload_required"
    | "official_form_reached"
    | "layout_changed"
    | "official_portal_error"
    | "needs_manual_verification"
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
      | "upload_required"
      | "payment_required"
      | "final_submit_required"
      | "layout_changed"
      | "official_portal_error"
      | "needs_manual_verification";
    status: "open" | "completed";
    instructions: string;
    screenshotUrl?: string;
  };
  paymentStatus?: "not_required" | "manual_required" | "blocked" | "paid";
}

export interface SgArrivalCardSubmissionResult {
  country: "SG";
  visaType: "SG_ARRIVAL_CARD";
  status:
    | "scheduled"
    | "submitted"
    | "validation_failed"
    | "official_portal_handoff_required"
    | "official_portal_error";
  mode: "live_assisted";
  provider: "sg_arrival_card_live";
  applicationId: string;
  submitted: boolean;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  /** submission-artifacts bucket path for the ICA confirmation PDF. */
  confirmationPdfStoragePath?: string | null;
  errorDetails?: {
    code: string;
    message: string;
    missingFields?: string[];
  };
  artifacts?: {
    screenshots?: string[];
    pdfs?: string[];
    logs?: string[];
    traces?: string[];
  };
  payloadSummary?: {
    purposeOfTravel?: string | null;
    arrivalDate?: string | null;
    modeOfTravel?: string | null;
    transportNumber?: string | null;
    accommodationAddressProvided: boolean;
  };
}

export interface DigitalArrivalCardSubmissionResult {
  country: "MY" | "TH" | "PH" | "VN";
  visaType: "MY_MDAC_ARRIVAL_CARD" | "TH_TDAC_ARRIVAL_CARD" | "PH_ETRAVEL_ARRIVAL_CARD" | "VN_PREARRIVAL_DECLARATION";
  status: "submitted" | "scheduled" | "validation_failed" | "official_portal_error";
  mode: "live_assisted";
  provider: "malaysia_mdac_live" | "thailand_tdac_live" | "philippines_etravel_live" | "vietnam_prearrival_live";
  applicationId: string;
  submitted: boolean;
  confirmationNumber?: string | null;
  referenceNumber?: string | null;
  portalUrl: string;
  portalResponseSummary: string;
  confirmationPdfStoragePath?: string | null;
  errorDetails?: {
    code: string;
    message: string;
    missingFields?: string[];
  };
  artifacts?: {
    screenshots?: string[];
    pdfs?: string[];
    logs?: string[];
    traces?: string[];
  };
  payloadSummary?: {
    arrivalDate?: string | null;
    departureDate?: string | null;
    modeOfTravel?: string | null;
    transportNumber?: string | null;
    accommodationAddressProvided: boolean;
  };
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

export interface KrSubmissionResult {
  country: "KR";
  status: "form_ready_for_kvac" | "official_eform_required" | "official_eform_ready";
  applicationId: string;
  annex17PdfUrl: string;
  officialEformPdfStoragePath?: string | null;
  officialEformApplicationNumber?: string | null;
  officialEformPortalUrl?: string | null;
  officialEformStatus?:
    | "not_started"
    | "queued"
    | "processing"
    | "manual_action_required"
    | "ready"
    | "failed";
  manualAction?: {
    type:
      | "official_eform_generation_required"
      | "official_eform_portal_review_required"
      | "official_eform_unsupported_for_post"
      | "official_eform_download_required"
      | "official_portal_error";
    status: "open" | "completed";
    instructions: string;
  };
  recommendedCenter?: {
    code: string;
    nameEn: string;
    nameZh: string;
    bookingUrl: string;
    addressZh: string;
  };
  appointmentStatus?: string | null;
}

export interface GenericSubmissionResult {
  country: "GENERIC";
  targetCountry: string;
  visaType: string;
  status: "submitted_mock" | "unsupported" | "action_required";
  mode: "dry_run" | "live_assisted";
  applicationId: string;
  confirmationNumber?: string;
  portalUrl?: string;
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
  | "scheduled"
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
  | "form_ready_for_kvac"
  | "failed";
