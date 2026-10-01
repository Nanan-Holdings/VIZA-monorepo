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
const FIXTURE_STAGE_NAME = "stage";
const FIXTURE_STAGE_VALUE = "send";
const FIXTURE_SUBMITTER_NAME = "fixtureEmailButton";
const FIXTURE_SUBMITTER_VALUE = "Email Confirmation";
const FIXTURE_RADIO_NAME = "fixtureAdditionalEmailChoice";
const FIXTURE_NO_VALUE = "No";
const FIXTURE_YES_VALUE = "Yes";
const FIXTURE_VIEWSTATE_NAME = "__VIEWSTATE";
const FIXTURE_VIEWSTATE_VALUE = "fixture-view-state-token";
const FIXTURE_EVENT_VALIDATION_NAME = "__EVENTVALIDATION";
const FIXTURE_EVENT_VALIDATION_VALUE = "fixture-event-validation-token";
const MUTATED_NO_VALUE = "No-after-fence";
const MUTATED_VIEWSTATE_VALUE = "fixture-view-state-after-fence";
const MUTATED_EVENT_VALIDATION_VALUE = "fixture-event-validation-after-fence";
const FIXTURE_UNEXPECTED_NAME = "fixtureUnexpectedKey";

type FixtureFormVariant = "native" | "mutated" | "omit_submitter" | "duplicate_unexpected";

interface FixtureNativePostShape {
  exactExpectedPairs: boolean;
  submitterPairCount: number;
  noRadioPairCount: number;
  yesRadioPairPresent: boolean;
  viewstatePairCount: number;
  eventValidationPairCount: number;
  unexpectedPairCount: number;
  unexpectedDuplicateKeyCount: number;
}

interface FixturePostObservation {
  nativeFinalPostCount: number;
  lastNativePost?: FixtureNativePostShape;
}

const fixturePostObservations = new WeakMap<Page, FixturePostObservation>();

function fixturePostObservation(page: Page): FixturePostObservation {
  const observation = fixturePostObservations.get(page);
  assert.ok(observation);
  return observation;
}

function summarizeNativePost(postData: string, variant: FixtureFormVariant): FixtureNativePostShape {
  const params = new URLSearchParams(postData);
  const pairs = [...params.entries()];
  const count = (name: string): number => params.getAll(name).length;
  const hasExactPair = (name: string, value: string): boolean => {
    const values = params.getAll(name);
    return values.length === 1 && values[0] === value;
  };
  const expectedNoValue = variant === "mutated" ? MUTATED_NO_VALUE : FIXTURE_NO_VALUE;
  const expectedViewstateValue = variant === "mutated" ? MUTATED_VIEWSTATE_VALUE : FIXTURE_VIEWSTATE_VALUE;
  const expectedEventValidationValue = variant === "mutated"
    ? MUTATED_EVENT_VALIDATION_VALUE : FIXTURE_EVENT_VALIDATION_VALUE;
  const knownNames = new Set([
    FIXTURE_STAGE_NAME, FIXTURE_SUBMITTER_NAME, FIXTURE_RADIO_NAME,
    FIXTURE_VIEWSTATE_NAME, FIXTURE_EVENT_VALIDATION_NAME,
  ]);
  const keyCounts = new Map<string, number>();
  for (const [name] of pairs) keyCounts.set(name, (keyCounts.get(name) ?? 0) + 1);
  const unexpectedEntries = pairs.filter(([name]) => !knownNames.has(name));
  const unexpectedKeys = [...keyCounts].filter(([name]) => !knownNames.has(name));
  const unexpectedPairCount = unexpectedEntries.length;
  const unexpectedDuplicateKeyCount = unexpectedKeys.filter(([, keyCount]) => keyCount > 1).length;
  const expectedPairsMatch = hasExactPair(FIXTURE_STAGE_NAME, FIXTURE_STAGE_VALUE)
    && hasExactPair(FIXTURE_SUBMITTER_NAME, FIXTURE_SUBMITTER_VALUE)
    && hasExactPair(FIXTURE_RADIO_NAME, expectedNoValue)
    && hasExactPair(FIXTURE_VIEWSTATE_NAME, expectedViewstateValue)
    && hasExactPair(FIXTURE_EVENT_VALIDATION_NAME, expectedEventValidationValue);
  return {
    exactExpectedPairs: expectedPairsMatch && unexpectedPairCount === 0,
    submitterPairCount: count(FIXTURE_SUBMITTER_NAME),
    noRadioPairCount: count(FIXTURE_RADIO_NAME),
    yesRadioPairPresent: params.getAll(FIXTURE_RADIO_NAME).includes(FIXTURE_YES_VALUE),
    viewstatePairCount: count(FIXTURE_VIEWSTATE_NAME),
    eventValidationPairCount: count(FIXTURE_EVENT_VALIDATION_NAME),
    unexpectedPairCount,
    unexpectedDuplicateKeyCount,
  };
}

