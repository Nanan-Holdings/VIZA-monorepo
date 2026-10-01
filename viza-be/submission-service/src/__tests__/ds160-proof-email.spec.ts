import assert from "node:assert/strict";
import test from "node:test";
import { chromium, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CeacSession } from "../ceac/session";
import type { ApplicantProfile, SubmissionQueueItem } from "../types";
import {
  captureDs160EmailPage, classifyDs160EmailFailure, ds160RecipientDigest, processDs160OfficialEmailJob,
  persistDs160EmailEvidence, type Ds160EmailFailureEvidence, type Ds160EmailJobDependencies,
} from "../ds160-proof-email";
import { GateDetectedError, NavigationError, SessionBootstrapError } from "../ceac/errors";

const queueId = "00000000-0000-4000-8000-000000000001";
const makeItem = (): SubmissionQueueItem => ({
  id: queueId, application_id: "fixture-application", provider: "ceac_proof",
  status: "ds160_proof_pending", attempts: 0, last_error: null,
  locked_by: "fixture-worker", locked_at: new Date().toISOString(),
  fv_result_payload: null, fv_application_reference: null, fv_pdf_storage_path: null,
  uk_result_payload: null, uk_application_reference: null, au_result_payload: null,
  au_trn: null, au_review_screenshot_storage_path: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  ceac_result_payload: { action: "official_ceac_email", email: {
    status: "queued", request_id: "00000000-0000-4000-8000-000000000002",
    recipient_sha256: ds160RecipientDigest("applicant@example.test"),
  } },
});

function fixture(options: {
  failBefore?: boolean;
  failAfter?: boolean;
  denyReserve?: boolean;
  closeFails?: boolean;
  recipientChanged?: boolean;
  reserved?: boolean;
  startError?: unknown;
  retrieveError?: unknown;
  capturePageOpen?: boolean;
  closePageAfterSend?: boolean;
  captureBodyFails?: boolean;
  captureScreenshotFails?: boolean;
  persistEvidence?: Ds160EmailJobDependencies["persistEvidence"];
} = {}) {
  const events: string[] = [];
  let settlement: Record<string, unknown> | undefined;
  let pageClosed = !(options.capturePageOpen ?? false);
  let bodyCaptureCount = 0;
  let screenshotCaptureCount = 0;
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      events.push(name);
      if (name === "renew_submission_queue_lease") return { data: [{ id: queueId, locked_until: new Date(Date.now() + 900_000).toISOString() }], error: null };
      if (name === "start_ds160_proof_email") {
        const item = makeItem();
        if (options.reserved) item.ceac_result_payload!.email = {
          ...(item.ceac_result_payload!.email as object), status: "sending", send_started_at: new Date().toISOString(),
        };
        return { data: [item], error: null };
      }
      if (name === "reserve_ds160_email_send" && options.denyReserve) return { data: [], error: null };
      if (name === "settle_ds160_proof_email") settlement = args;
      return { data: [{ id: queueId }], error: null };
    },
    from: (table: string) => {
      assert.equal(table, "applications");
      return { select: () => ({ eq: () => ({ single: async () => ({ error: null, data: {
        ds160_application_id: "AA00TEST00", submission_result: { country: "US", status: "submitted",
          applicationId: "AA00TEST00", surnameFirst5: "TEST", yearOfBirth: "1990", securityAnswer: "fixture" },
      } }) }) }) };
    },
    auth: { admin: { getUserById: async () => ({ error: null, data: { user: { email: options.recipientChanged ? "changed@example.test" : "applicant@example.test" } } }) } },
  } as unknown as SupabaseClient;
  const session = {
    page: {
      goto: async () => { events.push("goto"); },
      isClosed: () => pageClosed,
      url: () => "https://ceac.state.gov/GenNIV/common/email.aspx",
      locator: () => ({ innerText: async () => {
        events.push(bodyCaptureCount++ === 0 ? "pre_send_body" : "final_body");
        if (options.captureBodyFails) throw new Error("fixture body capture failure");
        return "private pre-send fixture body";
      } }),
      screenshot: async () => {
        events.push(screenshotCaptureCount++ === 0 ? "pre_send_screenshot" : "final_screenshot");
        if (options.captureScreenshotFails) throw new Error("fixture screenshot capture failure");
        return Buffer.from("private pre-send fixture screenshot");
      },
    },
    close: async () => { events.push("close"); if (options.closeFails) throw new Error("fixture close failure"); },
  } as unknown as CeacSession;
  const dependencies: Ds160EmailJobDependencies = {
    client, headless: true, leaseSeconds: 900,
    loadProfile: async () => ({ auth_user_id: "fixture-user" } as ApplicantProfile),
    loadAnswers: async () => ({ consular_post: "SHG" }),
    runtime: {
      startSession: async () => { events.push("open"); if (options.startError) throw options.startError; return session; },
      retrieve: async () => { events.push("retrieve"); if (options.retrieveError) throw options.retrieveError; },
      waitForConfirmation: async () => undefined,
      ensureEnglish: async () => undefined,
      sendEmail: async input => {
        if (options.failBefore) throw new Error("fixture pre-send failure");
        await input.beforeSend();
        events.push("send");
        if (options.closePageAfterSend) pageClosed = true;
        if (options.failAfter) throw new Error("fixture post-send failure");
        return { status: "sent", applicationIdVerified: true, recipientVerified: true,
          diagnostics: { sendAttempted: true, dispatchClickTimedOut: false, finalPath: "/GenNIV/common/email.aspx", elapsedMs: 1, events: [] } };
      },
    },
    ...(options.persistEvidence ? { persistEvidence: options.persistEvidence } : {}),
  };
  return { dependencies, events, settlement: () => settlement };
}

