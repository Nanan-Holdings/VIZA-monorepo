import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium, type Page } from "@playwright/test";
import {
  Ds160ConfirmationEmailError,
  sendOfficialDs160ConfirmationEmail,
} from "../confirmation-email";

const APPLICATION_ID = "AA00FLSF69";
const RECIPIENT = "verified@example.invalid";
const CONFIRMATION_PATH = "/GenNIV/General/ESign/Complete_Done_Confirmation.aspx";
const EMAIL_PATH = "/GenNIV/common/email.aspx";

test("sends the official email once after exact recipient and No readback", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "success" });
    let ownershipChecks = 0;
    let fenceCalls = 0;

    const result = await sendOfficialDs160ConfirmationEmail({
      page,
      expectedApplicationId: APPLICATION_ID,
      verifiedRecipient: RECIPIENT,
      assertOwned: () => { ownershipChecks += 1; },
      beforeSend: () => { fenceCalls += 1; },
      overallTimeoutMs: 10_000,
    });

    assert.equal(result.status, "sent");
    assert.equal(result.applicationIdVerified, true);
    assert.equal(result.recipientVerified, true);
    assert.equal(fenceCalls, 1);
    assert.equal(ownershipChecks, 2);
    assert.equal(result.diagnostics.sendAttempted, true);
    assert.match(result.diagnostics.receiptEvidenceHash ?? "", /^[a-f0-9]{64}$/);
    assert.ok(result.diagnostics.events.some(event => event.path === EMAIL_PATH && event.status === 200));
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
    assert.equal(await page.locator("#ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_1").isChecked({ timeout: 100 }).catch(() => false), false);
  } finally {
    await browser.close();
  }
});

test("keeps the final POST request evidence bounded under noisy asset responses", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { noisyAssets: true });
    const result = await sendOfficialDs160ConfirmationEmail({
      page,
      expectedApplicationId: APPLICATION_ID,
      verifiedRecipient: RECIPIENT,
      assertOwned: () => undefined,
      beforeSend: async () => { await page.waitForTimeout(250); },
      overallTimeoutMs: 10_000,
    });

    assert.equal(result.status, "sent");
    assert.ok(result.diagnostics.events.length <= 64);
    assert.ok(result.diagnostics.events.some(event =>
      event.kind === "request"
      && event.phase === "send"
      && event.method === "POST"
      && event.path === EMAIL_PATH,
    ));
    assert.ok(result.diagnostics.events.every(event => !event.path.includes("?")));
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
  } finally {
    await browser.close();
  }
});

test("retains a hanging final POST and late 500 response while noisy assets finish", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), {
      noisyAssets: true,
      delayedNoisyAssets: true,
      receipt: "server_error",
    });

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: async () => { await page.waitForTimeout(50); },
        dispatchTimeoutMs: 100,
        postbackTimeoutMs: 100,
        receiptTimeoutMs: 1_000,
        overallTimeoutMs: 3_000,
      }),
      (error: unknown) => {
        const typed = error as Ds160ConfirmationEmailError;
        assert.equal(typed.code, "ds160_email_receipt_unconfirmed");
        assert.equal(typed.diagnostics.sendAttempted, true);
        assert.equal(typed.diagnostics.dispatchClickTimedOut, true);
        assert.ok(typed.diagnostics.events.length <= 64);
        assert.ok(typed.diagnostics.events.some(event =>
          event.kind === "request"
          && event.phase === "send"
          && event.method === "POST"
          && event.path === EMAIL_PATH,
        ));
        assert.ok(typed.diagnostics.events.some(event =>
          event.kind === "response"
          && event.phase === "send"
          && event.method === "POST"
          && event.path === EMAIL_PATH
          && event.status === 500,
        ));
        assert.ok(typed.diagnostics.events
          .filter(event => event.resourceType === "image")
          .every(event => event.phase !== "send"));
        return true;
      },
    );
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
  } finally {
    await browser.close();
  }
});

test("rejects a recipient mismatch before reserving or dispatching", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { recipient: "other@example.invalid" });
    let fenceCalls = 0;

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: () => { fenceCalls += 1; },
        overallTimeoutMs: 10_000,
      }),
      (error: unknown) => (error as Ds160ConfirmationEmailError).code === "ds160_email_recipient_mismatch",
    );
    assert.equal(fenceCalls, 0);
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 0);
  } finally {
    await browser.close();
  }
});

test("keeps the final click one-shot when CEAC returns a gate", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "gate" });

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: () => undefined,
        overallTimeoutMs: 10_000,
      }),
      (error: unknown) => (error as { code?: string }).code === "GATE_DETECTED",
    );
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
  } finally {
    await browser.close();
  }
});

test("does not retry an ambiguous final click without explicit receipt evidence", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "timeout" });

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: () => undefined,
        controlTimeoutMs: 1_000,
        postbackTimeoutMs: 100,
        dispatchTimeoutMs: 100,
        receiptTimeoutMs: 100,
        overallTimeoutMs: 2_000,
      }),
      (error: unknown) => (error as Ds160ConfirmationEmailError).code === "ds160_email_receipt_unconfirmed",
    );
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
  } finally {
    await browser.close();
  }
});

test("does not treat instructions to send an email as a receipt", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "instruction" });

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: () => undefined,
        receiptTimeoutMs: 250,
        overallTimeoutMs: 2_000,
      }),
      (error: unknown) => (error as Ds160ConfirmationEmailError).code === "ds160_email_receipt_unconfirmed",
    );
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
  } finally {
    await browser.close();
  }
});

