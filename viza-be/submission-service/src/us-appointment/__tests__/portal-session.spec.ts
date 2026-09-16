import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { chromium, type Page } from "@playwright/test";
import {
  loadUSAppointmentRunnerConfig,
  type USAppointmentJobRow,
} from "../runner";
import { PlaywrightUSVisaSchedulingPortalClient } from "../usvisascheduling-portal";

const job: USAppointmentJobRow = {
  id: "session-fixture-job",
  application_id: "session-fixture-application",
  user_id: "session-fixture-user",
  appointment_account_id: null,
  applying_country_code: "CN",
  applying_post_city: "Beijing",
  scheduling_provider: "usvisascheduling",
  status: "appointment_payment_completed",
  mode: "assisted_live",
  user_preferences_json: null,
  requires_user_action: false,
  current_manual_action: null,
  updated_at: null,
};

test("abort releases the provider session even while Playwright close is pending", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.BROWSERBASE_API_KEY;
  let releaseClose!: () => void;
  const closePending = new Promise<void>((resolve) => { releaseClose = resolve; });
  const releases: string[] = [];
  process.env.BROWSERBASE_API_KEY = "fixture-key";
  globalThis.fetch = async (input, init) => {
    releases.push(String(input));
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(String(init?.body)), { status: "REQUEST_RELEASE" });
    return new Response("{}", { status: 200 });
  };
  const client = new PlaywrightUSVisaSchedulingPortalClient(loadUSAppointmentRunnerConfig({}));
  // Supply an owned transport that deliberately hangs, without opening a browser.
  Object.assign(client, {
    browser: { close: () => closePending },
    browserbaseSessionId: "fixture-session",
  });
  try {
    const aborting = client.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(releases, ["https://api.browserbase.com/v1/sessions/fixture-session"]);
    releaseClose();
    await aborting;
    await client.close();
    assert.equal(releases.length, 1);
  } finally {
    releaseClose();
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.BROWSERBASE_API_KEY;
    else process.env.BROWSERBASE_API_KEY = previousKey;
  }
});

