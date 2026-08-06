import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { chromium, type Page } from "playwright";
import { supabase } from "../src/supabase";
import { ensureApplicantInboxAlias } from "../src/inbox/alias";
import { fillForeignerAccountRegistration } from "../src/indonesia/runner";

const DEFAULT_APPLICATION_ID = "9e6769fa-4175-49eb-a67e-951acbe9d75f";
const LOCAL_BASE_URL = process.env.VIZA_LOCAL_BASE_URL?.trim() || "http://localhost:3000";
const APPLICATION_ID = process.env.ID_QA_APPLICATION_ID?.trim() || DEFAULT_APPLICATION_ID;
const MODE = process.env.INDONESIA_VISIBLE_QA_MODE?.trim().toLowerCase() || "all";
const ADDRESS = process.env.ID_QA_ADDRESS?.trim()
  || "Jl. Munduk Tengah No.19a, Pererenan, Kec. Mengwi, Kabupaten Badung, Bali 80351, Indonesia";
const POSTAL_CODE = process.env.ID_QA_POSTAL_CODE?.trim() || "80351";
const MOTHER_NAME = process.env.ID_QA_MOTHER_NAME?.trim() || "";
const UPLOAD_ROOT = process.env.ID_QA_UPLOAD_ROOT?.trim()
  || "/Users/edward/Github/Nanan-Holdings/VIZA-monorepo/tmp/indonesia-upload";

type ApplicantProfile = {
  auth_user_id: string;
  full_name: string | null;
  full_name_en: string | null;
  gender: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  place_of_birth_en: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_issue_date: string | null;
  passport_expiry_date: string | null;
  passport_issuing_country: string | null;
  passport_issuing_authority: string | null;
  phone: string | null;
};

type QaApplication = {
  id: string;
  applicant_id: string;
  visa_type: string | null;
  applicant_profiles: ApplicantProfile;
};

function readFirst(answers: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = answers[key]?.trim();
    if (value) return value;
  }
  return null;
}

function requiredFile(name: string): string {
  const filePath = `${UPLOAD_ROOT}/${name}`;
  if (!fs.existsSync(filePath)) throw new Error(`Missing authorized QA upload: ${filePath}`);
  return filePath;
}

async function loadQaData(): Promise<{
  application: QaApplication;
  answers: Record<string, string>;
  ownerEmail: string;
  managedAlias: string;
}> {
  const { data, error } = await supabase
    .from("applications")
    .select(`
      id,
      applicant_id,
      visa_type,
      applicant_profiles!inner(
        auth_user_id,
        full_name,
        full_name_en,
        gender,
        date_of_birth,
        place_of_birth,
        place_of_birth_en,
        nationality,
        passport_number,
        passport_issue_date,
        passport_expiry_date,
        passport_issuing_country,
        passport_issuing_authority,
        phone
      )
    `)
    .eq("id", APPLICATION_ID)
    .single();
  if (error || !data) throw new Error(`Indonesia QA application load failed: ${error?.message ?? "not found"}`);

  const application = data as unknown as QaApplication;
  const { data: answerRows, error: answerError } = await supabase
    .from("visa_application_answers")
    .select("field_name,value_text,value_json")
    .eq("application_id", APPLICATION_ID);
  if (answerError) throw new Error(`Indonesia QA answer load failed: ${answerError.message}`);

  const answers: Record<string, string> = {};
  for (const row of answerRows ?? []) {
    const value = row.value_json == null ? row.value_text : String(row.value_json);
    if (typeof value === "string" && value.trim()) answers[String(row.field_name)] = value;
  }

  const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(
    application.applicant_profiles.auth_user_id,
  );
  const ownerEmail = ownerData.user?.email?.trim();
  if (ownerError || !ownerEmail) throw new Error(`Indonesia QA owner lookup failed: ${ownerError?.message ?? "email missing"}`);
  const managedAlias = (await ensureApplicantInboxAlias(application.applicant_id)).alias;
  return { application, answers, ownerEmail, managedAlias };
}

