import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  auditKoreaOfficialEformFirstPageFill,
  auditKoreaOfficialEformSecondPageFill,
  fillKoreaOfficialEformFirstPage,
  fillKoreaOfficialEformSecondPage,
} from "../src/korea-eform/portal.js";
import { buildKoreaOfficialEformPayload } from "../src/korea-eform/runner.js";

const answers: Record<string, string> = {
  family_name: "CHEN",
  given_names: "HONGYU",
  date_of_birth: "1997-04-09",
  gender: "male",
  nationality: "CHINA P. R.",
  country_of_birth: "CHINA P. R.",
  national_identity_no: "110101199704091234",
  passport_number: "E12345678",
  passport_expiry_date: "2032-01-01",
  passport_issue_date: "2022-01-01",
  passport_place_of_issue: "BEIJING",
  email: "applicant@example.com",
  phone: "19974931995",
  home_address_street: "1 Test Road",
  home_address_city: "Beijing",
  home_address_state: "Beijing",
  home_address_country: "China",
  purpose_of_visit: "tourism_transit",
  marital_status: "single",
  highest_education: "bachelors",
  school_name: "Test University",
  school_location: "Beijing, China",
  employment_status: "employed",
  employer_name: "Test Company",
  employer_position: "Engineer",
  employer_address: "1 Employer Road, Beijing, China",
  employer_telephone: "13312345678",
  intended_period_of_stay: "7",
  intended_date_of_entry: "2026-09-01",
  korea_address_mode: "official_search",
  address_in_korea: "100 Toegye-ro, Jung-gu, Seoul",
  address_in_korea_detail: "Hotel",
  address_in_korea_postal_code: "04631",
  contact_in_korea: "+82 2 1234 5678",
  expected_korea_visit_count: "single",
  travelled_to_korea_5y: "no",
  travelled_outside_5y: "no",
  travelling_with_family: "no",
  estimated_travel_costs_usd: "1000",
  payer_name: "CHEN HONGYU",
  payer_relationship: "Self",
  payer_support_type: "Travel expenses",
  payer_contact: "19974931995",
  received_form_assistance: "no",
};

async function main() {
  process.env.KR_VISA_PORTAL_EFORM_LIVE_ENABLED = "true";
  const outputDir = path.resolve(process.cwd(), "output", "playwright");
  await fs.mkdir(outputDir, { recursive: true });
  const sampleDocumentDir = path.resolve(
    process.cwd(),
    "output",
    "korea-eform-documents",
    "434fbeb9-8990-450f-ae2a-c12b8f01dd7f",
  );
  const passportScanFilePath = process.env.KR_EFORM_AUDIT_PASSPORT_SCAN_PATH ?? path.join(sampleDocumentDir, "passport.jpg");
  const photoFilePath = process.env.KR_EFORM_AUDIT_PHOTO_PATH ?? path.join(sampleDocumentDir, "Photo.jpg");

  const browser = await chromium.launch({ headless: process.env.HEADFUL !== "true" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  try {
    const payload = buildKoreaOfficialEformPayload({ applicationId: "audit-korea-eform", answers });
    const firstFill = await fillKoreaOfficialEformFirstPage(page, payload, {
      pdfLanguage: "zh-CN",
      visitingPostName: "주 중국 대사관",
      visitingPostCode: "CP",
      documents: {
        passportScanFilePath,
        photoFilePath,
      },
    });
    const firstAudit = await auditKoreaOfficialEformFirstPageFill(page, payload, {
      visitingPostName: "주 중국 대사관",
      visitingPostCode: "CP",
    });
    const firstFailures = firstAudit.filter((item) => !item.ok);
    const firstScreenshot = path.join(outputDir, "korea-eform-audit-first-page.png");
    await page.screenshot({ path: firstScreenshot, fullPage: true });

    let secondAudit: Awaited<ReturnType<typeof auditKoreaOfficialEformSecondPageFill>> | null = null;
    let secondScreenshot: string | null = null;
    let secondPageError: string | null = null;
    try {
      const nextButton = page.locator("#REG_STEP1");
      await nextButton.waitFor({ state: "visible", timeout: 8000 });
      await nextButton.click();
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      const secondFill = await fillKoreaOfficialEformSecondPage(page, answers);
      secondAudit = await auditKoreaOfficialEformSecondPageFill(page, answers);
      secondScreenshot = path.join(outputDir, "korea-eform-audit-second-page.png");
      await page.screenshot({ path: secondScreenshot, fullPage: true });
      await fs.writeFile(
        path.join(outputDir, "korea-eform-audit-second-page-filled-selectors.json"),
        `${JSON.stringify(secondFill.filledSelectors, null, 2)}\n`,
        "utf8",
      );
    } catch (error) {
      secondPageError = error instanceof Error ? error.message : String(error);
    }

    const report = {
      firstPage: {
        filledSelectors: firstFill.filledSelectors,
        missingUploads: firstFill.missingUploads,
        auditCount: firstAudit.length,
        failureCount: firstFailures.length,
        failures: firstFailures,
        screenshot: firstScreenshot,
      },
      secondPage: secondAudit
        ? {
            auditCount: secondAudit.length,
            failureCount: secondAudit.filter((item) => !item.ok).length,
            failures: secondAudit.filter((item) => !item.ok),
            screenshot: secondScreenshot,
          }
        : {
            error: secondPageError,
          },
    };

    const reportPath = path.join(outputDir, "korea-eform-audit-report.json");
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
