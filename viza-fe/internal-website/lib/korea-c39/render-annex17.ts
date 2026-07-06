import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { resolveKvacCenter, type KvacRoutingInput } from "./kvac-routing";

export type KoreaAnswerMap = Record<string, string | null | undefined>;

interface RenderOptions {
  routing?: KvacRoutingInput;
  templateLanguage?: "zh" | "en";
}

export type Annex17RequiredField =
  | "family_name"
  | "given_names"
  | "date_of_birth"
  | "sex"
  | "nationality"
  | "passport_number"
  | "passport_issue_date"
  | "passport_expiry_date"
  | "email_address"
  | "mobile_phone"
  | "purpose_of_visit"
  | "intended_date_of_entry"
  | "intended_period_of_stay"
  | "address_in_korea";

const REQUIRED_FIELDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["family_name", ["family_name", "surname", "last_name"]],
  ["given_names", ["given_names", "given_name", "first_name"]],
  ["date_of_birth", ["date_of_birth", "dob"]],
  ["sex", ["sex", "gender"]],
  ["nationality", ["nationality"]],
  ["passport_number", ["passport_number"]],
  ["passport_issue_date", ["passport_issue_date"]],
  ["passport_expiry_date", ["passport_expiry_date", "passport_expiration_date"]],
  ["email_address", ["email_address", "email"]],
  ["mobile_phone", ["mobile_phone", "mobile_number", "telephone_number"]],
  ["purpose_of_visit", ["purpose_of_visit"]],
  ["intended_date_of_entry", ["intended_date_of_entry", "arrival_date"]],
  ["intended_period_of_stay", ["intended_period_of_stay", "intended_length_of_stay"]],
  ["address_in_korea", ["address_in_korea", "accommodation_address"]],
];

const FIELD_ORDER = [
  ["Full name", ["family_name", "surname", "last_name"], ["given_names", "given_name", "first_name"]],
  ["Date of birth", ["date_of_birth", "dob"]],
  ["Sex", ["sex", "gender"]],
  ["Nationality", ["nationality"]],
  ["Passport number", ["passport_number"]],
  ["Passport issue / expiry", ["passport_issue_date"], ["passport_expiry_date"]],
  ["Email", ["email_address", "email"]],
  ["Mobile phone", ["mobile_phone", "mobile_number", "telephone_number"]],
  ["Purpose of visit", ["purpose_of_visit"]],
  ["Intended entry date", ["intended_date_of_entry", "arrival_date"]],
  ["Intended stay", ["intended_period_of_stay", "intended_length_of_stay"]],
  ["Address in Korea", ["address_in_korea", "accommodation_address"]],
  ["Inviter", ["inviter_name", "inviter_full_name"]],
] as const;

// Template paths must stay fully literal (no variable path segments): the
// build-time file tracer otherwise falls back to bundling the entire
// project directory into this route's serverless function.
const TEMPLATE_ZH_PATH = path.join(process.cwd(), "lib/korea-c39/templates/visa-application-form-ch.pdf");
const TEMPLATE_ZH_REPO_PATH = path.join(process.cwd(), "viza-fe/internal-website/lib/korea-c39/templates/visa-application-form-ch.pdf");
const TEMPLATE_EN_PATH = path.join(process.cwd(), "lib/korea-c39/templates/visa-application-form-en.pdf");
const TEMPLATE_EN_REPO_PATH = path.join(process.cwd(), "viza-fe/internal-website/lib/korea-c39/templates/visa-application-form-en.pdf");

type DrawCtx = {
  font: PDFFont;
  bold: PDFFont;
};

function answer(answers: KoreaAnswerMap, keys: readonly string[]): string {
  for (const key of keys) {
    const value = answers[key]?.toString().trim();
    if (value) return value;
  }
  return "";
}

function yesNo(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "y", "on", "是", "有"].includes(normalized);
}

function sanitize(value: string): string {
  const replacements: Record<string, string> = {
    "，": ",",
    "。": ".",
    "“": "\"",
    "”": "\"",
    "‘": "'",
    "’": "'",
    "（": "(",
    "）": ")",
    "—": "-",
    "–": "-",
    "…": "...",
  };
  let output = "";
  for (const ch of value) {
    if (replacements[ch]) {
      output += replacements[ch];
      continue;
    }
    const cp = ch.codePointAt(0) ?? 0;
    output += cp <= 0x7e && cp >= 0x20 ? ch : "?";
  }
  return output;
}

