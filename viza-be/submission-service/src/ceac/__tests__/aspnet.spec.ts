import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import {
  installCeacPostbackMonitor,
  waitForAspNetPostback,
  waitForAspNetPostbackStable,
} from "../aspnet";
import { GateDetectedError, NavigationError } from "../errors";
import { advance } from "../navigator";
import { fillPageFields } from "../orchestrator";

const CEAC_ROUTE = "https://ceac.state.gov/GenNIV/**";
const CEAC_URL = "https://ceac.state.gov/GenNIV/Default.aspx";
const POSTBACK_URL = "https://ceac.state.gov/GenNIV/Default.aspx";
const PRIVATE_PAYLOAD = "privatepayload-fixture-value";
const QUERY_STACK = "querystack-fixture-value";

type FixtureWindow = Window & {
  __ceacTriggerPostback: () => Promise<number>;
  __ceacStartErroredPostback: () => void;
};

type FixtureOptions = {
  postbackStatus?: number;
  postbackBody?: string;
  postbackUrl?: string;
  responseGate?: Promise<void>;
  fieldPostback?: boolean;
  navigationLink?: boolean;
  documentForm?: boolean;
  navigatorForm?: boolean;
};

function fixtureHtml(
  postbackUrl: string,
  options: Pick<FixtureOptions, "fieldPostback" | "navigationLink" | "documentForm" | "navigatorForm"> = {},
): string {
  const fieldMarkup = options.fieldPostback
    ? '<input id="source"><input id="dependent">'
    : "";
  const navigationMarkup = options.navigationLink
    ? '<a id="full-navigation" href="https://ceac.state.gov/GenNIV/Next.aspx">Next</a>'
    : "";
  const documentFormMarkup = options.documentForm
    ? options.navigatorForm
      ? `<form id="document-postback" method="post" action="${postbackUrl}"><input id="document-submit" type="submit" class="next" value="Next: Personal 2"></form>`
      : `<form id="document-postback" method="post" action="${postbackUrl}"><button id="document-submit" type="submit">Submit</button></form>`
    : "";
  const fieldListener = options.fieldPostback
    ? `
<script>
document.querySelector("#source").addEventListener("input", () => {
  if (!window.__ceacFieldPostbackStarted) {
    window.__ceacFieldPostbackStarted = true;
    void window.__ceacTriggerPostback();
  }
});
</script>`
    : "";
  return `<!doctype html>
<html><body><h1>CEAC fixture</h1>${fieldMarkup}${navigationMarkup}
${documentFormMarkup}
<script>
(() => {
  const endRequestHandlers = [];
  const manager = {
    inAsyncPostBack: false,
    add_endRequest(handler) { endRequestHandlers.push(handler); },
    remove_endRequest(handler) {
      const index = endRequestHandlers.indexOf(handler);
      if (index >= 0) endRequestHandlers.splice(index, 1);
    },
    get_isInAsyncPostBack() { return this.inAsyncPostBack; },
    emitEndRequest(error) {
      const args = {
        get_error() { return error || null; },
        get_errorMessage() { return error && error.message ? error.message : null; },
      };
      for (const handler of [...endRequestHandlers]) handler(this, args);
    },
  };

  window.Sys = {
    WebForms: {
      PageRequestManager: { getInstance: () => manager },
    },
  };

  window.__ceacTriggerPostback = async () => {
    manager.inAsyncPostBack = true;
    let response;
    let caught;
    try {
      response = await fetch(${JSON.stringify(postbackUrl)}, {
        method: "POST",
        body: "fixture-form-values",
      });
    } catch (error) {
      caught = error;
    }
    manager.inAsyncPostBack = false;
    manager.emitEndRequest(caught);
    if (caught) throw caught;
    return response.status;
  };

  window.__ceacStartErroredPostback = () => {
    manager.inAsyncPostBack = true;
    setTimeout(() => {
      manager.inAsyncPostBack = false;
      manager.emitEndRequest({
        message: ${JSON.stringify(PRIVATE_PAYLOAD)},
        stack: ${JSON.stringify(QUERY_STACK)},
      });
    }, 15);
  };
})();
</script>${fieldListener}</body></html>`;
}

