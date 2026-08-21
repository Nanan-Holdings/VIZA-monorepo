import { type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  browserbaseEnabled,
  connectBrowserbaseCloudBrowser,
} from "../browserbase-session";

type BrowserContextOptions = NonNullable<Parameters<Browser["newContext"]>[0]>;

export interface FvBrowserOptions {
  headless?: boolean;
  storageState?: BrowserContextOptions["storageState"];
  acceptDownloads?: boolean;
}

export type FvBrowserProvider = "browserbase";

export interface FvBrowserHandles {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  provider?: FvBrowserProvider;
  /** Environment-variable label only; never the endpoint value. */
  source?: string;
}

export type FvBrowserSelection =
  { kind: "browserbase"; source: "FRANCE_VISAS_BROWSERBASE_ENABLED" };

/**
 * France-Visas is Browserbase-only. Explicitly disabling Browserbase fails
 * closed; country/global CDP settings and local Chromium are never fallbacks.
 */
export function resolveFranceVisasBrowserSelection(): FvBrowserSelection {
  if (!browserbaseEnabled("FRANCE_VISAS", true)) {
    throw new Error(
      "France-Visas requires Browserbase; FRANCE_VISAS_BROWSERBASE_ENABLED cannot be false.",
    );
  }
  return { kind: "browserbase", source: "FRANCE_VISAS_BROWSERBASE_ENABLED" };
}

export type FvBrowserSecurityCheckpoint = "ready" | "waf" | "blank" | "unknown";

export interface FvBrowserStateInput {
  url: string;
  title: string;
  bodyText: string;
}

export interface FvBrowserState {
  checkpoint: FvBrowserSecurityCheckpoint;
  message: string;
}

const FRANCE_VISAS_WAF_MARKERS = /(?:un\s+instant|just\s+a\s+moment|v[ée]rification\s+de\s+s[ée]curit[ée]|verification\s+de\s+securite|security\s+verification|checking\s+your\s+browser|verify\s+you\s+are\s+human|cloudflare|ray\s*id|cf-chl|access\s+denied|attention\s+required)/iu;

/**
 * Security classification used by the France-Visas gate and page waiters.
 * A remote session that returns an empty official page is not considered a
 * successful navigation: it is a WAF/blank checkpoint and must fail closed.
 */
export function classifyFranceVisasBrowserState(input: FvBrowserStateInput): FvBrowserState {
  const title = input.title.replace(/\s+/g, " ").trim();
  const body = input.bodyText.replace(/\s+/g, " ").trim();
  const haystack = `${input.url} ${title} ${body}`;
  const isHttpPage = /^https?:\/\//iu.test(input.url);
  if (isHttpPage && !title && !body) {
    return {
      checkpoint: "blank",
      message: "France-Visas returned a blank official page; refusing to treat the browser session as ready.",
    };
  }
  if (FRANCE_VISAS_WAF_MARKERS.test(haystack)) {
    return {
      checkpoint: "waf",
      message: "France-Visas is showing a Cloudflare/WAF security checkpoint.",
    };
  }
  const recognizedUrl = /(?:application-form\.france-visas\.gouv\.fr\/fv-fo-dde\/(?:accueil\.xhtml|step\d+\.xhtml|review\.xhtml|recapitulatif\.xhtml|confirmation\.xhtml)|connect\.france-visas\.gouv\.fr\/realms\/[^/]+\/login-actions\/(?:authenticate|registration|required-action|execute-actions))/iu.test(input.url);
  const recognizedText = /france[\s-]?visas|create\s+an\s+account|cr[ée]er\s+un\s+compte|sign\s+in|log\s+in|username|password|check\s+mailbox|email\s+verification|application\s+form|your\s+plans|your\s+information/iu.test(`${title} ${body}`);
  if (!recognizedUrl && !recognizedText) {
    return {
      checkpoint: "unknown",
      message: "France-Visas returned a non-empty page that is not a recognized login, registration, account, or application page.",
    };
  }
  return { checkpoint: "ready", message: "France-Visas page content is visible." };
}

export async function launchFvBrowser(
  options: FvBrowserOptions = {},
): Promise<FvBrowserHandles> {
  resolveFranceVisasBrowserSelection();
  const cloud = await connectBrowserbaseCloudBrowser({ prefix: "FRANCE_VISAS" });
  try {
    if (options.storageState) {
      const context = await cloud.browser.newContext({
        storageState: options.storageState,
        acceptDownloads: options.acceptDownloads ?? true,
        ...(!cloud.verifiedEnabled ? { viewport: { width: 1440, height: 900 } } : {}),
        locale: "en-US",
        timezoneId: "Europe/Paris",
      });
      const page = await context.newPage();
      return { browser: cloud.browser, context, page, provider: "browserbase", source: "FRANCE_VISAS_BROWSERBASE_ENABLED" };
    }
    if (!cloud.verifiedEnabled) {
      await cloud.page.setViewportSize({ width: 1440, height: 900 });
    }
    return {
      browser: cloud.browser,
      context: cloud.context,
      page: cloud.page,
      provider: "browserbase",
      source: "FRANCE_VISAS_BROWSERBASE_ENABLED",
    };
  } catch (error) {
    await cloud.browser.close().catch(() => undefined);
    throw error;
  }
}
