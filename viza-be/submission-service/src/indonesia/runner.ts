import * as fs from "fs";
import * as path from "path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { solveCaptcha } from "../captcha";
import type { IndonesiaOneTimeCard } from "./card-session";
import {
  actionForIndonesiaPortalState,
  classifyIndonesiaPortalSnapshot,
  shouldDirectNavigateIndonesiaStepOne,
  type IndonesiaPortalStateId,
} from "./portal-state";

export interface IndonesiaPortalProbeInput {
  portalUrl: string;
  provider: "indonesia_c1_live" | "indonesia_b1_evoa_live";
  visaType?: "ID_C1_TOURIST" | "ID_B1_EVOA";
  applicationId?: string | null;
  passportCountry?: string | null;
  applicantId?: string | null;
  accountEmail?: string | null;
  accountPassword?: string | null;
  registration?: IndonesiaAccountRegistrationInput;
  application?: IndonesiaApplicationFormInput;
  headless?: boolean;
  timeoutMs?: number;
  userPaymentHandoff?: {
    enabled?: boolean;
    waitTimeoutMs?: number;
    oneTimeCard?: IndonesiaOneTimeCard | null;
    onWaitingForUser?: (snapshot: {
      url: string;
      title: string | null;
      state: IndonesiaPortalStateId;
      diagnostics: string[];
    }) => Promise<void>;
  };
  onStage?: (stage: string, snapshot: { url: string; title?: string | null }) => Promise<void>;
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

export interface IndonesiaAccountRegistrationInput {
  fullName?: string | null;
  gender?: string | null;
  birthPlace?: string | null;
  dateOfBirth?: string | null;
  phoneCodeCountry?: string | null;
  mobilePhone?: string | null;
  motherName?: string | null;
  passportNumber?: string | null;
  passportCountry?: string | null;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  passportIssuePlace?: string | null;
  passportImagePath?: string | null;
  photoImagePath?: string | null;
}

export interface IndonesiaApplicationFormInput {
  fullName?: string | null;
  gender?: string | null;
  birthPlace?: string | null;
  dateOfBirth?: string | null;
  mobilePhone?: string | null;
  passportNumber?: string | null;
  passportCountry?: string | null;
  passportIssueDate?: string | null;
  passportExpiryDate?: string | null;
  passportIssuePlace?: string | null;
  residenceType?: string | null;
  addressInIndonesia?: string | null;
  postalCode?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  village?: string | null;
  email?: string | null;
  passportImagePath?: string | null;
  photoImagePath?: string | null;
  returnTicketPath?: string | null;
  passportSupportPath?: string | null;
}

interface IndonesiaInboundEmailRow {
  id: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  received_at: string;
}

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

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isIndonesiaPortalHomeUrl(value: string | null | undefined): boolean {
  const normalized = clean(value);
  if (!normalized) return false;
  return /^https:\/\/evisa\.imigrasi\.go\.id\/?$/i.test(normalized);
}

async function solveIndonesiaRecaptchaIfPresent(
  page: Page,
  diagnostics: string[],
  stage: string,
): Promise<boolean> {
  await page
    .locator("iframe[src*='recaptcha'], [data-sitekey], .g-recaptcha, textarea[name='g-recaptcha-response']")
    .first()
    .waitFor({ state: "attached", timeout: 8_000 })
    .catch(() => undefined);
  const captcha = await page
    .evaluate(() => {
      const widget = document.querySelector<HTMLElement>("[data-sitekey], .g-recaptcha");
      const iframe = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe[src*='recaptcha']")).find((frame) =>
        /\/recaptcha\/api2\/anchor|google\.com\/recaptcha/i.test(frame.src),
      );
      const iframeSiteKey = iframe ? new URL(iframe.src, window.location.href).searchParams.get("k") : null;
      const siteKey = widget?.getAttribute("data-sitekey") || iframeSiteKey;
      const visibleCheckbox = Boolean(
        widget || iframe || document.querySelector("textarea[name='g-recaptcha-response'], #g-recaptcha-response"),
      );
      return { siteKey, visibleCheckbox };
    })
    .catch(() => ({ siteKey: null, visibleCheckbox: false }));

  if (!captcha.visibleCheckbox) return false;
  if (!captcha.siteKey) {
    diagnostics.push(`indonesia_recaptcha_${stage}_missing_sitekey`);
    return false;
  }
  if (!process.env.TWOCAPTCHA_API_KEY?.trim()) {
    diagnostics.push(`indonesia_recaptcha_${stage}_missing_twocaptcha_key`);
    return false;
  }

  diagnostics.push(`indonesia_recaptcha_${stage}_solve_started`);
  const timeoutMs = Number.parseInt(process.env.INDONESIA_RECAPTCHA_TIMEOUT_MS ?? "180000", 10);
  const solved = await solveCaptcha({
    type: "recaptcha-v2",
    siteKey: captcha.siteKey,
    pageUrl: page.url(),
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 180_000,
  });
  const token = solved.text.trim();
  if (!token) {
    diagnostics.push(`indonesia_recaptcha_${stage}_empty_token`);
    return false;
  }

  await page.evaluate((captchaToken) => {
    const ensureResponseField = (): HTMLTextAreaElement => {
      const existing = document.querySelector<HTMLTextAreaElement>("textarea[name='g-recaptcha-response']");
      if (existing) return existing;
      const created = document.createElement("textarea");
      created.name = "g-recaptcha-response";
      created.id = "g-recaptcha-response";
      created.style.display = "none";
      const form = document.querySelector("form") ?? document.body;
      form.appendChild(created);
      return created;
    };

    const response = ensureResponseField();
    response.value = captchaToken;
    response.innerHTML = captchaToken;
    response.dispatchEvent(new Event("input", { bubbles: true }));
    response.dispatchEvent(new Event("change", { bubbles: true }));

    const visitCallbacks = (value: unknown, seen: Set<unknown>, callbacks: Array<(token: string) => void>) => {
      if (!value || seen.has(value)) return;
      if (typeof value !== "object") return;
      seen.add(value);
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key === "callback" && typeof child === "function") {
          callbacks.push(child as (token: string) => void);
        } else {
          visitCallbacks(child, seen, callbacks);
        }
      }
    };

    const recaptchaWindow = window as Window & {
      ___grecaptcha_cfg?: { clients?: Record<string, unknown> };
      grecaptcha?: Record<string, unknown>;
    };
    const callbacks: Array<(token: string) => void> = [];
    for (const client of Object.values(recaptchaWindow.___grecaptcha_cfg?.clients ?? {})) {
      visitCallbacks(client, new Set<unknown>(), callbacks);
    }
    for (const callback of callbacks) {
      try {
        callback(captchaToken);
      } catch {
        // Continue; some recaptcha clients keep non-widget callbacks in the tree.
      }
    }
    if (recaptchaWindow.grecaptcha && typeof recaptchaWindow.grecaptcha === "object") {
      recaptchaWindow.grecaptcha.getResponse = () => captchaToken;
      recaptchaWindow.grecaptcha.execute = () => Promise.resolve(captchaToken);
    }
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      "button[type='submit'], input[type='submit'], button.btn-send, .btn-send",
    ))) {
      button.disabled = false;
      button.removeAttribute("disabled");
    }
  }, token);
  diagnostics.push(`indonesia_recaptcha_${stage}_token_injected solveId=${solved.solveId ?? "unknown"}`);
  return true;
}

async function clickIndonesiaLoginSubmit(page: Page): Promise<boolean> {
  const loginButton = page
    .locator("button[type='submit'], input[type='submit'], button.btn-send, .btn-send, button.btn-primary, .btn-primary")
    .or(page.getByRole("button", { name: /login|log in|sign in|masuk|submit|lanjut|continue/i }))
    .or(page.getByRole("link", { name: /login|log in|sign in|masuk|submit|lanjut|continue/i }))
    .first();
  if (await loginButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const clicked = await loginButton.click({ timeout: 15_000 }).then(() => true).catch(() => false);
    if (clicked) return true;
  }

  return page
    .evaluate(() => {
      const visible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const describe = (element: Element): string => [
        element.textContent ?? "",
        (element as HTMLInputElement).value ?? "",
        element.getAttribute("aria-label") ?? "",
        element.getAttribute("title") ?? "",
        element.getAttribute("id") ?? "",
        element.getAttribute("class") ?? "",
      ].join(" ").toLowerCase();
      const controls = Array.from(document.querySelectorAll<HTMLElement>(
        "button, input[type='submit'], input[type='button'], a.btn, [role='button']",
      )).filter(visible);
      const target = controls.find((control) => /login|log in|sign in|masuk|submit|lanjut|continue/i.test(describe(control))) ??
        controls.find((control) => (control as HTMLButtonElement).type === "submit") ??
        controls[0];
      if (!target) return false;
      target.scrollIntoView({ block: "center", inline: "center" });
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    })
    .catch(() => false);
}

function toIndonesiaDate(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`;
  }
  const ymd = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymd) {
    const [, yyyy, mm, dd] = ymd;
    return `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const dd = String(parsed.getUTCDate()).padStart(2, "0");
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = String(parsed.getUTCFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }
  return raw;
}

function genderSelector(value: string | null | undefined): string {
  const normalized = clean(value)?.toLowerCase() ?? "";
  if (/^f|female|woman|女/.test(normalized)) return "#gender-F";
  return "#gender-M";
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

async function fillIfPresent(page: Page, selector: string, value: string | null | undefined): Promise<boolean> {
  const cleaned = clean(value);
  if (!cleaned) return false;
  const field = page.locator(selector).first();
  if ((await field.count().catch(() => 0)) === 0) return false;
  try {
    await field.fill(cleaned, { timeout: 10_000 });
  } catch {
    await field.evaluate((element, nextValue) => {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      input.value = nextValue;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, cleaned);
  }
  await field.dispatchEvent("input").catch(() => undefined);
  await field.dispatchEvent("change").catch(() => undefined);
  return true;
}

async function setFilesIfPresent(page: Page, selector: string, filePath: string | null | undefined): Promise<boolean> {
  const cleaned = clean(filePath);
  if (!cleaned) return false;
  const field = page.locator(selector).first();
  if ((await field.count().catch(() => 0)) === 0) return false;
  await field.setInputFiles(cleaned, { timeout: 30_000 });
  await triggerInputEvent(page, selector);
  await page.waitForTimeout(1_000);
  return true;
}

async function triggerInputEvent(page: Page, selector: string): Promise<void> {
  await page
    .evaluate((css) => {
      const element = document.querySelector<HTMLInputElement>(css);
      if (!element) return;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
      element.dispatchEvent(new Event("click", { bubbles: true }));
    }, selector)
    .catch(() => undefined);
}

async function setFilesWithFallbackSelectors(
  page: Page,
  filePath: string | null | undefined,
  explicitSelectors: string[],
  fallbackHints: string[],
): Promise<boolean> {
  if (!clean(filePath)) return false;
  const triedSelectors = new Set(explicitSelectors);
  let uploaded = false;
  for (const selector of triedSelectors) {
    uploaded = await setFilesIfPresent(page, selector, filePath) || uploaded;
  }
  if (uploaded) {
    return true;
  }

  const fallbackSelectors = await page
    .evaluate((hints) => {
      const lowerHints = hints.map((hint) => hint.toLowerCase());
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='file']"));
      const visibleInputs = inputs.filter((input) => {
        const style = window.getComputedStyle(input);
        const rect = input.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      });
      const matches = visibleInputs.filter((input) => {
        const haystack = `${input.id} ${input.name} ${input.className} ${input.getAttribute("aria-label")} ${input.getAttribute("accept")}`
          .toLowerCase();
        return lowerHints.some((hint) => haystack.includes(hint));
      });
      const picked = (matches.length > 0 ? matches : visibleInputs).slice(0, 2);
      return picked.map((input) => {
        if (input.id) return `#${CSS.escape(input.id)}`;
        if (input.name) return `input[name="${input.name.replace(/"/g, "\\\"")}"]`;
        return null;
      }).filter((selector): selector is string => Boolean(selector));
    }, fallbackHints)
    .catch(() => []);
  for (const selector of fallbackSelectors) {
    uploaded = await setFilesIfPresent(page, selector, filePath) || uploaded;
  }
  return uploaded;
}

async function clickIfPresent(page: Page, selector: string): Promise<boolean> {
  const control = page.locator(selector).first();
  if (!(await control.isVisible({ timeout: 2_000 }).catch(() => false))) return false;
  await control.click({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  return true;
}

async function isVisibleSelector(page: Page, selector: string, timeoutMs = 1_500): Promise<boolean> {
  return page.locator(selector).first().isVisible({ timeout: timeoutMs }).catch(() => false);
}

async function dismissIndonesiaDialogs(page: Page, diagnostics: string[]): Promise<boolean> {
  let sawExistingApplicationWarning = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const swal = page.locator(".swal2-confirm").first();
    if (await swal.isVisible({ timeout: 1_000 }).catch(() => false)) {
      const text = await page.locator(".swal2-container").first().innerText({ timeout: 1_000 }).catch(() => "");
      sawExistingApplicationWarning ||= isExistingApplicationWarningText(text);
      await swal.click({ timeout: 5_000, force: true }).catch(() => undefined);
      diagnostics.push(`indonesia_dialog_confirmed ${text.replace(/\s+/g, " ").trim().slice(0, 80)}`);
      await page.waitForTimeout(1_000);
      continue;
    }

    const scannerAccept = page.locator("#acceptScannerBtn").first();
    if (await scannerAccept.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await scannerAccept.click({ timeout: 5_000, force: true }).catch(() => undefined);
      diagnostics.push("indonesia_passport_scanner_preview_accepted");
      await page.waitForTimeout(1_000);
      continue;
    }
    return sawExistingApplicationWarning;
  }
  return sawExistingApplicationWarning;
}

async function acceptIndonesiaExistingApplicationCancellationWarning(
  page: Page,
  diagnostics: string[],
): Promise<boolean> {
  const accepted = await page
    .evaluate(() => {
      const normalized = (document.body.innerText || document.body.textContent || "").replace(/\s+/g, " ");
      if (!/Currently the foreigner has a visa application/i.test(normalized)) return false;
      if (!/cancell?ing my current visa|cancelled from the previous visa application/i.test(normalized)) return false;

      const visible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };

      const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='checkbox']"))
        .filter((checkbox) => !checkbox.disabled && visible(checkbox));
      const checkbox = checkboxes[0] ?? null;
      if (!checkbox) return false;
      checkbox.scrollIntoView({ block: "center", inline: "center" });
      checkbox.checked = true;
      checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      checkbox.dispatchEvent(new Event("input", { bubbles: true }));
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));

      const controls = Array.from(
        document.querySelectorAll<HTMLElement>("button, a, input[type='button'], input[type='submit'], [role='button']"),
      ).filter(visible);
      const next = controls.find((control) => /next/i.test((control.innerText || control.textContent || (control as HTMLInputElement).value || "").trim()));
      if (!next) return false;
      if ("disabled" in next) {
        (next as HTMLButtonElement | HTMLInputElement).disabled = false;
      }
      next.removeAttribute("disabled");
      next.classList.remove("disabled");
      next.scrollIntoView({ block: "center", inline: "center" });
      next.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    })
    .catch(() => false);

  if (!accepted) return false;
  diagnostics.push("indonesia_existing_application_cancellation_warning_accepted");
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(3_000);
  await dismissIndonesiaDialogs(page, diagnostics);
  return true;
}