async function installFixture(page: Page, options: FixtureOptions = {}): Promise<void> {
  const postbackUrl = options.postbackUrl ?? POSTBACK_URL;
  await page.route(CEAC_ROUTE, async (route) => {
    if (route.request().method() === "POST") {
      if (options.responseGate) await options.responseGate;
      const isDocumentRequest = route.request().resourceType() === "document";
      await route.fulfill({
        status: options.postbackStatus ?? 200,
        contentType: isDocumentRequest ? "text/html" : "text/plain",
        body: isDocumentRequest
          ? fixtureHtml(postbackUrl, options)
          : options.postbackBody ?? "fixture-response",
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: fixtureHtml(postbackUrl, options),
    });
  });
  await page.goto(CEAC_URL);
  await installCeacPostbackMonitor(page);
}

async function triggerPostback(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as FixtureWindow).__ceacTriggerPostback());
}

async function startErroredPostback(page: Page): Promise<void> {
  await page.evaluate(() => (window as unknown as FixtureWindow).__ceacStartErroredPostback());
}

function submitDocumentPostback(page: Page): void {
  void page.evaluate(() => {
    setTimeout(() => {
      const form = document.querySelector("#document-postback");
      if (!(form instanceof HTMLFormElement)) throw new Error("document postback fixture form is missing");
      form.submit();
    }, 0);
  }).catch(() => undefined);
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => { resolve = settle; });
  return { promise, resolve };
}

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser.close();
});

it("detects a fast 403 postback even when it completes before the wait", async () => {
  const page = await browser.newPage();
  try {
    await installFixture(page, { postbackStatus: 403, postbackBody: "fixture-gate-response" });
    assert.equal(await triggerPostback(page), 403);

    await assert.rejects(
      () => waitForAspNetPostback(page, 500),
      (error: unknown) => {
        assert.ok(error instanceof GateDetectedError);
        assert.equal(error.code, "GATE_DETECTED");
        return true;
      },
    );
  } finally {
    await page.close();
  }
});

it("allows a settled 200 response and a no-op wait", async () => {
  const page = await browser.newPage();
  try {
    await installFixture(page, { postbackStatus: 200 });
    assert.equal(await triggerPostback(page), 200);
    await waitForAspNetPostback(page, 500);

    await page.evaluate(() => { delete (window as unknown as { Sys?: unknown }).Sys; });
    await waitForAspNetPostback(page, 500);
  } finally {
    await page.close();
  }
});

it("waits through a delayed AutoPostBack before allowing the next action", async () => {
  const page = await browser.newPage();
  try {
    await installFixture(page, { postbackStatus: 200 });
    await page.evaluate(() => {
      const fixture = (window as unknown as FixtureWindow).__ceacTriggerPostback;
      setTimeout(() => { void fixture(); }, 650);
    });
    await assert.doesNotReject(() => waitForAspNetPostbackStable(page, 3_000));
  } finally {
    await page.close();
  }
});

it("rejects an active postback that exceeds the wait timeout", async () => {
  const page = await browser.newPage();
  const responseGate = deferred();
  let trigger: Promise<number> | undefined;
  try {
    await installFixture(page, { postbackStatus: 200, responseGate: responseGate.promise });
    const requestSeen = page.waitForRequest(
      (request) => request.url() === POSTBACK_URL && request.method() === "POST",
    );
    trigger = triggerPostback(page);
    await requestSeen;

    await assert.rejects(
      () => waitForAspNetPostback(page, 60),
      (error: unknown) => {
        assert.ok(error instanceof NavigationError);
        assert.equal(error.code, "NAVIGATION_FAILED");
        return true;
      },
    );
  } finally {
    responseGate.resolve();
    await trigger?.catch(() => undefined);
    await page.close();
  }
});

it("sanitizes gate response details before exposing the gate error", async () => {
  const page = await browser.newPage();
  try {
    await installFixture(page, {
      postbackStatus: 429,
      postbackUrl: `${POSTBACK_URL}?privateQuery=${QUERY_STACK}`,
      postbackBody: PRIVATE_PAYLOAD,
    });
    assert.equal(await triggerPostback(page), 429);

    await assert.rejects(
      () => waitForAspNetPostback(page, 500),
      (error: unknown) => {
        assert.ok(error instanceof GateDetectedError);
        assert.equal(error.code, "GATE_DETECTED");
        assert.doesNotMatch(error.message, new RegExp(PRIVATE_PAYLOAD));
        assert.doesNotMatch(error.message, new RegExp(QUERY_STACK));
        return true;
      },
    );
  } finally {
    await page.close();
  }
});

