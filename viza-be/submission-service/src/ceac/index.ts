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
  CeacError,
  UnexpectedPageError,
  SessionExpiredError,
  NavigationError,
  ValidationFailedError,
  SessionBootstrapError,
  type CeacErrorCode,
  type CeacErrorContext,
} from "./errors";
