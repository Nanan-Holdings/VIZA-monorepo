const CLIENT_AUTH_PATH_PREFIXES = [
  "/client/login",
  "/client/signup",
  "/client/register",
] as const;

function isClientAuthPath(pathname: string): boolean {
  return CLIENT_AUTH_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getSafeClientLoginNext(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value, "https://app.viza.it.com");
  } catch {
    return null;
  }

  if (parsed.origin !== "https://app.viza.it.com") return null;
  if (!parsed.pathname.startsWith("/client/")) return null;
  if (isClientAuthPath(parsed.pathname)) return null;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function buildClientLoginUrlWithNext(requestUrl: string): URL {
  const request = new URL(requestUrl);
  const login = new URL("/client/login", request);
  const next = getSafeClientLoginNext(
    `${request.pathname}${request.search}${request.hash}`
  );
  if (next) login.searchParams.set("next", next);
  return login;
}

export function buildClientLoginPathWithNext(
  destination: string | null | undefined
): string {
  const login = new URL("/client/login", "https://app.viza.it.com");
  const next = getSafeClientLoginNext(destination);
  if (next) login.searchParams.set("next", next);
  return `${login.pathname}${login.search}`;
}

export function resolveClientPostLoginDestination(
  searchParams: Pick<URLSearchParams, "get">,
  retainedHash = ""
): string {
  const candidate =
    getSafeClientLoginNext(searchParams.get("next")) ??
    getSafeClientLoginNext(searchParams.get("returnTo"));

  if (!candidate) return "/client/home";
  if (!retainedHash) return candidate;

  const destination = new URL(candidate, "https://app.viza.it.com");
  if (!destination.hash) destination.hash = retainedHash;
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
