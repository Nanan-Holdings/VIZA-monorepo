import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import type { KoreaOfficialEformPayload } from "./runner";

const KOREA_VISA_PORTAL_EFORM_URL = "https://www.visa.go.kr/openPage.do?MENU_ID=10204";

export interface KoreaOfficialEformDocumentPaths {
  photoFilePath?: string | null;
  passportScanFilePath?: string | null;
}

export interface KoreaOfficialEformFillOptions {
  visitingPostName?: string | null;
  visitingPostCode?: string | null;
  documents?: KoreaOfficialEformDocumentPaths;
  pdfLanguage?: "zh-CN" | "en" | "ko" | null;
}

export interface KoreaOfficialEformFillResult {
  status: "filled_first_page";
  portalUrl: string;
  filledSelectors: string[];
  missingUploads: Array<"photo" | "passport_scan">;
  nextCheckpoint: "official_eform_portal_review_required";
}

export interface KoreaOfficialEformCompletionResult {
  applicationNumber: string | null;
  officialPdfStoragePath: string;
  officialPdfLocalPath: string;
  successMessage: string | null;
}

interface FieldAssignment {
  selector: string;
  value: string;
}

interface RadioAssignment {
  selector: string;
}

export interface KoreaOfficialEformFillAuditItem {
  selector: string;
  expected: string;
  actual: string | null;
  ok: boolean;
  reason?: "missing_selector" | "empty_value" | "value_mismatch" | "radio_not_checked";
}

const MAX_OFFICIAL_UPLOAD_BYTES = 500 * 1024;
const TARGET_OFFICIAL_UPLOAD_BYTES = 480 * 1024;

function compactDate(value: string | null): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(0, 8);
  return value;
}

function normalizeCountryName(value: string | null): string {
  const normalized = value?.trim();
  if (!normalized) return "CHINA";
  if (/china|chinese|中国|中國/i.test(normalized)) return "CHINA";
  return normalized.toUpperCase();
}

function normalizeCountryCode(value: string | null): string {
  const normalized = normalizeCountryName(value);
  if (normalized === "CHINA") return "CHN";
  return "";
}

function readAnswer(answers: Record<string, string | null | undefined>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = answers[key]?.trim();
    if (value) return value;
  }
  return fallback;
}

function isYes(value: string | null | undefined) {
  return /^(?:yes|y|true|1|是)$/i.test(value?.trim() ?? "");
}

