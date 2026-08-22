import {
  chromium,
  type Browser,
  type BrowserContext,
  type Frame,
  type Page,
  type Route,
} from "@playwright/test";
import {
  isTrustedCanadaApplicationUrl,
  isTrustedCanadaBrowserUrl,
  isTrustedCanadaPortalUrl,
} from "./readiness.js";

const blockedCanadaNavigation = new WeakMap<Page, string>();

export type CanadaPageDestination = "portal" | "application" | "either";

function matchesCanadaDestination(
  value: string | URL,
  destination: CanadaPageDestination,
): boolean {
  if (destination === "portal") return isTrustedCanadaPortalUrl(value);
  if (destination === "application") return isTrustedCanadaApplicationUrl(value);
  return isTrustedCanadaBrowserUrl(value);
}

/**
 * Blocks any main-frame navigation outside the two exact HTTPS IRCC origins.
 * Once a redirect is blocked, the page remains unsafe for the rest of the
 * session so a mirrored form cannot regain trust by navigating back.
 */
export async function installCanadaTrustedNavigationGuard(
  page: Page,
): Promise<() => Promise<void>> {
  blockedCanadaNavigation.delete(page);
  const onRoute = async (route: Route): Promise<void> => {
    const request = route.request();
    if (
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame() &&
      !isTrustedCanadaBrowserUrl(request.url())
    ) {
      blockedCanadaNavigation.set(page, request.url());
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  };
  const onFrameNavigated = (frame: Frame): void => {
    const url = frame.url();
    if (
      frame === page.mainFrame() &&
      url !== "about:blank" &&
      !isTrustedCanadaBrowserUrl(url)
    ) {
      blockedCanadaNavigation.set(page, url);
    }
  };
  await page.route("**/*", onRoute);
  page.on("framenavigated", onFrameNavigated);
  return async () => {
    page.off("framenavigated", onFrameNavigated);
    await page.unroute("**/*", onRoute).catch(() => undefined);
  };
}

export function isCanadaPageSafe(
  page: Pick<Page, "url">,
  destination: CanadaPageDestination = "either",
): boolean {
  const playwrightPage = page as Page;
  return (
    !blockedCanadaNavigation.has(playwrightPage) &&
    matchesCanadaDestination(page.url(), destination)
  );
}

export function canadaUnsafePageUrl(page: Pick<Page, "url">): string {
  return blockedCanadaNavigation.get(page as Page) ?? page.url();
}

/**
 * Prefer the workstation Chrome used for live IRCC recon. A bounded retry
 * absorbs transient process-launch failures; bundled Chromium is the final
 * local fallback when it has been installed for the worker image.
 */
export async function launchCanadaPortalBrowser(headless: boolean): Promise<Browser> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await chromium.launch({ channel: "chrome", headless });
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }
  try {
    return await chromium.launch({ headless });
  } catch {
    throw new Error(
      "Canada portal browser unavailable after bounded Chrome and Chromium launch attempts.",
    );
  }
}

/**
 * IRCC's API currently returns HTTP 500 to Chrome's synthetic
 * `HeadlessChrome` user agent while serving the same official-origin request
 * normally to regular Chrome. Use a platform-matching Chrome UA in the
 * isolated IRCC context; no browser or applicant fingerprint is persisted.
 */
export async function createCanadaPortalContext(
  browser: Browser,
): Promise<BrowserContext> {
  const userAgent = buildCanadaPortalUserAgent(browser.version());
  return browser.newContext({ locale: "en-CA", userAgent });
}

export function buildCanadaPortalUserAgent(
  browserVersion: string,
  platformName: NodeJS.Platform = process.platform,
): string {
  const platform = platformName === "darwin"
    ? "Macintosh; Intel Mac OS X 10_15_7"
    : platformName === "win32"
      ? "Windows NT 10.0; Win64; x64"
      : "X11; Linux x86_64";
  return (
    `Mozilla/5.0 (${platform}) AppleWebKit/537.36 ` +
    `(KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`
  );
}