async function imageMetadata(page: Page, filePath: string): Promise<{ width: number; height: number } | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return null;
  const dataUrl = `data:image/${ext === ".png" ? "png" : ext === ".webp" ? "webp" : "jpeg"};base64,${fs.readFileSync(filePath).toString("base64")}`;
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  }, dataUrl).catch(() => null);
}

async function rotateImageClockwiseForPassport(page: Page, filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${fs.readFileSync(filePath).toString("base64")}`;
  const rotated = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalHeight;
    canvas.height = img.naturalWidth;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context unavailable");
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  }, dataUrl);
  const base64 = rotated.replace(/^data:image\/jpeg;base64,/, "");
  const outputPath = path.join(path.dirname(filePath), `${path.basename(filePath, path.extname(filePath))}-landscape.jpg`);
  fs.writeFileSync(outputPath, Buffer.from(base64, "base64"));
  return outputPath;
}

async function normalizePassportLandscape(page: Page, filePath: string | null | undefined, diagnostics: string[]): Promise<string | null> {
  const cleaned = clean(filePath);
  if (!cleaned) return null;
  const meta = await imageMetadata(page, cleaned);
  if (!meta || meta.width >= meta.height) return cleaned;
  const rotatedPath = await rotateImageClockwiseForPassport(page, cleaned);
  diagnostics.push("indonesia_passport_image_rotated_to_landscape");
  return rotatedPath;
}

async function makeImagePdf(page: Page, imagePath: string | null | undefined, diagnostics: string[]): Promise<string | null> {
  const cleaned = clean(imagePath);
  if (!cleaned) return null;
  if (/\.pdf$/i.test(cleaned)) return cleaned;
  const meta = await imageMetadata(page, cleaned);
  if (!meta) return null;
  const outputPath = path.join(path.dirname(cleaned), `${path.basename(cleaned, path.extname(cleaned))}.pdf`);
  const pdfPage = await page.context().newPage();
  try {
    const dataUrl = `data:image/${path.extname(cleaned).toLowerCase() === ".png" ? "png" : "jpeg"};base64,${fs.readFileSync(cleaned).toString("base64")}`;
    await pdfPage.setContent(
      `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;"><img src="${dataUrl}" style="max-width:100%;max-height:100%;object-fit:contain;" /></body></html>`,
      { waitUntil: "domcontentloaded" },
    );
    await pdfPage.pdf({ path: outputPath, printBackground: true, width: "11in", height: "8.5in" });
    diagnostics.push("indonesia_passport_support_pdf_generated");
    return outputPath;
  } finally {
    await pdfPage.close().catch(() => undefined);
  }
}

function digitsOnly(value: string | null | undefined): string | null {
  const valueDigits = clean(value)?.replace(/[^\d]/g, "");
  return valueDigits || null;
}

function officialSafeText(value: string | null | undefined, fallback: string | null = null): string | null {
  const source = clean(value) ?? fallback;
  if (!source) return null;
  const lastCompositePart = source.split("|").map((part) => part.trim()).filter(Boolean).pop() ?? source;
  const sanitized = lastCompositePart.replace(/[^a-zA-Z0-9., ]+/g, " ").replace(/\s+/g, " ").trim();
  return sanitized || fallback;
}

async function setDateValue(page: Page, selector: string, value: string | null | undefined): Promise<boolean> {
  const normalized = toIndonesiaDate(value);
  if (!normalized) return false;
  return fillIfPresent(page, selector, normalized);
}

async function fillTextInputValue(page: Page, selector: string, value: string | null | undefined): Promise<boolean> {
  const cleaned = clean(value);
  if (!cleaned) return false;
  const field = page.locator(selector).first();
  if ((await field.count().catch(() => 0)) === 0) return false;
  await field.evaluate((element, nextValue) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, cleaned);
  return true;
}

async function fillPostalCodeAndWaitForAddress(page: Page, postalCode: string | null | undefined): Promise<boolean> {
  const code = digitsOnly(postalCode) ?? "10310";
  const postal = page.locator("#postal_code").first();
  if ((await postal.count().catch(() => 0)) === 0) return false;
  await postal.fill(code, { timeout: 10_000 });
  await postal.dispatchEvent("keyup");
  await page.waitForFunction(
    () => {
      const ids = ["province_id", "city_id", "district_id", "village_id"];
      return ids.every((id) => {
        const field = document.getElementById(id) as HTMLInputElement | null;
        return Boolean(field?.value);
      });
    },
    undefined,
    { timeout: 12_000 },
  ).catch(() => undefined);
  return true;
}

async function waitForHiddenValue(
  page: Page,
  selector: string,
  diagnostics: string[],
  label: string,
  timeoutMs = 35_000,
): Promise<boolean> {
  const ready = await page
    .waitForFunction(
      (css) => {
        const input = document.querySelector<HTMLInputElement>(css);
        return Boolean(input?.value?.trim());
      },
      selector,
      { timeout: timeoutMs, polling: 500 },
    )
    .then(() => true)
    .catch(() => false);
  diagnostics.push(`${label}_${ready ? "ready" : "not_ready"}`);
  return ready;
}

async function waitForAnyHiddenValue(
  page: Page,
  selectors: string[],
  diagnostics: string[],
  label: string,
): Promise<boolean> {
  const ready = await page
    .waitForFunction(
      (cssSelectors) =>
        cssSelectors.some((css) => {
          const input = document.querySelector<HTMLInputElement>(css);
          return Boolean(input?.value?.trim());
        }),
      selectors,
      { timeout: 35_000, polling: 500 },
    )
    .then(() => true)
    .catch(() => false);
  diagnostics.push(`${label}_${ready ? "ready" : "not_ready"}`);
  return ready;
}

async function waitForAnyUploadValue(
  page: Page,
  selectors: string[],
  diagnostics: string[],
  label: string,
): Promise<boolean> {
  const ready = await page
    .waitForFunction(
      (cssSelectors) =>
        cssSelectors.some((css) => {
          const input = document.querySelector<HTMLInputElement>(css);
          return Boolean(input?.files?.length || input?.value?.trim());
        }),
      selectors,
      { timeout: 35_000, polling: 500 },
    )
    .then(() => true)
    .catch(() => false);
  diagnostics.push(`${label}_${ready ? "ready" : "not_ready"}`);
  return ready;
}

async function syncUploadHiddenFallback(
  page: Page,
  fileSelectors: string[],
  hiddenSelectors: string[],
  diagnostics: string[],
  label: string,
): Promise<boolean> {
  const changed = await page
    .evaluate(({ nextFileSelectors, nextHiddenSelectors }) => {
      const fileInputs = nextFileSelectors
        .map((selector) => document.querySelector<HTMLInputElement>(selector))
        .filter((input): input is HTMLInputElement => Boolean(input));
      const fileName = fileInputs
        .map((input) => input.files?.[0]?.name || input.value.split(/[/\\]/).pop() || "")
        .find((value) => value.trim());
      if (!fileName) return 0;
      let count = 0;
      for (const selector of nextHiddenSelectors) {
        const input = document.querySelector<HTMLInputElement>(selector);
        if (!input || input.value.trim() || input.type === "file") continue;
        input.value = fileName;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        count += 1;
      }
      return count;
    }, { nextFileSelectors: fileSelectors, nextHiddenSelectors: hiddenSelectors })
    .catch(() => 0);
  diagnostics.push(`${label}_hidden_fallback_${changed > 0 ? `set_${changed}` : "skipped"}`);
  return changed > 0;
}

async function assignBrowserFileToInputs(
  page: Page,
  filePath: string,
  selectors: string[],
  diagnostics: string[],
  label: string,
): Promise<boolean> {
  const cleaned = clean(filePath);
  if (!cleaned) return false;
  const ext = path.extname(cleaned).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const payload = {
    selectors,
    name: path.basename(cleaned),
    mime,
    base64: fs.readFileSync(cleaned).toString("base64"),
  };
  const assigned = await page
    .evaluate(({ selectors: cssSelectors, name, mime, base64 }) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      let count = 0;
      for (const css of cssSelectors) {
        const input = document.querySelector<HTMLInputElement>(css);
        if (!input || input.type !== "file") continue;
        const file = new File([bytes], name, { type: mime, lastModified: Date.now() });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        count += input.files?.length ? 1 : 0;
      }
      return count;
    }, payload)
    .catch(() => 0);
  diagnostics.push(`${label}_browser_file_assign_${assigned}`);
  return assigned > 0;
}

async function snapshotUploadInputs(page: Page, selectors: string[], diagnostics: string[], label: string): Promise<void> {
  const flags = await page
    .evaluate((cssSelectors) =>
      cssSelectors.map((css) => {
        const input = document.querySelector<HTMLInputElement>(css);
        if (!input) return `${css}=missing`;
        return `${css}=type:${input.type || "?"},files:${input.files?.length ?? 0},value:${input.value ? "set" : "empty"}`;
      }),
    selectors)
    .catch(() => []);
  diagnostics.push(`${label}_snapshot ${flags.join(",") || "unavailable"}`);
}

async function completeIndonesiaPassportBiodataUpload(
  page: Page,
  passportPath: string,
  diagnostics: string[],
): Promise<boolean> {
  await setFilesWithFallbackSelectors(
    page,
    passportPath,
    [
      "#passport-attachment",
      "#initial_file",
      "#path_attachment",
      "#path_attachment_crop",
      "#attachment-crop",
      "#attachment",
    ],
    ["passport", "biografi", "passport_page", "passport copy", "bio"],
  );
  await dismissIndonesiaDialogs(page, diagnostics);

  const hiddenFileInputsReady = await waitForAnyUploadValue(
    page,
    ["#path_attachment", "#path_attachment_crop"],
    diagnostics,
    "indonesia_step_1_passport_hidden_file_upload",
  );
  if (!hiddenFileInputsReady) {
    await setFilesIfPresent(page, "#path_attachment", passportPath);
    await setFilesIfPresent(page, "#path_attachment_crop", passportPath);
    await assignBrowserFileToInputs(
      page,
      passportPath,
      ["#path_attachment", "#path_attachment_crop"],
      diagnostics,
      "indonesia_step_1_passport_hidden",
    );
    await dismissIndonesiaDialogs(page, diagnostics);
  }
  await snapshotUploadInputs(
    page,
    ["#passport-attachment", "#initial_file", "#path_attachment", "#path_attachment_crop"],
    diagnostics,
    "indonesia_step_1_passport",
  );

  const ready = await waitForAnyUploadValue(
    page,
    ["#path_attachment", "#path_attachment_crop", "#attachment-files", "#path_passport", "#path_upload", "#passport_file"],
    diagnostics,
    "indonesia_step_1_passport_upload",
  );
  await syncUploadHiddenFallback(
    page,
    ["#passport-attachment", "#initial_file", "#attachment-crop", "#attachment"],
    ready
      ? ["#attachment-files", "#path_passport", "#path_upload", "#passport_file"]
      : ["#path_attachment", "#path_attachment_crop", "#attachment-files", "#path_passport", "#path_upload", "#passport_file"],
    diagnostics,
    "indonesia_step_1_passport_upload",
  );
  return ready || await waitForAnyUploadValue(
    page,
    ["#path_attachment", "#path_attachment_crop", "#attachment-files", "#path_passport", "#path_upload", "#passport_file"],
    diagnostics,
    "indonesia_step_1_passport_upload_after_fallback",
  );
}

async function waitForIndonesiaMrzScannerReady(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  const scannerReady = await page
    .waitForFunction(
      () => {
        try {
          return Boolean(eval("typeof scannerPayload !== 'undefined' && scannerPayload"));
        } catch {
          return false;
        }
      },
      undefined,
      { timeout: 90_000, polling: 1_000 },
    )
    .then(() => true)
    .catch(() => false);
  if (scannerReady) {
    diagnostics.push("indonesia_step_1_mrz_scanner_payload_ready");
    await dismissIndonesiaDialogs(page, diagnostics);
    return true;
  }

  const fallbackEnabled = process.env.INDONESIA_MRZ_FALLBACK_FROM_APPLICATION !== "false";
  if (!fallbackEnabled) {
    diagnostics.push("indonesia_step_1_mrz_scanner_payload_not_ready");
    return false;
  }

  const application = input.application;
  const source = input.registration ?? application;
  if (!source) {
    diagnostics.push("indonesia_step_1_mrz_scanner_payload_fallback_missing_profile");
    return false;
  }
  const nameParts = (source.fullName ?? application?.fullName ?? "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const fallbackPayload = {
    documentNumber: source.passportNumber,
    dateOfBirth: source.dateOfBirth,
    dateOfExpiry: source.passportExpiryDate,
    firstName: nameParts[0] ?? source.fullName ?? null,
    lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
    nationality: source.passportCountry,
    issuingState: source.passportCountry,
    sex: source.gender,
    mrzText: null,
  };
  const injected = await page
    .evaluate((payload) => {
      try {
        eval("scannerPayload = arguments[0]");
        eval("mrzInvalidCount = 0");
        eval("skipMRZ = false");
        return true;
      } catch {
        try {
          eval("skipMRZ = true");
          return true;
        } catch {
          return false;
        }
      }
    }, { ...fallbackPayload, email: application?.email ?? input.accountEmail })
    .catch(() => false);
  diagnostics.push(`indonesia_step_1_mrz_scanner_payload_fallback_${injected ? "set" : "failed"}`);
  return injected;
}