test("sends the official email once after exact recipient and No readback", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "success" });
    let ownershipChecks = 0;
    let fenceCalls = 0;
    let submittedFormMetadata: unknown;

    const result = await sendOfficialDs160ConfirmationEmail({
      page,
      expectedApplicationId: APPLICATION_ID,
      verifiedRecipient: RECIPIENT,
      assertOwned: () => { ownershipChecks += 1; },
      beforeSend: () => { fenceCalls += 1; },
      onSubmittedFormMetadata: metadata => { submittedFormMetadata = metadata; },
      overallTimeoutMs: 10_000,
    });

    assert.equal(result.status, "sent");
    assert.equal(result.applicationIdVerified, true);
    assert.equal(result.recipientVerified, true);
    assert.equal(fenceCalls, 1);
    assert.equal(ownershipChecks, 4);
    assert.equal(result.diagnostics.sendAttempted, true);
    assert.match(result.diagnostics.receiptEvidenceHash ?? "", /^[a-f0-9]{64}$/);
    assert.ok(result.diagnostics.events.some(event => event.path === EMAIL_PATH && event.status === 200));
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
    assert.equal(await page.locator("#ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_1").isChecked({ timeout: 100 }).catch(() => false), false);
    assert.deepEqual(fixturePostObservation(page), {
      nativeFinalPostCount: 1,
      lastNativePost: {
        exactExpectedPairs: true,
        submitterPairCount: 1,
        noRadioPairCount: 1,
        yesRadioPairPresent: false,
        viewstatePairCount: 1,
        eventValidationPairCount: 1,
        unexpectedPairCount: 0,
        unexpectedDuplicateKeyCount: 0,
      },
    });
    assert.deepEqual(submittedFormMetadata, {
      bodyAvailable: true,
      urlEncoded: true,
      bounded: true,
      pageFormObserved: true,
      submitterPairCount: 1,
      submitterPairMatches: true,
      noRadioPairCount: 1,
      noRadioPairMatches: true,
      yesRadioPairPresent: false,
      viewstatePairsMatch: true,
      eventValidationPairsMatch: true,
      successfulControlsMatch: true,
      missingPairCount: 0,
      unexpectedPairCount: 0,
      unexpectedDuplicateKeyCount: 0,
      unsupportedControlCount: 0,
    });
    assert.doesNotMatch(JSON.stringify(submittedFormMetadata), /fixtureEmailButton|fixtureAdditionalEmailChoice|fixture-view-state|fixture-event-validation|Email Confirmation|No|Yes/);
  } finally {
    await browser.close();
  }
});