it("sanitizes MSAJAX errors before exposing them as navigation failures", async () => {
  const page = await browser.newPage();
  try {
    await installFixture(page);
    await startErroredPostback(page);

    await assert.rejects(
      () => waitForAspNetPostback(page, 500),
      (error: unknown) => {
        assert.ok(error instanceof NavigationError);
        assert.equal(error.code, "NAVIGATION_FAILED");
        assert.doesNotMatch(error.message, new RegExp(PRIVATE_PAYLOAD));
        assert.doesNotMatch(error.message, new RegExp(QUERY_STACK));
        return true;
      },
    );
  } finally {
    await page.close();
  }
});

it("keeps a 403 postback as a gate and does not fill dependent fields", async () => {
  const page = await browser.newPage();
  try {
    await installFixture(page, {
      postbackStatus: 403,
      postbackBody: "fixture-gate-response",
      fieldPostback: true,
    });

    await assert.rejects(
      () => fillPageFields(page, {
        source: { selector: "#source", type: "text", label: "Source" },
        dependent: { selector: "#dependent", type: "text", label: "Dependent" },
      }, { source: "entered-before-gate", dependent: "must-not-be-entered" }, {}, {
        requireMappedAnswers: true,
      }),
      (error: unknown) => {
        assert.ok(error instanceof GateDetectedError);
        assert.equal(error.code, "GATE_DETECTED");
        return true;
      },
    );
    assert.equal(await page.locator("#source").inputValue(), "entered-before-gate");
    assert.equal(await page.locator("#dependent").inputValue(), "");
  } finally {
    await page.close();
  }
});

it("allows a normal full-document navigation while the wait is pending", async () => {
  const page = await browser.newPage();
  try {
    await installFixture(page, { navigationLink: true });
    const pendingWait = waitForAspNetPostback(page, 1_000);
    await page.locator("#full-navigation").click();
    await assert.doesNotReject(pendingWait);
    assert.match(page.url(), /\/GenNIV\/Next\.aspx$/);
  } finally {
    await page.close();
  }
});

it("does not settle while a full-document POST remains pending", { timeout: 10_000 }, async () => {
  const page = await browser.newPage();
  const responseGate = deferred();
  let pendingWait: Promise<void> | undefined;
  try {
    await installFixture(page, { documentForm: true, responseGate: responseGate.promise });
    const requestSeen = page.waitForRequest(
      request => request.method() === "POST" && request.resourceType() === "document",
    );
    submitDocumentPostback(page);
    await Promise.race([
      requestSeen,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("document POST was not observed")), 2_000)),
    ]);

    let settled = false;
    pendingWait = waitForAspNetPostback(page, 1_500);
    void pendingWait.then(() => { settled = true; }, () => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(settled, false);

    responseGate.resolve();
    await assert.doesNotReject(pendingWait);
  } finally {
    responseGate.resolve();
    await pendingWait?.catch(() => undefined);
    await page.close();
  }
});

it("rejects a full-document POST 403 as a gate", { timeout: 10_000 }, async () => {
  const page = await browser.newPage();
  try {
    await installFixture(page, { documentForm: true, postbackStatus: 403 });
    const responseSeen = page.waitForResponse(
      response => response.request().method() === "POST" &&
        response.request().resourceType() === "document" && response.status() === 403,
    );
    submitDocumentPostback(page);
    await Promise.race([
      responseSeen,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("document 403 was not observed")), 2_000)),
    ]);

    await assert.rejects(
      () => waitForAspNetPostback(page, 1_000),
      (error: unknown) => {
        assert.ok(error instanceof GateDetectedError);
        assert.equal(error.code, "GATE_DETECTED");
        return true;
      },
    );
  } finally {
    await page.close();
  }
});

it("keeps navigator Next failures as gates instead of generic fallbacks", { timeout: 10_000 }, async () => {
  const page = await browser.newPage();
  try {
    await installFixture(page, {
      documentForm: true,
      navigatorForm: true,
      postbackStatus: 403,
    });

    await assert.rejects(
      () => advance(page, {
        from: "personal_information_1",
        to: "personal_information_2",
        assertFrom: false,
        timeoutMs: 2_000,
      }),
      (error: unknown) => {
        assert.ok(error instanceof GateDetectedError);
        assert.equal(error.code, "GATE_DETECTED");
        return true;
      },
    );
  } finally {
    await page.close();
  }
});
