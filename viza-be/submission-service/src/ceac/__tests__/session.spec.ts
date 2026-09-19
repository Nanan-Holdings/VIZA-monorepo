import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { GateDetectedError } from "../errors";
import { gotoCeacStartPage } from "../start-page-navigation";
import { detectGate } from "../gates";
import { tryCaptureBootstrapDiagnostics } from "../diagnostics";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

let browser: Browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser.close(); });

it("preserves a failed bootstrap surface without serializing hidden input values", async () => {
  const page = await browser.newPage();
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-bootstrap-evidence-"));
  try {
    await page.setContent('<h2>Session expired</h2><input type="hidden" id="ViewState" value="PRIVATE-HIDDEN-STATE"><input id="captcha" value="PRIVATE-CAPTCHA-ANSWER">');
    await tryCaptureBootstrapDiagnostics(page, outputDir);
    const text = readFileSync(join(outputDir, "bootstrap-failure.json"), "utf8");
    assert.match(text, /Session expired/);
    assert.doesNotMatch(text, /PRIVATE-HIDDEN-STATE|PRIVATE-CAPTCHA-ANSWER/);
    assert.ok(readFileSync(join(outputDir, "bootstrap-failure.png")).length > 0);
  } finally {
    await page.close();
    if (dirname(resolve(outputDir)) !== resolve(tmpdir())) throw new Error("Unexpected diagnostic test path");
    rmSync(outputDir, { recursive: true, force: true });
  }
});

it("waits through an interstitial h2 until the CEAC form appears", async () => {
  const page = await browser.newPage();
  try {
    await page.route("https://ceac.state.gov/**", route => route.fulfill({
      contentType: "text/html",
      body: `<h2>Security verification</h2><script>setTimeout(()=>{document.body.innerHTML='<h2>Apply For a Nonimmigrant Visa</h2><select id="ctl00_ucLocation_ddlLocation"><option>BEJ</option></select>'},250)</script>`,
    }));
    await gotoCeacStartPage(page, 3000);
    assert.equal(await page.locator("h2").innerText(), "Apply For a Nonimmigrant Visa");
    assert.equal(await page.locator("select").count(), 1);
  } finally { await page.close(); }
});

it("preserves a definitive WAF block for structured gate classification", async () => {
  const page = await browser.newPage();
  try {
    await page.route("https://ceac.state.gov/**", route => route.fulfill({
      status: 403, contentType: "text/html", body: "<h2>Sorry, you have been blocked</h2>",
    }));
    await gotoCeacStartPage(page, 3000);
    assert.equal((await detectGate(page)).gated, true);
  } finally { await page.close(); }
});

it("classifies a persistent security-verification interstitial after bounded grace", async () => {
  const page = await browser.newPage();
  try {
    await page.route("https://ceac.state.gov/**", route => route.fulfill({
      contentType: "text/html",
      body: "<h2>Performing security verification</h2>",
    }));
    await assert.rejects(
      () => gotoCeacStartPage(page, 100, { verificationGraceMs: 100 }),
      (err: unknown) => {
        assert.ok(err instanceof GateDetectedError);
        assert.equal(err.code, "GATE_DETECTED");
        assert.equal(err.context.details?.gateKind, "anti_bot_text");
        assert.deepEqual(err.context.details?.matchedTextPatterns, ["security verification"]);
        return true;
      },
    );
  } finally { await page.close(); }
});

it("allows the recognized verification surface to clear during grace", async () => {
  const page = await browser.newPage();
  try {
    await page.route("https://ceac.state.gov/**", route => route.fulfill({
      contentType: "text/html",
      body: `<h2>Performing security verification</h2><script>setTimeout(()=>{document.body.innerHTML='<h2>Apply For a Nonimmigrant Visa</h2><select id="ctl00_ucLocation_ddlLocation"><option>BEJ</option></select>'},150)</script>`,
    }));
    await gotoCeacStartPage(page, 100, { verificationGraceMs: 500 });
    assert.equal(await page.locator("select").count(), 1);
  } finally { await page.close(); }
});

it("keeps unrelated readiness timeouts out of gate classification", async () => {
  const page = await browser.newPage();
  try {
    await page.route("https://ceac.state.gov/**", route => route.fulfill({
      contentType: "text/html",
      body: "<h2>CEAC maintenance</h2>",
    }));
    await assert.rejects(
      () => gotoCeacStartPage(page, 100, { verificationGraceMs: 100 }),
      (err: unknown) => {
        assert.ok(!(err instanceof GateDetectedError));
        assert.match(err instanceof Error ? err.message : String(err), /timeout/i);
        return true;
      },
    );
  } finally { await page.close(); }
});
