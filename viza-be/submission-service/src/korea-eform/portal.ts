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
}

export interface KoreaOfficialEformFillResult {
  status: "filled_first_page";
  portalUrl: string;
  filledSelectors: string[];
  missingUploads: Array<"photo" | "passport_scan">;
  nextCheckpoint: "official_eform_portal_review_required";
}

interface FieldAssignment {
  selector: string;
  value: string;
}

interface RadioAssignment {
  selector: string;
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

export function buildKoreaOfficialEformFirstPagePlan(
  payload: KoreaOfficialEformPayload,
  options: KoreaOfficialEformFillOptions = {},
): { fields: FieldAssignment[]; radios: RadioAssignment[]; selects: FieldAssignment[] } {
  const address = splitAddress(payload.homeAddress);
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
      { selector: "#ISS_PLACE", value: nationality },
      { selector: "#ISS_YMD", value: compactDate(payload.passportIssueDate) },
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
  const purposeMap: Record<string, string> = {
    tourism_transit: "#ENT_PURP_KIND_CD1",
    meeting_conference: "#ENT_PURP_KIND_CD2",
    medical_tourism: "#ENT_PURP_KIND_CD3",
    business_trip: "#ENT_PURP_KIND_CD4",
    study_training: "#ENT_PURP_KIND_CD5",
    work: "#ENT_PURP_KIND_CD6",
    trade_investment_ict: "#ENT_PURP_KIND_CD7",
    visiting_family_relatives_friends: "#ENT_PURP_KIND_CD8",
    marriage_migrant: "#ENT_PURP_KIND_CD10",
    diplomatic_official: "#ENT_PURP_KIND_CD11",
    other: "#ENT_PURP_KIND_CD12",
  };

  const marital = readAnswer(answers, ["marital_status"], "single").toLowerCase();
  const education = readAnswer(answers, ["highest_education"], "bachelors").toLowerCase();
  const job = readAnswer(answers, ["employment_status"], "employed").toLowerCase();
  const purpose = readAnswer(answers, ["purpose_of_visit"], "tourism_transit").toLowerCase();
  const travelledToKorea = isYes(readAnswer(answers, ["travelled_to_korea_5y"]));
  const travelledOutside = isYes(readAnswer(answers, ["travelled_outside_5y"]));
  const travellingWithFamily = isYes(readAnswer(answers, ["travelling_with_family"]));
  const receivedAssistance = isYes(readAnswer(answers, ["received_form_assistance"]));

  const fields: FieldAssignment[] = [
    { selector: "#LAST_SCH_NM", value: readAnswer(answers, ["school_name"]) },
    { selector: "#LAST_SCH_ADDR", value: readAnswer(answers, ["school_location"]) },
    { selector: "#COMPY_NM", value: readAnswer(answers, ["employer_name"]) },
    { selector: "#POSI_NM", value: readAnswer(answers, ["employer_position"]) },
    { selector: "#COMPY_ADDR", value: readAnswer(answers, ["employer_address"]) },
    { selector: "#JOB_TEL_NO", value: readAnswer(answers, ["employer_telephone"]) },
    { selector: "#APPL_SOJ_DUR", value: readAnswer(answers, ["intended_period_of_stay"]) },
    { selector: "#ENTRY_EXP_YMD", value: compactDate(readAnswer(answers, ["intended_date_of_entry"]) || null) },
    { selector: "#RNM_ENG_BS_ADDR", value: readAnswer(answers, ["address_in_korea"]) },
    { selector: "#RNM_ENG_DET_ADDR", value: readAnswer(answers, ["address_in_korea_detail"]) },
    { selector: "#SOJ_EXP_REGION_TEL_NO", value: readAnswer(answers, ["contact_in_korea"]) },
    { selector: "#VISIT_COST", value: readAnswer(answers, ["estimated_travel_costs_usd", "visit_cost_usd", "visit_cost"]) },
    { selector: "#COST_PAMNT_EK_NM", value: readAnswer(answers, ["payer_name", "cost_payer_name"]) },
    { selector: "#COST_PAMNT_REL", value: readAnswer(answers, ["payer_relationship", "cost_payer_relationship"]) },
    { selector: "#COST_PAMNT_DETAIL", value: readAnswer(answers, ["payer_support_type", "cost_payer_support_type"]) },
    { selector: "#COST_PAMNT_TEL_NO", value: readAnswer(answers, ["payer_contact", "cost_payer_contact"]) },
  ];

  if (purpose === "other") {
    fields.push({ selector: "#ENT_PURP_KIND_DETAIL", value: readAnswer(answers, ["purpose_of_visit_other"]) });
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
      { selector: "#noAddr", value: "" },
    ],
    radios: [
      { selector: maritalMap[marital] ?? "#MARI_STS_CD_S" },
      { selector: educationMap[education] ?? "#LAST_DEGREE_2" },
      { selector: jobMap[job] ?? "#JOB_CD_3" },
      { selector: purposeMap[purpose] ?? "#ENT_PURP_KIND_CD1" },
      { selector: "#APPL_VISA_GB_S" },
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
      element.value = item.value;
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

export async function fillKoreaOfficialEformFirstPage(
  page: Page,
  payload: KoreaOfficialEformPayload,
  options: KoreaOfficialEformFillOptions = {},
): Promise<KoreaOfficialEformFillResult> {
  await page.goto(KOREA_VISA_PORTAL_EFORM_URL, { waitUntil: "domcontentloaded" });
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
  const plan = buildKoreaOfficialEformSecondPagePlan(answers);
  const filledSelectors = [
    ...(await assignFields(page, plan.selects)),
    ...(await assignRadios(page, plan.radios)),
    ...(await assignFields(page, plan.fields)),
  ];
  return { filledSelectors };
}
