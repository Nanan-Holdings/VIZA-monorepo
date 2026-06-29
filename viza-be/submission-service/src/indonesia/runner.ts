import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import {
  actionForIndonesiaPortalState,
  classifyIndonesiaPortalSnapshot,
  type IndonesiaPortalStateId,
} from "./portal-state";

export interface IndonesiaPortalProbeInput {
  portalUrl: string;
  provider: "indonesia_c1_live" | "indonesia_b1_evoa_live";
  visaType?: "ID_C1_TOURIST" | "ID_B1_EVOA";
  passportCountry?: string | null;
  headless?: boolean;
  timeoutMs?: number;
}

export interface IndonesiaPortalProbeResult {
  state: IndonesiaPortalStateId;
  actionType: string;
  instruction: string;
  implementationStatus: "partial" | "blocked";
  url: string;
  title: string | null;
  browserProvider: "local" | "local-cdp" | "remote-browser-api";
  diagnostics: string[];
}

const INDONESIA_GENERAL_VISIT_PARENT = "General, Family, or Social";
const INDONESIA_TOURISM_ACTIVITY = "Tourism, Family Visit, and Transit";

function normalizeCountryLabel(value: string | null | undefined): string {
  const clean = value?.trim();
  if (!clean) return "CHINA";
  const upper = clean.toUpperCase();
  if (upper === "CN" || upper === "CHN" || upper === "PEOPLE'S REPUBLIC OF CHINA") {
    return "CHINA";
  }
  if (upper === "US" || upper === "USA" || upper === "UNITED STATES") {
    return "UNITED STATES OF AMERICA";
  }
  if (upper === "KR" || upper === "KOR" || upper === "SOUTH KOREA") {
    return "REPUBLIC OF KOREA";
  }
  return upper;
}

function visaPatternFor(
  provider: IndonesiaPortalProbeInput["provider"],
  visaType?: IndonesiaPortalProbeInput["visaType"],
): RegExp {
  if (provider === "indonesia_b1_evoa_live" || visaType === "ID_B1_EVOA") {
    return /^B1\s+-\s+Tourist/i;
  }
  return /^C1\s+-\s+Tourist Single Entry/i;
}

async function selectNativeOptionByText(
  page: Page,
  selector: string,
  pattern: RegExp,
  timeoutMs = 20_000,
): Promise<string> {
  await page.waitForFunction(
    ({ css, source, flags }) => {
      const re = new RegExp(source, flags);
      const select = document.querySelector<HTMLSelectElement>(css);
      if (!select) return false;
      return Array.from(select.options).some((option) =>
        re.test((option.textContent ?? "").replace(/\s+/g, " ").trim()),
      );
    },
    { css: selector, source: pattern.source, flags: pattern.flags },
    { timeout: timeoutMs },
  );

  const selected = await page.evaluate(
    ({ css, source, flags }) => {
      const re = new RegExp(source, flags);
      const select = document.querySelector<HTMLSelectElement>(css);
      if (!select) return null;
      const option = Array.from(select.options).find((candidate) =>
        re.test((candidate.textContent ?? "").replace(/\s+/g, " ").trim()),
      );
      if (!option) return null;
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return {
        value: option.value,
        text: (option.textContent ?? "").replace(/\s+/g, " ").trim(),
      };
    },
    { css: selector, source: pattern.source, flags: pattern.flags },
  );

  if (!selected) {
    throw new Error(`Indonesia official portal option not found for ${selector}: ${pattern}`);
  }
  await page.waitForTimeout(1_500);
  return selected.text;
}

