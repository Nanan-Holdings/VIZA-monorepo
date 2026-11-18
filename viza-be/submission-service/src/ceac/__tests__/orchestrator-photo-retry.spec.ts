import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { test } from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium, type Page } from "@playwright/test";
import { orchestrateFill } from "../orchestrator";
import { createRecoveryTracker } from "../artifacts";
import type { CeacSession } from "../session";

const UPLOAD_URL = "https://ceac.state.gov/GenNIV/General/photo/photo_uploadthephoto.aspx?node=UploadPhoto";
const CONFIRM_URL = "https://ceac.state.gov/GenNIV/General/photo/photo_confirmphoto.aspx?node=ConfirmPhoto";
const STOP = "test-stop-after-photo-step";

interface Fixture {
  /** Identix answers these 1-based upload attempts with its error page. */
  failingAttempts: (attempt: number) => boolean;
  /** CEAC renders a Next button on Upload Photo. */
  uploadNext: boolean;
  /** CEAC's Confirm Photo shows an enabled Review link without a photo. */
  reviewLinkWithoutPhoto: boolean;
}

async function installCeac(page: Page, fixture: Fixture): Promise<{ uploads: () => number }> {
  let uploads = 0;
  await page.route("https://ceac.state.gov/**", (route) => {
    const url = route.request().url();
    if (/photo_confirmphoto/i.test(url)) {
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><h2>Confirm Photo</h2>${fixture.reviewLinkWithoutPhoto
          ? '<a id="REVIEW" href="/GenNIV/General/review/review_reviewpersonal.aspx?node=ReviewPersonal">REVIEW</a>'
          : '<a id="REVIEW">REVIEW</a>'}`,
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
        <h2>Upload Photo</h2>
        <form action="https://identix.state.gov/qotw/Upload.aspx?handoff=synthetic-token" method="get">
          <input id="ctl00_cphMain_btnUploadPhoto" type="submit" value="Upload Photo">
        </form>
        ${fixture.uploadNext
          ? `<input type="submit" value="Next: Confirm Photo" onclick="window.location.href='${CONFIRM_URL}'; return false;">`
          : ""}`,
    });
  });
  await page.route("https://identix.state.gov/**", (route) => {
    const url = route.request().url();
    if (/\/qotw\/Error\.html/i.test(url)) {
      return route.fulfill({ status: 500, contentType: "text/html", body: "<h1>Official photo service error</h1>" });
    }
    uploads += 1;
    const action = fixture.failingAttempts(uploads)
      ? "https://identix.state.gov/qotw/Error.html?aspxerrorpath=%2Fqotw%2FUpload.aspx"
      : CONFIRM_URL;
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
        <form action="${action}" method="get">
          <input id="ctl00_cphMain_imageFileUpload" type="file">
          <input id="ctl00_cphButtons_btnUpload" name="ctl00$cphButtons$btnUpload" type="image" class="next">
        </form>`,
    });
  });
  return { uploads: () => uploads };
}

function failureOf(result: Awaited<ReturnType<typeof orchestrateFill>>) {
  assert.equal(result.result.status, "failed");
  return result.result.status === "failed" ? result.result.error : undefined;
}

async function runPhotoStep(fixture: Fixture) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-photo-retry-"));
  try {
    const counters = await installCeac(page, fixture);
    await page.goto(UPLOAD_URL, { waitUntil: "domcontentloaded" });
    const session = { browser, context: page.context(), page, runId: "run-photo-retry", close: async () => browser.close() } satisfies CeacSession;
    const result = await orchestrateFill(session, {
      answers: {},
      profile: {},
      tracker: createRecoveryTracker({ runId: "run-photo-retry", delegate: { async record() {} } }),
      outputDir,
      photo: { kind: "buffer", buffer: Buffer.from("synthetic-photo"), filename: "synthetic.jpg", mimeType: "image/jpeg" },
      finalSubmit: { passportNumber: "P1234567" },
      maxPhotoUploadAttempts: 3,
      photoRetryBaseDelayMs: 0,
      // Stop the loop as soon as it moves past the photo step.
      assertActive: () => {
        if (/photo_confirmphoto|review/i.test(session.page.url())) throw new Error(STOP);
      },
    });
    return { result, uploads: counters.uploads() };
  } finally {
    await browser.close();
    rmSync(outputDir, { recursive: true, force: true });
  }
}

test("retries an Identix service error and continues once an attempt is accepted", async () => {
  const { result, uploads } = await runPhotoStep({
    failingAttempts: (attempt) => attempt === 1,
    uploadNext: true,
    reviewLinkWithoutPhoto: true,
  });
  assert.equal(uploads, 2);
  assert.ok(result.sectionCoverage.filled.includes("upload_photo"));
  assert.ok(!result.sectionCoverage.skipped.includes("upload_photo"));
  assert.equal(failureOf(result)?.message, STOP);
});

test("skips the photo through CEAC's own Next after every attempt fails", async () => {
  const { result, uploads } = await runPhotoStep({
    failingAttempts: () => true,
    uploadNext: true,
    reviewLinkWithoutPhoto: true,
  });
  assert.equal(uploads, 3);
  assert.ok(result.sectionCoverage.skipped.includes("upload_photo"));
  assert.ok(!result.sectionCoverage.filled.includes("upload_photo"));
  assert.equal(failureOf(result)?.message, STOP);
});

test("keeps the Identix error when CEAC will not continue without a photo", async () => {
  const { result, uploads } = await runPhotoStep({
    failingAttempts: () => true,
    uploadNext: true,
    reviewLinkWithoutPhoto: false,
  });
  assert.equal(uploads, 3);
  assert.equal(failureOf(result)?.name, "IdentixPhotoServiceError");
  assert.ok(!result.sectionCoverage.skipped.includes("upload_photo"));
});