function failureEvidence(f: ReturnType<typeof fixture>): Ds160EmailFailureEvidence | undefined {
  const evidence = f.settlement()?.p_evidence;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return undefined;
  return (evidence as { failure?: Ds160EmailFailureEvidence }).failure;
}

test("official email reserves once, closes before settlement, and never mutates submitted application", async () => {
  const f = fixture();
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "sent");
  assert.equal(f.events.filter(x => x === "send").length, 1);
  assert.ok(f.events.indexOf("reserve_ds160_email_send") < f.events.indexOf("send"));
  assert.ok(f.events.indexOf("close") < f.events.indexOf("settle_ds160_proof_email"));
});

test("captures pre-send evidence before reserve and keeps it private when the final page closes", async () => {
  let encryptedPlaintext = "";
  const f = fixture({
    capturePageOpen: true,
    closePageAfterSend: true,
    persistEvidence: async input => persistDs160EmailEvidence(input, {
      encrypt: plaintext => { encryptedPlaintext = plaintext; return "encrypted-fixture"; },
      transport: { upload: async () => undefined, download: async () => null },
    }),
  });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "sent");
  const reserveIndex = f.events.indexOf("reserve_ds160_email_send");
  assert.ok(f.events.indexOf("pre_send_body") < reserveIndex);
  assert.ok(f.events.indexOf("pre_send_screenshot") < reserveIndex);
  const privateEvidence = JSON.parse(encryptedPlaintext) as Record<string, unknown>;
  const preSend = privateEvidence.preSend as Record<string, unknown>;
  assert.equal(preSend.body, "private pre-send fixture body");
  assert.equal(preSend.screenshotBase64, Buffer.from("private pre-send fixture screenshot").toString("base64"));
  assert.equal(preSend.path, "/GenNIV/common/email.aspx");
  assert.equal(privateEvidence.body, undefined);
  const publicEvidence = f.settlement()?.p_evidence as Record<string, unknown>;
  assert.ok(publicEvidence.audit);
  assert.deepEqual(publicEvidence.auditCaptureFailures, ["pre_send_form_metadata", "page_closed"]);
  assert.doesNotMatch(JSON.stringify(publicEvidence), /private pre-send fixture/);
});