test("rejects a pre-existing receipt before reserving another send", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "preexisting" });
    let fenceCalls = 0;

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: () => { fenceCalls += 1; },
        overallTimeoutMs: 2_000,
      }),
      (error: unknown) => (error as Ds160ConfirmationEmailError).code === "ds160_email_receipt_unconfirmed",
    );
    assert.equal(fenceCalls, 0);
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 0);
  } finally {
    await browser.close();
  }
});

test("does not accept a matching receipt after a foreign navigation", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "foreign" });
    let fenceCalls = 0;

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: () => { fenceCalls += 1; },
        receiptTimeoutMs: 500,
        overallTimeoutMs: 2_000,
      }),
      (error: unknown) => (error as Ds160ConfirmationEmailError).code === "ds160_email_receipt_unconfirmed",
    );
    assert.equal(fenceCalls, 1);
    assert.match(page.url(), /^https:\/\/foreign\.example\//);
  } finally {
    await browser.close();
  }
});

async function installFixture(page: Page, options: {
  recipient?: string;
  receipt?: "success" | "gate" | "timeout" | "instruction" | "foreign" | "preexisting" | "server_error";
  noisyAssets?: boolean;
  delayedNoisyAssets?: boolean;
} = {}): Promise<Page> {
  const recipient = options.recipient ?? RECIPIENT;
  const receipt = options.receipt ?? "success";
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== "https://ceac.state.gov") {
      await route.fulfill({ contentType: "text/html", body: "<html><body>Email confirmation has been sent.</body></html>" });
      return;
    }
    if (url.pathname === CONFIRMATION_PATH) {
      await route.fulfill({ contentType: "text/html", body: confirmationHtml() });
      return;
    }
    if (url.pathname.startsWith("/GenNIV/noise/")) {
      if (options.delayedNoisyAssets) await new Promise(resolve => setTimeout(resolve, 150));
      await route.fulfill({ contentType: "image/gif", body: "noise" });
      return;
    }
    if (url.pathname !== EMAIL_PATH) {
      await route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
      return;
    }
    const postData = request.postData() ?? "";
    if (request.method() === "POST" && postData.includes("stage=send")) {
      if (receipt === "timeout") {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({ contentType: "text/html", body: emailResultHtml(emailHtml(recipient)) });
        return;
      }
      if (receipt === "gate") {
        await route.fulfill({ status: 403, contentType: "text/html", body: emailResultHtml("Access denied") });
        return;
      }
      if (receipt === "server_error") {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({ status: 500, contentType: "text/html", body: emailResultHtml("Application Error") });
        return;
      }
      if (receipt === "instruction") {
        await route.fulfill({
          contentType: "text/html",
          body: emailResultHtml("Email will be sent after you review the instructions. Confirmation sent in the next step instructions."),
        });
        return;
      }
      if (receipt === "foreign") {
        await route.fulfill({
          contentType: "text/html",
          body: emailResultHtml("<script>location.href='https://foreign.example/success'</script>"),
        });
        return;
      }
      await route.fulfill({ contentType: "text/html", body: emailResultHtml("Email confirmation has been sent.") });
      return;
    }
    await route.fulfill({
      contentType: "text/html",
      body: emailHtml(
        recipient,
        receipt === "preexisting" ? "Email confirmation has been sent." : "",
        options.noisyAssets === true,
      ),
    });
  });
  await page.goto(`https://ceac.state.gov${CONFIRMATION_PATH}`, { waitUntil: "domcontentloaded" });
  return page;
}

function confirmationHtml(): string {
  return `<!doctype html><html><body>
    <h2>Thank You</h2>
    <span id="ctl00_SiteContentPlaceHolder_lblID">${APPLICATION_ID}</span>
    <form method="post" action="${EMAIL_PATH}">
      <input name="stage" value="open" type="hidden">
      <input id="ctl00_SiteContentPlaceHolder_FormView1_btnEmailConfirm" type="submit" value="Email Confirmation">
    </form>
    <input type="button" value="Print Confirmation">
    <input type="button" value="Print Application">
    <input type="button" value="Email Confirmation">
    <script>window.__sendClicks = window.__sendClicks || 0;</script>
  </body></html>`;
}

function emailHtml(recipient: string, receiptText = "", noisyAssets = false): string {
  const noise = noisyAssets
    ? Array.from({ length: 96 }, (_, index) => `<img src="/GenNIV/noise/${index}.gif" alt="">`).join("")
    : "";
  return `<!doctype html><html><body>
    <h2>Email Confirmation</h2>
    <div>Saved recipient: ${recipient}</div>
    ${receiptText ? `<div>${receiptText}</div>` : ""}
    ${noise}
    <form method="post" action="${EMAIL_PATH}">
      <input name="stage" value="send" type="hidden">
      <input id="ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_0" name="AdditionalEmailRadioList" type="radio" value="Yes">Yes
      <input id="ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_1" name="AdditionalEmailRadioList" type="radio" value="No">No
      <input id="ctl00_SiteContentPlaceHolder_EmailButton" type="submit" value="Email Confirmation" onclick="window.__sendClicks = (window.__sendClicks || 0) + 1;">
    </form>
    <script>window.__sendClicks = window.__sendClicks || 0;</script>
  </body></html>`;
}

function emailResultHtml(body: string): string {
  return `<html><body>${body}<script>window.__sendClicks = 1;</script></body></html>`;
}
