const SAFE_CHECKOUT_PARAMS = new Set([
  "applicationId",
  "error",
  "packageId",
  "session_id",
  "status",
]);

export function safeClientReturnTarget(value: string | null | undefined): string {
  if (value === "/feedback") return "/feedback";
  if (!value?.startsWith("/client/checkout")) return "/client/home";

  try {
    const url = new URL(value, "https://viza.invalid");
    if (url.origin !== "https://viza.invalid" || url.pathname !== "/client/checkout") {
      return "/client/home";
    }
    const clean = new URL("/client/checkout", url.origin);
    url.searchParams.forEach((parameterValue, key) => {
      if (SAFE_CHECKOUT_PARAMS.has(key) && parameterValue.length <= 256) {
        clean.searchParams.append(key, parameterValue);
      }
    });
    return `${clean.pathname}${clean.search}`;
  } catch {
    return "/client/home";
  }
}

export function checkoutReturnTarget(url: URL): string {
  return safeClientReturnTarget(`${url.pathname}${url.search}`);
}