test("captures the post shape after the fence mutates the current native form", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "success", formVariant: "mutated" });
    let submittedFormMetadata: unknown;
    const result = await sendOfficialDs160ConfirmationEmail({
      page,
      expectedApplicationId: APPLICATION_ID,
      verifiedRecipient: RECIPIENT,
      assertOwned: () => undefined,
      beforeSend: async () => {
        await page.locator(`#${"ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_1"}`).evaluate((element, values) => {
          const radio = element as HTMLInputElement;
          radio.value = values.noValue;
        }, { noValue: MUTATED_NO_VALUE });
        await page.locator(`input[name="${FIXTURE_VIEWSTATE_NAME}"]`).evaluate((element, value) => {
          (element as HTMLInputElement).value = value;
        }, MUTATED_VIEWSTATE_VALUE);
        await page.locator(`input[name="${FIXTURE_EVENT_VALIDATION_NAME}"]`).evaluate((element, value) => {
          (element as HTMLInputElement).value = value;
        }, MUTATED_EVENT_VALIDATION_VALUE);
      },
      onSubmittedFormMetadata: metadata => { submittedFormMetadata = metadata; },
      overallTimeoutMs: 10_000,
    });

    assert.equal(result.status, "sent");
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
    assert.deepEqual(fixturePostObservation(page), {
      nativeFinalPostCount: 1,
      lastNativePost: {
        exactExpectedPairs: true,
        submitterPairCount: 1,
        noRadioPairCount: 1,
        yesRadioPairPresent: false,
        viewstatePairCount: 1,
        eventValidationPairCount: 1,
        unexpectedPairCount: 0,
        unexpectedDuplicateKeyCount: 0,
      },
    });
    assert.deepEqual(submittedFormMetadata, {
      bodyAvailable: true,
      urlEncoded: true,
      bounded: true,
      pageFormObserved: true,
      submitterPairCount: 1,
      submitterPairMatches: true,
      noRadioPairCount: 1,
      noRadioPairMatches: true,
      yesRadioPairPresent: false,
      viewstatePairsMatch: true,
      eventValidationPairsMatch: true,
      successfulControlsMatch: true,
      missingPairCount: 0,
      unexpectedPairCount: 0,
      unexpectedDuplicateKeyCount: 0,
      unsupportedControlCount: 0,
    });
    assert.doesNotMatch(JSON.stringify(submittedFormMetadata), /fixtureEmailButton|fixtureAdditionalEmailChoice|fixture-view-state|fixture-event-validation|Email Confirmation|No-after-fence/);
  } finally {
    await browser.close();
  }
});

test("reports an omitted submitter pair without changing one-shot send behavior", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "success", formVariant: "omit_submitter" });
    let submittedFormMetadata: unknown;
    const result = await sendOfficialDs160ConfirmationEmail({
      page,
      expectedApplicationId: APPLICATION_ID,
      verifiedRecipient: RECIPIENT,
      assertOwned: () => undefined,
      beforeSend: () => undefined,
      onSubmittedFormMetadata: metadata => { submittedFormMetadata = metadata; },
      overallTimeoutMs: 10_000,
    });

    assert.equal(result.status, "sent");
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
    const observation = fixturePostObservation(page);
    assert.equal(observation.nativeFinalPostCount, 1);
    assert.equal(observation.lastNativePost?.submitterPairCount, 0);
    assert.equal(observation.lastNativePost?.exactExpectedPairs, false);
    assert.deepEqual(submittedFormMetadata, {
      bodyAvailable: true,
      urlEncoded: true,
      bounded: true,
      pageFormObserved: true,
      submitterPairCount: 0,
      submitterPairMatches: false,
      noRadioPairCount: 1,
      noRadioPairMatches: true,
      yesRadioPairPresent: false,
      viewstatePairsMatch: true,
      eventValidationPairsMatch: true,
      successfulControlsMatch: false,
      missingPairCount: 1,
      unexpectedPairCount: 0,
      unexpectedDuplicateKeyCount: 0,
      unsupportedControlCount: 0,
    });
    assert.doesNotMatch(JSON.stringify(submittedFormMetadata), /fixtureEmailButton|fixtureAdditionalEmailChoice|fixture-view-state|fixture-event-validation|Email Confirmation/);
  } finally {
    await browser.close();
  }
});

