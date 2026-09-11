import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GateDetectedError, ManualActionRequiredError } from "../errors";
import {
  attachToExistingCeacSession,
  isAttachableCeacFormPage,
  isOfficialCeacFormUrl,
  readCeacPageApplicationId,
  rebuildSessionForResume,
  requiresCeacConfirmApplication,
  resolveCeacLocalCdpEndpoint,
  startCeacSession,
  type CeacCdpAttachDependencies,
} from "../session";
import type { CeacPageId, PageIdentityResult } from "../pages";

const PERSONAL_1_URL =
  "https://ceac.state.gov/GenNIV/General/complete/complete_personal.aspx?node=Personal1";

function createAttachHarness(
  urls: string[],
  pageId: CeacPageId | "unknown" = "personal_information_1",
  gateError?: Error,
  startPageCaptcha = false,
  applicationIds: Array<string | null> = [],
): {
  browser: unknown;
  contextCloseCalls: () => number;
  browserCloseCalls: () => number;
  dependencies: CeacCdpAttachDependencies;
  connectCalls: Array<{ endpoint: string; timeout: number }>;
} {
  let contextCloseCount = 0;
  let browserCloseCount = 0;
  const pages = urls.map((url) => ({ url: () => url }));
  const context = {
    pages: () => pages,
    close: async () => {
      contextCloseCount += 1;
    },
  };
  const browser = {
    contexts: () => [context],
    close: async () => {
      browserCloseCount += 1;
    },
  };
  const connectCalls: Array<{ endpoint: string; timeout: number }> = [];
  const dependencies: CeacCdpAttachDependencies = {
    connectOverCDP: async (endpoint, options) => {
      connectCalls.push({ endpoint, timeout: options.timeout });
      return browser as never;
    },
    assertNoGate: async () => {
      if (gateError) throw gateError;
    },
    detectPage: async (page) => ({
      id: pageId,
      heading: pageId === "unknown" ? null : "Personal Information 1",
      url: page.url(),
    } satisfies PageIdentityResult),
    hasStartPageCaptcha: async () => startPageCaptcha,
    readApplicationId: async (page) => applicationIds[pages.indexOf(page)] ?? null,
  };
  return {
    browser,
    contextCloseCalls: () => contextCloseCount,
    browserCloseCalls: () => browserCloseCount,
    dependencies,
    connectCalls,
  };
}

describe("CEAC session bootstrap navigation", () => {
  it("waits only for the initial CEAC response commit before page detection", async () => {
    const { gotoCeacStartPage } = require("../start-page-navigation") as typeof import("../start-page-navigation");
    const calls: Array<{ waitUntil?: string; timeout?: number }> = [];
    const page = {
      goto: async (_url: string, options: { waitUntil?: string; timeout?: number }) => {
        calls.push(options);
        return null;
      },
      waitForSelector: async () => undefined,
    };

    await gotoCeacStartPage(page as never, 12_345);

    assert.deepEqual(calls, [{ waitUntil: "commit", timeout: 12_345 }]);
  });

  it("waits for CEAC page markers after the initial response commit", async () => {
    const { gotoCeacStartPage } = require("../start-page-navigation") as typeof import("../start-page-navigation");
    const selectors: Array<{ selector: string; state?: string; timeout?: number }> = [];
    const page = {
      goto: async () => null,
      waitForSelector: async (selector: string, options: { state?: string; timeout?: number }) => {
        selectors.push({ selector, ...options });
      },
    };

    await gotoCeacStartPage(page as never, 12_345);

    assert.equal(selectors.length, 1);
    assert.match(selectors[0].selector, /h2/);
    assert.equal(selectors[0].state, "attached");
    assert.equal(selectors[0].timeout, 12_345);
  });
});