function splitAddress(address: string | null): { street: string; city: string; state: string; country: string } {
  const parts = (address ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  const fallback = parts[0] ?? address ?? "";
  if (parts.length === 1) {
    return {
      street: fallback,
      city: fallback,
      state: fallback,
      country: "CHINA",
    };
  }
  if (parts.length === 2 && normalizeCountryName(parts[1]) === "CHINA") {
    return {
      street: fallback,
      city: fallback,
      state: fallback,
      country: parts[1],
    };
  }
  return {
    street: fallback,
    city: parts[1] ?? fallback,
    state: parts[2] ?? parts[1] ?? fallback,
    country: parts[3] ?? "CHINA",
  };
}

function payloadAddress(payload: KoreaOfficialEformPayload): { street: string; city: string; state: string; country: string } {
  if (payload.homeAddressStreet || payload.homeAddressCity || payload.homeAddressState || payload.homeAddressCountry) {
    return {
      street: payload.homeAddressStreet ?? payload.homeAddress ?? "",
      city: payload.homeAddressCity ?? payload.homeAddressStreet ?? payload.homeAddress ?? "",
      state: payload.homeAddressState ?? payload.homeAddressCity ?? "",
      country: payload.homeAddressCountry ?? "CHINA",
    };
  }
  return splitAddress(payload.homeAddress);
}

export function buildKoreaOfficialEformFirstPagePlan(
  payload: KoreaOfficialEformPayload,
  options: KoreaOfficialEformFillOptions = {},
): { fields: FieldAssignment[]; radios: RadioAssignment[]; selects: FieldAssignment[] } {
  const address = payloadAddress(payload);
  const nationality = normalizeCountryName(payload.nationality);
  const nationalityCode = normalizeCountryCode(payload.nationality);
  const postName = options.visitingPostName?.trim() || "주 중국 대사관";
  const postCode = options.visitingPostCode?.trim() || "CP";

  return {
    selects: [
      { selector: "#EFORM_STAY", value: "C3" },
      { selector: "#PASS_NO_KIND", value: "OR" },
    ],
    radios: [
      { selector: "#ENT_PURP_KIND_CD1" },
      { selector: payload.gender === "female" ? "#SEX_CD_F" : "#SEX_CD_M" },
      { selector: "#INVIT_YN1" },
      { selector: "#PTL_MEM_YN1" },
      { selector: "#OTHER_EK_NM_YN1" },
      { selector: "#MUL_NAT_YN1" },
      { selector: "#MUL_PASS_YN2" },
      { selector: "#CUR_NAT_SAME_Y" },
    ],
    fields: [
      { selector: "#RES_NM", value: postName },
      { selector: "#REG_OVERSEA_RES_CD", value: postCode },
      { selector: "#SUR_NM", value: payload.familyName ?? "" },
      { selector: "#GIV_NM", value: payload.givenNames ?? "" },
      { selector: "#BIRTH_YMD", value: compactDate(payload.dateOfBirth) },
      { selector: "#NAT_NM", value: nationality },
      { selector: "#NAT_CD", value: nationalityCode },
      { selector: "#PLA_BIRTH_NM", value: nationality },
      { selector: "#PLA_BIRTH", value: nationalityCode },
      { selector: "#PASS_NO", value: payload.passportNumber ?? "" },
      { selector: "#EXPR_YMD", value: compactDate(payload.passportExpiryDate) },
      { selector: "#ISS_NAT_NM", value: nationality },
      { selector: "#ISS_NAT_CD", value: nationalityCode },
      { selector: "#ISS_PLACE", value: payload.passportPlaceOfIssue ?? "" },
      { selector: "#ISS_YMD", value: compactDate(payload.passportIssueDate) },
      { selector: "#IDENTITY_NO", value: payload.nationalIdentityNo ?? "" },
      { selector: "#ADDR_STREET", value: address.street },
      { selector: "#ADDR_CITY", value: address.city },
      { selector: "#ADDR_STATE", value: address.state },
      { selector: "#ADDR_CNTR_NM", value: normalizeCountryName(address.country) },
      { selector: "#ADDR_CNTR_CD", value: normalizeCountryCode(address.country) },
      { selector: "#TEL_NO", value: payload.phone ?? "" },
      { selector: "#MOBILE_TEL_NO", value: payload.phone ?? "" },
      { selector: "#EMAIL", value: payload.email ?? "" },
    ],
  };
}

export function buildKoreaOfficialEformSecondPagePlan(
  answers: Record<string, string | null | undefined>,
): { fields: FieldAssignment[]; radios: RadioAssignment[]; selects: FieldAssignment[] } {
  const maritalMap: Record<string, string> = {
    single: "#MARI_STS_CD_S",
    unmarried: "#MARI_STS_CD_S",
    married: "#MARI_STS_CD_M",
    divorced: "#MARI_STS_CD_D",
  };
  const educationMap: Record<string, string> = {
    high_school: "#LAST_DEGREE_1",
    bachelors: "#LAST_DEGREE_2",
    bachelor: "#LAST_DEGREE_2",
    masters_or_doctoral: "#LAST_DEGREE_3",
    masters: "#LAST_DEGREE_3",
    doctoral: "#LAST_DEGREE_3",
    other: "#LAST_DEGREE_4",
  };
  const jobMap: Record<string, string> = {
    entrepreneur: "#JOB_CD_1",
    self_employed: "#JOB_CD_2",
    employed: "#JOB_CD_3",
    civil_servant: "#JOB_CD_4",
    student: "#JOB_CD_5",
    retired: "#JOB_CD_6",
    unemployed: "#JOB_CD_7",
    other: "#JOB_CD_8",
  };
  const visitCountMap: Record<string, string> = {
    single: "#APPL_VISA_GB_S",
    "1": "#APPL_VISA_GB_S",
    double: "#APPL_VISA_GB_D",
    "2": "#APPL_VISA_GB_D",
    multiple: "#APPL_VISA_GB_M",
    "3": "#APPL_VISA_GB_M",
    "3plus": "#APPL_VISA_GB_M",
  };

  const marital = readAnswer(answers, ["marital_status"], "single").toLowerCase();
  const education = readAnswer(answers, ["highest_education"], "bachelors").toLowerCase();
  const job = readAnswer(answers, ["employment_status"], "employed").toLowerCase();
  const expectedVisitCount = readAnswer(answers, ["expected_korea_visit_count", "planned_korea_visit_count"], "single").toLowerCase();
  const travelledToKorea = isYes(readAnswer(answers, ["travelled_to_korea_5y"]));
  const travelledOutside = isYes(readAnswer(answers, ["travelled_outside_5y"]));
  const travellingWithFamily = isYes(readAnswer(answers, ["travelling_with_family"]));
  const receivedAssistance = isYes(readAnswer(answers, ["received_form_assistance"]));
  const koreaAddressMode = readAnswer(answers, ["korea_address_mode"], "official_search").toLowerCase();
  const addressInKorea = readAnswer(answers, ["address_in_korea"], "100 Toegye-ro, Jung-gu, Seoul");
  const addressInKoreaDetail = readAnswer(answers, ["korea_address_detail", "address_in_korea_detail"], "Hotel");
  const koreaPostalCode = readAnswer(answers, ["address_in_korea_postal_code", "korea_postal_code"], "04631");
  const noAddressReason = readAnswer(answers, ["korea_no_address_reason"], koreaAddressMode === "address_not_found" ? "地址不存在" : koreaAddressMode === "undecided" ? "未定" : "");

  const fields: FieldAssignment[] = [
    { selector: "#LAST_SCH_NM", value: readAnswer(answers, ["school_name"]) },
    { selector: "#LAST_SCH_ADDR", value: readAnswer(answers, ["school_location"]) },
    { selector: "#COMPY_NM", value: readAnswer(answers, ["employer_name"]) },
    { selector: "#POSI_NM", value: readAnswer(answers, ["employer_position"]) },
    { selector: "#COMPY_ADDR", value: readAnswer(answers, ["employer_address"]) },
    { selector: "#JOB_TEL_NO", value: readAnswer(answers, ["employer_telephone"]) },
    { selector: "#APPL_SOJ_DUR", value: readAnswer(answers, ["intended_period_of_stay"]) },
    { selector: "#ENTRY_EXP_YMD", value: compactDate(readAnswer(answers, ["intended_date_of_entry"]) || null) },
    { selector: "#SOJ_EXP_REGION_TEL_NO", value: readAnswer(answers, ["contact_in_korea"]) },
    { selector: "#VISIT_COST", value: readAnswer(answers, ["estimated_travel_costs_usd", "visit_cost_usd", "visit_cost"]) },
    { selector: "#COST_PAMNT_EK_NM", value: readAnswer(answers, ["payer_name", "cost_payer_name"]) },
    { selector: "#COST_PAMNT_REL", value: readAnswer(answers, ["payer_relationship", "cost_payer_relationship"]) },
    { selector: "#COST_PAMNT_DETAIL", value: readAnswer(answers, ["payer_support_type", "cost_payer_support_type"]) },
    { selector: "#COST_PAMNT_TEL_NO", value: readAnswer(answers, ["payer_contact", "cost_payer_contact"]) },
  ];

  if (koreaAddressMode === "official_search") {
    fields.push(
      { selector: "#ZIP", value: koreaPostalCode },
      { selector: "#SOJ_EXP_REGION_DTL", value: addressInKorea },
      { selector: "#RNM_BS_ADDR", value: addressInKorea },
      { selector: "#RNM_DET_ADDR", value: addressInKoreaDetail },
      { selector: "#JIBUN_BS_ADDR", value: addressInKorea },
      { selector: "#JIBUN_DET_ADDR", value: addressInKoreaDetail },
      { selector: "#RNM_ENG_BS_ADDR", value: addressInKorea },
      { selector: "#RNM_ENG_DET_ADDR", value: addressInKoreaDetail },
      { selector: "#JIBUN_ENG_BS_ADDR", value: addressInKorea },
      { selector: "#JIBUN_ENG_DET_ADDR", value: addressInKoreaDetail },
    );
  }

  if (education === "other") {
    fields.push({ selector: "#LAST_DEGREE_DETAIL", value: readAnswer(answers, ["highest_education_other"]) });
  }
  if (job === "other") {
    fields.push({ selector: "#JOB_DETAIL", value: readAnswer(answers, ["employment_status_other"]) });
  }
  if (travelledToKorea) {
    fields.push(
      { selector: "#BF_VISIT_CNT", value: readAnswer(answers, ["korea_visit_count"]) },
      { selector: "#BF_VISIT_PURP", value: readAnswer(answers, ["korea_visit_purpose"]) },
    );
  }
  if (travelledOutside) {
    fields.push(
      { selector: "#BF_TRA_CNTR", value: readAnswer(answers, ["foreign_trip_country", "outside_travel_country"]) },
      { selector: "#BF_TRA_PURP", value: readAnswer(answers, ["foreign_trip_purpose", "outside_travel_purpose"]) },
      { selector: "#BF_TRA_ST_DT", value: compactDate(readAnswer(answers, ["foreign_trip_start_date", "outside_travel_start_date"]) || null) },
      { selector: "#BF_TRA_EN_DT", value: compactDate(readAnswer(answers, ["foreign_trip_end_date", "outside_travel_end_date"]) || null) },
    );
  }
  if (receivedAssistance) {
    fields.push(
      { selector: "#DOC_WRIT_HELP_EK_NM", value: readAnswer(answers, ["assistant_full_name", "form_assistant_name"]) },
      { selector: "#DOC_WRIT_HELP_BIRTH_YMD", value: compactDate(readAnswer(answers, ["assistant_dob", "form_assistant_date_of_birth"]) || null) },
      { selector: "#DOC_WRIT_HELP_TEL_NO", value: readAnswer(answers, ["assistant_telephone", "form_assistant_phone"]) },
      { selector: "#DOC_WRIT_HELP_REL", value: readAnswer(answers, ["assistant_relationship", "form_assistant_relationship"]) },
    );
  }

  return {
    selects: [
      { selector: "#APPL_SOJ_DUR_GB", value: "D" },
      { selector: "#noAddr", value: noAddressReason },
    ],
    radios: [
      { selector: maritalMap[marital] ?? "#MARI_STS_CD_S" },
      { selector: educationMap[education] ?? "#LAST_DEGREE_2" },
      { selector: jobMap[job] ?? "#JOB_CD_3" },
      { selector: visitCountMap[expectedVisitCount] ?? "#APPL_VISA_GB_S" },
      { selector: travelledToKorea ? "#BF_VISIT_Y" : "#BF_VISIT_N" },
      { selector: travelledOutside ? "#VISIT_NAT_Y" : "#VISIT_NAT_N" },
      { selector: travellingWithFamily ? "#ENT_FML_Y" : "#ENT_FML_N" },
      { selector: receivedAssistance ? "#DOC_WRIT_HELP_Y" : "#DOC_WRIT_HELP_N" },
    ],
    fields,
  };
}

async function assignFields(page: Page, assignments: FieldAssignment[]): Promise<string[]> {
  const filled = await page.evaluate((items) => {
    const changed: string[] = [];
    for (const item of items) {
      const element = document.querySelector(item.selector) as HTMLInputElement | HTMLSelectElement | null;
      if (!element) continue;
      if (element instanceof HTMLSelectElement) {
        const normalized = item.value.trim().toLowerCase();
        const matchingOption = Array.from(element.options).find((option) => {
          const value = option.value.trim().toLowerCase();
          const text = option.textContent?.trim().toLowerCase() ?? "";
          return value === normalized || text === normalized || text.includes(normalized);
        });
        element.value = matchingOption?.value ?? item.value;
      } else {
        element.value = item.value;
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      changed.push(item.selector);
    }
    return changed;
  }, assignments);
  return filled;
}

async function assignRadios(page: Page, assignments: RadioAssignment[]): Promise<string[]> {
  const filled = await page.evaluate((items) => {
    const changed: string[] = [];
    for (const item of items) {
      const element = document.querySelector(item.selector) as HTMLInputElement | null;
      if (!element) continue;
      element.checked = true;
      element.dispatchEvent(new Event("click", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      changed.push(item.selector);
    }
    return changed;
  }, assignments);
  return filled;
}

async function auditFieldAssignments(page: Page, assignments: FieldAssignment[]): Promise<KoreaOfficialEformFillAuditItem[]> {
  return page.evaluate((items) => {
    return items
      .filter((item) => item.value.trim().length > 0)
      .map((item) => {
        const element = document.querySelector(item.selector) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!element) {
          return {
            selector: item.selector,
            expected: item.value,
            actual: null,
            ok: false,
            reason: "missing_selector" as const,
          };
        }

        const actualValue = element.value.trim();
        const actualText = element instanceof HTMLSelectElement
          ? element.options[element.selectedIndex]?.textContent?.trim() || actualValue
          : actualValue;
        const expected = item.value.trim();
        const normalizedActual = actualText.toLowerCase();
        const normalizedActualValue = actualValue.toLowerCase();
        const normalizedExpected = expected.toLowerCase();
        const ok = normalizedActualValue === normalizedExpected ||
          normalizedActual === normalizedExpected ||
          normalizedActual.includes(normalizedExpected) ||
          normalizedExpected.includes(normalizedActual);

        return {
          selector: item.selector,
          expected,
          actual: actualText,
          ok,
          reason: ok ? undefined : actualText ? ("value_mismatch" as const) : ("empty_value" as const),
        };
      });
  }, assignments);
}

async function auditRadioAssignments(page: Page, assignments: RadioAssignment[]): Promise<KoreaOfficialEformFillAuditItem[]> {
  return page.evaluate((items) => {
    return items.map((item) => {
      const element = document.querySelector(item.selector) as HTMLInputElement | null;
      if (!element) {
        return {
          selector: item.selector,
          expected: "checked",
          actual: null,
          ok: false,
          reason: "missing_selector" as const,
        };
      }
      return {
        selector: item.selector,
        expected: "checked",
        actual: element.checked ? "checked" : "unchecked",
        ok: element.checked,
        reason: element.checked ? undefined : ("radio_not_checked" as const),
      };
    });
  }, assignments);
}

export async function auditKoreaOfficialEformFirstPageFill(
  page: Page,
  payload: KoreaOfficialEformPayload,
  options: KoreaOfficialEformFillOptions = {},
): Promise<KoreaOfficialEformFillAuditItem[]> {
  const plan = buildKoreaOfficialEformFirstPagePlan(payload, options);
  return [
    ...(await auditFieldAssignments(page, plan.selects)),
    ...(await auditRadioAssignments(page, plan.radios)),
    ...(await auditFieldAssignments(page, plan.fields)),
  ];
}

export async function auditKoreaOfficialEformSecondPageFill(
  page: Page,
  answers: Record<string, string | null | undefined>,
): Promise<KoreaOfficialEformFillAuditItem[]> {
  const plan = buildKoreaOfficialEformSecondPagePlan(answers);
  return [
    ...(await auditFieldAssignments(page, plan.selects)),
    ...(await auditRadioAssignments(page, plan.radios)),
    ...(await auditFieldAssignments(page, plan.fields)),
  ];
}

function isCompressibleImage(filePath: string) {
  return /\.(?:jpe?g|png|webp)$/i.test(filePath);
}

async function compressImageForOfficialUpload(page: Page, filePath: string): Promise<string> {
  const stat = await fs.stat(filePath);
  if (stat.size <= TARGET_OFFICIAL_UPLOAD_BYTES || !isCompressibleImage(filePath)) return filePath;

  const bytes = await fs.readFile(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const outputDir = path.join(path.dirname(filePath), "official-upload");
  await fs.mkdir(outputDir, { recursive: true });

  const compressedBase64 = await page.evaluate(
    async ({ dataUrl, targetBytes }) => {
      const image = new Image();
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not decode official upload image"));
      });
      image.src = dataUrl;
      await loaded;

      const dimensions = [1800, 1600, 1400, 1200, 1000, 850, 700, 560];
      const qualities = [0.88, 0.78, 0.68, 0.58, 0.48, 0.38];
      let best = "";
      for (const maxDimension of dimensions) {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create official upload canvas");
        ctx.drawImage(image, 0, 0, width, height);

        for (const quality of qualities) {
          const data = canvas.toDataURL("image/jpeg", quality);
          const payload = data.split(",", 2)[1] ?? "";
          best = payload;
          const approxBytes = Math.floor((payload.length * 3) / 4);
          if (approxBytes <= targetBytes) return payload;
        }
      }
      return best;
    },
    {
      dataUrl: `data:image/${ext.replace(".", "").replace("jpg", "jpeg")};base64,${bytes.toString("base64")}`,
      targetBytes: TARGET_OFFICIAL_UPLOAD_BYTES,
    },
  );

  const outputPath = path.join(outputDir, `${baseName}.official.jpg`);
  await fs.writeFile(outputPath, Buffer.from(compressedBase64, "base64"));
  const outputStat = await fs.stat(outputPath);
  if (outputStat.size > MAX_OFFICIAL_UPLOAD_BYTES) {
    throw new Error(`Korea official e-Form upload image remains over 500KB after compression: ${outputStat.size} bytes`);
  }
  return outputPath;
}

async function waitForOfficialUploadSettle(page: Page) {
  await page.waitForFunction(
    () => {
      const visibleModal = Array.from(document.querySelectorAll(".ui-dialog, .layerPopup, .popup, [role='dialog']"))
        .some((node) => {
          const element = node as HTMLElement;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        });
      const dimmed = Array.from(document.querySelectorAll(".ui-widget-overlay, .blockUI, .loading, [class*='loading']"))
        .some((node) => {
          const element = node as HTMLElement;
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
        });
      return !visibleModal && !dimmed;
    },
    { timeout: 8000 },
  ).catch(() => undefined);
  await page.waitForTimeout(1200);
}

async function applyOfficialPortalLanguage(page: Page, language: KoreaOfficialEformFillOptions["pdfLanguage"]) {
  const target = language ?? "zh-CN";
  const targetCode = target === "zh-CN" ? "CH" : target === "en" ? "EN" : "KO";
  const currentCode = await page.evaluate(() => (globalThis as unknown as { gfv_seLang?: string }).gfv_seLang).catch(() => null);
  if (currentCode === targetCode) return;

  const selector = target === "zh-CN" ? "#top_a_lang_ch" : target === "en" ? "#top_a_lang_en" : "#top_a_lang_ko";
  const languageLink = page.locator(selector);
  if ((await languageLink.count()) === 0) return;

  await Promise.all([
    page.waitForLoadState("domcontentloaded").catch(() => undefined),
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => undefined),
    languageLink.click(),
  ]);
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
}

export async function fillKoreaOfficialEformFirstPage(
  page: Page,
  payload: KoreaOfficialEformPayload,
  options: KoreaOfficialEformFillOptions = {},
): Promise<KoreaOfficialEformFillResult> {
  await page.goto(KOREA_VISA_PORTAL_EFORM_URL, { waitUntil: "domcontentloaded" });
  await applyOfficialPortalLanguage(page, options.pdfLanguage);
  const applyLink = page.locator("#applyVisa");
  if (await applyLink.count()) {
    await applyLink.click();
  }
  await page.waitForSelector("#SUR_NM", { timeout: 15000 });

  const missingUploads: Array<"photo" | "passport_scan"> = [];
  const photoPath = options.documents?.photoFilePath?.trim();
  const passportPath = options.documents?.passportScanFilePath?.trim();
  if (passportPath) {
    await page.locator("#PassPort_FULLIMAGE").setInputFiles(await compressImageForOfficialUpload(page, passportPath));
    await waitForOfficialUploadSettle(page);
  } else {
    missingUploads.push("passport_scan");
  }
  if (photoPath) {
    await page.locator("#PassPort_FILEIMAGE").setInputFiles(await compressImageForOfficialUpload(page, photoPath));
    await waitForOfficialUploadSettle(page);
  } else {
    missingUploads.push("photo");
  }

  const plan = buildKoreaOfficialEformFirstPagePlan(payload, options);
  const filledSelectors = [
    ...(await assignFields(page, plan.selects)),
    ...(await assignRadios(page, plan.radios)),
    ...(await assignFields(page, plan.fields)),
  ];

  return {
    status: "filled_first_page",
    portalUrl: page.url(),
    filledSelectors,
    missingUploads,
    nextCheckpoint: "official_eform_portal_review_required",
  };
}

export async function fillKoreaOfficialEformSecondPage(
  page: Page,
  answers: Record<string, string | null | undefined>,
): Promise<{ filledSelectors: string[] }> {
  await page.waitForSelector("#MARI_STS_CD_S, #MARI_STS_CD_M, #MARI_STS_CD_D", { timeout: 15000 });
  await Promise.all([
    page.waitForSelector("#LAST_SCH_NM", { timeout: 15000 }),
    page.waitForSelector("#VISIT_COST", { timeout: 15000 }),
    page.waitForSelector("#DOC_WRIT_HELP_N, #DOC_WRIT_HELP_Y", { timeout: 15000 }),
  ]);
  const plan = buildKoreaOfficialEformSecondPagePlan(answers);
  const filledSelectors = [
    ...(await assignFields(page, plan.selects)),
    ...(await assignRadios(page, plan.radios)),
    ...(await assignFields(page, plan.fields)),
  ];
  return { filledSelectors };
}

function parseKoreaApplicationNumber(value: string | null): string | null {
  return value?.match(/CP\d+ON\d+/i)?.[0] ?? null;
}

async function uploadOfficialEformPdf(applicationId: string, applicationNumber: string | null, filePath: string) {
  const { supabase } = await import("../supabase");
  const buffer = await fs.readFile(filePath);
  const suffix = applicationNumber ?? Date.now().toString();
  const storagePath = `korea/${applicationId}/official-eform-${suffix}.pdf`;
  const { error } = await supabase.storage.from("submission-artifacts").upload(storagePath, buffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) {
    throw new Error(`Korea official e-Form PDF upload failed: ${error.message}`);
  }
  return storagePath;
}

export async function completeKoreaOfficialEformAndDownloadPdf(
  page: Page,
  applicationId: string,
): Promise<KoreaOfficialEformCompletionResult> {
  await page.locator("#APPLY_VISA").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#APPLY_VISA").click();

  await page.locator("#confirmTrue").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#confirmTrue").click();

  await page.locator("#alertClose").waitFor({ state: "visible", timeout: 45000 });
  const successMessage = await page.locator(".ui-dialog").innerText().catch(() => null);
  const applicationNumber = parseKoreaApplicationNumber(successMessage);
  await page.locator("#alertClose").click();
  await page.waitForTimeout(3000);

  await page.locator("#PRINT_BTN").waitFor({ state: "visible", timeout: 30000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
  await page.locator("#PRINT_BTN").click();
  const download = await downloadPromise;

  const outputDir = path.resolve(process.cwd(), "output", "playwright");
  await fs.mkdir(outputDir, { recursive: true });
  const safeNumber = applicationNumber ?? Date.now().toString();
  const officialPdfLocalPath = path.join(outputDir, `korea-official-eform-${applicationId}-${safeNumber}.pdf`);
  await download.saveAs(officialPdfLocalPath);
  const officialPdfStoragePath = await uploadOfficialEformPdf(applicationId, applicationNumber, officialPdfLocalPath);

  return {
    applicationNumber,
    officialPdfStoragePath,
    officialPdfLocalPath,
    successMessage,
  };
}
