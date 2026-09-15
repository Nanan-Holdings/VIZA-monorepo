import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test } from "node:test";
import { chromium, type Page } from "@playwright/test";
import {
  loadUSAppointmentRunnerConfig,
  type AppointmentAccountCredentials,
} from "../runner";
import { PlaywrightUSVisaSchedulingPortalClient, isUSVisaSchedulingRegistrationPasswordValid } from "../usvisascheduling-portal";

type RegistrationMode =
  | "success"
  | "duplicate"
  | "create-failure"
  | "return-login"
  | "return-login-terms"
  | "return-login-terms-delayed"
  | "return-login-terms-mismatch"
  | "delayed-verification";

type RegistrationFixture = {
  client: PlaywrightUSVisaSchedulingPortalClient;
  page: Page;
  baseUrl: string;
  counts: { home: number; send: number; create: number };
  sentFields: { username: boolean; email: boolean; givenName: boolean; surname: boolean };
  close: () => Promise<void>;
};

const credentials: AppointmentAccountCredentials = {
  email: "applicant@example.com",
  password: "TestPassword@123",
  givenName: "Test Given",
  surname: "Test Surname",
  accountStatus: "account_creation_started",
  emailVerified: false,
};

function registrationPage(): string {
  return `<!doctype html>
    <h1>USVisaScheduling registration</h1>
    <form id="registration-form">
      <label>Username <input id="signInName" name="signInName"></label>
      <label>Password <input id="newPassword" name="newPassword" type="password"></label>
      <label>Confirm password <input id="reenterPassword" name="reenterPassword" type="password"></label>
      <label>Email <input id="email" name="email" type="email"></label>
      <label>Given name <input id="givenName" name="givenName"></label>
      <label>Surname <input id="surname" name="surname"></label>
      <label>Question 1 <select id="extension_kbq1"><option>Select</option><option>Q1</option></select></label>
      <label>Answer 1 <input id="extension_kba1"></label>
      <label>Question 2 <select id="extension_kbq2"><option>Select</option><option>Q2</option></select></label>
      <label>Answer 2 <input id="extension_kba2"></label>
      <label>Question 3 <select id="extension_kbq3"><option>Select</option><option>Q3</option></select></label>
      <label>Answer 3 <input id="extension_kba3"></label>
      <button id="email_ver_but_send" type="button">Send Verification Code</button>
      <section id="verification" hidden>
        <label>Verification code <input id="email_ver_input"></label>
        <button id="email_ver_but_verify" type="button">Verify Code</button>
        <button id="email_ver_but_edit" type="button" hidden>Change email</button>
        <div id="email_success" hidden>Email verified.</div>
      </section>
      <div id="registration-error" class="error" hidden></div>
      <button id="continue" type="button" hidden>Create Account</button>
    </form>
    <script>
      const form = document.querySelector('#registration-form');
      const mode = new URLSearchParams(location.search).get('mode') || 'success';
      const verification = document.querySelector('#verification');
      const error = document.querySelector('#registration-error');
      const success = document.querySelector('#email_success');
      document.querySelector('#email_ver_but_send').addEventListener('click', async () => {
        await fetch('/send', { method: 'POST', body: new URLSearchParams(new FormData(form)) });
        if (mode === 'duplicate') {
          error.textContent = 'Account already exists';
          error.hidden = false;
          return;
        }
        if (mode === 'delayed-verification') {
          setTimeout(() => { verification.hidden = false; }, 2500);
        } else {
          verification.hidden = false;
        }
      });
      document.querySelector('#email_ver_but_verify').addEventListener('click', () => {
        if (document.querySelector('#email_ver_input').value !== '123456') {
          error.textContent = 'Invalid verification code';
          error.hidden = false;
          return;
        }
        error.hidden = true;
        document.querySelector('#email_ver_input').hidden = true;
        document.querySelector('#email_ver_but_verify').hidden = true;
        document.querySelector('#email_ver_but_edit').hidden = false;
        success.hidden = false;
        document.querySelector('#continue').hidden = false;
      });
      document.querySelector('#continue').addEventListener('click', async () => {
        const response = await fetch('/create', { method: 'POST' });
        document.open();
        document.write(await response.text());
        document.close();
      });
    </script>`;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function returnToLoginPage(): string {
  return `<h1>Sign in</h1><form action="https://www.usvisascheduling.com/en-US/" method="post">
    <input id="signInName" name="signInName"><input id="password" name="password" type="password">
    <button type="submit">Sign In</button></form>`;
}

function profilePage(primaryEmail: string): string {
  return `<h1>Profile</h1>
    <a href="mailto:${primaryEmail}">${primaryEmail}</a>
    <a href="/Account/Login/LogOff" hidden>LogOff</a>
    <button id="change-password" type="button">Change password</button>
    <input id="firstname" value="Test Given">`;
}

function termsAndConditionsPage(primaryEmail: string): string {
  const profileHtml = profilePage(primaryEmail);
  return `<!doctype html>
    <h1>Terms and Conditions</h1>
    <label><input id="privacy-act-visual" type="checkbox"> Privacy Act</label>
    <label><input id="confidentiality-agreement" type="checkbox"> Confidentiality agreement</label>
    <input id="submit-agreement" type="submit" value="Continue" disabled>
    <script>
      history.replaceState({}, '', '/en-US/Account/Login/TermsAndConditions');
      const privacy = document.querySelector('#privacy-act-visual');
      const confidentiality = document.querySelector('#confidentiality-agreement');
      const submit = document.querySelector('#submit-agreement');
      const trace = [];
      const sync = () => {
        submit.disabled = !(privacy.checked && confidentiality.checked);
        trace.push([privacy.checked, confidentiality.checked, submit.disabled].join(':'));
        document.documentElement.dataset.termsTrace = trace.join('|');
      };
      privacy.addEventListener('change', sync);
      confidentiality.addEventListener('change', sync);
      sync();
      submit.addEventListener('click', (event) => {
        event.preventDefault();
        history.pushState({}, '', '/en-US/profile/');
        document.body.innerHTML = ${JSON.stringify(profileHtml)};
      });
    </script>`;
}

function delayedTermsAndConditionsPage(primaryEmail: string): string {
  const profileHtml = profilePage(primaryEmail);
  const controlsHtml = `
    <h1>Terms and Conditions</h1>
    <label><input id="privacy-act-visual" type="checkbox"> Privacy Act</label>
    <label><input id="confidentiality-agreement" type="checkbox"> Confidentiality agreement</label>
    <input id="submit-agreement" type="submit" value="Continue" disabled>`;
  return `<!doctype html>
    <h1>Terms and Conditions</h1>
    <form><label>Username <input id="signInName" name="signInName"></label>
      <label>Password <input id="password" name="password" type="password"></label></form>
    <script>
      history.replaceState({}, '', '/en-US/Account/Login/TermsAndConditions');
      setTimeout(() => {
        document.body.innerHTML = ${JSON.stringify(controlsHtml)};
        const privacy = document.querySelector('#privacy-act-visual');
        const confidentiality = document.querySelector('#confidentiality-agreement');
        const submit = document.querySelector('#submit-agreement');
        const sync = () => { submit.disabled = !(privacy.checked && confidentiality.checked); };
        privacy.addEventListener('change', sync);
        confidentiality.addEventListener('change', sync);
        sync();
        submit.addEventListener('click', (event) => {
          event.preventDefault();
          history.pushState({}, '', '/en-US/profile/');
          document.body.innerHTML = ${JSON.stringify(profileHtml)};
        });
      }, 12_000);
    </script>`;
}

async function withRegistrationFixture(
  mode: RegistrationMode,
  run: (fixture: RegistrationFixture) => Promise<void>,
): Promise<void> {
  const counts = { home: 0, send: 0, create: 0 };
  const sentFields = { username: false, email: false, givenName: false, surname: false };
  const server = createServer(async (request, response: ServerResponse) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    if (request.url === "/") {
      counts.home += 1;
      response.end("<h1>Sign in</h1><a href='/signup'>Sign up now</a>");
      return;
    }
    if (request.url?.startsWith("/signup")) {
      response.end(registrationPage().replace("</h1>", `</h1><script>history.replaceState({}, '', '/signup?mode=${mode}')</script>`));
      return;
    }
    if (request.url === "/send" && request.method === "POST") {
      counts.send += 1;
      const fields = new URLSearchParams(await readBody(request));
      sentFields.username = Boolean(fields.get("signInName"));
      sentFields.email = fields.get("email") === credentials.email;
      sentFields.givenName = fields.get("givenName") === credentials.givenName;
      sentFields.surname = fields.get("surname") === credentials.surname;
      response.end("ok");
      return;
    }
    if (request.url === "/create" && request.method === "POST") {
      counts.create += 1;
      if (mode === "create-failure") {
        response.end("<h1>Registration</h1><div class='error'>Account creation failed</div>");
      } else if (
        mode === "return-login"
        || mode === "return-login-terms"
        || mode === "return-login-terms-delayed"
        || mode === "return-login-terms-mismatch"
      ) {
        response.end(returnToLoginPage());
      } else {
        response.end("<h1>Account created successfully.</h1>");
      }
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
    await run({
      client,
      page,
      baseUrl,
      counts,
      sentFields,
      close: async () => {
        await client.close();
        await browser.close();
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      },
    });
  } finally {
    await client.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("registration fills B2C fields, sends a code, verifies it, and reports only explicit create success", async () => {
  await withRegistrationFixture("success", async ({ client, counts, sentFields }) => {
    const started = await client.registerAccount(credentials);
    assert.equal(started.readyForSlotCapture, false);
    assert.equal(started.gate?.actionType, "account_email_verification");
    assert.equal(started.emailVerified, false);
    assert.equal(started.accountCreated, false);
    assert.ok(started.verificationRequestedAt);
    assert.ok(Date.parse(started.verificationRequestedAt) <= Date.now());
    assert.equal(counts.send, 1);
    assert.equal(counts.create, 0);
    assert.deepEqual(sentFields, { username: true, email: true, givenName: true, surname: true });

    const completed = await client.completeAccountEmailVerification({ emailCode: "123456" });
    assert.equal(completed.gate, undefined);
    assert.equal(completed.emailVerified, true);
    assert.equal(completed.accountCreated, true);
    assert.equal(completed.readyForSlotCapture, false);
    assert.equal(counts.create, 1);
  });
});

test("registration waits for the delayed B2C verification widget without sending twice", async () => {
  await withRegistrationFixture("delayed-verification", async ({ client, counts }) => {
    const started = await client.registerAccount(credentials);
    assert.equal(started.gate?.actionType, "account_email_verification");
    assert.equal(counts.send, 1);
    const completed = await client.completeAccountEmailVerification({ emailCode: "123456" });
    assert.equal(completed.accountCreated, true);
    assert.equal(completed.emailVerified, true);
    assert.equal(counts.create, 1);
  });
});

test("registration password policy rejects invalid saved credentials before browser access", async () => {
  assert.equal(isUSVisaSchedulingRegistrationPasswordValid(credentials.password), true);
  for (const password of ["short1A", "StrongTestPassword@123", "TestPassword!123", "onlylowercase", "Abc12345 "]) {
    assert.equal(isUSVisaSchedulingRegistrationPasswordValid(password), false);
  }
  const client = new PlaywrightUSVisaSchedulingPortalClient(loadUSAppointmentRunnerConfig({}));
  const result = await client.registerAccount({ ...credentials, password: "StrongTestPassword!123" });
  assert.equal(result.gate?.errorCode, "registration_password_policy_invalid");
  assert.equal(result.accountCreated, false);
  assert.equal(result.verificationRequestedAt, undefined);
});

test("wrong verification code stops before Create", async () => {
  await withRegistrationFixture("success", async ({ client, counts }) => {
    await client.registerAccount(credentials);
    const result = await client.completeAccountEmailVerification({ emailCode: "000000" });
    assert.equal(result.gate?.errorCode, "verification_code_invalid");
    assert.equal(result.emailVerified, false);
    assert.equal(result.accountCreated, false);
    assert.equal(counts.create, 0);
  });
});

for (const loginAccepted of [true, false]) {
  test(`registration authenticates once after Create returns to sign-in (accepted=${loginAccepted})`, { timeout: 60_000 }, async () => {
    await withRegistrationFixture("return-login", async ({ client, page, counts }) => {
      let loginRequests = 0;
      // The official-host response is fulfilled locally; no network request
      // or credentials leave this fixture.
      await page.route("https://www.usvisascheduling.com/**", async (route) => {
        loginRequests += 1;
        assert.equal(route.request().method(), "POST");
        await route.fulfill({ contentType: "text/html", body: loginAccepted
          ? '<h1>MRV payment required</h1><a href="/logout">Sign out</a>'
          : '<div class="error">Username or password is invalid.</div>' });
      });
      await client.registerAccount(credentials);
      const result = await client.completeAccountEmailVerification({ emailCode: "123456" });
      assert.equal(counts.create, 1);
      assert.equal(loginRequests, 1);
      assert.equal(result.accountCreated, loginAccepted);
      assert.equal(result.emailVerified, true);
      assert.equal(result.readyForSlotCapture, false);
      assert.equal(result.gate?.errorCode, loginAccepted ? undefined : "account_creation_login_failed");
    });
  });
}

test("registration accepts the official terms checkpoint and requires bound profile evidence", { timeout: 60_000 }, async () => {
  await withRegistrationFixture("return-login-terms", async ({ client, page, counts }) => {
    const officialPaths: string[] = [];
    await page.route("https://www.usvisascheduling.com/**", async (route) => {
      const request = route.request();
      officialPaths.push(new URL(request.url()).pathname);
      assert.equal(request.method(), "POST");
      await route.fulfill({
        contentType: "text/html",
        body: termsAndConditionsPage(credentials.email),
      });
    });

    await client.registerAccount(credentials);
    const completed = await client.completeAccountEmailVerification({ emailCode: "123456" });

    assert.equal(counts.create, 1);
    assert.equal(completed.emailVerified, true);
    assert.equal(completed.accountCreated, true);
    assert.equal(completed.gate, undefined);
    assert.equal(completed.readyForSlotCapture, false);
    assert.equal(page.url(), "https://www.usvisascheduling.com/en-US/profile/");
    assert.equal(
      await page.locator("html").getAttribute("data-terms-trace"),
      "false:false:true|true:false:true|true:true:false",
    );
    assert.equal(await page.locator(`a[href="mailto:${credentials.email}"]`).count(), 1);
    assert.equal(await page.locator("a[href*='/Account/Login/LogOff']").isVisible(), false);
    assert.equal(await page.locator("#change-password").isVisible(), true);
    assert.equal(await page.locator("#firstname").isVisible(), true);
    assert.doesNotMatch(await page.locator("body").innerText(), /update|payment|booked/i);
    assert.equal(officialPaths.some((path) => /update|payment|booked/i.test(path)), false);
  });
});

test("registration waits on the same tab when the terms URL arrives before its controls", { timeout: 60_000 }, async () => {
  await withRegistrationFixture("return-login-terms-delayed", async ({ client, page, counts }) => {
    await page.route("https://www.usvisascheduling.com/**", async (route) => {
      assert.equal(route.request().method(), "POST");
      await route.fulfill({
        contentType: "text/html",
        body: delayedTermsAndConditionsPage(credentials.email),
      });
    });

    await client.registerAccount(credentials);
    const completed = await client.completeAccountEmailVerification({ emailCode: "123456" });

    assert.equal(counts.create, 1);
    assert.equal(completed.emailVerified, true);
    assert.equal(completed.accountCreated, true);
    assert.equal(completed.gate, undefined);
    assert.equal(page.url(), "https://www.usvisascheduling.com/en-US/profile/");
    assert.equal(await page.locator("#firstname").isVisible(), true);
  });
});

test("registration rejects a profile whose primary email does not match the bound account", { timeout: 60_000 }, async () => {
  await withRegistrationFixture("return-login-terms-mismatch", async ({ client, page }) => {
    await page.route("https://www.usvisascheduling.com/**", async (route) => {
      assert.equal(route.request().method(), "POST");
      await route.fulfill({
        contentType: "text/html",
        body: termsAndConditionsPage("different@example.com"),
      });
    });

    await client.registerAccount(credentials);
    const completed = await client.completeAccountEmailVerification({ emailCode: "123456" });

    assert.equal(completed.emailVerified, true);
    assert.equal(completed.accountCreated, false);
    assert.equal(completed.gate?.errorCode, "account_creation_unconfirmed");
    assert.equal(page.url(), "https://www.usvisascheduling.com/en-US/profile/");
    assert.equal(await page.locator(`a[href="mailto:${credentials.email}"]`).count(), 0);
    assert.equal(await page.locator("a[href='mailto:different@example.com']").count(), 1);
  });
});

test("duplicate registration response is surfaced and never reaches verification or Create", async () => {
  await withRegistrationFixture("duplicate", async ({ client, counts }) => {
    const result = await client.registerAccount(credentials);
    assert.equal(result.gate?.errorCode, "account_already_exists");
    assert.equal(result.accountCreated, false);
    assert.equal(counts.send, 1);
    assert.equal(counts.create, 0);
  });
});

test("Create failure never reports account creation success", async () => {
  await withRegistrationFixture("create-failure", async ({ client, counts }) => {
    await client.registerAccount(credentials);
    const result = await client.completeAccountEmailVerification({ emailCode: "123456" });
    assert.equal(result.gate?.errorCode, "account_creation_failed");
    assert.equal(result.emailVerified, true);
    assert.equal(result.accountCreated, false);
    assert.equal(counts.create, 1);
  });
});

test("missing registration fields fail before browser navigation or email send", async () => {
  await withRegistrationFixture("success", async ({ client, counts }) => {
    const result = await client.registerAccount({ ...credentials, surname: "" });
    assert.equal(result.gate?.errorCode, "registration_required_fields_missing");
    assert.equal(result.gate?.metadata.operation, "preflight");
    assert.equal(counts.home, 0);
    assert.equal(counts.send, 0);
  });
});

test("completed account status blocks duplicate registration before navigation", async () => {
  await withRegistrationFixture("success", async ({ client, counts }) => {
    const result = await client.registerAccount({
      ...credentials,
      accountStatus: "active",
    } as AppointmentAccountCredentials & { accountStatus: string });
    assert.equal(result.gate?.errorCode, "account_already_exists");
    assert.equal(counts.home, 0);
    assert.equal(counts.send, 0);
  });
});

test("unknown account state cannot start registration", async () => {
  await withRegistrationFixture("success", async ({ client, counts }) => {
    const result = await client.registerAccount({ ...credentials, accountStatus: "unknown" });
    assert.equal(result.gate?.errorCode, "account_registration_state_unknown");
    assert.equal(counts.home, 0);
    assert.equal(counts.send, 0);
  });
});

test("runner preparation validates new account names before opening the portal", async () => {
  await withRegistrationFixture("success", async ({ client, counts }) => {
    const result = await client.prepareAppointmentFlow({
      id: "job-1", application_id: "application-1", user_id: "user-1", appointment_account_id: "account-1",
      applying_country_code: "CN", applying_post_city: "Beijing", scheduling_provider: "usvisascheduling",
      status: "appointment_account_required", mode: "assisted_live", user_preferences_json: null,
      requires_user_action: false, current_manual_action: null, updated_at: null,
    }, { ...credentials, surname: null });
    assert.equal(result.readyForSlotCapture, false);
    assert.ok(result.gate);
    assert.equal(counts.home, 0);
    assert.equal(counts.send, 0);
  });
});

test("link-only verification is unsupported without navigation or Create", async () => {
  await withRegistrationFixture("success", async ({ client, page, counts }) => {
    await client.registerAccount(credentials);
    const before = page.url();
    const result = await client.completeAccountEmailVerification({
      verificationLink: "https://evil.example/verify?token=secret",
    });
    assert.equal(result.gate?.errorCode, "verification_link_unsupported");
    assert.equal(result.accountCreated, false);
    assert.equal(page.url(), before);
    assert.equal(counts.create, 0);
  });
});
