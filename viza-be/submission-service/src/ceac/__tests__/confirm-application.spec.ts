import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { handleConfirmApplicationPage } from "../confirm-application";

let browser: Browser;
let diagnosticDir: string;
let previousDiagnosticDir: string | undefined;

before(async () => {
  browser = await chromium.launch({ headless: true });
  diagnosticDir = mkdtempSync(join(tmpdir(), "viza-ceac-confirm-"));
  previousDiagnosticDir = process.env.CEAC_DIAG_OUT_DIR;
  process.env.CEAC_DIAG_OUT_DIR = diagnosticDir;
});

after(async () => {
  await browser.close();
  if (previousDiagnosticDir === undefined) delete process.env.CEAC_DIAG_OUT_DIR;
  else process.env.CEAC_DIAG_OUT_DIR = previousDiagnosticDir;
  rmSync(diagnosticDir, { recursive: true, force: true });
});

async function confirmPage(): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent(`
    <main>
      <label for="ctl00_SiteContentPlaceHolder_chkbxPrivacyAct">Privacy Act</label>
      <input id="ctl00_SiteContentPlaceHolder_chkbxPrivacyAct"
        name="ctl00$SiteContentPlaceHolder$chkbxPrivacyAct" type="checkbox">
      <div id="ctl00_SiteContentPlaceHolder_lblBarcode">Application ID AA00ABC123</div>
      <select id="ctl00_SiteContentPlaceHolder_ddlQuestions">
        <option value="1">What is your first pet's name?</option>
        <option value="3">What is your maternal grandmother's maiden name?</option>
      </select>
      <input id="ctl00_SiteContentPlaceHolder_txtAnswer" type="text">
      <button id="ctl00_SiteContentPlaceHolder_btnContinue" type="button"
        onclick="document.body.dataset.continued = 'yes'">Continue</button>
    </main>
  `);
  return page;
}

test("runs the optional checkpoint callback before Continue", async () => {
  const page = await confirmPage();
  try {
    const expectedCheckpoint = {
      applicationId: "AA00ABC123",
      securityQuestionValue: "3",
      securityQuestionText: "What is your maternal grandmother's maiden name?",
      securityAnswer: "RECOVERY-ANSWER",
    };
    let callbackCheckpoint: typeof expectedCheckpoint | null = null;

    const result = await handleConfirmApplicationPage(page, {
      securityAnswer: "RECOVERY-ANSWER",
      securityQuestionValue: "3",
      timeoutMs: 1_000,
      onBeforeContinue: async (checkpoint) => {
        assert.equal(await page.locator("body").getAttribute("data-continued"), null);
        callbackCheckpoint = checkpoint;
      },
    });

    assert.deepEqual(callbackCheckpoint, expectedCheckpoint);
    assert.deepEqual(result, {
      ...expectedCheckpoint,
      postContinueUrl: "about:blank",
    });
    assert.equal(await page.locator("body").getAttribute("data-continued"), "yes");
  } finally {
    await page.close();
  }
});

test("does not click Continue when checkpoint persistence rejects", async () => {
  const page = await confirmPage();
  try {
    await assert.rejects(
      () => handleConfirmApplicationPage(page, {
        securityAnswer: "RECOVERY-ANSWER",
        securityQuestionValue: "3",
        timeoutMs: 1_000,
        onBeforeContinue: () => {
          throw new Error("checkpoint persistence failed");
        },
      }),
      /checkpoint persistence failed/,
    );
    assert.equal(await page.locator("body").getAttribute("data-continued"), null);
  } finally {
    await page.close();
  }
});