async function continueFromVisaSelection(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<void> {
  const passportCountry = normalizeCountryLabel(input.passportCountry);
  await selectNativeOptionByText(page, "#selectCountry", new RegExp(`^${passportCountry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
  await selectNativeOptionByText(page, "#selectParentActivity", new RegExp(`^${INDONESIA_GENERAL_VISIT_PARENT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
  await selectNativeOptionByText(page, "#selectActivity", new RegExp(`^${INDONESIA_TOURISM_ACTIVITY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"));
  const visaLabel = await selectNativeOptionByText(
    page,
    "#selectVisa",
    visaPatternFor(input.provider, input.visaType),
  );
  diagnostics.push(`indonesia_visa_selection_completed visa=${visaLabel}`);

  const applicationLink = page.locator('a.btn.btn-primary[href*="application_add"]').first();
  await applicationLink.waitFor({ state: "attached", timeout: 20_000 });
  const href = await applicationLink.getAttribute("href");
  if (!href || href === "javascript:void(0);") {
    throw new Error("Indonesia official portal did not expose an application_add URL after visa selection");
  }
  const applicationUrl = new URL(href, page.url()).toString();
  await page.goto(applicationUrl, {
    waitUntil: "domcontentloaded",
    timeout: input.timeoutMs ?? 60_000,
  });
  await page.waitForTimeout(2_000);
  diagnostics.push("indonesia_official_application_url_opened");
}

async function continueFromAccountGate(page: Page, diagnostics: string[]): Promise<boolean> {
  const createAccountLink = page.getByRole("link", { name: /create account/i }).first();
  if (!(await createAccountLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return false;
  }
  await createAccountLink.click({ timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(1_500);

  const foreignerLink = page
    .locator('a[href*="/front/register/wna"]')
    .or(page.getByRole("link", { name: /^foreigner$/i }))
    .first();
  if (await foreignerLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await foreignerLink.click({ timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
  }
  diagnostics.push("indonesia_account_registration_form_opened");
  return true;
}

function firstConfiguredEndpoint(envNames: string[]): string | null {
  for (const name of envNames) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function endpointEnvNames(provider: IndonesiaPortalProbeInput["provider"]): string[] {
  const prefix = provider === "indonesia_b1_evoa_live" ? "ID_B1_EVOA" : "ID_C1";
  const envNames = [
    `${prefix}_BROWSER_API_ENDPOINT`,
    `${prefix}_BRIGHTDATA_BROWSER_API_ENDPOINT`,
    "INDONESIA_BROWSER_API_ENDPOINT",
    "INDONESIA_BRIGHTDATA_BROWSER_API_ENDPOINT",
  ];
  if (process.env.INDONESIA_USE_GLOBAL_BROWSER_API?.trim() === "true") {
    envNames.push(
      "BRIGHTDATA_BROWSER_WS",
      "BRIGHTDATA_BROWSER_API_ENDPOINT",
      "SBR_WS_ENDPOINT",
    );
  }
  return envNames;
}

async function createIndonesiaProbeSession(input: IndonesiaPortalProbeInput): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
  provider: "local" | "local-cdp" | "remote-browser-api";
  diagnostics: string[];
}> {
  const diagnostics: string[] = [];
  const endpoint = firstConfiguredEndpoint(endpointEnvNames(input.provider));
  if (endpoint) {
    const browser = await chromium.connectOverCDP(endpoint, { timeout: 45_000 });
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    diagnostics.push("indonesia_remote_browser_api_connected");
    return { browser, context, page, provider: "remote-browser-api", diagnostics };
  }

  const cdpEndpoint = firstConfiguredEndpoint([
    input.provider === "indonesia_b1_evoa_live" ? "ID_B1_EVOA_CDP_ENDPOINT" : "ID_C1_CDP_ENDPOINT",
    "INDONESIA_CDP_ENDPOINT",
    "INDONESIA_CHROME_CDP_ENDPOINT",
  ]);
  if (cdpEndpoint) {
    const browser = await chromium.connectOverCDP(cdpEndpoint, { timeout: 45_000 });
    const context = browser.contexts()[0] ?? await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    diagnostics.push("indonesia_local_cdp_connected");
    return { browser, context, page, provider: "local-cdp", diagnostics };
  }

  const channel = process.env.INDONESIA_PLAYWRIGHT_CHANNEL?.trim() || undefined;
  const browser = await chromium.launch({ channel, headless: input.headless ?? true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  diagnostics.push(`indonesia_local_browser channel=${channel ?? "chromium"} headless=${input.headless ?? true}`);
  return { browser, context, page, provider: "local", diagnostics };
}

export async function probeIndonesiaPortal(
  input: IndonesiaPortalProbeInput,
): Promise<IndonesiaPortalProbeResult> {
  const session = await createIndonesiaProbeSession(input);
  try {
    const page = session.page;
    await page.goto(input.portalUrl, {
      waitUntil: "domcontentloaded",
      timeout: input.timeoutMs ?? 60_000,
    });
    await page.waitForTimeout(1500);
    let title = await page.title().catch(() => null);
    let text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    let url = page.url();
    let state = classifyIndonesiaPortalSnapshot({ url, title, text });
    if (state === "landing_visible") {
      const applyControl = page
        .getByRole("link", { name: /^apply$/i })
        .or(page.getByRole("button", { name: /^apply$/i }))
        .first();
      if (await applyControl.isVisible({ timeout: 3000 }).catch(() => false)) {
        await applyControl.click({ timeout: 10_000 });
        await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
        await page.waitForTimeout(1500);
        title = await page.title().catch(() => null);
        text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
        url = page.url();
        state = classifyIndonesiaPortalSnapshot({ url, title, text });
      }
    }
    if (state === "visa_selection_visible" || url.includes("/web/visa-selection")) {
      await continueFromVisaSelection(page, input, session.diagnostics);
      title = await page.title().catch(() => null);
      text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
      url = page.url();
      state = classifyIndonesiaPortalSnapshot({ url, title, text });
    }
    if (state === "login_required" || state === "registration_required") {
      const advanced = await continueFromAccountGate(page, session.diagnostics);
      if (advanced) {
        title = await page.title().catch(() => null);
        text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
        url = page.url();
        state = classifyIndonesiaPortalSnapshot({ url, title, text });
      }
    }
    const action = actionForIndonesiaPortalState(state);
    return {
      state,
      actionType: action.actionType,
      instruction: action.instruction,
      implementationStatus: action.implementationStatus,
      url,
      title,
      browserProvider: session.provider,
      diagnostics: session.diagnostics,
    };
  } finally {
    await session.browser.close().catch(() => undefined);
  }
}
