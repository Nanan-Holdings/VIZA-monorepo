import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import {
  ensureEnglishDs160Confirmation,
  mergeUsProofStoragePaths,
  printOfficialDs160Confirmation,
  waitForDs160ConfirmationPage,
} from "../proof-artifacts";

test("mergeUsProofStoragePaths preserves submitted DS-160 result fields", () => {
  const merged = mergeUsProofStoragePaths(
    {
      country: "US",
      status: "submitted",
      applicationId: "AA00FLSF69",
      confirmationNumber: "AA00FLSF69",
      surnameFirst5: "CHEN",
      yearOfBirth: 2006,
      securityQuestion: "Question",
      securityAnswer: "DO_NOT_KNOW",
      embassyOrConsulate: "NSS",
      retrievalUrl: "https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=AA00FLSF69",
      confirmationPdfStoragePath: "existing/confirmation.pdf",
    },
    {
      applicationPdfStoragePath: "new/application.pdf",
      emailConfirmationPdfStoragePath: "new/email.pdf",
    },
  );

  assert.equal(merged.applicationId, "AA00FLSF69");
  assert.equal(merged.securityAnswer, "DO_NOT_KNOW");
  assert.equal(merged.confirmationPdfStoragePath, "existing/confirmation.pdf");
  assert.equal(merged.applicationPdfStoragePath, "new/application.pdf");
  assert.equal(merged.emailConfirmationPdfStoragePath, "new/email.pdf");
});

test("mergeUsProofStoragePaths rejects non-submitted DS-160 results", () => {
  assert.throws(
    () => mergeUsProofStoragePaths({ country: "US", status: "stopped_at_sign" }, {}),
    /submitted US DS-160 result/,
  );
});

test("waitForDs160ConfirmationPage does not accept the recovery security page as a proof page", async () => {
  const page = fakeProofPage([
    {
      body: "Security Question What is the given name of your mother's mother? Answer DO_NOT_KNOW Continue Cancel",
      printControls: 0,
      viewConfirmationControls: 0,
      continueControls: 0,
    },
  ]);

  await assert.rejects(
    () => waitForDs160ConfirmationPage(page as never),
    /CEAC confirmation page was not reached/,
  );
});

test("waitForDs160ConfirmationPage advances from recovery continue to official print controls", async () => {
  const page = fakeProofPage([
    {
      body: "Security Question What is the given name of your mother's mother? Answer DO_NOT_KNOW Continue Cancel",
      printControls: 0,
      viewConfirmationControls: 0,
      continueControls: 1,
    },
    {
      body: "Online Nonimmigrant Visa Application View Confirmation Page",
      printControls: 0,
      viewConfirmationControls: 1,
      continueControls: 0,
    },
    {
      body: "Print Confirmation Print Application Email Confirmation",
      printControls: 3,
      viewConfirmationControls: 0,
      continueControls: 0,
    },
  ]);

  await waitForDs160ConfirmationPage(page as never);
  assert.deepEqual(page.clicks, ["continue", "view"]);
});

test("ensureEnglishDs160Confirmation waits for a delayed language postback and reads English back", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(confirmationFixture({ delayedLanguagePostback: true }));

    await ensureEnglishDs160Confirmation(page, "AA00FLSF69");

    assert.equal(await page.locator("#ctl00_ddlLanguage").inputValue(), "en-US");
    assert.equal(await page.locator("#language-marker").innerText(), "Online Nonimmigrant Visa Application");
  } finally {
    await browser.close();
  }
});

test("ensureEnglishDs160Confirmation fails closed when CEAC has no English option", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(confirmationFixture({ includeEnglishOption: false }));

    await assert.rejects(
      () => ensureEnglishDs160Confirmation(page, "AA00FLSF69"),
      /does not expose one selectable English option/,
    );
  } finally {
    await browser.close();
  }
});

test("ensureEnglishDs160Confirmation preserves CEAC gate failures", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(confirmationFixture({ gateText: "Access denied" }));

    await assert.rejects(
      () => ensureEnglishDs160Confirmation(page, "AA00FLSF69"),
      (error: unknown) => (error as { code?: string }).code === "GATE_DETECTED",
    );
  } finally {
    await browser.close();
  }
});

test("printOfficialDs160Confirmation invokes the official same-page control once", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(confirmationFixture({ initiallyEnglish: true }));

    await printOfficialDs160Confirmation(page, "AA00FLSF69");

    assert.equal(await page.evaluate(() => (window as unknown as { __printClicks?: number }).__printClicks), 1);
  } finally {
    await browser.close();
  }
});

test("printOfficialDs160Confirmation rechecks the gate after the print action", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(confirmationFixture({ initiallyEnglish: true, postPrintMutation: "gate" }));

    await assert.rejects(
      () => printOfficialDs160Confirmation(page, "AA00FLSF69"),
      (error: unknown) => (error as { code?: string }).code === "GATE_DETECTED",
    );
    assert.equal(await page.evaluate(() => (window as unknown as { __printClicks?: number }).__printClicks), 1);
  } finally {
    await browser.close();
  }
});

