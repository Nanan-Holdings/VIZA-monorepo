import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

type BrowserContextOptions = NonNullable<Parameters<Browser["newContext"]>[0]>;

export interface FvBrowserOptions {
  headless?: boolean;
  storageState?: BrowserContextOptions["storageState"];
}

export interface FvBrowserHandles {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function launchFvBrowser(
  options: FvBrowserOptions = {},
): Promise<FvBrowserHandles> {
  const browser = await chromium.launch({
    headless: options.headless ?? true,
  });
  const context = await browser.newContext({
    ...(options.storageState ? { storageState: options.storageState } : {}),
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "Europe/Paris",
  });
  const page = await context.newPage();
  return { browser, context, page };
}