function formatDate(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return sanitize(trimmed);
  return `${match[1]}/${match[2].padStart(2, "0")}/${match[3].padStart(2, "0")}`;
}

function drawText(
  page: PDFPage,
  ctx: DrawCtx,
  value: string,
  x: number,
  y: number,
  options: { size?: number; maxChars?: number; bold?: boolean } = {},
): void {
  const text = sanitize(value).slice(0, options.maxChars ?? 80);
  if (!text) return;
  page.drawText(text, {
    x,
    y,
    size: options.size ?? 9,
    font: options.bold ? ctx.bold : ctx.font,
    color: rgb(0.02, 0.02, 0.02),
  });
}

function drawWrapped(
  page: PDFPage,
  ctx: DrawCtx,
  value: string,
  x: number,
  y: number,
  maxCharsPerLine: number,
  maxLines: number,
  options: { size?: number; lineHeight?: number } = {},
): void {
  const text = sanitize(value);
  if (!text) return;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  lines.slice(0, maxLines).forEach((line, index) => {
    drawText(page, ctx, line, x, y - index * (options.lineHeight ?? 11), { size: options.size ?? 8 });
  });
}

function drawCheck(page: PDFPage, ctx: DrawCtx, x: number, y: number): void {
  page.drawText("V", { x, y, size: 10, font: ctx.bold, color: rgb(0.02, 0.02, 0.02) });
}

function readAny(answers: KoreaAnswerMap, keys: readonly string[]): string {
  return answer(answers, keys);
}

async function loadOfficialTemplate(language: NonNullable<RenderOptions["templateLanguage"]>): Promise<Uint8Array | null> {
  const candidates =
    language === "zh"
      ? [TEMPLATE_ZH_PATH, TEMPLATE_ZH_REPO_PATH]
      : [TEMPLATE_EN_PATH, TEMPLATE_EN_REPO_PATH];
  for (const templatePath of candidates) {
    try {
      const bytes = await readFile(templatePath);
      return Uint8Array.from(bytes);
    } catch {
      // Try the next workspace layout.
    }
  }
  return null;
}

