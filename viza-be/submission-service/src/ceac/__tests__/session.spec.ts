import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { installCeacPostbackMonitor, waitForAspNetPostback } from "../aspnet";
import { GateDetectedError } from "../errors";
import { assertNoGate, detectGate } from "../gates";
import { assertPage } from "../pages";
import { gotoCeacStartPage } from "../start-page-navigation";
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

it("keeps a cleared initial 403 challenge usable after the verified monitor install point", async () => {
  const page = await browser.newPage();
  let navigationCount = 0;
  try {
    await page.route("https://ceac.state.gov/GenNIV/**", async route => {
      const request = route.request();
      if (request.isNavigationRequest() && request.resourceType() === "document") {
        navigationCount += 1;
        if (navigationCount === 1) {
          await route.fulfill({
            status: 403,
            contentType: "text/html",
            body: `<h2>Cloudflare challenge</h2><script>location.replace('/GenNIV/Default.aspx?challenge=cleared')</script>`,
          });
          return;
        }
        await route.fulfill({
          contentType: "text/html",
          body: `<h2>Apply For a Nonimmigrant Visa</h2>
            <select id="ctl00_ucLocation_ddlLocation"><option>BEJ</option></select>
            <form method="post" action="/GenNIV/Default.aspx">
              <input type="submit" id="postback" value="Continue">
            </form>`,
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "text/plain", body: "ok" });
    });

    await gotoCeacStartPage(page, 3_000);
    await assertNoGate(page);
    await assertPage(page, "start");

    // This is the production ordering: the monitor starts after the initial
    // challenge has cleared and the start page has passed both guards.
    installCeacPostbackMonitor(page);
    const postback = waitForAspNetPostback(page, 2_000);
    await page.locator("#postback").click();
    await postback;
    assert.equal(navigationCount, 3);
    await assertPage(page, "start");
  } finally {
    await page.close();
  }
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
