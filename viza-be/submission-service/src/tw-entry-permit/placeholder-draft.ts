import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { Page } from "@playwright/test";

const PLACEHOLDER_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function imagePath(): string {
  const file = path.join(os.tmpdir(), "viza-tw-entry-placeholder.png");
  if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(PLACEHOLDER_PNG, "base64"));
  return file;
}

/** Explicit smoke-only fill. It never solves the final CAPTCHA or submits. */
export async function fillTaiwanPlaceholderDraft(page: Page): Promise<{ filled: number; selected: number; uploaded: number }> {
  if (process.env.TW_ENTRY_PERMIT_PLACEHOLDER_FILL_ENABLED !== "true") {
    throw new Error("TW_ENTRY_PERMIT_PLACEHOLDER_FILL_ENABLED=true is required for placeholder filling.");
  }
  const values: Record<string, string> = {
    "traveller.chineseName": "測試申請人",
    "traveller.englishName": "TEST APPLICANT",
    "traveller.birthDate": "1990-01-01",
    "traveller.passportNo": "E12345678",
    "traveller.passportExpiryDate": "2030-07-13",
    "traveller.overseaIdNo": "TESTSG1234",
    "traveller.xtel": "65123456",
    "traveller.resume": "TEST ONLY",
    "traveller.address": "1 TEST STREET",
    "traveller.village": "TEST",
    "traveller.road": "TEST ROAD",
    "traveller.number": "1",
  };
  let filled = 0; let selected = 0;
  for (const [name, value] of Object.entries(values)) {
    const input = page.locator(`[name='${name}']`).first();
    if (await input.isVisible().catch(() => false)) { await input.fill(value); filled += 1; }
  }
  for (const name of ["continent", "overseaOfficeId", "traveller.applyCnt", "traveller.gender", "traveller.birthPlaceCode", "traveller.occupation", "traveller.partnerOfTaiwan", "traveller.accompanyMark"]) {
    const select = page.locator(`select[name='${name}']`).first();
    const value = await select.locator("option:not([disabled])").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).find(Boolean)).catch(() => "");
    if (value && await select.isVisible().catch(() => false)) { await select.selectOption(value); selected += 1; if (name === "continent") await page.waitForTimeout(500); }
  }
  const image = imagePath(); let uploaded = 0;
  for (const input of await page.locator("input[type='file']").all()) {
    if (await input.isVisible().catch(() => false)) { await input.setInputFiles(image); uploaded += 1; }
  }
  return { filled, selected, uploaded };
}
