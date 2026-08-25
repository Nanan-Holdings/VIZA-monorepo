export const SGAC_APPLICANT_TYPES = [
  "singapore_citizen_or_permanent_resident",
  "long_term_pass_holder",
  "foreign_visitor",
] as const;

export type SgacApplicantType = (typeof SGAC_APPLICANT_TYPES)[number];

const SGAC_PORTAL_URL_BY_APPLICANT_TYPE: Record<SgacApplicantType, string> = {
  singapore_citizen_or_permanent_resident: "https://eservices.ica.gov.sg/sgarrivalcard/scpr",
  long_term_pass_holder: "https://eservices.ica.gov.sg/sgarrivalcard/ltp",
  foreign_visitor: "https://eservices.ica.gov.sg/sgarrivalcard/fvipa",
};

export function isSgacApplicantType(value: string | null | undefined): value is SgacApplicantType {
  return SGAC_APPLICANT_TYPES.some((candidate) => candidate === value);
}

export function isSgacResidentApplicantType(
  value: string | null | undefined,
): value is Exclude<SgacApplicantType, "foreign_visitor"> {
  return isSgacApplicantType(value) && value !== "foreign_visitor";
}

export function sgacPortalUrlForApplicantType(applicantType: SgacApplicantType): string {
  return SGAC_PORTAL_URL_BY_APPLICANT_TYPE[applicantType];
}