test("captures redacted native and ASP.NET form metadata only in the encrypted pre-send bundle", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.context().setOffline(true);
    await page.route("**/*", async route => {
      await route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><body>
          <form method="post" action="https://evil.example/steal?private-token=secret#fragment" onsubmit="return false;">
            <input type="hidden" name="__VIEWSTATE" value="private-viewstate">
            <input type="hidden" name="__EVENTVALIDATION" value="">
            <input id="ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_1" name="AdditionalEmailRadioList" type="radio" value="No">
            <input id="ctl00_SiteContentPlaceHolder_AdditionalEmailRadioList_0" name="AdditionalEmailRadioList" type="radio" value="Yes" checked>
            <input id="native-invalid" name="required-control" type="text" required value="">
            <button id="ctl00_SiteContentPlaceHolder_EmailButton" type="submit" value="Email Confirmation">Email Confirmation</button>
          </form>
          <script>
            window.__pageClientValidateCalls = 0;
            window.__captureEvents = [];
            ['invalid', 'input', 'change', 'submit'].forEach(function (name) {
              document.addEventListener(name, function () { window.__captureEvents.push(name); }, true);
            });
            window.Page_IsValid = false;
            window.Page_Validators = [{isvalid:false, validationSummary:'private validator'}, {isvalid:true}];
            window.Page_ClientValidate = function () { window.__pageClientValidateCalls += 1; throw new Error('must not call'); };
          </script>
        </body></html>`,
      });
    });
    await page.goto("https://ceac.state.gov/GenNIV/common/email.aspx", { waitUntil: "domcontentloaded" });
    const preSendCapture = await captureDs160EmailPage(page, { captureFormMetadata: true });
    assert.ok(preSendCapture.formMetadata);
    const metadata = preSendCapture.formMetadata;
    assert.deepEqual(metadata.controls.no, {
      count: 1,
      states: [{ checked: false, disabled: false, type: "radio", namePresent: true, valuePresent: true }],
      statesTruncated: false,
    });
    assert.deepEqual(metadata.controls.yes, {
      count: 1,
      states: [{ checked: true, disabled: false, type: "radio", namePresent: true, valuePresent: true }],
      statesTruncated: false,
    });
    assert.deepEqual(metadata.controls.send, {
      count: 1,
      states: [{ checked: null, disabled: false, type: "submit", namePresent: false, valuePresent: true }],
      statesTruncated: false,
    });
    assert.equal(metadata.noYesSameGroup, true);
    assert.equal(metadata.noYesSameForm, true);
    assert.equal(metadata.sendSameForm, true);
    assert.equal(metadata.formCount, 1);
    assert.deepEqual(metadata.form, {
      method: "post",
      actionSafe: false,
      onsubmitHandlerPresent: true,
    });
    assert.deepEqual(metadata.nativeValidity, {
      eligibleCount: 4,
      validCount: 3,
      invalidCount: 1,
      allEligibleValid: false,
      anyInvalid: true,
    });
    assert.deepEqual(metadata.aspNetValidation, {
      pageIsValidAvailable: true,
      pageIsValid: false,
      validatorsAvailable: true,
      validatorCount: 2,
      validatorStatuses: [false, true],
      validValidatorCount: 1,
      invalidValidatorCount: 1,
      validatorStatusesTruncated: false,
    });
    assert.deepEqual(metadata.aspNetHiddenFields, {
      viewStatePresent: true,
      viewStateNonEmpty: true,
      eventValidationPresent: true,
      eventValidationNonEmpty: false,
    });
    assert.equal(await page.evaluate(() => (window as unknown as { __pageClientValidateCalls: number }).__pageClientValidateCalls), 0);
    assert.deepEqual(await page.evaluate(() => (window as unknown as { __captureEvents: string[] }).__captureEvents), []);

    let encryptedPlaintext = "";
    const result = await persistDs160EmailEvidence({
      page, jobId: queueId, runId: "ds160-email-metadata-fixture", outcome: "unknown", reserved: true,
      preSendCapture,
    }, {
      encrypt: plaintext => { encryptedPlaintext = plaintext; return "encrypted-metadata-fixture"; },
      transport: { upload: async () => undefined, download: async () => null },
    });
    assert.ok(result.audit);
    assert.doesNotMatch(JSON.stringify(result), /formMetadata|evil\.example|private-token|Page_Validators|AdditionalEmailRadioList/);
    const encrypted = JSON.parse(encryptedPlaintext) as Record<string, unknown>;
    const encryptedPreSend = encrypted.preSend as Record<string, unknown>;
    assert.deepEqual(encryptedPreSend.formMetadata, metadata);
    assert.doesNotMatch(encryptedPlaintext, /evil\.example|private-token|fragment|private-viewstate|AdditionalEmailRadioList/);

    await page.locator('form').evaluate(form => {
      form.setAttribute('action', 'https://ceac.state.gov/GenNIV/private-applicant-path?token=secret#fragment');
    });
    const redactedAction = await captureDs160EmailPage(page, { captureFormMetadata: true });
    assert.equal(redactedAction.formMetadata?.form?.actionSafe, false);
    assert.equal(redactedAction.formMetadata?.form?.actionPath, undefined);
    assert.doesNotMatch(JSON.stringify(redactedAction.formMetadata), /private-applicant-path|secret|fragment/);

    await page.locator('form').evaluate(form => {
      form.setAttribute('action', '/GenNIV/common/email.aspx?token=secret#fragment');
    });
    await page.evaluate(() => {
      const pageWindow = window as unknown as { Page_IsValid?: boolean; Page_Validators?: unknown };
      delete pageWindow.Page_IsValid;
      delete pageWindow.Page_Validators;
    });
    const uncomputedValidation = await captureDs160EmailPage(page, { captureFormMetadata: true });
    assert.equal(uncomputedValidation.formMetadata?.form?.actionPath, '/GenNIV/common/email.aspx');
    assert.deepEqual(uncomputedValidation.formMetadata?.aspNetValidation, {
      pageIsValidAvailable: false, validatorsAvailable: false,
    });
    assert.doesNotMatch(JSON.stringify(uncomputedValidation.formMetadata), /secret|fragment/);

    await page.goto('https://ceac.state.gov/GenNIV/Common/AppError.aspx', { waitUntil: 'domcontentloaded' });
    const wrongPageCapture = await captureDs160EmailPage(page, { captureFormMetadata: true });
    assert.equal(wrongPageCapture.formMetadata, undefined);
    const changedPage = {
      isClosed: () => false,
      url: () => 'https://ceac.state.gov/GenNIV/common/email.aspx',
      locator: page.locator.bind(page),
      screenshot: page.screenshot.bind(page),
      evaluate: page.evaluate.bind(page),
    } as unknown as Page;
    const racedCapture = await captureDs160EmailPage(changedPage, { captureFormMetadata: true });
    assert.equal(racedCapture.formMetadata, undefined);
    assert.deepEqual(racedCapture.captureFailures, ['form_metadata']);
  } finally {
    await browser.close();
  }
});

test("post-dispatch disconnect is unknown and never retried", async () => {
  const f = fixture({ failAfter: true });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "unknown");
  assert.equal(f.events.filter(x => x === "send").length, 1);
});

test("pre-dispatch failure settles failed without reserving or sending", async () => {
  const f = fixture({ failBefore: true });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "failed");
  assert.ok(!f.events.includes("reserve_ds160_email_send"));
});

test("typed bootstrap gate preserves safe phase, status, and classified code", async () => {
  const f = fixture({
    startError: new GateDetectedError("private gate details", {
      url: "https://ceac.state.gov/GenNIV/Default.aspx?private=secret",
      details: { status: 403, visibleTextSnippet: "private applicant text" },
    }),
  });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "failed");
  assert.equal(f.settlement()?.p_error_code, "ds160_email_gate_detected");
  assert.deepEqual(failureEvidence(f), {
    phase: "bootstrap", cause: "gate", ceacCode: "GATE_DETECTED", status: 403,
  });
  assert.doesNotMatch(JSON.stringify(f.settlement()), /private|secret|applicant/);
});

test("typed bootstrap error before session assignment preserves bootstrap phase without private context", async () => {
  const f = fixture({
    startError: new SessionBootstrapError("private bootstrap details", {
      url: "https://ceac.state.gov/GenNIV/Default.aspx?private=secret",
      details: { cause: "private applicant text", runId: "private-run" },
    }),
  });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "failed");
  assert.equal(f.settlement()?.p_error_code, "ds160_email_session_bootstrap_failed");
  assert.deepEqual(failureEvidence(f), {
    phase: "bootstrap", cause: "bootstrap", ceacCode: "SESSION_BOOTSTRAP_FAILED",
  });
  assert.doesNotMatch(JSON.stringify(f.settlement()), /private|secret|applicant/);
});

test("typed retrieval navigation timeout keeps a missing HTTP status and never copies its context", async () => {
  const f = fixture({
    retrieveError: new NavigationError("private navigation timeout", {
      url: "https://ceac.state.gov/GenNIV/Common/Retrieve.aspx?private=secret",
      details: { phase: "aspnet_postback", timeoutMs: 10_000 },
    }),
  });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "failed");
  assert.equal(f.settlement()?.p_error_code, "ds160_email_navigation_failed");
  assert.deepEqual(failureEvidence(f), {
    phase: "retrieve", cause: "navigation", ceacCode: "NAVIGATION_FAILED",
  });
  assert.doesNotMatch(JSON.stringify(f.settlement()), /private|secret|applicant/);
});

test("a typed failure after the send fence remains unknown without exposing a typed retry cause", () => {
  const result = classifyDs160EmailFailure(
    new GateDetectedError("private gate details", { details: { status: 403 } }),
    true,
    "send",
  );
  assert.deepEqual(result, { status: "unknown", code: "ds160_email_receipt_unconfirmed" });
});

test("untyped HTTP-looking bootstrap errors remain an unknown cause", async () => {
  const f = fixture({ startError: new Error("HTTP 403 from a private CEAC URL") });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "failed");
  assert.equal(f.settlement()?.p_error_code, "ds160_email_retrieval_failed");
  assert.deepEqual(failureEvidence(f), { phase: "bootstrap", cause: "unknown" });
  assert.doesNotMatch(JSON.stringify(f.settlement()), /HTTP 403|private|CEAC URL/);
});

test("fresh dispatch fence stops a stale claim before browser startup", async () => {
  const f = fixture({ reserved: true });
  const item = makeItem();
  await processDs160OfficialEmailJob(item, f.dependencies);
  assert.equal(f.settlement()?.p_status, "unknown");
  assert.ok(!f.events.includes("open"));
});

test("changed account email fails before opening CEAC", async () => {
  const f = fixture({ recipientChanged: true });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.equal(f.settlement()?.p_status, "failed");
  assert.ok(!f.events.includes("open"));
});

test("a denied dispatch fence cannot send", async () => {
  const f = fixture({ denyReserve: true });
  await processDs160OfficialEmailJob(makeItem(), f.dependencies);
  assert.ok(!f.events.includes("send"));
  assert.equal(f.settlement()?.p_status, "failed");
});

test("provider cleanup failure never publishes a terminal/retryable queue", async () => {
  const f = fixture({ closeFails: true });
  await assert.rejects(processDs160OfficialEmailJob(makeItem(), f.dependencies), /fixture close failure/);
  assert.equal(f.settlement(), undefined);
});

function auditFixture(options: { bodyFails?: boolean; screenshotFails?: boolean; closed?: boolean } = {}) {
  const body = "Private fixture recipient applicant@example.test: Application Error";
  let encryptedPlaintext = "";
  let uploaded = "";
  const page = {
    isClosed: () => options.closed ?? false,
    url: () => "https://ceac.state.gov/GenNIV/Common/AppError.aspx?private=value",
    locator: () => ({ innerText: async () => {
      if (options.bodyFails) throw new Error("private capture error");
      return body;
    } }),
    screenshot: async () => {
      if (options.screenshotFails) throw new Error("private screenshot error");
      return Buffer.from("fixture screenshot");
    },
  } as unknown as Page;
  const input = { page, jobId: queueId, runId: "ds160-email-fixture", outcome: "unknown" as const, reserved: true };
  const dependencies = {
    encrypt: (plaintext: string) => { encryptedPlaintext = plaintext; return "encrypted-fixture"; },
    transport: {
      upload: async ({ body: bytes }: { body: Uint8Array }) => { uploaded = Buffer.from(bytes).toString(); },
      download: async () => null,
    },
  };
  return { input, dependencies, body, plaintext: () => JSON.parse(encryptedPlaintext) as Record<string, unknown>, uploaded: () => uploaded };
}

test("partial pre-send screenshot capture keeps body in encrypted evidence when final capture fails", async () => {
  const preSendPage = {
    isClosed: () => false,
    url: () => "https://ceac.state.gov/GenNIV/common/email.aspx",
    locator: () => ({ innerText: async () => "private pre-send body" }),
    screenshot: async () => { throw new Error("fixture pre-send screenshot failure"); },
  } as unknown as Page;
  const preSendCapture = await captureDs160EmailPage(preSendPage);
  assert.deepEqual(preSendCapture.captureFailures, ["screenshot"]);
  const f = auditFixture({ bodyFails: true, screenshotFails: true });
  const result = await persistDs160EmailEvidence({ ...f.input, preSendCapture }, f.dependencies);
  assert.ok(result.audit);
  assert.deepEqual(result.auditCaptureFailures, ["pre_send_screenshot", "body", "screenshot"]);
  const privateEvidence = f.plaintext();
  const preSend = privateEvidence.preSend as Record<string, unknown>;
  assert.equal(preSend.body, "private pre-send body");
  assert.equal(preSend.screenshotBase64, undefined);
  assert.deepEqual(preSend.captureFailures, ["screenshot"]);
  assert.doesNotMatch(JSON.stringify(result), /private pre-send body/);
});

test("screenshot failure preserves encrypted official text and reports only capture stage", async () => {
  const f = auditFixture({ screenshotFails: true });
  const result = await persistDs160EmailEvidence(f.input, f.dependencies);
  assert.ok(result.audit);
  assert.equal(result.auditUnavailable, undefined);
  assert.deepEqual(result.auditCaptureFailures, ["screenshot"]);
  assert.equal(f.plaintext().body, f.body);
  assert.equal(f.plaintext().screenshotBase64, undefined);
  assert.equal(f.plaintext().path, "/GenNIV/Common/AppError.aspx");
  assert.equal(f.uploaded(), "encrypted-fixture");
  assert.ok(!JSON.stringify(result).includes("applicant@example.test"));
  assert.ok(!JSON.stringify(result).includes("private"));
});

test("text failure preserves the screenshot without inventing receipt text", async () => {
  const f = auditFixture({ bodyFails: true });
  const result = await persistDs160EmailEvidence(f.input, f.dependencies);
  assert.ok(result.audit);
  assert.deepEqual(result.auditCaptureFailures, ["body"]);
  assert.equal(f.plaintext().body, undefined);
  assert.equal(f.plaintext().outcome, "unknown");
  assert.equal(f.plaintext().screenshotBase64, Buffer.from("fixture screenshot").toString("base64"));
});

test("no captured evidence reports capture unavailable without uploading a fake artifact", async () => {
  for (const options of [{ closed: true }, { bodyFails: true, screenshotFails: true }]) {
    const f = auditFixture(options);
    const result = await persistDs160EmailEvidence(f.input, f.dependencies);
    assert.equal(result.audit, undefined);
    assert.equal(result.auditFailureStage, "capture");
    assert.equal(result.auditUnavailable, true);
    assert.equal(f.uploaded(), "");
  }
});

test("encryption failure is distinguished from capture and exposes no raw error", async () => {
  const f = auditFixture();
  const result = await persistDs160EmailEvidence(f.input, {
    ...f.dependencies, encrypt: () => { throw new Error("secret encryption details"); },
  });
  assert.equal(result.auditFailureStage, "encryption");
  assert.equal(result.auditUnavailable, true);
  assert.equal(f.uploaded(), "");
  assert.ok(!JSON.stringify(result).includes("secret"));
});

test("unacknowledged storage never gets an audit ref and reports sanitized storage code", async () => {
  const f = auditFixture();
  const result = await persistDs160EmailEvidence(f.input, {
    ...f.dependencies,
    transport: { upload: async () => { throw Object.assign(new Error("private provider URL"), { status: 401 }); }, download: async () => null },
  });
  assert.equal(result.audit, undefined);
  assert.equal(result.auditUnavailable, true);
  assert.equal(result.auditFailureStage, "storage");
  assert.equal(result.auditFailureCode, "AUDIT_STORAGE_AUTHORIZATION");
  assert.ok(!JSON.stringify(result).includes("private"));
});