test("printOfficialDs160Confirmation rechecks application identity after the print action", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(confirmationFixture({ initiallyEnglish: true, postPrintMutation: "identity" }));

    await assert.rejects(
      () => printOfficialDs160Confirmation(page, "AA00FLSF69"),
      /CEAC English confirmation page identity could not be verified/,
    );
    assert.equal(await page.evaluate(() => (window as unknown as { __printClicks?: number }).__printClicks), 1);
  } finally {
    await browser.close();
  }
});

function fakeProofPage(
  states: Array<{
    body: string;
    printControls: number;
    viewConfirmationControls: number;
    continueControls: number;
  }>,
) {
  let index = 0;
  const current = () => states[Math.min(index, states.length - 1)]!;
  const clicks: string[] = [];
  return {
    clicks,
    locator(selector: string) {
      const kind = selector.includes("Print Confirmation") ||
        selector.includes("Print Application") ||
        selector.includes("Email Confirmation")
        ? "print"
        : selector.includes("View Confirmation") || selector.includes("radConfirmPage")
          ? "view"
          : selector.includes("Continue")
            ? "continue"
            : "body";
      return {
        first() {
          return this;
        },
        count: async () => {
          if (kind === "print") return current().printControls;
          if (kind === "view") return current().viewConfirmationControls;
          if (kind === "continue") return current().continueControls;
          return 1;
        },
        innerText: async () => current().body,
        click: async () => {
          clicks.push(kind);
          index += 1;
        },
        evaluate: async () => {
          clicks.push(kind);
          index += 1;
        },
      };
    },
    waitForLoadState: async () => undefined,
    waitForTimeout: async () => undefined,
  };
}

function confirmationFixture(options: {
  delayedLanguagePostback?: boolean;
  includeEnglishOption?: boolean;
  initiallyEnglish?: boolean;
  gateText?: string;
  postPrintMutation?: "gate" | "identity";
} = {}): string {
  const includeEnglishOption = options.includeEnglishOption ?? true;
  const initiallyEnglish = options.initiallyEnglish ?? false;
  const languageOptions = [
    `<option value="zh-CN"${initiallyEnglish ? "" : " selected"}>中文</option>`,
    ...(includeEnglishOption ? [`<option value="en-US"${initiallyEnglish ? " selected" : ""}>English</option>`] : []),
  ].join("");
  const initialMarker = initiallyEnglish ? "Online Nonimmigrant Visa Application" : "中文确认页";
  const delay = options.delayedLanguagePostback ? 250 : 0;
  const gateText = options.gateText ?? "";
  const postPrintMutation = options.postPrintMutation === "gate"
    ? "document.body.insertAdjacentText('beforeend', ' Access denied');"
    : options.postPrintMutation === "identity"
      ? "document.getElementById('ctl00_SiteContentPlaceHolder_lblID').textContent = 'WRONGID';"
      : "";
  return `<!doctype html>
    <html><body>
      <h2>Thank You</h2>
      <div>${gateText}</div>
      <select id="ctl00_ddlLanguage">${languageOptions}</select>
      <input id="ctl00_SiteContentPlaceHolder_FormView1_btnPrintConfirm" type="button" value="Print Confirmation" onclick="window.__printClicks = (window.__printClicks || 0) + 1; ${postPrintMutation} window.print();">
      <input id="ctl00_SiteContentPlaceHolder_FormView1_btnPrintApp" type="button" value="Print Application" disabled>
      <input id="ctl00_SiteContentPlaceHolder_FormView1_btnEmailConfirm" type="button" value="Email Confirmation">
      <span id="ctl00_SiteContentPlaceHolder_lblID">AA00FLSF69</span>
      <div id="language-marker">${initialMarker}</div>
      <script>
        window.__mgr = {
          busy: false,
          handlers: [],
          get_isInAsyncPostBack: function() { return this.busy; },
          add_endRequest: function(handler) { this.handlers.push(handler); },
          remove_endRequest: function(handler) { this.handlers = this.handlers.filter(function(item) { return item !== handler; }); }
        };
        window.Sys = { WebForms: { PageRequestManager: { getInstance: function() { return window.__mgr; } } } };
        document.getElementById("ctl00_ddlLanguage").addEventListener("change", function() {
          window.__mgr.busy = true;
          window.setTimeout(function() {
            var english = document.getElementById("ctl00_ddlLanguage").value === "en-US";
            document.getElementById("language-marker").textContent = english ? "Online Nonimmigrant Visa Application" : "中文确认页";
            window.__mgr.busy = false;
            window.__mgr.handlers.slice().forEach(function(handler) { handler(null, { get_error: function() { return null; } }); });
          }, ${delay});
        });
      </script>
    </body></html>`;
}