async function withFixture(
  run: (
    client: PlaywrightUSVisaSchedulingPortalClient,
    baseUrl: string,
    page: Page,
  ) => Promise<void>,
): Promise<void> {
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    if (request.url === "/") {
      response.end("<h1>Applicant home</h1><a href='/calendar'>Schedule Appointment</a>");
      return;
    }
    if (request.url === "/calendar") {
      response.end("<h1>Interview Calendar</h1><button class='slot'>2027-08-18 13:30 Beijing</button>");
      return;
    }
    if (request.url === "/expired") {
      response.end("<h1>Sign in</h1><label>Username<input type='text' name='username'></label><label>Password<input type='password' name='password'></label>");
      return;
    }
    response.statusCode = 404;
    response.end("Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const baseUrl = `http://127.0.0.1:${address.port}/`;
  const client = new PlaywrightUSVisaSchedulingPortalClient(
    {
      ...loadUSAppointmentRunnerConfig({}),
      playwrightEnabled: true,
      playwrightHeadless: true,
      baseUrl,
    },
    { page },
  );
  try {
    await run(client, baseUrl, page);
  } finally {
    await client.close();
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

type AuthWaitProbeClient = {
  waitForAuthenticatedPortal(
    page: Page,
    timeoutMs?: number,
    waitingRoomTimeoutMs?: number,
  ): Promise<boolean>;
};

async function withOfficialAuthFixture(
  html: string,
  run: (
    client: PlaywrightUSVisaSchedulingPortalClient,
    page: Page,
    requests: string[],
  ) => Promise<void>,
): Promise<void> {
  const origin = "https://www.usvisascheduling.com";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const requests: string[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      await route.abort();
      return;
    }
    requests.push(`${request.method()} ${url.pathname}`);
    await route.fulfill({ contentType: "text/html", body: html });
  });
  const client = new PlaywrightUSVisaSchedulingPortalClient({
    ...loadUSAppointmentRunnerConfig({}),
    baseUrl: `${origin}/en-US/`,
    playwrightEnabled: true,
  }, { page });
  try {
    await page.goto(`${origin}/en-US/`, { waitUntil: "domcontentloaded" });
    await run(client, page, requests);
  } finally {
    await client.close();
    await browser.close();
  }
}

function waitForAuthenticatedPortalForTest(
  client: PlaywrightUSVisaSchedulingPortalClient,
  page: Page,
  timeoutMs: number,
  waitingRoomTimeoutMs: number,
): Promise<boolean> {
  return (client as unknown as AuthWaitProbeClient).waitForAuthenticatedPortal(
    page,
    timeoutMs,
    waitingRoomTimeoutMs,
  );
}

test("submitted registration reconciles only through a matching official profile without entering applicant details", async () => {
  const browser = await chromium.launch({ headless: true });
  const origin = "https://www.usvisascheduling.com";
  try {
    for (const matching of [true, false]) {
      const page = await browser.newPage();
      const visited: string[] = [];
      // Every request is fulfilled/aborted locally; no official request is sent.
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== origin) { await route.abort(); return; }
        visited.push(url.pathname);
        await route.fulfill({contentType: "text/html", body: url.pathname === "/en-US/profile/"
          ? `<h1>Profile</h1><a href="mailto:${matching ? "fixture" : "other"}@example.invalid">Primary email</a>
            <input id="firstname" readonly value="TEST"><input id="lastname" readonly value="APPLICANT">
            <input id="atlas_emailaddress1" value="fixture@example.invalid">
            <select id="adx_preferredlanguageid"><option value="en">English</option></select>
            <select id="atlas_country"><option value="cn">China</option></select>
            <input id="UpdateButton" type="button" value="Update" onclick="document.getElementById('MessagePanel').textContent='Profile updated successfully'">
            <div id="MessagePanel"></div>`
          : '<h1>Applicant home</h1>'});
      });
      const client = new PlaywrightUSVisaSchedulingPortalClient({
        ...loadUSAppointmentRunnerConfig({}), baseUrl: `${origin}/en-US/`, playwrightEnabled: true,
      }, {page});
      try {
        const result = await client.prepareAppointmentFlow(job, {
          email: "fixture@example.invalid", password: "fixture-only", givenName: "TEST", surname: "APPLICANT",
          accountStatus: "registration_submitted", emailVerified: false,
        });
        assert.equal(result.readyForSlotCapture, false);
        assert.equal(result.emailVerified === true && result.accountCreated === true, matching);
        if (!matching) assert.equal(result.gate?.errorCode, "primary_email_mismatch");
        assert.ok(visited.includes("/en-US/profile/"));
        assert.ok(visited.every((path) => ["/en-US/", "/en-US/profile/"].includes(path)));
      } finally { await client.close(); await page.close(); }
    }
  } finally { await browser.close(); }
});

test("account inspection returns redacted diagnostics and does not prepare booking", async () => {
  await withFixture(async (client) => {
    const result = await client.inspectAccountSession({
      email: "applicant@example.com",
      password: "test-password",
    });

    assert.equal(result.state, "pending");
    assert.equal(result.gate, undefined);
    assert.equal(result.diagnostics.currentHost, "127.0.0.1");
    assert.ok(result.diagnostics.bodyTextLength > 0);
    assert.equal("bodyText" in result.diagnostics, false);
    await assert.rejects(client.observeSlots(job), /must be prepared/);
  });
});

test("aborting an appointment browser closes the page and prevents reopening it", async () => {
  await withFixture(async (client, _baseUrl, page) => {
    await client.abort();
    assert.equal(page.isClosed(), true);
    await assert.rejects(client.prepareAppointmentFlow(job, null), /execution was cancelled/);
  });
});

test("account inspection converts navigation errors into a redacted fixed-stage gate", async () => {
  await withFixture(async (client, baseUrl, page) => {
    await page.route("**/*", (route) => route.abort());
    const result = await client.inspectAccountSession({
      email: "applicant@example.com",
      password: "test-password",
    });

    assert.equal(result.state, "pending");
    assert.equal(result.gate?.errorCode, "account_session_inspection_failed");
    assert.equal(result.gate?.metadata.operation, "navigation");
    assert.equal(result.gate?.metadata.raw_error, "[REDACTED]");
    assert.doesNotMatch(JSON.stringify(result), /ERR_FAILED|127\.0\.0\.1|test-password/);
    assert.equal(result.diagnostics.currentHost, null);
    void baseUrl;
  });
});

