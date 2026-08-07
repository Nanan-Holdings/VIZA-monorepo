import type { BrowserContext } from "@playwright/test";

const OFFICIAL_API_HOSTS = new Set([
  "api.evisa.gov.vn",
  "api.thithucdientu.gov.vn",
]);

export function shouldProxyVietnamPublicRequest(method: string, rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || !OFFICIAL_API_HOSTS.has(url.hostname)) return false;
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "POST") {
    // This is the only public write request that may be proxied. The browser
    // still sends the official multipart body exactly once through route.fetch;
    // the proxy only restores the official SPA origin header on the response.
    // Application submit and payment requests must always bypass this helper.
    return url.pathname === "/client-service/public/upload";
  }
  if (normalizedMethod !== "GET") return false;
  return url.pathname.startsWith("/client-service/public/") || url.pathname.startsWith("/static/");
}

export function isVietnamPublicUploadRequest(method: string, rawUrl: string): boolean {
  if (method.toUpperCase() !== "POST") return false;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    OFFICIAL_API_HOSTS.has(url.hostname) &&
    url.pathname === "/client-service/public/upload"
  );
}

export async function installVietnamPublicApiProxy(
  context: BrowserContext,
  callbacks: {
    onSuccess?: (url: string) => void;
    onFailure?: (url: string, reason: string) => void;
  } = {},
): Promise<void> {
  await context.route(/https:\/\/api\.(?:evisa|thithucdientu)\.gov\.vn\/.*/i, async (route) => {
    const request = route.request();
    if (!shouldProxyVietnamPublicRequest(request.method(), request.url())) {
      await route.continue();
      return;
    }

    try {
      const response = await route.fetch({ timeout: 30_000 });
      const origin = request.headers().origin;
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          ...(origin ? { "access-control-allow-origin": origin } : {}),
        },
      });
      callbacks.onSuccess?.(request.url());
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      callbacks.onFailure?.(request.url(), reason);
      await route.continue().catch(() => undefined);
    }
  });
}
