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
      { selector: "#CUR_NAT_SAME_YN2" },
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

  const plan = buildKoreaOfficialEformFirstPagePlan(payload, options);
  const filledSelectors = [
    ...(await assignFields(page, plan.selects)),
    ...(await assignRadios(page, plan.radios)),
    ...(await assignFields(page, plan.fields)),
  ];

  const missingUploads: Array<"photo" | "passport_scan"> = [];
  const photoPath = options.documents?.photoFilePath?.trim();
  const passportPath = options.documents?.passportScanFilePath?.trim();
  if (photoPath) {
    await page.locator("#PassPort_FULLIMAGE").setInputFiles(photoPath);
  } else {
    missingUploads.push("photo");
  }
  if (passportPath) {
    await page.locator("#PassPort_FILEIMAGE").setInputFiles(passportPath);
  } else {
    missingUploads.push("passport_scan");
  }

  return {
    status: "filled_first_page",
    portalUrl: page.url(),
    filledSelectors,
    missingUploads,
    nextCheckpoint: "official_eform_portal_review_required",
  };
}