test("slot observation fails closed when the prepared page expires into login", async () => {
  await withFixture(async (client, baseUrl, page) => {
    const prepared = await client.prepareAppointmentFlow(job, null);
    assert.equal(prepared.readyForSlotCapture, true);
    await page.goto(`${baseUrl}expired`);
    await assert.rejects(
      client.observeSlots(job),
      /must be prepared|no longer authenticated|redirected or expired/,
    );
  });
});

test("security answers are submitted once and an official validation error stops login", { timeout: 30_000 }, async () => {
  await withFixture(async (client, baseUrl, page) => {
    let submissions = 0;
    await page.route(`${baseUrl}**`, async (route) => {
      const current = new URL(route.request().url());
      if (current.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: `<form action="/questions">
          <input name="email" hidden><input type="password" hidden>
          <input id="signInName"><input type="password" name="password">
          <button>Sign In</button></form>` });
        return;
      }
      if (current.pathname === "/security") submissions += 1;
      await route.fulfill({ contentType: "text/html", body: `<form action="/security" method="post">
        <input id="kba1_response"><input id="kba3_response"><button id="continue">Continue</button>
        ${submissions ? '<div role="alert">Security answers are incorrect.</div>' : ""}</form>` });
    });
    const result = await client.inspectAccountSession({ email: "fixture@example.invalid", password: "fixture-only" });
    assert.equal(submissions, 1);
    assert.equal(result.state, "pending");
    assert.doesNotMatch(JSON.stringify(result), /fixture-only|VizaAnswer/);
  });
});

test("official waiting-room admission preserves the same tab without reloading", { timeout: 30_000 }, async () => {
  await withFixture(async (client, baseUrl, page) => {
    let queueVisits = 0;
    await page.route(`${baseUrl}**`, async (route) => {
      if (new URL(route.request().url()).pathname === "/") {
        queueVisits += 1;
        await route.fulfill({ contentType: "text/html", body: `<h1>You are now in line.</h1>
          <h2>Your estimated wait time is 4 minutes.</h2><footer>Cloudflare</footer>
          <script>setTimeout(() => location.href = '/admitted', 2500)</script>` });
      } else {
        await route.fulfill({ contentType: "text/html", body: "<h1>No appointments available</h1>" });
      }
    });
    const result = await client.prepareAppointmentFlow(job, null);
    assert.equal(result.readyForSlotCapture, true);
    assert.equal(result.gate, undefined);
    assert.equal(queueVisits, 1);
    assert.equal(new URL(page.url()).pathname, "/admitted");
  });
});

test("authentication wait extends past its initial bound for same-tab waiting-room admission", { timeout: 10_000 }, async () => {
  const waitingRoomHtml = `<h1>You are now in line.</h1>
    <h2>Your estimated wait time is 1 minute.</h2><footer>Cloudflare</footer>
    <form action="/signin-aad-b2c_1" method="post"><input id="signInName"><input type="password" name="password"><button>Sign In</button></form>
    <form action="/security" method="post"><input id="kba1_response"><button id="continue">Continue</button></form>
    <script>setTimeout(() => {
      history.replaceState({}, "", "/en-US/profile/");
      document.body.innerHTML = "<h1>Applicant home</h1><a id='start_application' href='/en-US/applicant_details/'>Start Application</a>";
    }, 350)</script>`;
  await withOfficialAuthFixture(waitingRoomHtml, async (client, page, requests) => {
    const started = Date.now();
    const authenticated = await waitForAuthenticatedPortalForTest(client, page, 100, 4_000);
    const elapsed = Date.now() - started;

    assert.equal(authenticated, true);
    assert.ok(elapsed >= 100, `authentication returned before its initial bound (${elapsed}ms)`);
    assert.ok(elapsed < 5_000, `same-tab admission exceeded the fixture bound (${elapsed}ms)`);
    assert.equal(new URL(page.url()).pathname, "/en-US/profile/");
    assert.equal(requests.filter((request) => request.startsWith("POST ")).length, 0);
    assert.equal(requests.filter((request) => request === "GET /en-US/").length, 1);
  });
});