test("reports duplicate unexpected native keys without creating another send", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "success", formVariant: "duplicate_unexpected" });
    let submittedFormMetadata: unknown;
    const result = await sendOfficialDs160ConfirmationEmail({
      page,
      expectedApplicationId: APPLICATION_ID,
      verifiedRecipient: RECIPIENT,
      assertOwned: () => undefined,
      beforeSend: () => undefined,
      onSubmittedFormMetadata: metadata => { submittedFormMetadata = metadata; },
      overallTimeoutMs: 10_000,
    });

    assert.equal(result.status, "sent");
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
    const observation = fixturePostObservation(page);
    assert.equal(observation.nativeFinalPostCount, 1);
    assert.equal(observation.lastNativePost?.unexpectedPairCount, 2);
    assert.equal(observation.lastNativePost?.unexpectedDuplicateKeyCount, 1);
    assert.deepEqual(submittedFormMetadata, {
      bodyAvailable: true,
      urlEncoded: true,
      bounded: true,
      pageFormObserved: true,
      submitterPairCount: 1,
      submitterPairMatches: true,
      noRadioPairCount: 1,
      noRadioPairMatches: true,
      yesRadioPairPresent: false,
      viewstatePairsMatch: true,
      eventValidationPairsMatch: true,
      successfulControlsMatch: false,
      missingPairCount: 0,
      unexpectedPairCount: 2,
      unexpectedDuplicateKeyCount: 1,
      unsupportedControlCount: 0,
    });
    assert.doesNotMatch(JSON.stringify(submittedFormMetadata), /fixtureEmailButton|fixtureAdditionalEmailChoice|fixture-view-state|fixture-event-validation|fixtureUnexpectedKey|unexpected-one|unexpected-two/);
  } finally {
    await browser.close();
  }
});

test("does not click after ownership is lost following the send fence", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "success" });
    let owned = true;
    let fenceCalls = 0;

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => {
          if (!owned) throw new Error("lease lost");
        },
        beforeSend: () => {
          fenceCalls += 1;
          owned = false;
        },
        overallTimeoutMs: 10_000,
      }),
      (error: unknown) => error instanceof Error && error.message === "lease lost",
    );
    assert.equal(fenceCalls, 1);
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 0);
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

test("does not accept success text from an HTTP 500 response", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "server_error_success" });

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: () => undefined,
        dispatchTimeoutMs: 100,
        postbackTimeoutMs: 100,
        receiptTimeoutMs: 1_000,
        overallTimeoutMs: 3_000,
      }),
      (error: unknown) => {
        const typed = error as Ds160ConfirmationEmailError;
        assert.equal(typed.code, "ds160_email_receipt_unconfirmed");
        assert.equal(typed.diagnostics.dispatchClickTimedOut, true);
        assert.ok(typed.diagnostics.events.some(event =>
          event.kind === "response" && event.method === "POST" && event.path === EMAIL_PATH && event.status === 500,
        ));
        return true;
      },
    );
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
  } finally {
    await browser.close();
  }
});

test("waits for a delayed document response and preserves AppError as unconfirmed", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), {
      noisyAssets: true,
      delayedNoisyAssets: true,
      receipt: "delayed_app_error",
    });

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: () => undefined,
        dispatchTimeoutMs: 100,
        receiptTimeoutMs: 250,
        overallTimeoutMs: 3_000,
      }),
      (error: unknown) => {
        const typed = error as Ds160ConfirmationEmailError;
        assert.equal(typed.code, "ds160_email_receipt_unconfirmed");
        assert.equal(typed.diagnostics.dispatchClickTimedOut, true);
        assert.equal(typed.diagnostics.finalPath, EMAIL_PATH);
        assert.ok(typed.diagnostics.events.some(event =>
          event.kind === "response" && event.method === "POST" && event.path === EMAIL_PATH && event.status === 200,
        ));
        assert.ok(typed.diagnostics.events.length <= 64);
        return true;
      },
    );
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
  } finally {
    await browser.close();
  }
});

