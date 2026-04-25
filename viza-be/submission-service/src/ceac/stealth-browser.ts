/**
 * Stealth browser launcher for CEAC automation.
 *
 * CEAC fingerprints automation in several ways:
 *   - User-Agent and sec-ch-ua client hints carry `HeadlessChrome` when
 *     Chromium runs in headless mode. CEAC silently returns the start
 *     page (not an async postback or redirect) when it sees this, so
 *     correctly solved CAPTCHAs appear to fail.
 *   - `navigator.webdriver === true`, missing `window.chrome` object,
 *     empty plugins array, Permissions.query quirks, iframe.contentWindow
 *     nulls, and several other JS surface differences.
 *
 * This module wraps Playwright's chromium launcher with
 * `puppeteer-extra-plugin-stealth` (which patches the JS-surface leaks)
 * and applies a matching UA + client-hints override on the context.
 *
 * Use via `launchStealthBrowser()` — returns the same shape as a
 * Playwright `{ browser, context, page }` tuple plus a `close()` helper.
 */
import { chromium as playwrightChromium } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import PlaywrightExtraDefault from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

type ChromiumLauncher = {
  chromium: {
    use: (plugin: unknown) => void;
    launch: (opts: Parameters<typeof playwrightChromium.launch>[0]) => Promise<Browser>;
  };
};

// playwright-extra's default export is a launcher object. Its CommonJS/ESM
// interop leaves the typed shape fuzzy; narrow here to the surface we use.
const extra = (
  (PlaywrightExtraDefault as unknown as { default?: unknown }).default ??
  PlaywrightExtraDefault
) as ChromiumLauncher;

// Register stealth once at module load — it patches every future launch.
extra.chromium.use(StealthPlugin());

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_CLIENT_HINTS: Record<string, string> = {
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
};

export interface StealthBrowserOptions {
  headless?: boolean;
  acceptDownloads?: boolean;
  /** Override the UA. Default: macOS Chrome 131. */
  userAgent?: string;
  /**
   * Per-call hardening profile. CEAC's existing flow uses the default
   * (no-op) profile and continues to behave as before. France-Visas
   * passes `"france-visas"` to enable the additional fingerprint
   * suppression needed to pass Keycloak's headless detection.
   */
  hardening?: "default" | "france-visas";
}

export interface StealthBrowserHandles {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

const FV_LAUNCH_ARGS: readonly string[] = [
  // Quiets the "Chrome is being controlled by automated test software" banner
  // and removes the navigator.webdriver=true signal that some bot detectors
  // still read despite the stealth plugin's patches.
  "--disable-blink-features=AutomationControlled",
  // Match a real desktop browser footprint:
  "--disable-features=IsolateOrigins,site-per-process",
  "--no-default-browser-check",
  "--no-first-run",
  "--disable-sync",
  // Larger viewport-default so window.outerHeight/innerHeight don't pin the
  // tiny default headless viewport that some detectors flag.
  "--window-size=1440,900",
  // Avoid the "non-stable-channel" warning that can show up under headless.
  "--disable-dev-shm-usage",
];

/**
 * Init script applied to every page in a France-Visas-hardened context.
 * Runs BEFORE any France-Visas script, so by the time Keycloak probes
 * navigator.webdriver / chrome / permissions, our overrides are in place.
 *
 * The stealth plugin already covers most of these — this is a defense-in-
 * depth layer that survives plugin upgrades and patches the few signals
 * Keycloak's France-Visas theme still reads (verified via headless
 * failure mode in the live smoke run, 2026-04-25).
 */
const FV_INIT_SCRIPT = `
(() => {
  try {
    Object.defineProperty(Navigator.prototype, "webdriver", { get: () => undefined });
  } catch (e) {}
  try {
    if (!window.chrome) {
      Object.defineProperty(window, "chrome", { get: () => ({ runtime: {} }) });
    } else if (!window.chrome.runtime) {
      window.chrome.runtime = {};
    }
  } catch (e) {}
  try {
    Object.defineProperty(Navigator.prototype, "languages", { get: () => ["en-US", "en"] });
  } catch (e) {}
  try {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", { get: () => 8 });
  } catch (e) {}
  try {
    Object.defineProperty(Navigator.prototype, "deviceMemory", { get: () => 8 });
  } catch (e) {}
  try {
    Object.defineProperty(Navigator.prototype, "platform", { get: () => "MacIntel" });
  } catch (e) {}
  try {
    const origQuery = window.navigator.permissions && window.navigator.permissions.query;
    if (origQuery) {
      window.navigator.permissions.query = (parameters) =>
        parameters && parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : origQuery.call(window.navigator.permissions, parameters);
    }
  } catch (e) {}
  try {
    Object.defineProperty(Navigator.prototype, "plugins", {
      get: () => [
        { name: "PDF Viewer", description: "Portable Document Format", filename: "internal-pdf-viewer" },
        { name: "Chrome PDF Viewer", description: "", filename: "internal-pdf-viewer" },
        { name: "Chromium PDF Viewer", description: "", filename: "internal-pdf-viewer" },
      ],
    });
  } catch (e) {}
})();
`;

/**
 * Launch a stealth-patched Chromium browser and return a fresh page.
 *
 * The stealth plugin hides `navigator.webdriver`, spoofs the chrome
 * runtime, patches plugins/languages/vendor, and covers roughly a dozen
 * other JS-surface leaks. Combined with a real-Chrome UA + matching
 * client hints, this makes CEAC treat us as a regular browser session.
 *
 * `hardening: "france-visas"` adds Chromium launch flags + an init
 * script that survive Keycloak's headless detection — the stock
 * stealth-plugin set is not sufficient for France-Visas.
 */
export async function launchStealthBrowser(
  options: StealthBrowserOptions = {},
): Promise<StealthBrowserHandles> {
  const hardening = options.hardening ?? "default";

  const launchOpts: Parameters<typeof playwrightChromium.launch>[0] = {
    headless: options.headless ?? true,
  };
  if (hardening === "france-visas") {
    launchOpts.args = [...FV_LAUNCH_ARGS];
  }
  const browser = await extra.chromium.launch(launchOpts);

  const contextOpts: Parameters<Browser["newContext"]>[0] = {
    acceptDownloads: options.acceptDownloads ?? true,
    userAgent: options.userAgent ?? DEFAULT_USER_AGENT,
    extraHTTPHeaders: DEFAULT_CLIENT_HINTS,
  };
  if (hardening === "france-visas") {
    contextOpts.viewport = { width: 1440, height: 900 };
    contextOpts.locale = "en-US";
    contextOpts.timezoneId = "Europe/Paris";
  }
  const context = await browser.newContext(contextOpts);

  if (hardening === "france-visas") {
    await context.addInitScript(FV_INIT_SCRIPT);
  }

  const page = await context.newPage();
  return { browser, context, page };
}