test("authentication wait returns false at the bounded waiting-room deadline without submitting", { timeout: 10_000 }, async () => {
  const waitingRoomHtml = `<h1>Waiting Room</h1>
    <p>You are now in line. Your estimated wait time is 1 minute.</p><footer>Cloudflare</footer>
    <form action="/signin-aad-b2c_1" method="post"><input id="signInName"><input type="password" name="password"><button>Sign In</button></form>
    <form action="/security" method="post"><input id="kba1_response"><button id="continue">Continue</button></form>`;
  await withOfficialAuthFixture(waitingRoomHtml, async (client, page, requests) => {
    const started = Date.now();
    const authenticated = await waitForAuthenticatedPortalForTest(client, page, 100, 450);
    const elapsed = Date.now() - started;

    assert.equal(authenticated, false);
    assert.ok(elapsed < 2_000, `waiting-room timeout was not bounded (${elapsed}ms)`);
    assert.equal(requests.filter((request) => request.startsWith("POST ")).length, 0);
    assert.equal(requests.filter((request) => request === "GET /en-US/").length, 1);
  });
});

test("rejected existing account credentials do not create a replacement official account", { timeout: 30_000 }, async () => {
  await withFixture(async (client, baseUrl, page) => {
    let registrationRequests = 0;
    await page.route(`${baseUrl}**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === "/register") registrationRequests += 1;
      await route.fulfill({ contentType: "text/html", body: `<form action="/invalid">
        <input id="signInName"><input type="password" name="password"><button>Sign In</button></form>
        <a href="/register">Sign up now</a>
        ${pathname === "/invalid" ? '<div class="error">Username or password is invalid.</div>' : ""}` });
    });
    const result = await client.prepareAppointmentFlow(job, {
      email: "fixture@example.invalid", password: "fixture-only",
    });
    assert.equal(result.readyForSlotCapture, false);
    assert.equal(result.gate?.errorCode, "invalid_credentials");
    assert.equal(registrationRequests, 0);
  });
});

test("entrance reconnect continues the admitted page without repeating root navigation", { timeout: 30_000 }, async () => {
  await withFixture(async (client, baseUrl, initialPage) => {
    const ownedBrowser = initialPage.context().browser();
    assert.ok(ownedBrowser);
    const resumedPage = await ownedBrowser.newPage();
    await resumedPage.goto(`${baseUrl}calendar`);
    let rootVisits = 0;
    let reconnects = 0;
    let disconnected = false;
    await initialPage.route(baseUrl, async (route) => {
      rootVisits += 1;
      await route.fulfill({ contentType: "text/html", body: "<h1>Just a moment</h1>" });
      setTimeout(() => { disconnected = true; void initialPage.close(); }, 100);
    });
    let currentPage = initialPage;
    Object.assign(client, { browserbaseCloud: {
      get browser() { return disconnected ? { isConnected: () => false } : ownedBrowser; },
      get context() { return currentPage.context(); },
      get page() { return currentPage; },
      async reconnect() { reconnects += 1; currentPage = resumedPage; disconnected = false; },
      async close() {},
    } });
    const result = await client.prepareAppointmentFlow(job, null);
    assert.equal(result.readyForSlotCapture, true);
    assert.equal(reconnects, 1);
    assert.equal(rootVisits, 1);
    assert.equal(new URL(resumedPage.url()).pathname, "/calendar");
    const slots = await client.observeSlots(job);
    assert.ok(slots.length > 0);
  });
});

test("a disconnect after login submission cannot reconnect or replay authentication", { timeout: 30_000 }, async () => {
  await withFixture(async (client, baseUrl, page) => {
    let submits = 0;
    let reconnects = 0;
    await page.route(`${baseUrl}**`, async (route) => {
      if (new URL(route.request().url()).pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: `<form action="/authenticate" method="post">
          <input id="signInName"><input type="password" name="password"><button>Sign In</button></form>` });
      } else {
        submits += 1;
        await route.fulfill({ contentType: "text/html", body: "<h1>Loading</h1>" });
        setTimeout(() => void page.close(), 100);
      }
    });
    Object.assign(client, { browserbaseCloud: {
      browser: page.context().browser(), context: page.context(), page,
      async reconnect() { reconnects += 1; }, async close() {},
    } });
    await assert.rejects(client.prepareAppointmentFlow(job, {
      email: "fixture@example.invalid", password: "fixture-only",
    }));
    assert.equal(submits, 1);
    assert.equal(reconnects, 0);
  });
});
