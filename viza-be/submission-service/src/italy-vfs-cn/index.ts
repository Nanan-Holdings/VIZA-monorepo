/**
 * Public surface of the Italy-VFS-CN corridor adapter.
 *
 * Thin re-export barrel so callers can
 * `import { ... } from "./italy-vfs-cn"` without reaching into
 * individual modules. Mirrors `france-visas/index.ts` in shape.
 *
 * Live walk and `fill-steps.ts` / `run.ts` are deferred to a follow-up
 * pass — the exports below cover the schema-mapping layer that does not
 * require live-portal access.
 */

export {
  ItVfsError,
  UnexpectedPageError,
  SessionExpiredError,
  NavigationError,
  ValidationFailedError,
  SessionBootstrapError,
  GateDetectedError,
  LoginFailedError,
  CorridorIneligibleError,
  serializeError,
  type ItVfsErrorCode,
  type ItVfsErrorContext,
} from "./errors";

export {
  detectPage,
  assertPage,
  waitForPage,
  IT_VFS_HEADING_PATTERNS,
  IT_VFS_SESSION_EXPIRED_MARKERS,
  type ItVfsPageId,
  type PageIdentityResult,
} from "./pages";

export {
  IT_VFS_URLS,
  IT_VFS_LOGIN_SELECTORS,
  IT_VFS_PERSONAL_FIELDS,
  IT_VFS_TRAVEL_DOC_FIELDS,
  IT_VFS_CONTACT_FIELDS,
  IT_VFS_OCCUPATION_FIELDS,
  IT_VFS_TRIP_FIELDS,
  IT_VFS_ACCOMMODATION_FIELDS,
  IT_VFS_TRAVEL_HISTORY_FIELDS,
  IT_VFS_COST_FIELDS,
  IT_VFS_NAV_SELECTORS,
  IT_VFS_VALIDATION_SUMMARY_SELECTOR,
  IT_VFS_FIELD_ERROR_SELECTOR,
  IT_VFS_GATE_MARKERS,
  IT_VFS_PURPOSE_VALUES,
  urlForLanguage,
  type ItVfsLanguage,
  type ItVfsPurposeKey,
} from "./selectors";

export {
  normalizeItVfsAnswers,
  assertCorridorEligible,
  type AnswerMap,
  type NormalizeInput,
  type ItVfsAnswers,
  type ItVfsPersonalAnswers,
  type ItVfsTravelDocumentAnswers,
  type ItVfsContactAnswers,
  type ItVfsOccupationAnswers,
  type ItVfsTripAnswers,
  type ItVfsAccommodationAnswers,
  type ItVfsTravelHistoryAnswers,
  type ItVfsCostAnswers,
  type ItVfsCostMeans,
} from "./normalize";