async function captureRegistrationArtifact(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<void> {
  const applicationId = String(input.applicantId ?? input.application?.passportNumber ?? "unknown")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.resolve("diag-out", "indonesia-c1-registration", applicationId);
  fs.mkdirSync(dir, { recursive: true });
  const htmlPath = path.join(dir, "registration.html");
  const screenshotPath = path.join(dir, "registration.png");
  fs.writeFileSync(htmlPath, await page.content().catch(() => ""));
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
  diagnostics.push(`indonesia_account_registration_artifact ${dir}`);
}

async function captureStepOneArtifact(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<void> {
  try {
    const applicationId = String(input.applicationId ?? input.application?.passportNumber ?? "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const dir = path.resolve("diag-out", "indonesia-step-1", applicationId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "step-1.html"), await page.content().catch(() => ""));
    const fieldSnapshot = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea"))
          .filter((control) => /passport|picture|photo|attachment|file|path|crop|initial/i.test(`${control.id} ${control.name} ${control.className}`))
          .map((control) => {
            const input = control as HTMLInputElement;
            return {
              tag: control.tagName.toLowerCase(),
              id: control.id,
              name: control.getAttribute("name"),
              type: input.type,
              classes: control.className,
              accept: input.accept,
              required: control.required,
              hasValue: Boolean(String(control.value ?? "").trim()),
              valueLength: String(control.value ?? "").length,
              fileCount: input.files?.length ?? 0,
              onchange: control.getAttribute("onchange"),
              data: Array.from(control.attributes)
                .filter((attr) => attr.name.startsWith("data-") || /url|upload|crop|path/i.test(attr.name))
                .map((attr) => [attr.name, attr.value]),
            };
          }),
      )
      .catch((error: unknown) => [{ error: error instanceof Error ? error.message : String(error) }]);
    fs.writeFileSync(path.join(dir, "fields.json"), JSON.stringify(fieldSnapshot, null, 2));
    await page.screenshot({ path: path.join(dir, "step-1.png"), fullPage: true }).catch(() => undefined);
    diagnostics.push(`indonesia_step_1_artifact ${dir}`);
  } catch (error) {
    diagnostics.push(`indonesia_step_1_artifact_failed ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function captureApplicationListArtifact(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<void> {
  try {
    const applicationId = String(input.applicationId ?? input.application?.passportNumber ?? "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const dir = path.resolve("diag-out", "indonesia-application-list", applicationId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "application-list.html"), await page.content().catch(() => ""));
    const controls = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("a,button,[role='button'],input[type='button'],input[type='submit']"))
          .filter((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0;
          })
          .map((element) => ({
            tag: element.tagName.toLowerCase(),
            text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180),
            href: element.getAttribute("href"),
            id: element.id,
            classes: element.className,
            title: element.getAttribute("title"),
            ariaLabel: element.getAttribute("aria-label"),
            dataAction: element.getAttribute("data-action"),
            dataUrl: element.getAttribute("data-url"),
            onclick: element.getAttribute("onclick"),
          })),
      )
      .catch((error: unknown) => [{ error: error instanceof Error ? error.message : String(error) }]);
    fs.writeFileSync(path.join(dir, "controls.json"), JSON.stringify(controls, null, 2));
    await page.screenshot({ path: path.join(dir, "application-list.png"), fullPage: true }).catch(() => undefined);
    diagnostics.push(`indonesia_application_list_artifact ${dir}`);
  } catch (error) {
    diagnostics.push(`indonesia_application_list_artifact_failed ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function captureApplicationStepArtifact(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
  step: 2 | 3,
): Promise<void> {
  try {
    const applicationId = String(input.applicationId ?? input.application?.passportNumber ?? "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const dir = path.resolve("diag-out", `indonesia-step-${step}`, applicationId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `step-${step}.html`), await page.content().catch(() => ""));
    const controls = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("a,button,[role='button'],input[type='button'],input[type='submit'],select,input,textarea"))
          .filter((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0;
          })
          .map((element) => {
            const control = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            return {
              tag: element.tagName.toLowerCase(),
              text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180),
              id: element.id,
              name: element.getAttribute("name"),
              type: control instanceof HTMLInputElement ? control.type : null,
              classes: element.className,
              valueLength: String(control.value ?? "").length,
              required: "required" in control ? Boolean(control.required) : false,
              disabled: "disabled" in control ? Boolean(control.disabled) : false,
              href: element.getAttribute("href"),
              onclick: element.getAttribute("onclick"),
            };
          }),
      )
      .catch((error: unknown) => [{ error: error instanceof Error ? error.message : String(error) }]);
    fs.writeFileSync(path.join(dir, "controls.json"), JSON.stringify(controls, null, 2));
    await page.screenshot({ path: path.join(dir, `step-${step}.png`), fullPage: true }).catch(() => undefined);
    diagnostics.push(`indonesia_step_${step}_artifact ${dir}`);
  } catch (error) {
    diagnostics.push(`indonesia_step_${step}_artifact_failed ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function capturePaymentArtifact(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
  label: "otp" | "payment",
): Promise<void> {
  try {
    const applicationId = String(input.applicationId ?? input.application?.passportNumber ?? "unknown")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const dir = path.resolve("diag-out", "indonesia-payment", applicationId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${label}.html`), await page.content().catch(() => ""));
    const controls = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("a,button,[role='button'],input[type='button'],input[type='submit'],select,input,textarea,iframe"))
          .filter((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0;
          })
          .map((element) => {
            const control = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            return {
              tag: element.tagName.toLowerCase(),
              text: (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180),
              id: element.id,
              name: element.getAttribute("name"),
              type: control instanceof HTMLInputElement ? control.type : null,
              classes: element.className,
              placeholder: element.getAttribute("placeholder"),
              autocomplete: element.getAttribute("autocomplete"),
              valueLength: String(control.value ?? "").length,
              required: "required" in control ? Boolean(control.required) : false,
              disabled: "disabled" in control ? Boolean(control.disabled) : false,
              href: element.getAttribute("href"),
              src: element.getAttribute("src"),
            };
          }),
      )
      .catch((error: unknown) => [{ error: error instanceof Error ? error.message : String(error) }]);
    fs.writeFileSync(path.join(dir, `${label}-controls.json`), JSON.stringify(controls, null, 2));
    await page.screenshot({ path: path.join(dir, `${label}.png`), fullPage: true }).catch(() => undefined);
    diagnostics.push(`indonesia_${label}_artifact ${dir}`);
  } catch (error) {
    diagnostics.push(`indonesia_${label}_artifact_failed ${error instanceof Error ? error.message : String(error)}`);
  }
}

function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function extractIndonesiaVerificationUrlFromEmail(message: {
  html?: string | null;
  text?: string | null;
}): URL | null {
  const haystacks = [message.html ?? "", message.text ?? ""]
    .flatMap((value) => [value, decodeQuotedPrintable(value)])
    .map((value) =>
      value
        .replace(/&amp;/gi, "&")
        .replace(/&#x3D;/gi, "=")
        .replace(/&equals;/gi, "="),
    );
  for (const haystack of haystacks) {
    const matches = haystack.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
    for (const match of matches) {
      const candidate = match
        .replace(/[),.;\]]+$/g, "")
        .trim();
      if (!/evisa\.imigrasi\.go\.id/i.test(candidate)) continue;
      if (!/verify|verification|activate|activation|confirm|token|email/i.test(candidate)) continue;
      try {
        return new URL(candidate);
      } catch {
        // Continue scanning.
      }
    }
  }
  return null;
}

async function waitForIndonesiaVerificationLink(
  applicantId: string,
  accountEmail: string | null | undefined,
  diagnostics: string[],
): Promise<URL | null> {
  const alias = clean(accountEmail)?.toLowerCase();
  const { supabase } = await import("../supabase");
  const timeoutMs = Number(process.env.INDONESIA_EMAIL_VERIFICATION_TIMEOUT_MS ?? "180000");
  const since = new Date(Date.now() - Number(process.env.INDONESIA_EMAIL_VERIFICATION_LOOKBACK_MS ?? "1800000")).toISOString();
  const deadline = Date.now() + Math.max(10_000, timeoutMs);

  if (!alias) {
    diagnostics.push("indonesia_account_email_verification_alias_missing");
    return null;
  }

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("inbound_email")
      .select("id, to_addr, from_addr, subject, text, html, received_at, processed")
      .eq("to_addr", alias)
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(10);
    if (error) {
      diagnostics.push(`indonesia_account_email_verification_lookup_failed ${error.message}`);
      return null;
    }

    for (const row of (data ?? []) as Array<{
      id: string;
      from_addr: string | null;
      subject: string | null;
      text: string | null;
      html: string | null;
      received_at: string;
    }>) {
      const haystack = `${row.from_addr ?? ""} ${row.subject ?? ""} ${row.text ?? ""} ${row.html ?? ""}`;
      if (!/evisa\.imigrasi\.go\.id|imigrasi/i.test(haystack)) continue;
      if (!/verify|verification|activate|activation|confirm|account|email/i.test(haystack)) continue;
      const link = extractIndonesiaVerificationUrlFromEmail(row);
      if (!link) {
        diagnostics.push(`indonesia_account_email_verification_link_not_extracted received_at=${row.received_at}`);
        continue;
      }
      try {
        await supabase
          .from("inbound_email")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", row.id);
      } catch {
        // Marking the email processed is best-effort; the activation link can still be used.
      }
      diagnostics.push(`indonesia_account_email_verification_link_found received_at=${row.received_at}`);
      return link;
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  diagnostics.push(`indonesia_account_email_verification_timeout applicant=${applicantId}`);
  return null;
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

async function continueFromAccountLogin(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  const email = clean(input.accountEmail);
  const password = clean(input.accountPassword);
  if (!email || !password) return false;
  const loginVisible = await page
    .locator("input[type='email'], input[name='username'], #username, #email, input[name='email']")
    .first()
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
  const passwordVisible = await page
    .locator("input[type='password'], #password")
    .first()
    .isVisible({ timeout: 3_000 })
    .catch(() => false);
  const text = await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "");
  if (!loginVisible || !passwordVisible || !/login|log in|sign in|masuk|email|username/i.test(text)) {
    return false;
  }

  const filled = await page
    .evaluate(
      ({ nextEmail, nextPassword }) => {
        const visible = (element: Element): boolean => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0;
        };
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input")).filter((input) =>
          !input.disabled &&
          input.type !== "hidden" &&
          visible(input)
        );
        const emailInput = inputs.find((input) =>
          /email|username|user/i.test(`${input.id} ${input.name} ${input.placeholder} ${input.autocomplete}`),
        ) ?? inputs.find((input) => input.type === "email") ?? inputs[0];
        const passwordInput = inputs.find((input) => input.type === "password" || /password/i.test(`${input.id} ${input.name}`));
        if (!emailInput || !passwordInput) return false;
        emailInput.value = nextEmail;
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));
        emailInput.dispatchEvent(new Event("change", { bubbles: true }));
        passwordInput.value = nextPassword;
        passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
        passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      },
      { nextEmail: email, nextPassword: password },
    )
    .catch(() => false);
  if (!filled) return false;

  await solveIndonesiaRecaptchaIfPresent(page, diagnostics, "login").catch((error: unknown) => {
    diagnostics.push(`indonesia_recaptcha_login_failed ${error instanceof Error ? error.message : String(error)}`);
    return false;
  });

  let clicked = await clickIndonesiaLoginSubmit(page);
  if (!clicked) return false;

  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(3_000);
  if (/\/front\/login/i.test(page.url())) {
    const solvedRetryCaptcha = await solveIndonesiaRecaptchaIfPresent(page, diagnostics, "login_retry").catch((error: unknown) => {
      diagnostics.push(`indonesia_recaptcha_login_retry_failed ${error instanceof Error ? error.message : String(error)}`);
      return false;
    });
    if (solvedRetryCaptcha) {
      clicked = await clickIndonesiaLoginSubmit(page);
      if (clicked) {
        await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
        await page.waitForTimeout(3_000);
        if (!/\/front\/login/i.test(page.url())) {
          diagnostics.push("indonesia_account_login_submitted_after_recaptcha_retry");
          return true;
        }
      }
    }
    const visibleMessages = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>(".invalid-feedback, .text-danger, .alert, .swal2-container, .error, .help-block"))
          .filter((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          })
          .map((element) => (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 6),
      )
      .catch(() => []);
    if (visibleMessages.length > 0) {
      diagnostics.push(`indonesia_account_login_messages ${visibleMessages.join(" | ").slice(0, 300)}`);
    }
    if (visibleMessages.some((message) => /authenticated failed|invalid|incorrect|failed/i.test(message))) {
      diagnostics.push("indonesia_account_login_failed_try_registration");
      return false;
    }
    diagnostics.push("indonesia_account_login_still_on_login_try_registration");
    return false;
  }
  diagnostics.push("indonesia_account_login_submitted");
  return true;
}

