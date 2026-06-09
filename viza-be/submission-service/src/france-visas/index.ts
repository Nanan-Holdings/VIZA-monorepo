/**
 * Public surface of the France-Visas helpers.
 *
 * Thin re-export barrel so callers can `import { ... } from "./france-visas"`
 * without reaching into individual modules.
 *
 * France live-assisted helpers use standard Playwright Chromium. CAPTCHA,
 * account creation, email verification, final validation, payment, and
 * appointment booking are applicant-controlled checkpoints.
 */

export {
  FV_URLS,
  FV_REGISTRATION_SELECTORS,
  FV_LANGUAGE_OPTIONS,
  FV_LOGIN_SELECTORS,
  FV_ACCUEIL_SELECTORS,
  FV_NAV_SELECTORS,
  FV_STEP1_FIELDS,
  FV_STEP2_FIELDS,
  FV_STEP3_FIELDS,
  FV_STEP4_FIELDS,
  FV_STEP5_FIELDS,
  FV_STEP6_IS_INFORMATIONAL,
  FV_VISA_TYPE_VALUES,
  FV_PURPOSE_CATEGORY_VALUES,
  FV_TRAVEL_DOCUMENT_VALUES,
  FV_AUTO_FUNDING_VALUES,
  FV_VALIDATION_SUMMARY_SELECTOR,
  FV_FIELD_ERROR_SELECTOR,
  FV_SESSION_EXPIRED_MARKERS,
  FV_CHECK_MAILBOX_MARKERS,
  FV_GATE_MARKERS,
  type FvLanguageOption,
  type FvVisaType,
  type FvPurposeCategory,
  type FvTravelDocument,
  type FvAutoFunding,
} from "./selectors";

export {
  selectPrimeFacesOption,
  selectPrimeFacesRadio,
  setJsfTextInput,
  waitForJsfIdle,
} from "./primefaces-ajax";

export {
  detectPage,
  assertPage,
  waitForPage,
  type FvPageId,
  type PageIdentityResult,
} from "./pages";

export {
  FvError,
  UnexpectedPageError,
  SessionExpiredError,
  NavigationError,
  ValidationFailedError,
  SessionBootstrapError,
  RegistrationFailedError,
  InboxTimeoutError,
  GateDetectedError,
  serializeError,
  type FvErrorCode,
  type FvErrorContext,
} from "./errors";

export {
  detectGate,
  assertNoGate,
  isGateError,
  type FvGateKind,
  type GateDetectionResult,
} from "./gates";

export {
  pollInboxForVerificationLink,
  FV_VERIFICATION_EMAIL_FILTERS,
  type MailboxProvider,
} from "./inbox-poller";

export {
  registerFvAccount,
  type FvRegistrationInput,
  type FvRegistrationOptions,
  type FvRegistrationResult,
  type FvStealthHandles,
} from "./registration";

export {
  restoreFvSession,
  signInWithPassword,
  type FvSignInInput,
  type FvSignInOptions,
  type FvRestoreSessionOptions,
  type FvSessionHandles,
} from "./sign-in";

export {
  makeSessionCloser,
  type FvSession,
} from "./session";

export {
  startNewApplication,
  finalizeAndDownloadPdf,
  type CreateApplicationOptions,
  type FinalizeOptions,
  type FinalizeResult,
} from "./accueil";

export {
  advance,
  goBack,
  saveCurrent,
  readValidationMessages,
  hasValidationErrors,
  type FvNavAction,
  type FvValidationReport,
  type NavigateOptions,
} from "./navigator";

export {
  orchestrateFvFill,
  type FvOrchestrateOptions,
  type FvOrchestrateResult,
  type FvSectionCoverage,
} from "./orchestrator";

export {
  fillStep1,
  fillStep2,
  fillStep3,
  fillStep4,
  fillStep5,
} from "./fill-steps";

export {
  fillFranceVisasApplication,
  type FillFranceVisasInput,
  type FillFranceVisasOptions,
  type FillFranceVisasResult,
} from "./run";

export {
  type FvApplicationAnswers,
  type FvStep1Answers,
  type FvStep2Answers,
  type FvStep3Answers,
  type FvStep4Answers,
  type FvStep5Answers,
} from "./field-mappings";

export {
  normalizeFvAnswers,
  buildAnswerMap,
  toFvCountryCode,
  toFvDate,
  NormalizationError,
  type AnswerMap,
  type NormalizeInput,
} from "./normalize";

export {
  setJsfCheckbox,
  setJsfCheckboxGroup,
} from "./primefaces-ajax";
