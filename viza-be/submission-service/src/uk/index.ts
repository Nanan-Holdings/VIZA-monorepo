/**
 * Public surface of the UK Standard Visitor visa helpers.
 * Mirrors the ceac/ barrel.
 */

export {
  UK_URLS,
  UK_SUBMIT_SELECTOR,
  UK_HEADING_SELECTOR,
  UK_CSRF_SELECTOR,
  UK_PAGE_SELECTORS,
  UK_MARKERS,
  POST_AUTH_TODO,
} from "./selectors";

export {
  detectPage,
  assertPage,
  type UkPageId,
  type UkPageIdentity,
} from "./pages";

export {
  startUkSession,
  type UkSession,
  type UkSessionOptions,
} from "./session";

export {
  orchestrateUkFill,
  type UkOrchestrateOptions,
  type UkOrchestrateResult,
} from "./orchestrator";

export {
  UkError,
  UkUnexpectedPageError,
  UkSessionExpiredError,
  UkNavigationError,
  UkValidationError,
  UkSessionBootstrapError,
  UkGateDetectedError,
  UkFieldNotMappedError,
  UkWidgetFillError,
  isUkGateError,
  serializeUkError,
  type UkErrorCode,
  type UkErrorContext,
} from "./errors";

export {
  detectGate,
  assertNoGate,
  type UkGateKind,
  type UkGateResult,
} from "./gates";

export {
  fillTextInput,
  fillTextarea,
  fillRadio,
  fillCheckbox,
  fillSelect,
  fillIso3Select,
  fillGovukDate,
  uploadFile,
} from "./widgets";

export {
  UK_FIELD_DEFINITIONS,
  fillField,
  fillKnownFields,
  type UkFieldDefinition,
  type UkWidgetKind,
} from "./field-mappings";

export {
  tryCaptureScreenshot,
  type UkScreenshotArtifact,
  type CaptureScreenshotOptions,
} from "./diagnostics";
