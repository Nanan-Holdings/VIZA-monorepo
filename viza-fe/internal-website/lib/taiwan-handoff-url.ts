export function isAllowedTaiwanLiveViewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname === "browserbase.com" ||
      url.hostname.endsWith(".browserbase.com") ||
      url.hostname === "browserbase.io" ||
      url.hostname.endsWith(".browserbase.io")
    );
  } catch {
    return false;
  }
}
