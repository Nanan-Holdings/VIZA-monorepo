/**
 * Public surface of the Taiwan Online Entry Permit helpers.
 * Mirrors the src/uk/index.ts barrel.
 */

export { TW_URLS, startTwSession, type TwSession, type TwSessionOptions } from "./session";

export {
  TwError,
  TwUnexpectedPageError,
  TwNavigationError,
  TwSessionBootstrapError,
  TwGateDetectedError,
  TwTermsModalError,
  TwOfficialLoginConfigurationError,
  TwOfficialLoginError,
  TwEmailVerificationError,
  TwFieldVerificationError,
  TwFileUploadError,
  TwDuplicateRunError,
  TwFieldNotMappedError,
  TwWidgetFillError,
  TwNormalizationError,
  isTwGateError,
  serializeTwError,
  type TwErrorCode,
  type TwErrorContext,
} from "./errors";

export { detectGate, assertNoGate, type TwGateKind, type TwGateResult } from "./gates";

export { normalizeTwAnswers, type TwAnswerMap, type TwNormalizeInput } from "./normalize";

export {
  twFillText,
  twFillTextarea,
  twSelectByValue,
  twPickRadio,
  twPickRadioInGroup,
  twPickCheckbox,
  twUploadFile,
  twClickButtonOrLink,
  isAtTwCaptchaBoundary,
  twFillByName,
  twSelectByName,
  twPickRadioByValue,
  twPickCheckboxByName,
  twUploadFileByName,
  twUploadFileByDocumentDescription,
  twFillByNameStrict,
  twSelectByNameStrict,
  twPickRadioByValueStrict,
  twPickCheckboxByNameStrict,
  twUploadFileByNameStrict,
  twUploadFileByDocumentDescriptionStrict,
  twFillDateByName,
  twFillDateByNameStrict,
  type TwFieldVerificationEntry,
  type TwVerifiedFieldKind,
  type TwScope,
} from "./fillers";

export { waitForTwVerificationCode, type TwVerificationCodeEmail } from "./inbox";

export {
  createTwOfficialLoginProvider,
  createTwOfficialLoginProviderFromEnvironment,
  createTwOfficialLoginOtpProvider,
  createTwOfficialLoginOtpProviderFromEnvironment,
  setTwOfficialLoginProviderForRuntime,
  setTwOfficialLoginOtpProviderForRuntime,
  TwInboxEmailOtpProvider,
  twFailClosedOfficialLoginProvider,
  twFailClosedOfficialLoginOtpProvider,
  type TwEmailOtpProvider,
  type TwEmailOtpRequest,
  type TwOfficialLoginInput,
  type TwOfficialLoginOtpProvider,
  type TwOfficialLoginOtpRequest,
  type TwOfficialLoginProvider,
  type TwOfficialLoginResult,
} from "./auth";

export {
  fillTwEntryPermitApplication,
  HK_MACAU_EMBASSY_OFFICE_VALUES,
  clickEnterApplication,
  type TwApplyInput,
  type TwApplyOptions,
  type TwFillResult,
} from "./apply";

export {
  TW_OFFICIAL_TERMS_CONSENT_VERSION,
  assertTwOfficialTermsConsentAudit,
  parseTwOfficialTermsConsentAudit,
  type TwOfficialTermsConsentAudit,
} from "./official-terms-consent";

export {
  runTwFormalRunnerPreflight,
  type TwFormalPreflightDiagnostic,
  type TwFormalPreflightInput,
  type TwFormalPreflightOptions,
  type TwFormalPreflightPhase,
  type TwFormalPreflightResult,
} from "./formal-preflight";

export {
  collectTwOfficialValidationIssues,
  runTwRepairSubmissionLoop,
  type TwOfficialValidationIssue,
  type TwRepairFailure,
  type TwRepairFailureCategory,
  type TwRepairOperation,
  type TwRepairPlanItem,
  type TwRepairSubmissionResult,
} from "./repair-loop";

export {
  parseTwOfficialReceiptEvidence,
  readTwOfficialReceiptEvidence,
  type TwOfficialReceiptEvidence,
  type TwOfficialReceiptEvidenceSource,
} from "./receipt";

export {
  TW_CAPTCHA_BOUNDARY,
  clickTwFinalSubmit,
  getTwCaptchaMaxAttempts,
  getTwCaptchaTimeoutMs,
  solveAndFillTwCaptchaOnce,
  solveTwCaptchaAndSubmitOnce,
  solveTwCaptchaAndSubmitWithRetry,
  solveTwCaptchaForSubmitWithRetry,
  type TwCaptchaClickSubmitOutcome,
  type TwCaptchaFillOutcome,
  type TwCaptchaSubmitOutcome,
  type TwCaptchaSolveWithTelemetry,
} from "./captcha";

export {
  tryCaptureTwScreenshot,
  tryCaptureTwMaskedScreenshot,
  type TwScreenshotArtifact,
  type CaptureTwScreenshotOptions,
} from "./diagnostics";
export {
  buildTwRunMetadata,
  fingerprintTwPage,
  summarizeTwFieldAudit,
  type TwFieldVerificationSummary,
  type TwPageFingerprint,
  type TwRunMetadata,
} from "./run-metadata";

export {
  registerTwApplicantHandoff,
  waitForTwApplicantSubmission,
  type TwApplicantHandoffRegistration,
} from "./applicant-handoff";
