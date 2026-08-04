const FALLBACK_CLIENT_ROUTE = "/client/application";

export function isRetiredAboutMeRoute(pathname: string): boolean {
  return (
    pathname === "/client/about-me-form" ||
    pathname.startsWith("/client/about-me-form/")
  );
}

export function getAboutMeRedirectTarget(
  value: string | string[] | undefined,
): string {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    candidate?.startsWith("/client/") &&
    !candidate.startsWith("/client/about-me-form")
  ) {
    return candidate;
  }

  return FALLBACK_CLIENT_ROUTE;
}
