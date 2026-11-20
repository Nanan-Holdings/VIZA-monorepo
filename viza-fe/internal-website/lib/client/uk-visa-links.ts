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

const UK_RESUME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function hasExplicitPort(value: string): boolean {
  const authority = value.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/iu)?.[1];
  if (!authority) return false;
  const host = authority.slice(authority.lastIndexOf("@") + 1);
  return host.includes(":");
}

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

  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.port
    || hasExplicitPort(value)
    || url.hash
  ) {
    return false;
  }

  if (url.hostname === "visas-immigration.service.gov.uk") {
    if (url.search !== "") return false;
    if (
      url.pathname.startsWith("/forceResume/") &&
      url.pathname.length > "/forceResume/".length
    ) {
      return true;
    }
    const resumePrefix = "/resume/";
    return url.pathname.startsWith(resumePrefix)
      && UK_RESUME_UUID.test(url.pathname.slice(resumePrefix.length));
  }

  if (url.hostname !== "apply-uk-visa.service.gov.uk" || url.pathname !== "/forceResume") {
    return false;
  }

  const queryKeys = [...url.searchParams.keys()];
  return queryKeys.length === 1 && queryKeys[0] === "token" && Boolean(url.searchParams.get("token"));
}
