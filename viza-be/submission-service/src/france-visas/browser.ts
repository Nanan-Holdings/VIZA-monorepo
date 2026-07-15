import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
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

export interface FvBrowserHandles {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function launchFvBrowser(
  options: FvBrowserOptions = {},
): Promise<FvBrowserHandles> {
  if (browserbaseEnabled("FRANCE_VISAS")) {
    const cloud = await connectBrowserbaseCloudBrowser({ prefix: "FRANCE_VISAS" });
    if (options.storageState) {
      const context = await cloud.browser.newContext({
        storageState: options.storageState,
        acceptDownloads: options.acceptDownloads ?? true,
        viewport: { width: 1440, height: 900 },
        locale: "en-US",
        timezoneId: "Europe/Paris",
      });
      const page = await context.newPage();
      return { browser: cloud.browser, context, page };
    }
    await cloud.page.setViewportSize({ width: 1440, height: 900 });
    return { browser: cloud.browser, context: cloud.context, page: cloud.page };
  }
  const browser = await chromium.launch({
    headless: options.headless ?? true,
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || undefined,
  });
  const context = await browser.newContext({
    ...(options.storageState ? { storageState: options.storageState } : {}),
    acceptDownloads: options.acceptDownloads ?? true,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "Europe/Paris",
  });
  const page = await context.newPage();
  return { browser, context, page };
}