describe("CEAC local Chrome CDP attach", () => {
  it("accepts only explicit loopback endpoints and rejects conflicting aliases", () => {
    assert.equal(
      resolveCeacLocalCdpEndpoint({ CEAC_CHROME_CDP_ENDPOINT: "http://127.0.0.1:9222" }),
      "http://127.0.0.1:9222/",
    );
    assert.equal(
      resolveCeacLocalCdpEndpoint({ CEAC_CDP_ENDPOINT: "ws://localhost:9222/devtools/browser/test" }),
      "ws://localhost:9222/devtools/browser/test",
    );
    assert.equal(resolveCeacLocalCdpEndpoint({}), null);
    assert.throws(
      () => resolveCeacLocalCdpEndpoint({ CEAC_CDP_ENDPOINT: "http://192.168.1.20:9222" }),
      /loopback|localhost/i,
    );
    assert.throws(
      () => resolveCeacLocalCdpEndpoint({ CEAC_CDP_ENDPOINT: "http://user:secret@localhost:9222" }),
      /unauthenticated/i,
    );
    assert.throws(
      () => resolveCeacLocalCdpEndpoint({
        CEAC_CHROME_CDP_ENDPOINT: "http://127.0.0.1:9222",
        CEAC_CDP_ENDPOINT: "http://127.0.0.1:9333",
      }),
      /same loopback endpoint/i,
    );
  });

  it("recognizes only the exact official HTTPS origin and entered form pages", () => {
    assert.equal(isOfficialCeacFormUrl(PERSONAL_1_URL), true);
    assert.equal(isOfficialCeacFormUrl("http://ceac.state.gov/GenNIV/General/complete/complete_personal.aspx"), false);
    assert.equal(isOfficialCeacFormUrl("https://ceac.state.gov.example/GenNIV/General/complete/complete_personal.aspx"), false);
    assert.equal(isAttachableCeacFormPage("personal_information_1"), true);
    assert.equal(isAttachableCeacFormPage("sign_and_submit"), true);
    assert.equal(isAttachableCeacFormPage("start"), false);
    assert.equal(isAttachableCeacFormPage("retrieve_application"), false);
    assert.equal(isAttachableCeacFormPage("confirmation"), false);
    assert.equal(isAttachableCeacFormPage("unknown"), false);
  });

  it("reads the stored Application ID from a CEAC URL or retrieve input", async () => {
    const queryPage = {
      url: () => "https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=aa00exampl1",
    };
    assert.equal(await readCeacPageApplicationId(queryPage as never), "AA00EXAMPL1");

    const input = {
      first: () => input,
      count: async () => 1,
      inputValue: async () => "aa00exampl2",
    };
    const retrievePage = {
      url: () => "https://ceac.state.gov/GenNIV/Common/Recovery.aspx",
      locator: () => input,
    };
    assert.equal(await readCeacPageApplicationId(retrievePage as never), "AA00EXAMPL2");
  });

  it("attaches to the unique Personal1 tab and disconnects without closing its context", async () => {
    const harness = createAttachHarness(["https://example.invalid/", PERSONAL_1_URL]);
    const session = await attachToExistingCeacSession(
      "http://127.0.0.1:9222",
      { runId: "run-test" },
      harness.dependencies,
    );

    assert.equal(session.page.url(), PERSONAL_1_URL);
    assert.equal(session.attachedExistingForm, true);
    assert.equal(session.runId, "run-test");
    assert.deepEqual(harness.connectCalls, [
      { endpoint: "http://127.0.0.1:9222/", timeout: 45_000 },
    ]);
    assert.equal(requiresCeacConfirmApplication(session), false);

    await session.close();
    await session.close();
    assert.equal(harness.browserCloseCalls(), 1);
    assert.equal(harness.contextCloseCalls(), 0);
  });

  it("keeps the normal new-session contract requiring Confirm Application", () => {
    assert.equal(requiresCeacConfirmApplication({}), true);
    assert.equal(requiresCeacConfirmApplication({ attachedExistingForm: false }), true);
  });

  it("fails closed when zero or multiple official CEAC tabs are open", async () => {
    const none = createAttachHarness(["https://example.invalid/"]);
    await assert.rejects(
      () => attachToExistingCeacSession("http://localhost:9222", {}, none.dependencies),
      /found no open official form page/i,
    );
    assert.equal(none.browserCloseCalls(), 1);
    assert.equal(none.contextCloseCalls(), 0);

    const multiple = createAttachHarness([
      PERSONAL_1_URL,
      "https://ceac.state.gov/GenNIV/General/complete/complete_travel.aspx?node=Travel",
    ]);
    await assert.rejects(
      () => attachToExistingCeacSession("http://localhost:9222", {}, multiple.dependencies),
      /stored Application ID when more than one official tab is open/i,
    );
    assert.equal(multiple.browserCloseCalls(), 1);
    assert.equal(multiple.contextCloseCalls(), 0);
  });

  it("selects the unique official tab whose Application ID matches the stored draft", async () => {
    const travelUrl =
      "https://ceac.state.gov/GenNIV/General/complete/complete_travel.aspx?node=Travel";
    const harness = createAttachHarness(
      [PERSONAL_1_URL, travelUrl],
      "personal_information_1",
      undefined,
      false,
      ["AA00OTHER1", "AA00EXAMPL1"],
    );

    const session = await attachToExistingCeacSession(
      "http://localhost:9222",
      { resumeApplicationId: "AA00EXAMPL1" },
      harness.dependencies,
    );

    assert.equal(session.page.url(), travelUrl);
    await session.close();
  });

  it("fails with redacted diagnostics when no tab matches the stored draft", async () => {
    const harness = createAttachHarness(
      [
        PERSONAL_1_URL,
        "https://ceac.state.gov/GenNIV/General/complete/complete_travel.aspx?node=Travel",
      ],
      "personal_information_1",
      undefined,
      false,
      ["AA00OTHER1", "AA00OTHER2"],
    );

    let caught: unknown;
    try {
      await attachToExistingCeacSession(
        "http://localhost:9222",
        { resumeApplicationId: "AA00EXAMPL1" },
        harness.dependencies,
      );
    } catch (error) {
      caught = error;
    }

    assert.ok(caught instanceof Error);
    assert.match(caught.message, /could not identify one form tab/i);
    const serialized = JSON.stringify(caught);
    assert.match(serialized, /matching_ceac_tab_not_unique/);
    assert.doesNotMatch(serialized, /AA00EXAMPL1|AA00OTHER1|AA00OTHER2/);
  });

  it("rejects Confirm Application ID and non-form page identities", async () => {
    const confirm = createAttachHarness([
      "https://ceac.state.gov/GenNIV/Common/ConfirmApplicationID.aspx?node=SecureQuestion",
    ]);
    await assert.rejects(
      () => attachToExistingCeacSession("http://localhost:9222", {}, confirm.dependencies),
      /refused the Confirm Application ID/i,
    );
    assert.equal(confirm.browserCloseCalls(), 1);

    const start = createAttachHarness([
      "https://ceac.state.gov/GenNIV/Default.aspx",
    ], "start");
    await assert.rejects(
      () => attachToExistingCeacSession("http://localhost:9222", {}, start.dependencies),
      /stored recovery credentials are unavailable/i,
    );
    assert.equal(start.browserCloseCalls(), 1);
  });

  it("allows Start and Retrieve only for an explicit stored CEAC application", async () => {
    const start = createAttachHarness([
      "https://ceac.state.gov/GenNIV/Default.aspx",
    ], "start");
    const startSession = await attachToExistingCeacSession(
      "http://localhost:9222",
      { resumeApplicationId: "AA00EXAMPL1" },
      start.dependencies,
    );
    assert.equal(startSession.attachedPageId, "start");
    await startSession.close();

    const retrieve = createAttachHarness([
      "https://ceac.state.gov/GenNIV/Common/Recovery.aspx",
    ], "retrieve_application");
    const retrieveSession = await attachToExistingCeacSession(
      "http://localhost:9222",
      { resumeApplicationId: "AA00EXAMPL1" },
      retrieve.dependencies,
    );
    assert.equal(retrieveSession.attachedPageId, "retrieve_application");
    await retrieveSession.close();
  });

  it("fails closed at the attached Start-page image CAPTCHA", async () => {
    const harness = createAttachHarness([
      "https://ceac.state.gov/GenNIV/Default.aspx",
    ], "start", undefined, true);

    await assert.rejects(
      () => attachToExistingCeacSession(
        "http://localhost:9222",
        { resumeApplicationId: "AA00EXAMPL1" },
        harness.dependencies,
      ),
      (error: unknown) =>
        error instanceof ManualActionRequiredError && error.actionType === "ceac_start_captcha",
    );
    assert.equal(harness.browserCloseCalls(), 1);
    assert.equal(harness.contextCloseCalls(), 0);
  });

  it("attaches without touching the Start CAPTCHA when a bounded manual wait is configured", async () => {
    const harness = createAttachHarness([
      "https://ceac.state.gov/GenNIV/Default.aspx",
    ], "start", undefined, true);

    const attached = await attachToExistingCeacSession(
      "http://localhost:9222",
      {
        resumeApplicationId: "AA00EXAMPL1",
        manualStartWaitMs: 60_000,
      },
      harness.dependencies,
    );

    assert.equal(attached.attachedPageId, "start");
    assert.equal(attached.manualStartWaitMs, 60_000);
    assert.equal(harness.contextCloseCalls(), 0);
    await attached.close();
  });

  it("allows one explicit new-application Start attach without stored recovery credentials", async () => {
    const harness = createAttachHarness([
      "https://ceac.state.gov/GenNIV/Default.aspx",
    ], "start", undefined, true);

    const attached = await attachToExistingCeacSession(
      "http://localhost:9222",
      {
        allowNewApplicationFromStart: true,
        manualStartWaitMs: 60_000,
      },
      harness.dependencies,
    );

    assert.equal(attached.attachedPageId, "start");
    assert.equal(attached.newApplicationFromStart, true);
    assert.equal(attached.manualStartWaitMs, 60_000);
    await attached.close();
  });

  it("rejects ambiguous create-and-recover attachment intent", async () => {
    const harness = createAttachHarness([
      "https://ceac.state.gov/GenNIV/Default.aspx",
    ], "start");

    await assert.rejects(
      () => attachToExistingCeacSession(
        "http://localhost:9222",
        {
          resumeApplicationId: "AA00EXAMPL1",
          allowNewApplicationFromStart: true,
        },
        harness.dependencies,
      ),
      /cannot recover.*and create/i,
    );
    assert.equal(harness.connectCalls.length, 0);
  });

  it("rejects invalid stored CEAC application IDs before connecting", async () => {
    const harness = createAttachHarness([
      "https://ceac.state.gov/GenNIV/Default.aspx",
    ], "start");
    await assert.rejects(
      () => attachToExistingCeacSession(
        "http://localhost:9222",
        { resumeApplicationId: "not-an-official-id" },
        harness.dependencies,
      ),
      /valid stored official Application ID/i,
    );
    assert.equal(harness.connectCalls.length, 0);
  });

  it("propagates WAF/reCAPTCHA gate failures and disconnects", async () => {
    const gate = new GateDetectedError("blocked", { details: { gateKind: "captcha" } });
    const harness = createAttachHarness([PERSONAL_1_URL], "personal_information_1", gate);

    await assert.rejects(
      () => attachToExistingCeacSession("http://localhost:9222", {}, harness.dependencies),
      (error: unknown) => error === gate,
    );
    assert.equal(harness.browserCloseCalls(), 1);
    assert.equal(harness.contextCloseCalls(), 0);
  });

  it("does not fall back to a replacement browser when CDP connection fails", async () => {
    const dependencies: CeacCdpAttachDependencies = {
      connectOverCDP: async () => {
        throw new Error("connection refused");
      },
      assertNoGate: async () => undefined,
      detectPage: async () => ({ id: "unknown", heading: null, url: "" }),
      hasStartPageCaptcha: async () => false,
      readApplicationId: async () => null,
    };

    await assert.rejects(
      () => attachToExistingCeacSession("http://127.0.0.1:9222", {}, dependencies),
      /refusing to launch a replacement browser/i,
    );
  });

  it("requires a configured endpoint in strict existing-session mode", async () => {
    const previousChromeEndpoint = process.env.CEAC_CHROME_CDP_ENDPOINT;
    const previousEndpoint = process.env.CEAC_CDP_ENDPOINT;
    delete process.env.CEAC_CHROME_CDP_ENDPOINT;
    delete process.env.CEAC_CDP_ENDPOINT;
    try {
      await assert.rejects(
        () => startCeacSession({ requireExistingFormFromEnvironment: true }),
        (error: unknown) => {
          if (!(error instanceof Error)) return false;
          const serialized = JSON.stringify(error);
          return (
            /requires a configured loopback CDP endpoint/i.test(error.message) &&
            /cdp_endpoint_missing/.test(serialized) &&
            /remote-debugging-port/.test(serialized)
          );
        },
      );
    } finally {
      if (previousChromeEndpoint === undefined) delete process.env.CEAC_CHROME_CDP_ENDPOINT;
      else process.env.CEAC_CHROME_CDP_ENDPOINT = previousChromeEndpoint;
      if (previousEndpoint === undefined) delete process.env.CEAC_CDP_ENDPOINT;
      else process.env.CEAC_CDP_ENDPOINT = previousEndpoint;
    }
  });

  it("never launches a replacement browser after an attached session expires", async () => {
    let closeCalls = 0;
    const session = {
      browser: {},
      context: {},
      page: {},
      attachedExistingForm: true,
      attachedPageId: "personal_information_1",
      close: async () => {
        closeCalls += 1;
      },
    };

    await assert.rejects(
      () => rebuildSessionForResume(session as never),
      (error: unknown) =>
        error instanceof ManualActionRequiredError &&
        error.actionType === "ceac_attached_session_expired",
    );
    assert.equal(closeCalls, 0);
  });
});
