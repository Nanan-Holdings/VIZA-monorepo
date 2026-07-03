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

function splitAddress(address: string | null): { street: string; city: string; state: string; country: string } {
  const parts = (address ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return {
    street: parts[0] ?? address ?? "",
    city: parts[1] ?? "",
    state: parts[2] ?? "",
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
  const postName = options.visitingPostName?.trim() || "CHINA-BEIJING";
  const postCode = options.visitingPostCode?.trim() || "";

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
  if (photoPath) {
    await page.locator("#PassPort_FILEIMAGE").setInputFiles(await compressImageForOfficialUpload(page, photoPath));
  } else {
    missingUploads.push("photo");
  }
  if (passportPath) {
    await page.locator("#PassPort_FULLIMAGE").setInputFiles(await compressImageForOfficialUpload(page, passportPath));
  } else {
    missingUploads.push("passport_scan");
  }
  if (photoPath || passportPath) {
    await waitForOfficialUploadSettle(page);
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