test("accepts a late explicit receipt after document navigation without a second POST", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "delayed_success" });
    const result = await sendOfficialDs160ConfirmationEmail({
      page,
      expectedApplicationId: APPLICATION_ID,
      verifiedRecipient: RECIPIENT,
      assertOwned: () => undefined,
      beforeSend: () => undefined,
      dispatchTimeoutMs: 100,
      receiptTimeoutMs: 500,
      overallTimeoutMs: 3_000,
    });

    assert.equal(result.status, "sent");
    assert.equal(result.diagnostics.finalPath, EMAIL_PATH);
    assert.ok(result.diagnostics.events.some(event =>
      event.kind === "response" && event.method === "POST" && event.path === EMAIL_PATH && event.status === 200,
    ));
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
  } finally {
    await browser.close();
  }
});

test("settles a same-page AJAX receipt without waiting for document navigation", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "ajax_success" });
    const result = await sendOfficialDs160ConfirmationEmail({
      page,
      expectedApplicationId: APPLICATION_ID,
      verifiedRecipient: RECIPIENT,
      assertOwned: () => undefined,
      beforeSend: () => undefined,
      dispatchTimeoutMs: 100,
      postbackTimeoutMs: 1_000,
      receiptTimeoutMs: 1_000,
      overallTimeoutMs: 3_000,
    });

    assert.equal(result.status, "sent");
    assert.ok(result.diagnostics.elapsedMs < 2_500);
    assert.ok(result.diagnostics.events.some(event =>
      event.kind === "request" && event.phase === "send" && event.method === "POST" &&
      event.path === EMAIL_PATH && event.resourceType === "fetch",
    ));
    assert.equal(await page.evaluate(() => (window as unknown as { __sendClicks?: number }).__sendClicks), 1);
  } finally {
    await browser.close();
  }
});

