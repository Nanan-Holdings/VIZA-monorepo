import * as fs from "fs";
import * as path from "path";
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
  applicantId?: string | null;
  accountEmail?: string | null;
  accountPassword?: string | null;
  registration?: IndonesiaAccountRegistrationInput;
  application?: IndonesiaApplicationFormInput;
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
  await page.waitForTimeout(1_000);
  return true;
}

async function clickIfPresent(page: Page, selector: string): Promise<boolean> {
  const control = page.locator(selector).first();
  if (!(await control.isVisible({ timeout: 2_000 }).catch(() => false))) return false;
  await control.click({ timeout: 10_000 });
  await page.waitForTimeout(1_500);
  return true;
}

async function dismissIndonesiaDialogs(page: Page, diagnostics: string[]): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const swal = page.locator(".swal2-confirm").first();
    if (await swal.isVisible({ timeout: 1_000 }).catch(() => false)) {
      const text = await page.locator(".swal2-container").first().innerText({ timeout: 1_000 }).catch(() => "");
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
    return;
  }
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

async function waitForHiddenValue(page: Page, selector: string, diagnostics: string[], label: string): Promise<boolean> {
  const ready = await page
    .waitForFunction(
      (css) => {
        const input = document.querySelector<HTMLInputElement>(css);
        return Boolean(input?.value?.trim());
      },
      selector,
      { timeout: 35_000, polling: 500 },
    )
    .then(() => true)
    .catch(() => false);
  diagnostics.push(`${label}_${ready ? "ready" : "not_ready"}`);
  return ready;
}

async function waitForIndonesiaVerificationLink(applicantId: string): Promise<URL | null> {
  const { inbox } = await import("../inbox/wait-for-message");
  const message = await inbox.waitForMessage(
    applicantId,
    (row) => {
      const haystack = `${row.from_addr ?? ""} ${row.subject ?? ""} ${row.text ?? ""} ${row.html ?? ""}`;
      return /evisa\.imigrasi\.go\.id|imigrasi/i.test(haystack) &&
        /verify|verification|activate|activation|confirm|account|email/i.test(haystack);
    },
    Number(process.env.INDONESIA_EMAIL_VERIFICATION_TIMEOUT_MS ?? "180000"),
  ).catch(() => null);

  if (!message) return null;
  const haystacks = [message.html ?? "", message.text ?? ""];
  for (const haystack of haystacks) {
    const matches = haystack.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
    for (const match of matches) {
      const candidate = match
        .replace(/&amp;/gi, "&")
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
  }

  if (input.applicantId) {
    const verificationLink = await waitForIndonesiaVerificationLink(input.applicantId);
    if (verificationLink) {
      await page.goto(verificationLink.toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForTimeout(2_000);
      diagnostics.push("indonesia_account_email_verification_opened");
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
  if (!/\/step_1\b/i.test(page.url())) return false;
  const application = input.application;
  if (!application?.passportImagePath || !application.photoImagePath) {
    diagnostics.push("indonesia_step_1_missing_passport_or_photo");
    return false;
  }

  await dismissIndonesiaDialogs(page, diagnostics);
  const passportPath = await normalizePassportLandscape(page, application.passportImagePath, diagnostics);
  if (!passportPath) {
    diagnostics.push("indonesia_step_1_passport_image_unavailable");
    return false;
  }
  await setFilesIfPresent(page, "#passport-attachment", passportPath);
  await page.waitForTimeout(6_000);
  await dismissIndonesiaDialogs(page, diagnostics);

  await setFilesIfPresent(page, "#picture", application.photoImagePath);
  await page.waitForTimeout(2_000);
  await dismissIndonesiaDialogs(page, diagnostics);

  const next = page.locator("#btn-submit").first();
  if (await next.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await next.click({ timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(3_000);
    await dismissIndonesiaDialogs(page, diagnostics);
    diagnostics.push("indonesia_step_1_uploaded_and_advanced");
    return true;
  }
  return false;
}

async function continueFromApplicationStepTwo(
  page: Page,
  input: IndonesiaPortalProbeInput,
  diagnostics: string[],
): Promise<boolean> {
  if (!/\/step_2\b/i.test(page.url())) return false;
  const application = input.application;
  if (!application) return false;

  await dismissIndonesiaDialogs(page, diagnostics);
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

  await setFilesIfPresent(page, "#attachment-return_ticket", application.returnTicketPath);
  const passportSupportPath = application.passportSupportPath ?? await makeImagePdf(page, application.passportImagePath, diagnostics);
  await setFilesIfPresent(page, "#support-paspor", passportSupportPath);
  await page.waitForTimeout(2_000);
  await dismissIndonesiaDialogs(page, diagnostics);
  diagnostics.push("indonesia_step_2_form_filled");

  const shouldAdvance = process.env.INDONESIA_ADVANCE_AFTER_STEP_2 !== "false";
  if (!shouldAdvance) return true;
  const next = page.locator("#btn-submit").first();
  if (await next.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await next.click({ timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(4_000);
    await dismissIndonesiaDialogs(page, diagnostics);
    diagnostics.push("indonesia_step_2_submitted");
  }
  return true;
}

async function continueFromApplicationStepThree(
  page: Page,
  diagnostics: string[],
): Promise<boolean> {
  if (!/\/step_3\b/i.test(page.url())) return false;
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
    await next.click({ timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
    await page.waitForTimeout(4_000);
    await dismissIndonesiaDialogs(page, diagnostics);
    diagnostics.push("indonesia_step_3_submitted");
  }
  return true;
}

async function continueFromApplicationList(page: Page, diagnostics: string[]): Promise<boolean> {
  if (!/\/web\/applications\/.+\/list\b/i.test(page.url())) return false;
  await dismissIndonesiaDialogs(page, diagnostics);
  const text = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
  if (/waiting for payment/i.test(text)) {
    diagnostics.push("indonesia_application_list_waiting_for_payment");
    return true;
  }
  const submit = page.locator("#btn-save").first();
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
    for (let step = 0; step < 10; step += 1) {
      const beforeUrl = url;
      const beforeState = state;
      let advanced = false;

      if (state === "landing_visible") {
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
      } else if (state === "visa_selection_visible" || url.includes("/web/visa-selection")) {
        await continueFromVisaSelection(page, input, session.diagnostics);
        advanced = true;
      } else if (state === "login_required" || state === "registration_required") {
        advanced = await continueFromAccountGate(page, session.diagnostics);
      } else if (state === "account_registration_form_visible") {
        advanced = await fillForeignerAccountRegistration(page, input, session.diagnostics);
      } else if (/\/step_1\b/i.test(url)) {
        advanced = await continueFromApplicationStepOne(page, input, session.diagnostics);
      } else if (/\/step_2\b/i.test(url)) {
        advanced = await continueFromApplicationStepTwo(page, input, session.diagnostics);
      } else if (/\/step_3\b/i.test(url)) {
        advanced = await continueFromApplicationStepThree(page, session.diagnostics);
      } else if (/\/web\/applications\/.+\/list\b/i.test(url)) {
        advanced = await continueFromApplicationList(page, session.diagnostics);
      }

      if (advanced) {
        title = await page.title().catch(() => null);
        text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
        url = page.url();
        state = classifyIndonesiaPortalSnapshot({ url, title, text });
      }

      if (!advanced || (beforeUrl === url && beforeState === state)) {
        break;
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
