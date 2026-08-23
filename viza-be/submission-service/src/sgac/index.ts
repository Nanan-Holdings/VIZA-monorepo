export {
  normalizeSgacPortalPayload,
  normalizeSgacLongTermPassPortalPayload,
  SgacPortalValidationError,
  type SgacPortalPayload,
  type SgacLongTermPassPortalPayload,
} from "./normalize";
export {
  runSgacPortalSubmission,
  runSgacLongTermPassPortalSubmission,
  SGAC_OFFICIAL_PORTAL_URL,
  SGAC_LONG_TERM_PASS_OFFICIAL_PORTAL_URL,
  SgacPortalError,
  type SgacPortalRunResult,
} from "./runner";