async function renderOfficialTemplate(
  answers: KoreaAnswerMap,
  options: RenderOptions,
): Promise<Uint8Array | null> {
  const template = await loadOfficialTemplate(options.templateLanguage ?? "zh");
  if (!template) return null;

  const pdf = await PDFDocument.load(template);
  const ctx: DrawCtx = {
    font: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const pages = pdf.getPages();
  const [page1, page2, page3, page4, page5] = pages;
  const routing = resolveKvacCenter(options.routing ?? {});

  if (page1) {
    drawText(page1, ctx, readAny(answers, ["family_name", "surname", "last_name"]).toUpperCase(), 172, 516, { size: 10 });
    drawText(page1, ctx, readAny(answers, ["given_names", "given_name", "first_name"]).toUpperCase(), 382, 516, { size: 10 });
    drawText(page1, ctx, readAny(answers, ["chinese_name", "name_in_chinese"]), 172, 486, { size: 9 });
    const sex = readAny(answers, ["sex", "gender"]).toLowerCase();
    if (["female", "f", "woman", "女"].includes(sex)) drawCheck(page1, ctx, 552, 486);
    else drawCheck(page1, ctx, 462, 486);
    drawText(page1, ctx, formatDate(readAny(answers, ["date_of_birth", "dob"])), 204, 448, { size: 10 });
    drawText(page1, ctx, readAny(answers, ["nationality", "current_nationality"]) || "CHINA", 392, 448, { size: 10 });
    drawText(page1, ctx, readAny(answers, ["country_of_birth", "place_of_birth_country"]) || "CHINA", 210, 420, { size: 9 });
    drawText(page1, ctx, readAny(answers, ["national_id_number", "identity_number"]), 430, 420, { size: 9 });
    drawCheck(page1, ctx, yesNo(readAny(answers, ["has_used_other_names"])) ? 186 : 111, 375);
    drawCheck(page1, ctx, yesNo(readAny(answers, ["has_multiple_nationalities"])) ? 526 : 444, 350);
    drawCheck(page1, ctx, 319, 260);
    drawText(page1, ctx, "C-3-9", 378, 260, { size: 11, bold: true });
  }

  if (page2) {
    drawCheck(page2, ctx, 259, 732);
    drawText(page2, ctx, readAny(answers, ["passport_number"]), 178, 702, { size: 10 });
    drawText(page2, ctx, readAny(answers, ["passport_issuing_country", "passport_issue_country", "nationality"]) || "CHINA", 353, 702, { size: 9 });
    drawText(page2, ctx, readAny(answers, ["passport_place_of_issue", "passport_issue_place"]), 500, 702, { size: 9 });
    drawText(page2, ctx, formatDate(readAny(answers, ["passport_issue_date"])), 178, 672, { size: 9 });
    drawText(page2, ctx, formatDate(readAny(answers, ["passport_expiry_date", "passport_expiration_date"])), 387, 672, { size: 9 });
    drawCheck(page2, ctx, yesNo(readAny(answers, ["has_other_passports"])) ? 223 : 145, 640);
    drawCheck(page2, ctx, yesNo(readAny(answers, ["is_married", "marital_status"])) ? 306 : 146, 531);
    drawWrapped(page2, ctx, readAny(answers, ["home_address", "current_address", "residential_address"]), 177, 361, 58, 2);
    drawText(page2, ctx, readAny(answers, ["mobile_phone", "mobile_number", "telephone_number", "phone"]), 178, 326, { size: 9 });
    drawText(page2, ctx, readAny(answers, ["email_address", "email"]), 362, 326, { size: 9, maxChars: 46 });
  }

  if (page3) {
    drawCheck(page3, ctx, 143, 752);
    drawText(page3, ctx, readAny(answers, ["occupation", "current_occupation"]), 177, 726, { size: 9 });
    drawWrapped(page3, ctx, readAny(answers, ["employer_name", "school_name"]), 177, 695, 48, 1);
    drawWrapped(page3, ctx, readAny(answers, ["employer_address", "school_address"]), 177, 668, 60, 2);
    drawText(page3, ctx, readAny(answers, ["employer_phone", "school_phone"]), 177, 630, { size: 9 });
    drawText(page3, ctx, "TOURISM / SHORT-TERM VISIT", 177, 548, { size: 9 });
    drawText(page3, ctx, readAny(answers, ["intended_period_of_stay", "intended_length_of_stay"]), 194, 517, { size: 9 });
    drawText(page3, ctx, formatDate(readAny(answers, ["intended_date_of_entry", "arrival_date"])), 388, 517, { size: 9 });
    drawWrapped(page3, ctx, readAny(answers, ["address_in_korea", "accommodation_address"]), 177, 487, 58, 2);
    drawText(page3, ctx, readAny(answers, ["contact_no_in_korea", "accommodation_phone"]), 388, 447, { size: 9 });
    drawCheck(page3, ctx, yesNo(readAny(answers, ["visited_korea_last_5_years"])) ? 207 : 145, 414);
    drawCheck(page3, ctx, yesNo(readAny(answers, ["travelled_other_countries_last_5_years"])) ? 207 : 145, 311);
    drawCheck(page3, ctx, yesNo(readAny(answers, ["family_in_korea"])) ? 207 : 145, 191);
  }

  if (page4) {
    drawCheck(page4, ctx, yesNo(readAny(answers, ["travelling_with_family"])) ? 207 : 145, 755);
    drawCheck(page4, ctx, yesNo(readAny(answers, ["has_inviter", "inviter_name"])) ? 206 : 145, 530);
    drawText(page4, ctx, readAny(answers, ["inviter_name", "inviter_full_name"]), 182, 502, { size: 9 });
    drawWrapped(page4, ctx, readAny(answers, ["inviter_address"]), 182, 443, 58, 2);
    drawText(page4, ctx, readAny(answers, ["inviter_phone"]), 182, 396, { size: 9 });
    const funding = readAny(answers, ["trip_funding", "sponsor_name", "payer_name"]);
    drawText(page4, ctx, funding || "SELF", 182, 276, { size: 9 });
    drawText(page4, ctx, readAny(answers, ["estimated_travel_cost", "trip_budget"]), 412, 276, { size: 9 });
  }

  if (page5) {
    drawCheck(page5, ctx, yesNo(readAny(answers, ["received_assistance"])) ? 207 : 145, 726);
    drawText(page5, ctx, formatDate(readAny(answers, ["date_of_application"]) || new Date().toISOString().slice(0, 10)), 180, 203, { size: 9 });
    drawText(
      page5,
      ctx,
      [
        readAny(answers, ["family_name", "surname", "last_name"]).toUpperCase(),
        readAny(answers, ["given_names", "given_name", "first_name"]).toUpperCase(),
      ].filter(Boolean).join(" "),
      180,
      176,
      { size: 9 },
    );
    drawText(page5, ctx, `Recommended KVAC: ${routing.recommended.nameEn}`, 96, 90, { size: 7, maxChars: 72 });
  }

  return pdf.save();
}

export function validateAnnex17Answers(answers: KoreaAnswerMap): Annex17RequiredField[] {
  const missing: Annex17RequiredField[] = [];
  for (const [canonical, aliases] of REQUIRED_FIELDS) {
    if (answer(answers, aliases) === "") {
      missing.push(canonical as Annex17RequiredField);
    }
  }
  return missing;
}

export async function renderKoreaC39Annex17(
  answers: KoreaAnswerMap,
  options: RenderOptions = {},
): Promise<Uint8Array> {
  const missingFields = validateAnnex17Answers(answers);
  if (missingFields.length > 0) {
    const normalized = missingFields.join(", ");
    throw new Error(`Missing required Korea Annex-17 fields: ${normalized}`);
  }

  const official = await renderOfficialTemplate(answers, options);
  if (official) return official;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const routing = resolveKvacCenter(options.routing ?? {});

  for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
    const page = pdf.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    page.drawText("VISA APPLICATION FORM / Annex 17", {
      x: 42,
      y: height - 54,
      size: 16,
      font: bold,
      color: rgb(0.08, 0.08, 0.08),
    });
    page.drawText("Korea C-3-9 Short-Term Visit - generated by VIZA from applicant answers", {
      x: 42,
      y: height - 76,
      size: 9,
      font,
      color: rgb(0.28, 0.28, 0.28),
    });
    page.drawText(`Page ${pageIndex + 1} of 5`, {
      x: width - 96,
      y: height - 54,
      size: 9,
      font,
      color: rgb(0.28, 0.28, 0.28),
    });

    if (pageIndex === 0) {
      let y = height - 118;
      page.drawText("1. Applicant Information", { x: 42, y, size: 12, font: bold });
      y -= 26;
      for (const [label, first, second] of FIELD_ORDER) {
        const value = second
          ? [answer(answers, first), answer(answers, second)].filter(Boolean).join(" ")
          : answer(answers, first);
        page.drawText(label, { x: 50, y, size: 9, font: bold });
        page.drawRectangle({ x: 180, y: y - 4, width: 330, height: 16, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.5 });
        page.drawText(sanitize(value || " "), { x: 186, y, size: 9, font });
        y -= 24;
      }
    } else if (pageIndex === 1) {
      page.drawText("2. Visa Category", { x: 42, y: height - 118, size: 12, font: bold });
      page.drawText("Period of Stay: Short-term", { x: 50, y: height - 148, size: 10, font });
      page.drawText("Status of Stay: C-3-9", { x: 50, y: height - 170, size: 10, font });
      page.drawText("Purpose: Short-term general visit", { x: 50, y: height - 192, size: 10, font });
    } else if (pageIndex === 2) {
      page.drawText("3. KVAC Routing", { x: 42, y: height - 118, size: 12, font: bold });
      page.drawText(`Recommended center: ${routing.recommended.nameEn}`, { x: 50, y: height - 148, size: 10, font });
      page.drawText(`Booking URL: ${routing.recommended.bookingUrl}`, { x: 50, y: height - 170, size: 9, font });
      page.drawText(`Routing basis: ${routing.basis}`, { x: 50, y: height - 192, size: 10, font });
    } else if (pageIndex === 3) {
      page.drawText("4. Declaration", { x: 42, y: height - 118, size: 12, font: bold });
      page.drawText("Applicant must review, print, attach photo, and sign before KVAC intake.", {
        x: 50,
        y: height - 148,
        size: 10,
        font,
      });
      page.drawText("Signature: ____________________________     Date: __________________", {
        x: 50,
        y: height - 212,
        size: 10,
        font,
      });
    } else {
      page.drawText("5. VIZA Submission Notes", { x: 42, y: height - 118, size: 12, font: bold });
      page.drawText("Photo and supporting documents remain separate uploads/checklist items.", {
        x: 50,
        y: height - 148,
        size: 10,
        font,
      });
    }
  }

  return pdf.save();
}