async function continueFromAccountGate(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  if (await continueFromAccountLogin(page, input, diagnostics)) {
    return true;
  }
  const createAccountLink = page
    .getByRole("link", { name: /create account|register|sign up|daftar|buat akun/i })
    .or(page.getByRole("button", { name: /create account|register|sign up|daftar|buat akun/i }))
    .or(page.locator('a[href*="register"], a[href*="signup"], a[href*="daftar"]'))
    .first();
  if (!(await createAccountLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return false;
  }
  const href = await createAccountLink.getAttribute("href").catch(() => null);
  const blockingDialog = page.locator(".swal2-container.swal2-backdrop-show").first();
  if (await blockingDialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
    const dialogText = await blockingDialog.innerText({ timeout: 1_000 }).catch(() => "");
    if (dialogText) diagnostics.push(`indonesia_account_login_dialog ${dialogText.replace(/\s+/g, " ").slice(0, 160)}`);
    const confirmButton = page.locator(".swal2-confirm, .swal2-actions button").first();
    if (await confirmButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmButton.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(500);
    }
  }
  if (href) {
    await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
  } else {
    await createAccountLink.click({ timeout: 15_000 });
  }
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

async function fillForeignerAccountRegistration(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  if (!input.registration || !input.accountEmail || !input.accountPassword) {
    diagnostics.push("indonesia_account_registration_missing_credentials_or_profile");
    return false;
  }
  if (!/\/front\/register\/wna/i.test(page.url())) {
    const formVisible = await page
      .locator("#document_travel_id, #attachment, #full_name, #username, #confirm_email")
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    if (!formVisible) return false;
  }

  const registration = input.registration;
  await selectNativeOptionByText(page, "#document_travel_id", /^Passport$/i).catch(() => undefined);
  await setFilesIfPresent(page, "#attachment", registration.passportImagePath);
  await setFilesIfPresent(page, "#initial_file", registration.passportImagePath);
  await waitForHiddenValue(page, "#path_attachment", diagnostics, "indonesia_account_passport_upload");
  await setFilesIfPresent(page, "#picture", registration.photoImagePath);
  await waitForHiddenValue(page, "#path_photo", diagnostics, "indonesia_account_photo_upload");

  await fillIfPresent(page, "#full_name", officialSafeText(registration.fullName));
  const gender = page.locator(genderSelector(registration.gender)).first();
  if (await gender.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await gender.check({ timeout: 5_000 }).catch(() => undefined);
  }
  await fillIfPresent(page, "#birth_place", officialSafeText(registration.birthPlace));
  await fillIfPresent(page, "#birthday", toIndonesiaDate(registration.dateOfBirth));
  const phoneCountry = normalizeCountryLabel(registration.phoneCodeCountry ?? registration.passportCountry);
  await selectNativeOptionByText(page, "#phone_code", new RegExp(phoneCountry.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).catch(() => undefined);
  await fillIfPresent(page, "#mobile_phone", digitsOnly(registration.mobilePhone));
  await fillIfPresent(page, "#mother", registration.motherName ?? "UNKNOWN");
  await fillIfPresent(page, "#number", registration.passportNumber);
  await selectNativeOptionByText(
    page,
    "#country_id",
    new RegExp(`^${normalizeCountryLabel(registration.passportCountry).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  ).catch(() => undefined);
  await page.locator("#number").first().dispatchEvent("blur").catch(() => undefined);
  await page.waitForTimeout(2_000);
  await fillIfPresent(page, "#release_date", toIndonesiaDate(registration.passportIssueDate));
  await fillIfPresent(page, "#expired_date", toIndonesiaDate(registration.passportExpiryDate));
  await fillIfPresent(page, "#release_place", officialSafeText(registration.passportIssuePlace ?? registration.passportCountry, "CHINA"));
  await fillIfPresent(page, "#username", input.accountEmail);
  await fillIfPresent(page, "#confirm_email", input.accountEmail);
  await fillIfPresent(page, "#password", input.accountPassword);
  await fillIfPresent(page, "#confirm_password", input.accountPassword);
  diagnostics.push("indonesia_account_registration_form_filled");

  const shouldSubmit = process.env.INDONESIA_ACCOUNT_REGISTRATION_SUBMIT !== "false";
  if (!shouldSubmit) return true;
  const submit = page.locator("button.btn-send, .btn-send").first();
  if (await submit.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await solveIndonesiaRecaptchaIfPresent(page, diagnostics, "account_registration").catch((error: unknown) => {
      diagnostics.push(`indonesia_recaptcha_account_registration_failed ${error instanceof Error ? error.message : String(error)}`);
      return false;
    });
    await submit.click({ timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(4_000);
    diagnostics.push("indonesia_account_registration_submitted");
    const visibleErrors = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>(".invalid-feedback, .text-danger, .alert, .swal2-container, .error"))
          .filter((element) => {
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          })
          .map((element) => (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 6),
      )
      .catch(() => []);
    if (visibleErrors.length > 0) {
      diagnostics.push(`indonesia_account_registration_errors ${visibleErrors.join(" | ").slice(0, 300)}`);
    }
    const invalidControls = await page
      .evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>(".is-invalid"))
          .map((element) => {
            const input = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            return input.id || input.getAttribute("name") || element.className || element.tagName;
          })
          .filter(Boolean)
          .slice(0, 12),
      )
      .catch(() => []);
    if (invalidControls.length > 0) {
      diagnostics.push(`indonesia_account_registration_invalid_controls ${invalidControls.join(", ")}`);
    }
    if (/\/front\/register\/wna/i.test(page.url())) {
      await captureRegistrationArtifact(page, input, diagnostics);
    }
  }

  if (input.applicantId) {
    const verificationLink = await waitForIndonesiaVerificationLink(input.applicantId, input.accountEmail, diagnostics);
    if (verificationLink) {
      await page.goto(verificationLink.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(2_000);
      diagnostics.push("indonesia_account_email_verification_opened");
      await page.goto(input.portalUrl, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(1_500);
    } else {
      diagnostics.push("indonesia_account_email_verification_not_found_yet");
    }
  }
  return true;
}

async function continueFromApplicationStepOne(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  const isStepOne =
    /\/step_1\b/i.test(page.url()) ||
    await isVisibleSelector(page, "#passport-attachment");
  if (!isStepOne) return false;
  const application = input.application;
  if (!application?.passportImagePath || !application.photoImagePath) {
    diagnostics.push("indonesia_step_1_missing_passport_or_photo");
    return false;
  }

  await dismissIndonesiaDialogs(page, diagnostics);
  await input.onStage?.("step_1_processing_passport_image", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });
  const passportPath = await normalizePassportLandscape(page, application.passportImagePath, diagnostics);
  if (!passportPath) {
    diagnostics.push("indonesia_step_1_passport_image_unavailable");
    return false;
  }
  await input.onStage?.("step_1_uploading_passport", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });
  await completeIndonesiaPassportBiodataUpload(page, passportPath, diagnostics);
  await waitForIndonesiaMrzScannerReady(page, input, diagnostics);

  await input.onStage?.("step_1_uploading_photo", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });
  await setFilesWithFallbackSelectors(
    page,
    application.photoImagePath,
    ["#picture", "#photo", "#photo_attachment"],
    ["photo", "foto", "applicant_photo", "profile_photo"],
  );
  const photoUploadReady = await waitForHiddenValue(page, "#path_photo", diagnostics, "indonesia_step_1_photo_upload", 12_000);
  if (!photoUploadReady) {
    await syncUploadHiddenFallback(
      page,
      ["#picture", "#photo", "#photo_attachment"],
      ["#path_photo"],
      diagnostics,
      "indonesia_step_1_photo_upload",
    );
  }
  await snapshotUploadInputs(
    page,
    ["#picture", "#path_photo"],
    diagnostics,
    "indonesia_step_1_photo",
  );
  await input.onStage?.("step_1_photo_ready", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });
  await fillIndonesiaStayAndSupportFieldsIfPresent(page, input, diagnostics, "indonesia_step_1");
  await dismissIndonesiaDialogs(page, diagnostics);

  const next = page.locator("#btn-submit").first();
  if (await next.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await input.onStage?.("step_1_clicking_next", {
      url: page.url(),
      title: await page.title().catch(() => null),
    });
    if (shouldDirectNavigateIndonesiaStepOne(process.env.INDONESIA_STEP_1_DIRECT_TO_STEP_2)) {
      await navigateIndonesiaApplicationStep(page, 2, diagnostics, "indonesia_step_1_next_direct_step_2");
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(2_000);
      await dismissIndonesiaDialogs(page, diagnostics);
    } else {
      await clickIndonesiaStepOneNext(page, next, diagnostics);
      await page.waitForURL((nextUrl) => !/\/step_1\b/i.test(nextUrl.toString()), { timeout: 30_000 }).catch(() => undefined);
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(5_000);
      await dismissIndonesiaDialogs(page, diagnostics);
    }
    if (/\/step_1\b/i.test(page.url()) && process.env.INDONESIA_STEP_1_USE_LEGACY_FALLBACKS === "true") {
      const fallbackClicked = await clickVisibleSubmitFallback(page, diagnostics, "indonesia_step_1");
      if (!fallbackClicked) {
        diagnostics.push("indonesia_step_1_fallback_submit_not_clicked");
      }
      await page.waitForURL((nextUrl) => !/\/step_1\b/i.test(nextUrl.toString()), { timeout: 10_000 }).catch(() => undefined);
    }
    if (/\/step_1\b/i.test(page.url()) && process.env.INDONESIA_STEP_1_USE_LEGACY_FALLBACKS === "true") {
      await submitIndonesiaStepOneFormFallback(page, diagnostics);
      await page.waitForURL((nextUrl) => !/\/step_1\b/i.test(nextUrl.toString()), { timeout: 15_000 }).catch(() => undefined);
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(3_000);
      await dismissIndonesiaDialogs(page, diagnostics);
    }
    if (/\/step_1\b/i.test(page.url()) && process.env.INDONESIA_STEP_1_USE_LEGACY_FALLBACKS === "true") {
      await submitIndonesiaStepOneOfficialAjax(page, input, diagnostics);
      await page.waitForURL((nextUrl) => !/\/step_1\b/i.test(nextUrl.toString()), { timeout: 20_000 }).catch(() => undefined);
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
      await page.waitForTimeout(3_000);
      await dismissIndonesiaDialogs(page, diagnostics);
    }
    if (/\/step_1\b/i.test(page.url())) {
      const invalidControls = await visibleInvalidControlNames(page);
      if (invalidControls.length > 0) {
        diagnostics.push(`indonesia_step_1_validation_controls ${invalidControls.join(", ")}`);
      } else {
        diagnostics.push("indonesia_step_1_still_visible_after_next");
      }
      await captureStepOneArtifact(page, input, diagnostics);
      const debugSummary = await collectIndonesiaStepOneDebugSummary(page);
      for (const entry of debugSummary) {
        diagnostics.push(entry);
      }
      diagnostics.push("indonesia_step_1_debug_after_artifact_v2");
      await input.onStage?.("step_1_validation_blocked", {
        url: page.url(),
        title: await page.title().catch(() => null),
      });
      return false;
    }
    diagnostics.push("indonesia_step_1_uploaded_and_advanced");
    await page.waitForURL((nextUrl) => /\/step_[23]\b|\/web\/applications\/.+\/list\b/i.test(nextUrl.toString()), {
      timeout: 10_000,
    }).catch(() => undefined);
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    const chainedStepTwo = await continueFromApplicationStepTwo(page, input, diagnostics);
    if (!chainedStepTwo) {
      diagnostics.push(`indonesia_step_1_chain_step_2_not_applicable url=${page.url()}`);
    }
    return true;
  }
  return false;
}

async function fillIndonesiaStayAndSupportFieldsIfPresent(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
  label: string,
): Promise<boolean> {
  const application = input.application;
  if (!application) return false;
  let touched = false;
  touched = await selectNativeOptionByText(
    page,
    "#residence_type_id",
    new RegExp(application.residenceType ?? "HOTEL", "i"),
  ).then(() => true).catch(() => touched);
  touched = await fillIfPresent(page, "#address", application.addressInIndonesia) || touched;
  touched = await fillPostalCodeAndWaitForAddress(page, application.postalCode) || touched;
  touched = await fillIfPresent(page, "#email", input.accountEmail ?? application.email) || touched;
  touched = await fillIfPresent(page, "#email_confirmation", input.accountEmail ?? application.email) || touched;
  touched = await setFilesIfPresent(page, "#attachment-return_ticket", application.returnTicketPath) || touched;
  if (touched) diagnostics.push(`${label}_stay_support_fields_filled`);
  return touched;
}

function hasIndonesiaStepOneValidationBlock(diagnostics: string[]): boolean {
  return diagnostics.some((entry) =>
    entry.startsWith("indonesia_step_1_validation_controls") ||
    entry === "indonesia_step_1_still_visible_after_next",
  );
}

async function clickIndonesiaStepOneNext(
  page: Page,
  _next: ReturnType<Page["locator"]>,
  diagnostics: string[],
): Promise<void> {
  const nextCandidates = [
    page.locator("#btn-submit"),
    page.locator("button.btn-send"),
    page.locator("button[name='send']"),
    page.getByRole("button", { name: /lanjut|selanjutnya|kirim/i }),
    page.getByRole("button", { name: /submit|continue|next/i }),
  ];
  let nextLocator = nextCandidates[0];
  for (const candidate of nextCandidates) {
    if (await candidate.isVisible({ timeout: 2_000 }).catch(() => false)) {
      nextLocator = candidate;
      break;
    }
  }
  const box = await nextLocator.first().boundingBox({ timeout: 5_000 }).catch(() => null);
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    diagnostics.push("indonesia_step_1_next_mouse_clicked");
    return;
  }
  const domClicked = await page
    .evaluate(() => {
      const button = document.querySelector<HTMLElement>(
        "#btn-submit, button.btn-send, button[name='send'], button[type='submit'], input[type='submit']",
      );
      if (!button) return false;
      button.scrollIntoView({ block: "center", inline: "center" });
      button.click();
      return true;
    })
    .catch(() => false);
  if (domClicked) {
    diagnostics.push("indonesia_step_1_next_dom_clicked");
    return;
  }
  diagnostics.push("indonesia_step_1_next_click_failed");
}

async function submitIndonesiaStepOneFormFallback(page: Page, diagnostics: string[]): Promise<boolean> {
  const result = await page
    .evaluate(() => {
      const button = document.querySelector<HTMLButtonElement | HTMLInputElement>(
        "#btn-submit, button.btn-send, button[name='send'], button[type='submit'], input[type='submit']",
      );
      const form = button?.closest("form") ?? document.querySelector<HTMLFormElement>("form");
      if (!form) return { submitted: false, reason: "form_missing", events: 0 };
      let events = 0;
      form.addEventListener("submit", () => {
        events += 1;
      }, { once: true });
      button?.removeAttribute("disabled");
      button?.scrollIntoView({ block: "center", inline: "center" });
      button?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      button?.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      if (events === 0 && typeof form.requestSubmit === "function") {
        form.requestSubmit(button instanceof HTMLButtonElement || button instanceof HTMLInputElement ? button : undefined);
      } else if (events === 0) {
        form.submit();
      }
      return { submitted: true, reason: "fallback_submitted", events };
    })
    .catch((error: unknown) => ({ submitted: false, reason: error instanceof Error ? error.message : String(error), events: 0 }));
  diagnostics.push(`indonesia_step_1_form_submit_fallback submitted=${result.submitted ? "true" : "false"} events=${result.events} reason=${String(result.reason).slice(0, 80)}`);
  return result.submitted;
}

async function navigateIndonesiaApplicationStep(
  page: Page,
  step: 2 | 3,
  diagnostics: string[],
  label: string,
): Promise<boolean> {
  const currentUrl = page.url();
  const targetUrl = /\/step_\d+\b/i.test(currentUrl)
    ? currentUrl.replace(/\/step_\d+\b/i, `/step_${step}`)
    : new URL(`step_${step}`, currentUrl.endsWith("/") ? currentUrl : `${currentUrl}/`).toString();
  diagnostics.push(`${label}_navigating ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch((error: unknown) => {
    diagnostics.push(`${label}_failed ${error instanceof Error ? error.message : String(error)}`.slice(0, 180));
  });
  return /\/step_[23]\b/i.test(page.url());
}

async function submitIndonesiaStepOneOfficialAjax(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  const source = input.registration ?? input.application;
  const payload = {
    documentNumber: source?.passportNumber ?? null,
    dateOfBirth: source?.dateOfBirth ?? null,
    dateOfExpiry: source?.passportExpiryDate ?? null,
    fullName: source?.fullName ?? null,
    nationality: source?.passportCountry ?? null,
    issuingState: source?.passportCountry ?? null,
    sex: source?.gender ?? null,
  };
  const result = await page
    .evaluate(async (mrzPayload) => {
      const win = window as unknown as {
        $?: {
          ajax: (options: Record<string, unknown>) => void;
        };
        routing?: {
          generate: (name: string) => string;
        };
        __vizaStepOneOfficialAjaxResult?: { ok: boolean; reason: string; code?: unknown; message?: unknown };
      };
      const form = document.querySelector<HTMLFormElement>("#form") ?? document.querySelector<HTMLFormElement>("form");
      if (!form || !win.$?.ajax || !win.routing?.generate) {
        return { ok: false, reason: "missing_form_or_ajax" };
      }
      const data = new FormData(form);
      data.append("mrz_payload_data", JSON.stringify(mrzPayload ?? {}));
      return await new Promise<{ ok: boolean; reason: string; code?: unknown; message?: unknown }>((resolve) => {
        let settled = false;
        const finish = (outcome: { ok: boolean; reason: string; code?: unknown; message?: unknown }) => {
          if (settled) return;
          settled = true;
          win.__vizaStepOneOfficialAjaxResult = outcome;
          resolve(outcome);
        };
        window.setTimeout(() => {
          finish({ ok: false, reason: "official_ajax_timeout" });
        }, 45_000);
        win.$?.ajax({
          type: "POST",
          data,
          processData: false,
          contentType: false,
          url: win.routing?.generate("web_upload_passport_add"),
          success: (raw: { code?: unknown; message?: unknown }) => {
            if (raw?.code === 400) {
              finish({ ok: false, reason: "official_ajax_validation", code: raw.code, message: raw.message });
              return;
            }
            window.location.href = win.routing?.generate("web_application_add_step_2") ?? window.location.href;
            finish({ ok: true, reason: "official_ajax_success", code: raw?.code, message: raw?.message });
          },
          error: (request: { responseJSON?: { error?: unknown; message?: unknown }; status?: unknown }) => {
            finish({
              ok: false,
              reason: "official_ajax_error",
              code: request?.status,
              message: request?.responseJSON?.error ?? request?.responseJSON?.message,
            });
          },
        });
      });
    }, payload)
    .catch((error: unknown) => ({ ok: false, reason: error instanceof Error ? error.message : String(error) }));
  diagnostics.push(`indonesia_step_1_official_ajax ok=${result.ok ? "true" : "false"} reason=${String(result.reason).slice(0, 80)} message=${String("message" in result ? result.message ?? "" : "").slice(0, 120)}`);
  return result.ok;
}

async function visibleInvalidControlNames(page: Page): Promise<string[]> {
  return page
    .evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".is-invalid, [aria-invalid='true'], .invalid-feedback, .text-danger, .alert, .swal2-container"))
        .filter((element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0;
        })
        .map((element) => {
          const field = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          const identifier = field.id || field.name || element.getAttribute("data-field") || element.className || element.tagName;
          const text = (element.innerText || element.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 120);
          if (text === "*") return "";
          return text ? `${identifier}: ${text}` : identifier;
        })
        .filter(Boolean)
        .slice(0, 10),
    )
    .catch(() => []);
}

async function collectIndonesiaStepOneDebugSummary(page: Page): Promise<string[]> {
  return page
    .evaluate(() => {
      const visible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const describe = (element: Element): string => {
        const control = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        return control.id || control.name || element.getAttribute("data-field") || element.tagName.toLowerCase();
      };
      const submit = document.querySelector<HTMLButtonElement | HTMLInputElement>("#btn-submit");
      const form = submit?.closest("form") ?? document.querySelector("form");
      const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea"));
      const runtime = (() => {
        const win = window as unknown as {
          __vizaStepOneOfficialAjaxResult?: { ok?: boolean; reason?: string; code?: unknown; message?: unknown };
        };
        let scannerPayloadReady = false;
        let skipMrz = "unknown";
        let mrzInvalidCount = "unknown";
        try {
          scannerPayloadReady = Boolean(eval("typeof scannerPayload !== 'undefined' && scannerPayload"));
          skipMrz = String(eval("typeof skipMRZ !== 'undefined' ? skipMRZ : 'unknown'"));
          mrzInvalidCount = String(eval("typeof mrzInvalidCount !== 'undefined' ? mrzInvalidCount : 'unknown'"));
        } catch {
          scannerPayloadReady = false;
        }
        const ajax = win.__vizaStepOneOfficialAjaxResult;
        return `scannerPayload=${scannerPayloadReady ? "set" : "empty"} skipMRZ=${skipMrz} mrzInvalidCount=${mrzInvalidCount} ajax=${ajax ? `${ajax.ok ? "ok" : "fail"}:${ajax.reason ?? ""}:${String(ajax.message ?? "").slice(0, 80)}` : "none"}`;
      })();
      const requiredEmpty = controls
        .filter((control) => {
          const required = control.required || control.getAttribute("aria-required") === "true" || control.closest(".required");
          if (!required) return false;
          if ((control as HTMLInputElement).type === "file") return !(control as HTMLInputElement).files?.length;
          return !String(control.value ?? "").trim();
        })
        .map(describe)
        .filter(Boolean)
        .slice(0, 12);
      const uploadFlags = controls
        .filter((control) => /passport|picture|photo|attachment|file|path/i.test(`${control.id} ${control.name}`))
        .map((control) => {
          const input = control as HTMLInputElement;
          const hasFile = input.type === "file" ? Boolean(input.files?.length) : Boolean(String(input.value ?? "").trim());
          return `${describe(control)}=${hasFile ? "set" : "empty"}`;
        })
        .slice(0, 16);
      return [
        `indonesia_step_1_button disabled=${submit?.disabled ? "true" : "false"} type=${submit?.getAttribute("type") ?? "button"} classes=${submit?.className ?? ""}`.slice(0, 220),
        `indonesia_step_1_form action=${form?.getAttribute("action") ?? ""} method=${form?.getAttribute("method") ?? ""}`.slice(0, 220),
        `indonesia_step_1_required_empty ${requiredEmpty.join(",") || "none"}`.slice(0, 260),
        `indonesia_step_1_upload_flags ${uploadFlags.join(",") || "none"}`.slice(0, 320),
        `indonesia_step_1_runtime ${runtime}`.slice(0, 320),
        `indonesia_step_1_visible_submit=${submit && visible(submit) ? "true" : "false"}`,
      ];
    })
    .catch(() => ["indonesia_step_1_debug_summary_failed"]);
}

async function clickVisibleSubmitFallback(page: Page, diagnostics: string[], label: string): Promise<boolean> {
  const clicked = await page
    .evaluate(() => {
      const isVisible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const describe = (element: Element): string => {
        const control = element as HTMLInputElement | HTMLButtonElement;
        return `${control.textContent ?? ""} ${(control as HTMLInputElement).value ?? ""} ${control.getAttribute("id") ?? ""} ${control.getAttribute("name") ?? ""} ${control.getAttribute("class") ?? ""} ${control.getAttribute("title") ?? ""}`.toLowerCase();
      };
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>("button, input[type='button'], input[type='submit'], [role='button'], a.btn, a[role='button'], a"),
      ).filter(isVisible);
      const isNegative = (control: Element): boolean =>
        /(back|cancel|previous|prev|kembali|batal|close|tutup|delete|hapus)/i.test(describe(control));
      const textCandidate = controls.find((control) =>
        !isNegative(control) &&
        /(submit|continue|next|proceed|confirm|agree|process|payment|pay|bayar|lanjut|selanjutnya|save|kirim|selesai|send|lanjutkan)/i.test(describe(control))
      );
      const primaryCandidates = controls.filter((control) =>
        !isNegative(control) &&
        /(btn-primary|btn-send|submit|send|primary|next|continue|lanjut|bayar|payment|pay)/i.test(describe(control))
      );
      const candidate = textCandidate ?? primaryCandidates.at(-1);
      if (!candidate) return false;
      candidate.scrollIntoView({ block: "center", inline: "center" });
      (candidate as HTMLElement).click();
      return true;
    })
    .catch(() => false);

  if (clicked) {
    diagnostics.push(`${label}_fallback_clicked`);
    return true;
  }
  diagnostics.push(`${label}_fallback_not_clicked`);
  return false;
}

function isPaymentGatewayOrFlowUrl(value: string | null | undefined): boolean {
  const normalized = clean(value)?.toLowerCase() ?? "";
  return /\/(pay|payment|checkout|billing|invoice|gateway|otp)\b|pembayaran|simponi|tripay|midtrans|checkout\.html|pay\.html/i.test(
    normalized,
  );
}

async function waitForPaymentLikeUrlOrText(
  page: Page,
  previousUrl: string,
  timeoutMs = 8_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const currentUrl = page.url();
    const text = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
    const textNormalized = (text ?? "").toLowerCase();
    if (/pay|payment|checkout|otp|bayar|pembayaran|menunggu pembayaran|belum bayar|belum dibayar/i.test(textNormalized)) {
      return true;
    }
    if (currentUrl !== previousUrl && isPaymentGatewayOrFlowUrl(currentUrl)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function extractPaymentUrlFromDomValue(value: string | null | undefined): string | null {
  const raw = clean(value);
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^https?:\/\/.*/i.test(trimmed) || /^\/.*/.test(trimmed)) {
    if (trimmed === "#" || /^javascript:void\(0\)/i.test(trimmed)) return null;
    return trimmed;
  }
  const jsQuoted = trimmed.match(/["']([^"']+)["']/);
  if (jsQuoted?.[1]) {
    return jsQuoted[1].trim();
  }
  const locationMatch = trimmed.match(
    /(?:location\.href|location\.href\s*=\s*|window\.location|window\.location\.href|window\.open)\s*[:=]\s*["']([^"']+)["']/i,
  );
  if (locationMatch?.[1]) {
    return locationMatch[1].trim();
  }
  return null;
}

async function detectPaymentCandidates(page: Page): Promise<string[]> {
  return page
    .evaluate(() => {
      const isVisible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const describe = (element: Element): string => [
        element.textContent ?? "",
        element.getAttribute("aria-label") ?? "",
        element.getAttribute("title") ?? "",
        element.getAttribute("href") ?? "",
        element.getAttribute("id") ?? "",
        element.getAttribute("class") ?? "",
        element.getAttribute("data-action") ?? "",
        element.getAttribute("data-url") ?? "",
        element.getAttribute("onclick") ?? "",
      ].join(" ").toLowerCase();

      const keywords = /pay|payment|checkout|proceed|bayar|billing|simponi|card|visa|mastercard|otp|3ds|3d secure|pembayaran|menunggu pembayaran|belum bayar|belum dibayar/i;
      const controls = Array.from(
        document.querySelectorAll<
          HTMLAnchorElement | HTMLButtonElement | HTMLInputElement | HTMLSpanElement | HTMLElement
        >("a, button, [role='button'], input[type='button'], input[type='submit'], input[type='image'], span, div"),
      ).filter(isVisible);
      const directMatches = controls.filter((control) => {
        const description = describe(control);
        if (!keywords.test(description)) return false;
        const href = control.getAttribute("href") ?? "";
        if (href && href.startsWith("javascript:")) return true;
        return true;
      });

      const paymentHrefMatches = Array.from(document.querySelectorAll<HTMLElement>("a[href], [data-url], [onclick], [data-action]"))
        .filter(isVisible)
        .map((control) => {
          const href = control.getAttribute("href") ?? "";
          const dataUrl = control.getAttribute("data-url") ?? "";
          const dataAction = control.getAttribute("data-action") ?? "";
          const onclick = control.getAttribute("onclick") ?? "";
          const text = describe(control);
          const paymentValue = href || dataUrl || dataAction || onclick;
          if (!paymentValue && !text) return null;
          if (/pay|payment|billing|invoice|checkout|otp|order|transaction/i.test(`${paymentValue} ${text}`)) return paymentValue || null;
          return null;
        })
        .filter((value): value is string => Boolean(value));

      const indonesianPaymentRowText = /bayar|pembayaran|menunggu pembayaran|belum bayar|belum dibayar|bayarkan|melakukan pembayaran/i;
      const rows = Array.from(document.querySelectorAll("tr, .row, .card, .list-group-item, table, tbody"))
        .filter((element) => indonesianPaymentRowText.test(element.textContent ?? ""));
      const rowLinks = rows.flatMap((row) =>
        Array.from(row.querySelectorAll<HTMLElement>("a, button, [role='button'], input[type='button'], input[type='submit']"))
          .filter(isVisible)
          .map((control) => {
            if (control instanceof HTMLAnchorElement && control.href) return control.href;
            return (
              control.getAttribute("data-url") ??
              control.getAttribute("data-action") ??
              control.getAttribute("onclick") ??
              ""
            );
          }),
      );

      const fallbackTexts = controls
        .filter((control) => /bayar|pay|payment|checkout|proceed/i.test(describe(control)))
        .slice(0, 5)
        .map((control) => describe(control));

      const candidates = [
        ...directMatches.map((control) => {
          if (control instanceof HTMLAnchorElement && control.href) return control.href;
          return control.getAttribute("href") || "";
        }),
        ...paymentHrefMatches,
        ...rowLinks,
      ]
        .filter((candidate) => Boolean(candidate))
        .map((candidate) => candidate.trim())
        .filter((candidate, index, self) => Boolean(candidate) && self.indexOf(candidate) === index)
        .filter((candidate) => candidate && !candidate.startsWith("javascript:void(0)"))
        .slice(0, 12);

      if (candidates.length > 0) {
        return candidates;
      }

      if (fallbackTexts.length > 0) {
        return [`text-fallback:${fallbackTexts.join(" | ").slice(0, 180)}`];
      }

      return [];
    })
    .catch(() => []);
}

async function openPaymentCandidateLinks(
  page: Page,
  diagnostics: string[],
): Promise<"candidate_navigated" | "candidate_popup" | null> {
  const previousUrl = page.url();
  const popup = page
    .waitForEvent("popup", { timeout: 8_000 })
    .then((nextPage) => nextPage)
    .catch(() => null);

  const paymentCandidates = await detectPaymentCandidates(page);
  const paymentLink = paymentCandidates[0] ?? null;
  if (paymentCandidates.length > 0) {
    diagnostics.push(`indonesia_payment_candidate_pool ${paymentCandidates.length}`);
  }
  if (paymentLink && !paymentLink.startsWith("text-fallback:")) {
    const rawCandidates = [paymentLink, ...paymentCandidates.slice(1)];
    const resolvedLinks = rawCandidates
      .map((candidate) => extractPaymentUrlFromDomValue(candidate))
      .filter((value): value is string => Boolean(value))
      .map((value) => {
        if (/^https?:\/\//i.test(value)) return value;
        try {
          return new URL(value, previousUrl).toString();
        } catch {
          return null;
        }
      })
      .filter((value): value is string => value !== null && !value.startsWith("javascript:"))
      .filter((value, index, all) => all.indexOf(value) === index);

    for (const resolvedLink of resolvedLinks) {
      if (!isPaymentGatewayOrFlowUrl(resolvedLink)) {
        continue;
      }
      await page.goto(resolvedLink, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch(() => undefined);
      const arrived = await waitForPaymentLikeUrlOrText(page, previousUrl, 8_000);
      if (arrived) {
        diagnostics.push("indonesia_payment_control_navigated_via_href");
        return "candidate_navigated";
      }
      diagnostics.push(`indonesia_payment_control_via_href_not_paid ${resolvedLink}`);
    }
  }

  const clickedByHeuristic = process.env.INDONESIA_PAYMENT_HEURISTIC_CLICK_UNSAFE === "true" && await page
      .evaluate(() => {
      const keywords = /pay|payment|checkout|bayar|billing|simponi|otp|3ds|3d secure|pembayaran|menunggu pembayaran|belum bayar|belum dibayar|pay now/i;
      const isVisible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const describe = (element: Element): string => [
        element.textContent ?? "",
        element.getAttribute("aria-label") ?? "",
        element.getAttribute("title") ?? "",
        element.getAttribute("href") ?? "",
        element.getAttribute("id") ?? "",
        element.getAttribute("class") ?? "",
        element.getAttribute("data-action") ?? "",
        element.getAttribute("data-url") ?? "",
        element.getAttribute("onclick") ?? "",
      ].join(" ").toLowerCase();
      const targets = Array.from(
        document.querySelectorAll<HTMLElement>("a, button, [role='button'], input[type='button'], input[type='submit'], .btn, .button"),
      )
        .filter(isVisible)
        .filter((control) => keywords.test(describe(control)));
      if (!targets.length) return false;
      const target = targets[0];
      target.scrollIntoView({ block: "center", inline: "center" });
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    })
    .catch(() => false);
  if (clickedByHeuristic) {
    await page.waitForTimeout(1_500);
    if (page.url() === previousUrl) {
      diagnostics.push("indonesia_payment_control_candidate_clicked_without_navigation");
      return null;
    }
    const text = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
    if (/pay|payment|checkout|otp|bayar|pembayaran|menunggu pembayaran|belum bayar|belum dibayar/i.test(text.toLowerCase()) || isPaymentGatewayOrFlowUrl(page.url())) {
      diagnostics.push("indonesia_payment_control_candidate_clicked_by_heuristic");
      return "candidate_navigated";
    }
    diagnostics.push("indonesia_payment_control_candidate_clicked_non_payment_page");
    return null;
  }

  const popupPage = await popup;
  if (popupPage) {
    await popupPage.bringToFront().catch(() => undefined);
    const popupUrl = popupPage.url() ?? "";
    if (popupUrl && isPaymentGatewayOrFlowUrl(popupUrl) && popupPage !== page) {
      await popupPage.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.goto(popupUrl, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
      diagnostics.push("indonesia_payment_popup_opened_and_replayed");
      return "candidate_popup";
    }
  }

  if (paymentLink && paymentLink.startsWith("text-fallback:")) {
    const rowText = paymentLink.replace(/^text-fallback:/, "");
    diagnostics.push(`indonesia_payment_control_text_fallback ${rowText}`);
  }
  return null;
}

async function navigateToDerivedPaymentUrlFromApplicationsList(
  page: Page,
  diagnostics: string[],
): Promise<boolean> {
  const currentUrl = page.url();
  const match = /\/web\/applications\/([^/]+)\/list/i.exec(currentUrl);
  if (!match?.[1]) return false;
  const appId = match[1];
  let base: string | null = null;
  try {
    base = new URL(currentUrl).origin;
  } catch {
    return false;
  }

  const paymentCandidates = [
    `${base}/web/applications/${appId}/checkout`,
    `${base}/web/applications/${appId}/payment`,
    `${base}/web/payment/${appId}/checkout`,
    `${base}/web/payment/checkout?appId=${appId}`,
    `${base}/web/payment/checkout?applicationId=${appId}`,
    `${base}/web/payment/checkout/${appId}`,
    `${base}/web/checkout/${appId}`,
    `${base}/payment/checkout?application=${appId}`,
    `${base}/front/payment/${appId}`,
  ];

  for (const candidate of paymentCandidates) {
    if (!isPaymentGatewayOrFlowUrl(candidate)) continue;
    const responseUrl = await page.goto(candidate, { waitUntil: "domcontentloaded", timeout: 10_000 }).then(() => page.url())
      .catch(() => null);
    if (!responseUrl) continue;
    const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    if (/pay|payment|checkout|otp|bayar|pembayaran|billing/i.test((text ?? "").toLowerCase())) {
      diagnostics.push(`indonesia_payment_navigation_derived_url ${responseUrl}`);
      await page.waitForTimeout(1_500);
      return true;
    }
  }
  return false;
}

function isExistingApplicationWarningText(value: string): boolean {
  return /currently\s+the\s+foreigner\s+has\s+a\s+visa\s+application/i.test(value) ||
    /application\s+that\s+is\s+being\s+verified/i.test(value);
}

function isExpiredIndonesiaApplicationText(value: string): boolean {
  const normalized = clean(value)?.toLowerCase() ?? "";
  return /application\s+expired/i.test(normalized) ||
    /\bstatus\s*[:\s]+expired\b/i.test(normalized) ||
    /\bexpired\b/i.test(normalized) && /transaction number|visitor visa number|passport number|visa type|action/i.test(normalized) ||
    /expired\s+application/i.test(normalized) ||
    /expired.*visa/i.test(normalized) ||
    /visa\s+application\s+.*\bexpired\b/i.test(normalized) ||
    /permohonan\s+terkadaluarsa/i.test(normalized) ||
    /permohonan\s+telah\s+kedaluwarsa/i.test(normalized) ||
    /permohonan\s+kadaluarsa/i.test(normalized) ||
    /permohonan\s+kedaluwarsa/i.test(normalized) ||
    /sudah\s+kadaluarsa/i.test(normalized) ||
    /telah\s+kedaluwarsa/i.test(normalized) ||
    /expired.*step/i.test(normalized) ||
    /tanggal\s+berakhir/i.test(normalized);
}

function isExpiredIndonesiaPortalUrl(value: string | null | undefined): boolean {
  const normalized = clean(value)?.toLowerCase() ?? "";
  return /\/expired\b/.test(normalized) || /status=expired/i.test(normalized);
}

function isIndonesiaPortalNotFoundText(value: string): boolean {
  const normalized = clean(value)?.toLowerCase() ?? "";
  return /page\s+not\s+found/i.test(normalized) ||
    /oh\s*!\s*no/i.test(normalized) ||
    /go\s+to\s+home/i.test(normalized);
}

function isReusableIndonesiaApplicationUrl(value: string | null | undefined): value is string {
  const cleanUrl = clean(value);
  if (!cleanUrl) return false;
  if (!/^https:\/\/evisa\.imigrasi\.go\.id\//i.test(cleanUrl)) return false;
  if (/\/web\/visa-selection\b/i.test(cleanUrl)) return false;
  if (/\/application_add\//i.test(cleanUrl) && !/\/step_[23]\b/i.test(cleanUrl)) return false;
  return /\/web\/applications\/.+\/list\b/i.test(cleanUrl) ||
    /\/application_add\/visa\/.+\/step_[23]\b/i.test(cleanUrl) ||
    /pay|payment|checkout/i.test(cleanUrl);
}

function collectIndonesiaPortalUrls(value: unknown, urls: string[] = []): string[] {
  if (typeof value === "string") {
    const embedded = value.match(/https:\/\/evisa\.imigrasi\.go\.id\/[^\s"'<>]+/gi) ?? [];
    for (const candidate of embedded.length > 0 ? embedded : [value]) {
      const normalized = candidate.replace(/[).,;]+$/g, "");
      if (isReusableIndonesiaApplicationUrl(normalized)) urls.push(normalized);
    }
    return urls;
  }
  if (!value || typeof value !== "object") return urls;
  if (Array.isArray(value)) {
    for (const item of value) collectIndonesiaPortalUrls(item, urls);
    return urls;
  }
  for (const item of Object.values(value as Record<string, unknown>)) {
    collectIndonesiaPortalUrls(item, urls);
  }
  return urls;
}

async function reopenIndonesiaPortalFromScratch(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<void> {
  diagnostics.push("indonesia_expired_application_recovered_start_from_portal_root");
  await page.goto(input.portalUrl, {
    waitUntil: "domcontentloaded",
    timeout: input.timeoutMs ?? 60_000,
  });
  await page.waitForTimeout(1500);
}

async function findSavedIndonesiaApplicationUrl(
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<string | null> {
  const applicationId = clean(input.applicationId);
  if (!applicationId) {
    diagnostics.push("indonesia_existing_application_missing_viza_application_id");
    return null;
  }
  const { supabase } = await import("../supabase");
  const candidates: string[] = [];

  const queue = await supabase
    .from("submission_queue")
    .select("official_portal_url, vn_result_payload, error_message, last_error, updated_at")
    .eq("application_id", applicationId)
    .in("provider", ["indonesia_c1_live", "indonesia_b1_evoa_live"])
    .order("updated_at", { ascending: false })
    .limit(20);
  if (queue.error) {
    diagnostics.push(`indonesia_existing_application_queue_lookup_failed ${queue.error.message}`);
  } else {
    for (const row of (queue.data ?? []) as Array<Record<string, unknown>>) {
      collectIndonesiaPortalUrls(row.official_portal_url, candidates);
      collectIndonesiaPortalUrls(row.vn_result_payload, candidates);
      collectIndonesiaPortalUrls(row.error_message, candidates);
      collectIndonesiaPortalUrls(row.last_error, candidates);
    }
  }

  const application = await supabase
    .from("applications")
    .select("submission_result, updated_at")
    .eq("id", applicationId)
    .maybeSingle();
  if (application.error) {
    diagnostics.push(`indonesia_existing_application_result_lookup_failed ${application.error.message}`);
  } else {
    collectIndonesiaPortalUrls((application.data as Record<string, unknown> | null)?.submission_result, candidates);
  }

  const unique = Array.from(new Set(candidates)).filter(isReusableIndonesiaApplicationUrl);
  if (unique.length === 0) {
    diagnostics.push("indonesia_existing_application_no_saved_portal_url");
    return null;
  }
  unique.sort((a, b) => {
    const score = (value: string): number => {
      if (isPaymentGatewayOrFlowUrl(value) || /\/web\/applications\/.+\/list\b/i.test(value)) return 0;
      if (/\/step_3\b/i.test(value)) return 1;
      if (/\/step_2\b/i.test(value)) return 2;
      return 3;
    };
    return score(a) - score(b);
  });
  diagnostics.push(`indonesia_existing_application_saved_url_selected ${unique[0]}`);
  return unique[0];
}

async function redirectToSavedIndonesiaApplication(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<void> {
  const savedUrl = await findSavedIndonesiaApplicationUrl(input, diagnostics);
  if (!savedUrl) {
    throw new Error(
      `Indonesia official portal reports an existing visa application, but VIZA has no saved reusable official application URL for application ${input.applicationId ?? "(unknown)"}.`,
    );
  }
  diagnostics.push("indonesia_existing_application_redirecting_to_saved_url");
  await page.goto(savedUrl, {
    waitUntil: "domcontentloaded",
    timeout: input.timeoutMs ?? 60_000,
  });
  await page.waitForTimeout(3_000);
  await dismissIndonesiaDialogs(page, diagnostics);
  const savedBodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (isExpiredIndonesiaApplicationText(savedBodyText) || isExpiredIndonesiaPortalUrl(page.url())) {
    diagnostics.push("indonesia_existing_application_saved_url_expired");
    await reopenIndonesiaPortalFromScratch(page, input, diagnostics);
  }
}

async function continueFromApplicationStepTwo(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  const pageText = await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "");
  if (isIndonesiaPortalNotFoundText(pageText)) {
    diagnostics.push("indonesia_step_2_not_found_page_detected");
    return false;
  }
  const isStepTwo =
    (/\/step_2\b/i.test(page.url()) && await isVisibleSelector(page, "#residence_type_id, #attachment-return_ticket, #support-paspor")) ||
    await isVisibleSelector(page, "#residence_type_id, #attachment-return_ticket, #support-paspor");
  if (!isStepTwo) {
    diagnostics.push(`indonesia_step_2_not_detected url=${page.url()}`);
    return false;
  }
  const application = input.application;
  if (!application) {
    diagnostics.push("indonesia_step_2_missing_application_input");
    return false;
  }
  await input.onStage?.("step_2_started", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });

  const initialExistingApplicationWarning = await dismissIndonesiaDialogs(page, diagnostics);
  if (initialExistingApplicationWarning) {
    diagnostics.push("indonesia_step_2_existing_application_warning_detected");
    const acceptedCancellation = await acceptIndonesiaExistingApplicationCancellationWarning(page, diagnostics);
    if (!acceptedCancellation) {
      await redirectToSavedIndonesiaApplication(page, input, diagnostics);
    }
    return true;
  }
  await fillIfPresent(page, "#full_name", application.fullName);
  const gender = page.locator(genderSelector(application.gender)).first();
  if (await gender.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await gender.check({ timeout: 5_000 }).catch(() => undefined);
  }
  await fillIfPresent(page, "#birth_place", application.birthPlace);
  await setDateValue(page, "#birthday", application.dateOfBirth);
  await fillIfPresent(page, "#mobile_phone", digitsOnly(application.mobilePhone));
  await selectNativeOptionByText(page, "#document_travel_id", /^Passport$/i).catch(() => undefined);
  await fillIfPresent(page, "#number", application.passportNumber);
  await selectNativeOptionByText(
    page,
    "#country_id",
    new RegExp(`^${normalizeCountryLabel(application.passportCountry).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  ).catch(() => undefined);
  await setDateValue(page, "#release_date", application.passportIssueDate);
  await setDateValue(page, "#expired_date", application.passportExpiryDate);
  await fillIfPresent(page, "#release_place", application.passportIssuePlace ?? application.passportCountry);
  await selectNativeOptionByText(page, "#residence_type_id", new RegExp(application.residenceType ?? "HOTEL", "i")).catch(() => undefined);
  await fillIfPresent(page, "#address", application.addressInIndonesia);
  await fillPostalCodeAndWaitForAddress(page, application.postalCode);
  await fillIfPresent(page, "#email", input.accountEmail ?? application.email);
  await fillIfPresent(page, "#email_confirmation", input.accountEmail ?? application.email);
  await input.onStage?.("step_2_filled_text_fields", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });

  await setFilesIfPresent(page, "#attachment-return_ticket", application.returnTicketPath);
  await input.onStage?.("step_2_uploaded_return_ticket", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });
  const passportSupportPath = application.passportSupportPath ?? await makeImagePdf(page, application.passportImagePath, diagnostics);
  await setFilesIfPresent(page, "#support-paspor", passportSupportPath);
  await input.onStage?.("step_2_uploaded_support_passport", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });
  await page.waitForTimeout(2_000);
  await dismissIndonesiaDialogs(page, diagnostics);
  diagnostics.push("indonesia_step_2_form_filled");

  const shouldAdvance = process.env.INDONESIA_ADVANCE_AFTER_STEP_2 !== "false";
  if (!shouldAdvance) return true;
  const next = page.locator("#btn-submit").first();
  if (await next.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await input.onStage?.("step_2_clicking_next", {
      url: page.url(),
      title: await page.title().catch(() => null),
    });
    await next.click({ timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(4_000);
    const submitExistingApplicationWarning = await dismissIndonesiaDialogs(page, diagnostics);
    const bodyText = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    const allDiagnostics = diagnostics.join(" ");
    if (submitExistingApplicationWarning || isExistingApplicationWarningText(`${bodyText} ${allDiagnostics}`)) {
      diagnostics.push("indonesia_step_2_existing_application_warning_detected");
      const acceptedCancellation = await acceptIndonesiaExistingApplicationCancellationWarning(page, diagnostics);
      if (!acceptedCancellation) {
        await redirectToSavedIndonesiaApplication(page, input, diagnostics);
      }
    }
    diagnostics.push("indonesia_step_2_submitted");
  } else {
    const fallbackSubmitted = await clickVisibleSubmitFallback(page, diagnostics, "indonesia_step_2");
    if (fallbackSubmitted) {
      diagnostics.push("indonesia_step_2_fallback_submitted");
    } else {
      await captureApplicationStepArtifact(page, input, diagnostics, 2);
      const directStepThree = await navigateIndonesiaApplicationStep(page, 3, diagnostics, "indonesia_step_2_next_direct_step_3");
      if (directStepThree) {
        diagnostics.push("indonesia_step_2_direct_step_3_after_missing_submit");
      }
    }
  }
  if (/\/step_3\b/i.test(page.url())) {
    await continueFromApplicationStepThree(page, input, diagnostics);
  }
  return true;
}

async function continueFromApplicationStepThree(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  const isStepThree =
    /\/step_3\b/i.test(page.url()) ||
    await isVisibleSelector(page, 'input[type="checkbox"]');
  if (!isStepThree) return false;
  await input.onStage?.("step_3_started", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });
  await dismissIndonesiaDialogs(page, diagnostics);
  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const checkbox = checkboxes.nth(index);
    if (await checkbox.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await checkbox.check({ force: true }).catch(() => undefined);
    }
  }
  diagnostics.push(`indonesia_step_3_checked_declarations count=${count}`);

  const shouldAdvance = process.env.INDONESIA_ADVANCE_AFTER_STEP_3 !== "false";
  if (!shouldAdvance) return true;
  const next = page.locator("#btn-submit, button.btn-send").first();
  if (await next.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await input.onStage?.("step_3_clicking_submit", {
      url: page.url(),
      title: await page.title().catch(() => null),
    });
    await next.click({ timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(4_000);
    await dismissIndonesiaDialogs(page, diagnostics);
    diagnostics.push("indonesia_step_3_submitted");
  } else {
    const fallbackSubmitted = await clickVisibleSubmitFallback(page, diagnostics, "indonesia_step_3");
    if (fallbackSubmitted) {
      diagnostics.push("indonesia_step_3_fallback_submitted");
      await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(4_000);
      await dismissIndonesiaDialogs(page, diagnostics);
    } else {
      await captureApplicationStepArtifact(page, input, diagnostics, 3);
    }
  }
  if (/\/web\/applications\/.+\/list\b/i.test(page.url())) {
    await continueFromApplicationList(page, input, diagnostics);
  }
  return true;
}

async function continueFromApplicationList(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
  options: { onExpiredApplication?: () => void } = {},
): Promise<boolean> {
  if (!/\/web\/applications\/.+\/list\b/i.test(page.url())) return false;
  await input.onStage?.("application_list_visible", {
    url: page.url(),
    title: await page.title().catch(() => null),
  });
  await dismissIndonesiaDialogs(page, diagnostics);
  const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  diagnostics.push("indonesia_application_list_visible");
  await captureApplicationListArtifact(page, input, diagnostics);
  if (isExpiredIndonesiaApplicationText(text)) {
    diagnostics.push("indonesia_application_list_expired_detected_restarting_application");
    options.onExpiredApplication?.();
    await reopenIndonesiaPortalFromScratch(page, input, diagnostics);
    return true;
  }
  const isDraftApplicationText = /\bdraft\b|please click submit before submitting the application/i.test(text);
  if (isDraftApplicationText) {
    const submittedDraft = await submitIndonesiaDraftApplicationFromList(page, diagnostics);
    if (submittedDraft) {
      await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(3_000);
      await dismissIndonesiaDialogs(page, diagnostics);
      diagnostics.push("indonesia_application_list_draft_submitted");
      return true;
    }
    diagnostics.push("indonesia_application_list_draft_submit_not_clicked");
  }
  const waitingPaymentDetailNavigated = await navigateToWaitingPaymentDetail(page, diagnostics);
  if (waitingPaymentDetailNavigated) {
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    await dismissIndonesiaDialogs(page, diagnostics);
    diagnostics.push("indonesia_application_list_waiting_payment_detail_navigated");
    return true;
  }
  const isWaitingForPaymentText = /waiting for payment|menunggu pembayaran|belum bayar|bayar|pembayaran|belum dibayar/i.test(text);
  const clicked = await clickIndonesiaPaymentControl(page, diagnostics);
  if (clicked) {
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(3_000);
    await dismissIndonesiaDialogs(page, diagnostics);
    diagnostics.push("indonesia_application_payment_control_clicked");
    return true;
  }
  const candidateResult = await openPaymentCandidateLinks(page, diagnostics);
  if (candidateResult) {
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(2_000);
    await dismissIndonesiaDialogs(page, diagnostics);
    diagnostics.push(`indonesia_application_payment_control_candidate_${candidateResult}`);
    return true;
  }

  if (isWaitingForPaymentText) {
    diagnostics.push("indonesia_application_list_waiting_for_payment");
  }
  const derivedPaymentNavigation = await navigateToDerivedPaymentUrlFromApplicationsList(page, diagnostics);
  if (derivedPaymentNavigation) {
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(1_000);
    await dismissIndonesiaDialogs(page, diagnostics);
    diagnostics.push("indonesia_application_list_derived_payment_url_navigated");
    return true;
  }
  if (isWaitingForPaymentText) {
    diagnostics.push("indonesia_application_payment_control_not_found");
    return false;
  }
  const submit = page.locator("#btn-save, .btn-save").first();
  if (!(await submit.isVisible({ timeout: 3_000 }).catch(() => false))) return false;
  await submit.click({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  const asGuest = page.locator("#btn-as-guest").first();
  if (await asGuest.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await asGuest.click({ timeout: 10_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(3_000);
    await dismissIndonesiaDialogs(page, diagnostics);
    diagnostics.push("indonesia_application_list_submitted_as_guest");
    return true;
  }
  diagnostics.push("indonesia_application_list_submit_clicked");
  return true;
}

async function navigateToWaitingPaymentDetail(page: Page, diagnostics: string[]): Promise<boolean> {
  const href = await page
    .evaluate(() => {
      const rows = Array.from(document.querySelectorAll<HTMLTableRowElement>("tr"));
      for (const row of rows) {
        const text = (row.innerText || row.textContent || "").replace(/\s+/g, " ");
        if (!/waiting\s+for\s+payment|menunggu\s+pembayaran|belum\s+bayar/i.test(text)) continue;
        const link = Array.from(row.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .map((anchor) => anchor.getAttribute("href") ?? "")
          .find((value) => /\/web\/application\/.+\/detail/i.test(value));
        if (link) return link;
      }
      return null;
    })
    .catch(() => null);
  if (!href) {
    diagnostics.push("indonesia_application_list_waiting_payment_detail_not_found");
    return false;
  }
  diagnostics.push(`indonesia_application_list_waiting_payment_detail_opening ${href}`);
  await page.goto(new URL(href, page.url()).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 }).catch((error: unknown) => {
    diagnostics.push(`indonesia_application_list_waiting_payment_detail_failed ${error instanceof Error ? error.message : String(error)}`.slice(0, 180));
  });
  return /\/web\/application\/.+\/detail/i.test(page.url()) ||
    /\/web\/application-detail-otp\//i.test(page.url());
}

async function submitIndonesiaDraftApplicationFromList(page: Page, diagnostics: string[]): Promise<boolean> {
  const submit = page.locator("#btn-save, button#btn-save, .btn-save").first();
  if (!(await submit.isVisible({ timeout: 5_000 }).catch(() => false))) return false;
  await submit.click({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  const asGuest = page.locator("#btn-as-guest").first();
  if (await asGuest.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await asGuest.click({ timeout: 10_000 });
    diagnostics.push("indonesia_application_list_draft_as_guest_clicked");
    return true;
  }
  const withRegister = page.locator("#btn-with-register").first();
  if (await withRegister.isVisible({ timeout: 2_000 }).catch(() => false)) {
    diagnostics.push("indonesia_application_list_draft_register_option_visible");
  }
  return true;
}

async function clickIndonesiaPaymentControl(page: Page, diagnostics: string[]): Promise<boolean> {
  const paymentKeywords = /pay|payment|checkout|bayar|billing|simponi|pembayaran|menunggu pembayaran|belum bayar|belum dibayar|pay now|invoice/i;
  const paymentControl = page
    .getByRole("link", { name: paymentKeywords })
    .or(page.getByRole("button", { name: paymentKeywords }))
    .or(page.locator([
      'a[href*="pay" i]',
      'a[href*="payment" i]',
      'a[href*="pay/" i]',
      'a[href*="pay-now" i]',
      'a[href*="checkout" i]',
      'a[href*="billing" i]',
      'a[href*="invoice" i]',
      'button[id*="pay" i]',
      'button[id*="billing" i]',
      'button[class*="pay" i]',
      'button[class*="billing" i]',
      '[data-action*="pay" i]',
      '[data-action*="payment" i]',
      '[data-url*="pay" i]',
      '[data-url*="payment" i]',
      '[onclick*="pay" i]',
      '[onclick*="payment" i]',
      '[onclick*="billing" i]',
      '[onclick*="checkout" i]',
      '[onclick*="simponi" i]',
    ].join(",")))
    .first();
  if (await paymentControl.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await paymentControl.click({ timeout: 10_000 });
    diagnostics.push("indonesia_payment_control_clicked_by_locator");
    return true;
  }
  if (process.env.INDONESIA_PAYMENT_DOM_SEARCH !== "true") {
    diagnostics.push("indonesia_payment_control_dom_search_disabled");
    return false;
  }

  const clickedByDomSearch = await page.evaluate(() => {
    const keywords = /pay|payment|checkout|bayar|billing|simponi|pembayaran|invoice/i;
    const isVisible = (element: Element): boolean => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0;
    };
    const describe = (element: Element): string => [
      element.textContent ?? "",
      element.getAttribute("aria-label") ?? "",
      element.getAttribute("title") ?? "",
      element.getAttribute("href") ?? "",
      element.getAttribute("id") ?? "",
      element.getAttribute("class") ?? "",
      element.getAttribute("data-action") ?? "",
      element.getAttribute("data-url") ?? "",
      element.getAttribute("onclick") ?? "",
    ].join(" ");
    const clickTarget = (element: Element): boolean => {
      if (!isVisible(element)) return false;
      (element as HTMLElement).click();
      return true;
    };

    const directTargets = Array.from(document.querySelectorAll("a,button,[role='button'],input[type='button'],input[type='submit']"));
    const directMatch = directTargets.find((element) => keywords.test(describe(element)));
    if (directMatch && clickTarget(directMatch)) return true;

    const paymentRows = Array.from(document.querySelectorAll("tr,.row,.card,.list-group-item"))
      .filter((element) => /waiting for payment|menunggu pembayaran|belum bayar/i.test(element.textContent ?? ""));
    for (const row of paymentRows) {
      const rowTargets = Array.from(row.querySelectorAll("a,button,[role='button'],input[type='button'],input[type='submit']"))
        .filter(isVisible);
      const keywordTarget = rowTargets.find((element) => keywords.test(describe(element)));
      if (keywordTarget && clickTarget(keywordTarget)) return true;
    }

    return false;
  }).catch(() => false);
  if (clickedByDomSearch) {
    diagnostics.push("indonesia_payment_control_clicked_by_dom_search");
    return true;
  }

  return false;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
}

function extractIndonesiaOtpCode(row: IndonesiaInboundEmailRow): string | null {
  const htmlText = decodeHtmlEntities(row.html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const haystack = `${row.subject ?? ""} ${row.text ?? ""} ${htmlText}`
    .replace(/=\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const afterCodePrompt =
    haystack.match(/code\s+(?:below|di bawah ini)[^A-Z0-9]{0,120}([A-Z0-9]{4,8})/i)?.[1] ??
    haystack.match(/login process\.\s*([A-Z0-9]{4,8})/i)?.[1] ??
    haystack.match(/proses login\.\s*([A-Z0-9]{4,8})/i)?.[1] ??
    null;
  if (afterCodePrompt && /[A-Z]/i.test(afterCodePrompt) && /\d/.test(afterCodePrompt)) {
    return afterCodePrompt.toUpperCase();
  }
  const candidates = haystack.match(/\b[A-Z0-9]{6}\b/gi) ?? [];
  const candidate = candidates.find((value) => /[A-Z]/i.test(value) && /\d/.test(value));
  return candidate?.toUpperCase() ?? null;
}

async function waitForIndonesiaOtpCode(
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<string | null> {
  const alias = clean(input.accountEmail)?.toLowerCase();
  if (!alias) {
    diagnostics.push("indonesia_otp_alias_missing");
    return null;
  }
  const { supabase } = await import("../supabase");
  const timeoutMs = Number(process.env.INDONESIA_EMAIL_OTP_TIMEOUT_MS ?? "90000");
  const since = new Date(Date.now() - Number(process.env.INDONESIA_EMAIL_OTP_LOOKBACK_MS ?? "120000")).toISOString();
  const deadline = Date.now() + Math.max(10_000, timeoutMs);

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("inbound_email")
      .select("id, subject, text, html, received_at")
      .eq("to_addr", alias)
      .ilike("subject", "%OTP%")
      .eq("processed", false)
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(8);
    if (error) {
      diagnostics.push(`indonesia_otp_email_lookup_failed ${error.message}`);
      return null;
    }

    for (const row of (data ?? []) as IndonesiaInboundEmailRow[]) {
      const code = extractIndonesiaOtpCode(row);
      if (!code) continue;
      try {
        await supabase
          .from("inbound_email")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", row.id);
      } catch {
        // Marking the email processed is best-effort; the OTP can still be used once.
      }
      diagnostics.push(`indonesia_otp_email_consumed received_at=${row.received_at}`);
      return code;
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("inbound_email")
      .select("id, subject, text, html, received_at")
      .eq("from_addr", "no-reply@notif.imigrasi.go.id")
      .ilike("subject", "%OTP%")
      .eq("processed", false)
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(3);
    if (fallbackError) {
      diagnostics.push(`indonesia_otp_email_fallback_lookup_failed ${fallbackError.message}`);
      return null;
    }

    for (const row of (fallbackData ?? []) as IndonesiaInboundEmailRow[]) {
      const code = extractIndonesiaOtpCode(row);
      if (!code) continue;
      try {
        await supabase
          .from("inbound_email")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", row.id);
      } catch {
        // Marking the email processed is best-effort; the OTP can still be used once.
      }
      diagnostics.push(`indonesia_otp_email_fallback_consumed received_at=${row.received_at}`);
      return code;
    }

    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  diagnostics.push("indonesia_otp_email_not_found");
  return null;
}

async function continueFromIndonesiaOtpPage(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  const isOfficialOtpUrl = /\/web\/application-detail-otp\//i.test(page.url());
  if (!isOfficialOtpUrl && !/enter otp code|otp code|one time password|authentication code|verification code|kode otp|kode verifikasi/i.test(text)) {
    return false;
  }
  if (!/evisa\.imigrasi\.go\.id/i.test(page.url())) return false;
  await capturePaymentArtifact(page, input, diagnostics, "otp");

  const code = await waitForIndonesiaOtpCode(input, diagnostics);
  if (!code) return false;

  const filled = await page.evaluate((otp) => {
    const controls = Array.from(document.querySelectorAll<HTMLInputElement>("input"))
      .filter((input) => {
        const style = window.getComputedStyle(input);
        const rect = input.getBoundingClientRect();
        return !input.disabled &&
          input.type !== "hidden" &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      });
    const oneCharInputs = controls.filter((input) => input.maxLength === 1 || input.getAttribute("maxlength") === "1");
    const targets = oneCharInputs.length >= otp.length ? oneCharInputs : controls;
    if (targets.length >= otp.length) {
      for (let index = 0; index < otp.length; index += 1) {
        targets[index].focus();
        targets[index].value = otp[index];
        targets[index].dispatchEvent(new Event("input", { bubbles: true }));
        targets[index].dispatchEvent(new Event("change", { bubbles: true }));
        targets[index].dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: otp[index] }));
      }
      return true;
    }
    const first = targets[0];
    if (!first) return false;
    first.focus();
    first.value = otp;
    first.dispatchEvent(new Event("input", { bubbles: true }));
    first.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, code);
  if (!filled) {
    diagnostics.push("indonesia_otp_inputs_not_found");
    return false;
  }

  const submit = page
    .getByRole("button", { name: /^submit$/i })
    .or(page.locator("#btn-submit-otp, #btn-submit, button[type='submit'], a.btn-primary:has-text('Submit')"))
    .first();
  if (await submit.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await submit.click({ timeout: 10_000 });
  } else {
    await page.keyboard.press("Enter").catch(() => undefined);
  }
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(3_000);
  await dismissIndonesiaDialogs(page, diagnostics);
  diagnostics.push("indonesia_otp_filled_and_submitted");
  return true;
}

async function continueFromIndonesiaPaymentDetail(
  page: Page,
  diagnostics: string[],
): Promise<boolean> {
  if (!/\/web\/application\/.+\/detail/i.test(page.url())) return false;
  const href = await page
    .evaluate(() => {
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
      const makePayment = links.find((link) =>
        /make\s+a\s+payment|payment/i.test((link.innerText || link.textContent || "").replace(/\s+/g, " ")) &&
        /\/web\/payment\//i.test(link.getAttribute("href") ?? ""),
      );
      return makePayment?.getAttribute("href") ?? null;
    })
    .catch(() => null);
  if (!href) {
    diagnostics.push("indonesia_payment_detail_make_payment_not_found");
    return false;
  }
  const targetUrl = new URL(href, page.url()).toString();
  diagnostics.push(`indonesia_payment_detail_make_payment_opening ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch((error: unknown) => {
    diagnostics.push(`indonesia_payment_detail_make_payment_failed ${error instanceof Error ? error.message : String(error)}`.slice(0, 180));
  });
  await page.waitForTimeout(3_000);
  return page.url() !== targetUrl || /\/web\/payment\//i.test(page.url()) || isPaymentGatewayOrFlowUrl(page.url());
}

async function waitForUserPaymentCompletion(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<{
  state: IndonesiaPortalStateId;
  title: string | null;
  text: string;
  url: string;
}> {
  const waitTimeoutMs = Math.max(
    30_000,
    Number(input.userPaymentHandoff?.waitTimeoutMs ?? process.env.INDONESIA_USER_PAYMENT_WAIT_MS ?? 10 * 60 * 1000),
  );
  const deadline = Date.now() + waitTimeoutMs;
  let notified = false;
  let title = await page.title().catch(() => null);
  let text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  let url = page.url();
  let state = classifyIndonesiaPortalSnapshot({ url, title, text });
  if (input.userPaymentHandoff?.oneTimeCard) {
    await payIndonesiaPortalWithOneTimeCard(page, input.userPaymentHandoff.oneTimeCard, diagnostics);
    title = await page.title().catch(() => null);
    text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    url = page.url();
    state = classifyIndonesiaPortalSnapshot({ url, title, text });
  } else {
    diagnostics.push("indonesia_one_time_card_not_available_for_payment_page");
  }

  while (Date.now() < deadline) {
    if (!notified) {
      await input.userPaymentHandoff?.onWaitingForUser?.({
        url,
        title,
        state,
        diagnostics,
      });
      diagnostics.push("indonesia_user_payment_handoff_waiting");
      notified = true;
    }

    await page.waitForTimeout(5_000).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      diagnostics.push(`indonesia_user_payment_wait_interrupted ${message}`.slice(0, 180));
    });
    if (page.isClosed()) {
      diagnostics.push("indonesia_user_payment_window_closed");
      break;
    }

    title = await page.title().catch(() => null);
    text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    url = page.url();
    state = classifyIndonesiaPortalSnapshot({ url, title, text });
    if (state === "submitted_or_approved") {
      diagnostics.push("indonesia_user_payment_completed");
      break;
    }
    if (state !== "payment_required") {
      diagnostics.push(`indonesia_user_payment_state_changed ${state}`);
      break;
    }
  }

  if (state === "payment_required" && Date.now() >= deadline) {
    diagnostics.push("indonesia_user_payment_wait_timeout");
  }

  return { state, title, text, url };
}

async function payIndonesiaPortalWithOneTimeCard(
  page: Page,
  card: IndonesiaOneTimeCard,
  diagnostics: string[],
): Promise<boolean> {
  const filled = await page
    .evaluate((paymentCard) => {
      const visible = (element: Element): boolean => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      };
      const describe = (input: HTMLInputElement | HTMLSelectElement): string => [
        input.id,
        input.name,
        input.className,
        input.getAttribute("autocomplete") ?? "",
        input.getAttribute("placeholder") ?? "",
        input.getAttribute("aria-label") ?? "",
        input.closest("label")?.textContent ?? "",
      ].join(" ").toLowerCase();
      const controls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select"))
        .filter((control) => visible(control) && !control.disabled && !(control instanceof HTMLInputElement && control.readOnly));
      const setValue = (control: HTMLInputElement | HTMLSelectElement, value: string): boolean => {
        control.focus();
        if (control instanceof HTMLSelectElement) {
          const option = Array.from(control.options).find((candidate) =>
            candidate.value === value ||
            candidate.text.trim() === value ||
            candidate.text.trim().padStart(2, "0") === value,
          );
          if (!option) return false;
          control.value = option.value;
        } else {
          control.value = value;
        }
        control.dispatchEvent(new Event("input", { bubbles: true }));
        control.dispatchEvent(new Event("change", { bubbles: true }));
        control.dispatchEvent(new Event("blur", { bubbles: true }));
        return true;
      };
      const fillByPattern = (pattern: RegExp, value: string): boolean => {
        const control = controls.find((candidate) => pattern.test(describe(candidate)));
        return control ? setValue(control, value) : false;
      };

      const filledCard = fillByPattern(/cc-number|card.?number|card_no|cardno|no.?kartu|pan|nomor.?kartu/, paymentCard.pan);
      const combinedExpiry = `${paymentCard.expiryMonth}/${paymentCard.expiryYear.slice(-2)}`;
      const filledExpiry = fillByPattern(/cc-exp|expir|expiry|valid.?thru|masa.?berlaku/, combinedExpiry);
      const filledMonth = filledExpiry || fillByPattern(/exp.*month|month|bulan/, paymentCard.expiryMonth);
      const filledYear = filledExpiry || fillByPattern(/exp.*year|year|tahun/, paymentCard.expiryYear);
      const filledCvv = fillByPattern(/cc-csc|cvv|cvc|security.?code|kode.?keamanan/, paymentCard.cvv);
      const filledName = paymentCard.holderName
        ? fillByPattern(/cc-name|card.?holder|holder.?name|name.?on.?card|nama/, paymentCard.holderName)
        : false;

      return { filledCard, filledExpiry, filledMonth, filledYear, filledCvv, filledName };
    }, card)
    .catch((error: unknown) => {
      diagnostics.push(`indonesia_one_time_card_fill_error ${error instanceof Error ? error.message : String(error)}`.slice(0, 160));
      return null;
    });

  if (!filled) return false;
  diagnostics.push(
    `indonesia_one_time_card_fields card=${filled.filledCard ? "yes" : "no"} expiry=${filled.filledExpiry || filled.filledMonth && filled.filledYear ? "yes" : "no"} cvv=${filled.filledCvv ? "yes" : "no"} holder=${filled.filledName ? "yes" : "no"}`,
  );
  if (!filled.filledCard || !filled.filledCvv || !(filled.filledExpiry || filled.filledMonth && filled.filledYear)) {
    diagnostics.push("indonesia_one_time_card_payment_form_not_recognized");
    return false;
  }

  const payButton = page
    .getByRole("button", { name: /pay|submit|continue|bayar|lanjut|process/i })
    .or(page.locator("input[type='submit'], button[type='submit']").first())
    .first();
  if (await payButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await payButton.click({ timeout: 10_000 }).catch((error: unknown) => {
      diagnostics.push(`indonesia_one_time_card_pay_click_failed ${error instanceof Error ? error.message : String(error)}`.slice(0, 160));
    });
    diagnostics.push("indonesia_one_time_card_pay_clicked");
    await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(5_000);
    return true;
  }
  diagnostics.push("indonesia_one_time_card_pay_button_not_found");
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
  const endpoint = input.userPaymentHandoff?.enabled
    ? null
    : firstConfiguredEndpoint(endpointEnvNames(input.provider));
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
    let savedApplicationUrl = await findSavedIndonesiaApplicationUrl(input, session.diagnostics);
    const startUrl = savedApplicationUrl ?? input.portalUrl;
    if (savedApplicationUrl) {
      session.diagnostics.push("indonesia_starting_from_saved_application_url");
    }
    await page.goto(startUrl, {
      waitUntil: "domcontentloaded",
      timeout: input.timeoutMs ?? 60_000,
    });
    await page.waitForTimeout(1500);
    let title = await page.title().catch(() => null);
    let text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    if (savedApplicationUrl && (isExpiredIndonesiaApplicationText(text) || isExpiredIndonesiaPortalUrl(startUrl))) {
      session.diagnostics.push("indonesia_starting_url_detected_expired");
      savedApplicationUrl = null;
      await reopenIndonesiaPortalFromScratch(page, input, session.diagnostics);
      title = await page.title().catch(() => null);
      text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    }
    let url = page.url();
    let state = classifyIndonesiaPortalSnapshot({ url, title, text });
    for (let step = 0; step < 18; step += 1) {
      const beforeUrl = url;
      const beforeState = state;
      let advanced = false;

      if (isExpiredIndonesiaApplicationText(text) || isExpiredIndonesiaPortalUrl(url)) {
        session.diagnostics.push("indonesia_running_flow_detected_expired");
        savedApplicationUrl = null;
        await reopenIndonesiaPortalFromScratch(page, input, session.diagnostics);
        title = await page.title().catch(() => null);
        text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
        url = page.url();
        state = classifyIndonesiaPortalSnapshot({ url, title, text });
        advanced = true;
      }

      if (!advanced && /\/application_add\/visa\/.+\/step_/i.test(url) && isIndonesiaPortalNotFoundText(text)) {
        session.diagnostics.push("indonesia_running_flow_detected_application_step_not_found_restarting");
        savedApplicationUrl = null;
        await reopenIndonesiaPortalFromScratch(page, input, session.diagnostics);
        title = await page.title().catch(() => null);
        text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
        url = page.url();
        state = classifyIndonesiaPortalSnapshot({ url, title, text });
        advanced = true;
      }

      if (!advanced && (/\/web\/application-detail-otp\//i.test(url) || /enter otp code|otp code|one time password|authentication code|verification code|kode otp|kode verifikasi/i.test(text))) {
        advanced = await continueFromIndonesiaOtpPage(page, input, session.diagnostics);
      }

      if (!advanced && isExistingApplicationWarningText(text)) {
        advanced = await acceptIndonesiaExistingApplicationCancellationWarning(page, session.diagnostics);
      }

      if (state === "landing_visible") {
        if (savedApplicationUrl && !isIndonesiaPortalHomeUrl(savedApplicationUrl)) {
          session.diagnostics.push("indonesia_landing_returning_to_saved_application_url");
          await page.goto(savedApplicationUrl, {
            waitUntil: "domcontentloaded",
            timeout: input.timeoutMs ?? 60_000,
          }).catch((error: unknown) => {
            session.diagnostics.push(`indonesia_landing_saved_url_return_failed ${error instanceof Error ? error.message : String(error)}`.slice(0, 180));
          });
          await page.waitForTimeout(1_500);
          await dismissIndonesiaDialogs(page, session.diagnostics);
          advanced = true;
        } else {
          const applyControl = page
            .getByRole("link", { name: /^apply$/i })
            .or(page.getByRole("button", { name: /^apply$/i }))
            .first();
          if (await applyControl.isVisible({ timeout: 3000 }).catch(() => false)) {
            await applyControl.click({ timeout: 10_000 });
            await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
            await page.waitForTimeout(1500);
            advanced = true;
          }
        }
      } else if (state === "visa_selection_visible" || url.includes("/web/visa-selection")) {
        await continueFromVisaSelection(page, input, session.diagnostics);
        advanced = true;
      } else if (state === "login_required" || state === "registration_required") {
        advanced = await continueFromAccountGate(page, input, session.diagnostics);
        if (advanced && savedApplicationUrl) {
          session.diagnostics.push("indonesia_login_completed_returning_to_saved_url");
          await page.goto(savedApplicationUrl, { waitUntil: "domcontentloaded", timeout: input.timeoutMs ?? 60_000 })
            .catch(() => undefined);
          await page.waitForTimeout(1_500);
        }
      } else if (state === "account_registration_form_visible") {
        advanced = await fillForeignerAccountRegistration(page, input, session.diagnostics);
      } else if (/\/step_1\b/i.test(url)) {
        advanced = await continueFromApplicationStepOne(page, input, session.diagnostics);
      } else if (/\/step_2\b/i.test(url)) {
        advanced = await continueFromApplicationStepTwo(page, input, session.diagnostics);
      } else if (/\/step_3\b/i.test(url)) {
        advanced = await continueFromApplicationStepThree(page, input, session.diagnostics);
      } else if (/\/web\/applications\/.+\/list\b/i.test(url)) {
        advanced = await continueFromApplicationList(page, input, session.diagnostics, {
          onExpiredApplication: () => {
            savedApplicationUrl = null;
          },
        });
      } else if (state === "payment_required") {
        advanced =
          await continueFromIndonesiaOtpPage(page, input, session.diagnostics) ||
          await continueFromIndonesiaPaymentDetail(page, session.diagnostics);
      } else if (state === "official_application_started" || state === "application_form_visible") {
        advanced =
          await continueFromApplicationStepOne(page, input, session.diagnostics) ||
          await continueFromApplicationStepTwo(page, input, session.diagnostics) ||
          await continueFromApplicationStepThree(page, input, session.diagnostics) ||
          await continueFromApplicationList(page, input, session.diagnostics, {
            onExpiredApplication: () => {
              savedApplicationUrl = null;
            },
          });
        if (!advanced) {
          session.diagnostics.push(`indonesia_application_form_visible_no_handler url=${url}`);
        }
      }

      if (advanced) {
        title = await page.title().catch(() => null);
        text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
        url = page.url();
        state = classifyIndonesiaPortalSnapshot({ url, title, text });
      }

      if (
        /\/step_2\b/i.test(url) &&
        (beforeUrl === url && beforeState === state || !advanced) &&
        !session.diagnostics.includes("indonesia_step_2_state_machine_direct_step_3_attempted")
      ) {
        await captureApplicationStepArtifact(page, input, session.diagnostics, 2);
        session.diagnostics.push("indonesia_step_2_state_machine_direct_step_3_attempted");
        const directStepThree = await navigateIndonesiaApplicationStep(page, 3, session.diagnostics, "indonesia_step_2_state_machine_direct_step_3");
        if (directStepThree) {
          title = await page.title().catch(() => null);
          text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
          url = page.url();
          state = classifyIndonesiaPortalSnapshot({ url, title, text });
          advanced = true;
        }
      }

      if (!advanced || (beforeUrl === url && beforeState === state)) {
        break;
      }
    }

    if (state === "payment_required" && input.userPaymentHandoff?.enabled) {
      await capturePaymentArtifact(page, input, session.diagnostics, "payment");
      const paymentResult = await waitForUserPaymentCompletion(page, input, session.diagnostics);
      title = paymentResult.title;
      text = paymentResult.text;
      url = paymentResult.url;
      state = paymentResult.state;
    }

    const stepOneValidationBlocked = hasIndonesiaStepOneValidationBlock(session.diagnostics);
    const action = stepOneValidationBlocked
      ? {
          actionType: "official_step_1_validation_blocked",
          instruction:
            "The Indonesia official portal blocked step 1 after VIZA uploaded passport/photo files. Review the official validation message and adjust the uploaded document mapping or image format before continuing.",
          implementationStatus: "partial" as const,
        }
      : actionForIndonesiaPortalState(state);
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