async function authenticateLocalPage(page: Page, ownerEmail: string): Promise<void> {
  await page.goto(`${LOCAL_BASE_URL}/client/login`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email: ownerEmail });
  const token = data.properties?.email_otp;
  if (error || !token) throw new Error(`Local QA login token failed: ${error?.message ?? "token missing"}`);
  const response = await page.request.post(`${LOCAL_BASE_URL}/api/client/auth`, {
    data: { operation: "verify_otp", email: ownerEmail, token },
  });
  const payload = await response.json() as { success?: boolean; error?: string };
  if (!payload.success) throw new Error(`Local QA login failed: ${payload.error ?? response.statusText()}`);
}

async function attachFile(page: Page, buttonName: string, filePath: string): Promise<void> {
  if (await page.getByText(path.basename(filePath), { exact: true }).count() > 0) {
    console.log(`[id-visible-qa] Already uploaded locally: ${path.basename(filePath)}`);
    return;
  }
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(filePath);
  await page.waitForTimeout(1_200);
}

async function fillLocalViza(page: Page, managedAlias: string): Promise<void> {
  const url = `${LOCAL_BASE_URL}/client/application/long-form?country=indonesia&visaType=ID_C1_TOURIST&skipFormCheck=true&applicationId=${APPLICATION_ID}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByRole("heading", { name: /印度尼西亚C1|Indonesia C1/i }).waitFor({ timeout: 30_000 });

  await page.getByRole("textbox", { name: "Mobile number without the country calling code", exact: true }).fill("81234567");
  await page.getByRole("textbox", { name: "Enter address", exact: true }).fill(ADDRESS);
  await page.getByRole("textbox", { name: "Enter 5 digits to auto-fill the region", exact: true }).fill(POSTAL_CODE);
  await page.getByRole("textbox", { name: "Managed official eVisa account email", exact: true }).fill(managedAlias);

  const { data: documentRows, error: documentError } = await supabase
    .from("application_documents")
    .select("document_type,status")
    .eq("application_id", APPLICATION_ID);
  if (documentError) throw new Error(`Local VIZA document verification failed: ${documentError.message}`);
  const uploadedTypes = new Set(
    (documentRows ?? [])
      .filter((row) => row.status === "uploaded")
      .map((row) => String(row.document_type)),
  );
  const uploadIfMissing = async (documentType: string, buttonName: string, filename: string) => {
    if (uploadedTypes.has(documentType)) {
      console.log(`[id-visible-qa] Already uploaded locally: ${filename}`);
      return;
    }
    await attachFile(page, buttonName, requiredFile(filename));
  };
  await uploadIfMissing("passport_copy", "选择护照资料页", "Passport.jpg");
  await uploadIfMissing("photo", "选择近期彩色证件照", "Portrait.JPG");
  await uploadIfMissing("return_ticket", "选择返程或续程机票", "Return-Ticket-QA-Only.pdf");
  await uploadIfMissing("bank_statement", "选择个人银行对账单（最低 USD 2,000 或等值金额）", "Statement.pdf");
  await page.waitForTimeout(3_000);
  console.log("[id-visible-qa] Local VIZA fields and four authorized documents are filled. No VIZA Submit click was made.");
}

async function fillOfficialRegistration(
  page: Page,
  input: Awaited<ReturnType<typeof loadQaData>>,
): Promise<void> {
  if (!MOTHER_NAME) {
    throw new Error("ID_QA_MOTHER_NAME is required for the official Indonesia WNA registration preview.");
  }

  process.env.INDONESIA_ACCOUNT_REGISTRATION_SUBMIT = "false";
  const { application, answers, managedAlias } = input;
  const profile = application.applicant_profiles;
  await page.goto("https://evisa.imigrasi.go.id/front/register/wna", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.locator("#full_name, #username, #document_travel_id").first().waitFor({ timeout: 60_000 });

  const diagnostics: string[] = [];
  const filled = await fillForeignerAccountRegistration(page, {
    portalUrl: "https://evisa.imigrasi.go.id/",
    provider: "indonesia_c1_live",
    visaType: "ID_C1_TOURIST",
    applicationId: application.id,
    applicantId: application.applicant_id,
    accountEmail: managedAlias,
    accountPassword: `VizaQa!${randomBytes(12).toString("base64url")}`,
    registration: {
      documentTravelType: "Passport",
      fullName: readFirst(answers, ["full_name", "full_name_en", "name_as_in_passport"]) || profile.full_name_en || profile.full_name,
      gender: readFirst(answers, ["gender", "sex"]) || profile.gender,
      birthPlace: readFirst(answers, ["birth_place", "place_of_birth"]) || profile.place_of_birth_en || profile.place_of_birth,
      dateOfBirth: readFirst(answers, ["date_of_birth", "birth_date", "birthday"]) || profile.date_of_birth,
      phoneCountryCode: readFirst(answers, ["phone_country_code", "phone_code"]) || "+65",
      phoneCodeCountry: "Singapore",
      mobilePhone: readFirst(answers, ["mobile_phone", "mobile_number", "phone"]) || profile.phone,
      motherName: MOTHER_NAME,
      passportNumber: readFirst(answers, ["passport_number", "travel_document_number"]) || profile.passport_number,
      passportCountry: "China",
      passportIssueDate: readFirst(answers, ["passport_issue_date", "date_of_issue"]) || profile.passport_issue_date,
      passportExpiryDate: readFirst(answers, ["passport_expiry_date", "date_of_expiry"]) || profile.passport_expiry_date,
      passportIssuingCountry: "China",
      passportIssuePlace: readFirst(answers, ["passport_place_of_issue", "passport_issuing_authority"]) || profile.passport_issuing_authority,
      // Deliberately omit official-site file uploads: those endpoints may store
      // the files immediately even when the registration button is never used.
      passportImagePath: null,
      photoImagePath: null,
    },
    headless: false,
  }, diagnostics);
  if (!filled) throw new Error(`Official registration form was not filled: ${diagnostics.join(" | ")}`);

  const requiredSelectors = [
    "#full_name", "#birth_place", "#birthday", "#mobile_phone", "#mother",
    "#number", "#release_date", "#expired_date", "#release_place", "#username",
    "#confirm_email", "#password", "#confirm_password",
  ];
  const emptySelectors = await page.evaluate((selectors) => selectors.filter((selector) => {
    const field = document.querySelector<HTMLInputElement>(selector);
    return !field?.value?.trim();
  }), requiredSelectors);
  if (emptySelectors.length > 0) throw new Error(`Official registration fields remained empty: ${emptySelectors.join(", ")}`);

  await page.bringToFront();
  console.log(`[id-visible-qa] Official WNA registration filled (${requiredSelectors.length} text/date fields verified).`);
  console.log("[id-visible-qa] No passport/photo was uploaded to the government site and Register was not clicked.");
}

async function waitForOperator(): Promise<void> {
  console.log("[id-visible-qa] Browser left open for inspection. Press Enter to close.");
  process.stdin.resume();
  await new Promise<void>((resolve) => process.stdin.once("data", () => resolve()));
}

async function main(): Promise<void> {
  if (!["all", "local", "official"].includes(MODE)) {
    throw new Error("INDONESIA_VISIBLE_QA_MODE must be all, local, or official.");
  }
  const data = await loadQaData();
  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    slowMo: Number(process.env.ID_QA_SLOW_MO_MS || "250"),
    args: ["--start-maximized"],
  });
  const context = await browser.newContext({ viewport: null });
  const localPage = await context.newPage();
  try {
    if (MODE !== "official") {
      await authenticateLocalPage(localPage, data.ownerEmail);
      await fillLocalViza(localPage, data.managedAlias);
      await localPage.bringToFront();
    }
    if (MODE !== "local") {
      const officialPage = await context.newPage();
      await fillOfficialRegistration(officialPage, data);
    }
    await waitForOperator();
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`[id-visible-qa] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
