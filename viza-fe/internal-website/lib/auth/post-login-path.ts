const DEFAULT_POST_LOGIN_PATH = "/client/home";

/**
 * Where to send an applicant after login. Only same-site paths we expect to
 * return to are honoured: the beta feedback form, and the application route
 * the marketing site hands visitors to (`/client/application?country=&visaType=`).
 * Anything else, including absolute or protocol-relative URLs, falls back to
 * the client home so `returnTo` cannot be used as an open redirect.
 */
export function getPostLoginPath(returnTo: string | null | undefined): string {
  if (!returnTo) return DEFAULT_POST_LOGIN_PATH;
  if (returnTo === "/feedback") return returnTo;
  if (/^\/client\/application(?:[/?]|$)/.test(returnTo) && !/[\\]|\/\/|:/.test(returnTo.split("?")[0])) {
    return returnTo;
  }
  return DEFAULT_POST_LOGIN_PATH;
}

/** Login URL that returns the applicant to `path` once they are signed in. */
export function loginPathReturningTo(path: string): string {
  const target = getPostLoginPath(path);
  return target === DEFAULT_POST_LOGIN_PATH
    ? "/client/login"
    : `/client/login?returnTo=${encodeURIComponent(target)}`;
}
