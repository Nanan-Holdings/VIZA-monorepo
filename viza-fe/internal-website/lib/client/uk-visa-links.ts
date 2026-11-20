/**
 * Official UK government entry points used by the customer-facing result
 * card. These are ordinary outbound links: opening one never mutates VIZA
 * application state or starts an official-portal action in the background.
 */
export const UK_VISA_LINKS = {
  findVisaApplicationCentre: "https://www.gov.uk/find-a-visa-application-centre",
  signInVisaApplication: "https://www.gov.uk/sign-in-visa",
  setUpUkviAccount: "https://www.gov.uk/evisa/set-up-ukvi-account",
  viewProveImmigrationStatus: "https://www.gov.uk/view-prove-immigration-status",
  updateUkviAccountDetails: "https://www.gov.uk/update-uk-visas-immigration-account-details",
} as const;

export type UkVisaLinkKey = keyof typeof UK_VISA_LINKS;

/**
 * Keep the customer-facing resume link in lockstep with the backend vault
 * boundary. A resume URL is a bearer credential, so reject look-alike hosts,
 * credentials, ports, fragments, and unrelated query parameters.
 */
export function isAllowedUkResumeUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
    return false;
  }

  if (
    url.hostname === "visas-immigration.service.gov.uk" &&
    url.pathname.startsWith("/forceResume/") &&
    url.pathname.length > "/forceResume/".length
  ) {
    return url.search === "";
  }

  if (url.hostname !== "apply-uk-visa.service.gov.uk" || url.pathname !== "/forceResume") {
    return false;
  }

  const queryKeys = [...url.searchParams.keys()];
  return queryKeys.length === 1 && queryKeys[0] === "token" && Boolean(url.searchParams.get("token"));
}
