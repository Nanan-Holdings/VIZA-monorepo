/**
 * Public surface of the CEAC DS-160 helpers.
 *
 * Keep this file as a thin re-export barrel so callers can `import { ... }
 * from "./ceac"` without reaching into individual modules.
 */

export {
  CEAC_URLS,
  CEAC_NAV_SELECTORS,
  CEAC_HEADING_SELECTOR,
  CEAC_VALIDATION_SUMMARY_SELECTOR,
  CEAC_FIELD_ERROR_SELECTOR,
  CEAC_APPLICATION_ID_SELECTORS,
  CEAC_APPLICATION_ID_PATTERN,
  CEAC_SESSION_EXPIRED_MARKERS,
  CEAC_SIGN_AND_SUBMIT_MARKERS,
} from "./selectors";

export {
  detectPage,
  assertPage,
  waitForPage,
  type CeacPageId,
  type PageIdentityResult,
} from "./pages";

export {
  startCeacSession,
  type CeacSession,
  type CeacSessionOptions,
} from "./session";

export {
  advance,
  goBack,
  saveCurrent,
  readValidationMessages,
  hasValidationErrors,
  type CeacNavAction,
  type CeacValidationReport,
  type NavigateOptions,
} from "./navigator";

export {
  captureApplicationId,
  buildCheckpoint,
  saveAndCheckpoint,
  recordSectionCheckpoint,
  recordBootstrapCheckpoint,
  consoleCheckpointSink,
  type ApplicationIdCapture,
  type CeacCheckpoint,
  type CeacCheckpointAction,
  type CheckpointSink,
  type CheckpointEmitOptions,
  type SaveAndCheckpointOptions,
  type BuildCheckpointInput,
} from "./checkpoints";

export {
  tryCaptureScreenshot,
  type ScreenshotArtifact,
  type CaptureScreenshotOptions,
} from "./diagnostics";

export {
  captureDatArtifact,
  captureDatAndCheckpoint,
  createRecoveryTracker,
  preserveRecoveryOnFailure,
  type DatArtifact,
  type CaptureDatOptions,
  type CaptureDatAndCheckpointOptions,
  type RecoveryMetadata,
  type RecoveryTracker,
  type CreateRecoveryTrackerOptions,
  type PreserveRecoveryOptions,
  type PreservedRecovery,
} from "./artifacts";

export {
  CeacError,
  UnexpectedPageError,
  SessionExpiredError,
  NavigationError,
  ValidationFailedError,
  SessionBootstrapError,
  GateDetectedError,
  serializeError,
  type CeacErrorCode,
  type CeacErrorContext,
} from "./errors";

export {
  detectGate,
  assertNoGate,
  isGateError,
  type CeacGateKind,
  type GateDetectionResult,
} from "./gates";

export {
  buildSuccessResult,
  buildFailureResult,
  isSuccessResult,
  isFailureResult,
  type CeacRunResult,
  type CeacRunSuccess,
  type CeacRunFailure,
} from "./result";

export {
  orchestrateFill,
  type OrchestrateOptions,
  type OrchestrateResult,
  type SectionCoverage,
} from "./orchestrator";

export {
  probeCeacStartPage,
  probeCaptchaSolve,
  type SmokeOutcome,
  type SmokeResult,
  type CaptchaSmokeResult,
} from "./smoke";

export {
  solveImageCaptcha,
  reportBadCaptcha,
  TwoCaptchaConfigError,
  TwoCaptchaApiError,
  TwoCaptchaZeroBalanceError,
  TwoCaptchaNetworkError,
  TwoCaptchaSolveTimeoutError,
  type CaptchaSolveResult,
  type CaptchaSolveTelemetry,
} from "./captcha-solver";

export {
  solveStartPageCaptcha,
  solveStartPageCaptchaWithRetry,
  type StartPageCaptchaOutcome,
  type CaptchaSolveWithTelemetry,
} from "./start-page-captcha";

export {
  detectSignAndSubmit,
  assertSignAndSubmit,
  stopAtSignAndSubmit,
  isHandoffReadyOutcome,
  type SignPageMarkers,
  type SignPageIdentity,
  type HandoffReadyOutcome,
  type StopAtSignOptions,
} from "./stop-at-sign";

export {
  handleConfirmApplicationPage,
  type ConfirmApplicationOptions,
  type ConfirmApplicationResult,
} from "./confirm-application";
