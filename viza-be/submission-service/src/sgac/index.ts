export {
  normalizeSgacPortalPayload,
  SgacPortalValidationError,
  type SgacApplicantType,
  type SgacForeignVisitorPortalPayload,
  type SgacPortalPayload,
  type SgacResidentPortalPayload,
} from "./normalize";
export {
  runSgacPortalSubmission,
  SGAC_OFFICIAL_PORTAL_URL,
  SGAC_RESIDENT_PORTAL_URLS,
  sgacPortalUrlForPayload,
  SgacPortalError,
  type SgacPortalRunResult,
} from "./runner";
