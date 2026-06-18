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
  | SgArrivalCardSubmissionResult
  | AuSubmissionResult
  | JpSubmissionResult
  | GenericSubmissionResult
  | GenericEvisaSubmissionResult;

/**
 * POR-006: generic e-Visa result for the launch countries that share the
 * standard halt/submit/paper outcome shape (no bespoke card needed): ID, EG,
 * SA, MY, TH, AE, CA, TR, IT, IN. Rendered by GenericEvisaResultCard.
 * NOTE: the BE mirror (agent-backend submission-result.ts) should add the same
 * member to stay byte-equivalent — tracked sync (the BE drives what's written).
 */
export interface GenericEvisaSubmissionResult {
  country: "ID" | "EG" | "SA" | "MY" | "TH" | "AE" | "CA" | "TR" | "IT" | "IN";
  /** submitted = filed to pre-pay step; stopped_at_pay = halted before gov pay; form_ready_for_agency = paper/VFS pack. */
  status: "submitted" | "stopped_at_pay" | "form_ready_for_agency";
  /** Portal reference / registration code, when captured. */
  reference?: string;
  /** submission-artifacts bucket path for the e-visa / confirmation PDF. */
  artifactStoragePath?: string;
}

export interface UsSubmissionResult {
  country: "US";
  status: "stopped_at_sign" | "stopped_at_pay" | "submitted";
  applicationId: string;
  confirmationNumber?: string;
  submittedAt?: string;
  surnameFirst5: string;
  yearOfBirth: number;
  securityQuestion: string;
  securityAnswer?: string;
  securityAnswerCipher?: string;
  embassyOrConsulate: string;
  retrievalUrl: string;
  datStoragePath?: string;
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
    | "official_record_confirmed"
    | "appointment_required"
    | "payment_required"
    | "lodged_at_visa_centre";
  appointment?: {
    centerName: string;
    address: string;
    atIso: string;
  };
  printablePdfStoragePath?: string;
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
    resultingUrl: string;
  };
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