test("keeps a send one-shot when its redirect cannot complete offline", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await installFixture(await browser.newPage(), { receipt: "redirect_unavailable" });
    let fenceCalls = 0;
    let sendRequests = 0;
    page.on("request", request => {
      if (request.method() === "POST" && request.postData()?.includes("stage=send")) {
        sendRequests += 1;
      }
    });

    await assert.rejects(
      () => sendOfficialDs160ConfirmationEmail({
        page,
        expectedApplicationId: APPLICATION_ID,
        verifiedRecipient: RECIPIENT,
        assertOwned: () => undefined,
        beforeSend: () => { fenceCalls += 1; },
        controlTimeoutMs: 1_000,
        postbackTimeoutMs: 100,
        dispatchTimeoutMs: 100,
        receiptTimeoutMs: 250,
        overallTimeoutMs: 2_000,
      }),
      (error: unknown) => {
        const typed = error as Ds160ConfirmationEmailError;
        assert.equal(typed.code, "ds160_email_receipt_unconfirmed");
        assert.equal(typed.diagnostics.sendAttempted, true);
        assert.ok(typed.diagnostics.events.some(event =>
          event.kind === "response"
          && event.phase === "send"
          && event.method === "POST"
          && event.path === EMAIL_PATH
          && event.status === 302,
        ));
        return true;
      },
    );
    assert.equal(fenceCalls, 1);
    assert.equal(sendRequests, 1);
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
  receipt?: "success" | "gate" | "timeout" | "instruction" | "foreign" | "preexisting" | "server_error" | "server_error_success" | "redirect_unavailable" | "delayed_app_error" | "delayed_success" | "ajax_success";
  noisyAssets?: boolean;
  delayedNoisyAssets?: boolean;
  formVariant?: FixtureFormVariant;
} = {}): Promise<Page> {
  const recipient = options.recipient ?? RECIPIENT;
  const receipt = options.receipt ?? "success";
  const formVariant = options.formVariant ?? "native";
  const postObservation: FixturePostObservation = { nativeFinalPostCount: 0 };
  fixturePostObservations.set(page, postObservation);
  // Browser-followed redirects may bypass route handlers. Keep every fixture
  // offline so an unhandled redirect can never contact the official portal.
  await page.context().setOffline(true);
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
    const isFinalPost = request.method() === "POST"
      && new URLSearchParams(postData).get(FIXTURE_STAGE_NAME) === FIXTURE_STAGE_VALUE;
    if (isFinalPost) {
      if (receipt !== "ajax_success") {
        postObservation.nativeFinalPostCount += 1;
        postObservation.lastNativePost = summarizeNativePost(postData, formVariant);
      }
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
      if (receipt === "server_error_success") {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({ status: 500, contentType: "text/html", body: emailResultHtml("Email confirmation has been sent.") });
        return;
      }
      if (receipt === "redirect_unavailable") {
        await route.fulfill({
          status: 302,
          headers: { location: "https://ceac.state.gov/GenNIV/General/ESign/Complete_Done.aspx" },
          contentType: "text/html",
          body: "",
        });
        return;
      }
      if (receipt === "delayed_app_error" || receipt === "delayed_success") {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({
          contentType: "text/html",
          body: emailResultHtml(receipt === "delayed_success" ? "Email confirmation has been sent." : "Application Error"),
        });
        return;
      }
      if (receipt === "ajax_success") {
        await route.fulfill({ contentType: "text/plain", body: "ok" });
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
        receipt === "ajax_success",
        formVariant,
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

function emailHtml(
  recipient: string,
  receiptText = "",
  noisyAssets = false,
  ajaxSubmit = false,
  formVariant: FixtureFormVariant = "native",
): string {
  const noise = noisyAssets
    ? Array.from({ length: 96 }, (_, index) => `<img src="/GenNIV/noise/${index}.gif" alt="">`).join("")
    : "";
  const sendButtonAction = ajaxSubmit
    ? `event.preventDefault(); window.__sendClicks = (window.__sendClicks || 0) + 1; fetch('${EMAIL_PATH}', { method: 'POST', body: 'stage=send' }).then(() => document.body.insertAdjacentHTML('beforeend', '<div>Email confirmation has been sent.</div>'));`
    : "window.__sendClicks = (window.__sendClicks || 0) + 1;";
  const formVariantScript = formVariant === "omit_submitter"
    ? `<script>document.querySelector('form').addEventListener('formdata', event => event.formData.delete('${FIXTURE_SUBMITTER_NAME}'));</script>`
    : formVariant === "duplicate_unexpected"
      ? `<script>document.querySelector('form').addEventListener('formdata', event => { event.formData.append('${FIXTURE_UNEXPECTED_NAME}', 'unexpected-one'); event.formData.append('${FIXTURE_UNEXPECTED_NAME}', 'unexpected-two'); });</script>`
      : "";
  return `<!doctype html><html><body>
    <h2>Email Confirmation</h2>
    <div>Saved recipient: ${recipient}</div>
    ${receiptText ? `<div>${receiptText}</div>` : ""}
    ${noise}
    <form method="post" action="${EMAIL_PATH}">
      <input name="stage" value="send" type="hidden">
      <input type="hidden" name="${FIXTURE_VIEWSTATE_NAME}" value="${FIXTURE_VIEWSTATE_VALUE}">
      <input type="hidden" name="${FIXTURE_EVENT_VALIDATION_NAME}" value="${FIXTURE_EVENT_VALIDATION_VALUE}">
      <input id="ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_0" name="${FIXTURE_RADIO_NAME}" type="radio" value="${FIXTURE_YES_VALUE}">Yes
      <input id="ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_1" name="${FIXTURE_RADIO_NAME}" type="radio" value="${FIXTURE_NO_VALUE}">No
    <input id="ctl00_SiteContentPlaceHolder_EmailButton" name="${FIXTURE_SUBMITTER_NAME}" type="submit" value="${FIXTURE_SUBMITTER_VALUE}" onclick="${sendButtonAction}">
    </form>
    ${formVariantScript}
    <script>window.__sendClicks = window.__sendClicks || 0;</script>
  </body></html>`;
}

function emailResultHtml(body: string): string {
  return `<html><body>${body}<script>window.__sendClicks = 1;</script></body></html>`;
}
