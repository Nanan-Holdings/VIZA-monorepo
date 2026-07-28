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
  TwEmailVerificationError,
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
  twFillDateByName,
  type TwScope,
} from "./fillers";

export { waitForTwVerificationCode, type TwVerificationCodeEmail } from "./inbox";

export {
  fillTwEntryPermitApplication,
  HK_MACAU_EMBASSY_OFFICE_VALUES,
  type TwApplyInput,
  type TwApplyOptions,
  type TwFillResult,
} from "./apply";

export { tryCaptureTwScreenshot, type TwScreenshotArtifact, type CaptureTwScreenshotOptions } from "./diagnostics";
