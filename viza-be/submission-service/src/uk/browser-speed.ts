import type { Page } from "@playwright/test";

const BLOCKED_RESOURCE_TYPES = new Set(["image", "font", "media"]);
const BLOCKED_URL_PATTERN =
  /google-analytics|googletagmanager|hotjar|doubleclick|facebook\.net|analytics\.gov\.uk/i;

/** Block heavy assets on gov.uk — forms are plain HTML; images/CSS are not needed. */
export async function attachUkFastPageMode(page: Page): Promise<void> {
  await page.route("**/*", (route) => {
    const request = route.request();
    if (BLOCKED_RESOURCE_TYPES.has(request.resourceType())) {
      void route.abort();
      return;
    }
    if (BLOCKED_URL_PATTERN.test(request.url())) {
      void route.abort();
      return;
    }
    void route.continue();
  });
}

export const UK_GOTO_WAIT: "commit" | "domcontentloaded" = "commit";
