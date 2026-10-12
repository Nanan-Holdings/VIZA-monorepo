import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { chromium, type Page } from "@playwright/test";
import {
  setupUSVisaSchedulingProfile,
  type USVisaSchedulingProfileSetupResult,
} from "../profile-setup";

const credentials = {
  email: "managed@example.com",
  givenName: "Actual",
  surname: "Applicant",
} as const;

type FixtureAction =
  | "success_message"
  | "error_message"
  | "trusted_navigation"
  | "unexpected_navigation"
  | "neutral_message";

interface FixtureOptions {
  action?: FixtureAction;
  primaryEmail?: string;
}

function profileHtml(): string {
  return `<!doctype html>
    <html><body>
      <h1>Profile</h1>
      <a id="primary-email" href="mailto:managed@example.com">managed@example.com</a>
      <label>First name <input id="firstname" value="Prefilled"></label>
      <label>Last name <input id="lastname" value="Name"></label>
      <label>Contact email <input id="atlas_emailaddress1" value=""></label>
      <label>Preferred language
        <select id="adx_preferredlanguageid">
          <option value="">Choose</option>
          <option value="en">English</option>
          <option value="zh">Chinese</option>
        </select>
      </label>
      <label>Country
        <select id="atlas_country">
          <option value="">Choose</option>
          <option value="hidden-china" hidden>China</option>
          <option value="cn">China</option>
          <option value="us">United States</option>
        </select>
      </label>
      <input id="frm_pref_RANDOM" name="frm_pref_RANDOM" aria-label="Leave this field blank" value="">
      <input id="unrelated" value="keep">
      <input id="UpdateButton" type="button" value="Update">
      <div id="MessagePanel" hidden></div>
      <script>
        document.querySelector('#UpdateButton').addEventListener('click', async () => {
          const response = await fetch('/profile-update', { method: 'POST' });
          const result = await response.json();
          if (result.redirect) {
            location.href = result.redirect;
            return;
          }
          const panel = document.querySelector('#MessagePanel');
          panel.textContent = result.message;
          panel.hidden = false;
        });
      </script>
    </body></html>`;
}

async function withFixture(
  options: FixtureOptions,
  run: (page: Page, origin: string, updateCount: () => number) => Promise<void>,
): Promise<void> {
  let updates = 0;
  const server = createServer((request, response) => {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    if (request.url === "/en-US/profile/") {
      response.end(profileHtml().replace(
        "mailto:managed@example.com",
        `mailto:${options.primaryEmail ?? credentials.email}`,
      ));
      return;
    }
    if (request.url === "/en-US/" || request.url === "/en-US/home/") {
      response.end("<h1 id='pagetitle'>Apply for a U.S. Visa:</h1><a id='start_application' href='/en-US/applicant_details/'>Start Application</a>");
      return;
    }
    if (request.url === "/en-US/error/") {
      response.end("<h1>Error</h1>");
      return;
    }
    if (request.url === "/profile-update" && request.method === "POST") {
      updates += 1;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      if (options.action === "trusted_navigation") {
        response.end(JSON.stringify({ redirect: "/en-US/" }));
      } else if (options.action === "unexpected_navigation") {
        response.end(JSON.stringify({ redirect: "/en-US/error/" }));
      } else if (options.action === "error_message") {
        response.end(JSON.stringify({ message: "E-mail Address cannot be empty." }));
      } else if (options.action === "neutral_message") {
        response.end(JSON.stringify({ message: "Profile request accepted." }));
      } else {
        response.end(JSON.stringify({ message: "Profile updated successfully." }));
      }
      return;
    }
    response.statusCode = 404;
    response.end("Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/en-US/profile/`, { waitUntil: "domcontentloaded" });
    await run(page, origin, () => updates);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function setupInput(page: Page, origin: string, country = "CN") {
  return {
    page,
    credentials,
    applyingCountryCode: country,
    originOverride: origin,
    timeoutMs: 3_000,
  } as const;
}

function gateCode(result: USVisaSchedulingProfileSetupResult): string | undefined {
  return result.state === "gate" ? result.gate.code : undefined;
}

test("profile setup fills only the observed controls and confirms a success message", async () => {
  await withFixture({ action: "success_message" }, async (page, origin, updateCount) => {
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.deepEqual(result, {
      state: "profileSaved",
      handled: true,
      profileSaved: true,
      evidence: "success_message",
    });
    assert.equal(updateCount(), 1);
    assert.equal(await page.locator("#firstname").inputValue(), credentials.givenName);
    assert.equal(await page.locator("#lastname").inputValue(), credentials.surname);
    assert.equal(await page.locator("#atlas_emailaddress1").inputValue(), credentials.email);
    assert.equal(await page.locator("#adx_preferredlanguageid").inputValue(), "en");
    assert.equal(await page.locator("#atlas_country").inputValue(), "cn");
    assert.equal(await page.locator("#frm_pref_RANDOM").inputValue(), "");
    assert.equal(await page.locator("#unrelated").inputValue(), "keep");
  });
});

test("profile setup treats a trusted post-update navigation as saved", async () => {
  await withFixture({ action: "trusted_navigation" }, async (page, origin, updateCount) => {
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.deepEqual(result, {
      state: "profileSaved",
      handled: true,
      profileSaved: true,
      evidence: "trusted_navigation",
    });
    assert.equal(updateCount(), 1);
    assert.equal(new URL(page.url()).pathname, "/en-US/");
  });
});

test("profile setup preserves matching readonly names without trying to fill them", async () => {
  await withFixture({}, async (page, origin, updateCount) => {
    await page.locator("#firstname").fill(credentials.givenName);
    await page.locator("#lastname").fill(credentials.surname);
    await page.evaluate(() => {
      for (const id of ["firstname", "lastname"]) {
        const input = document.getElementById(id) as HTMLInputElement;
        input.readOnly = true;
        input.dataset.inputEvents = "0";
        input.addEventListener("input", () => { input.dataset.inputEvents = String(Number(input.dataset.inputEvents) + 1); });
      }
    });
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.equal(result.state, "profileSaved");
    assert.equal(updateCount(), 1);
    assert.equal(await page.locator("#firstname").getAttribute("data-input-events"), "0");
    assert.equal(await page.locator("#lastname").getAttribute("data-input-events"), "0");
  });
});

test("profile setup reports the exact readonly mismatch field without exposing its value", async () => {
  await withFixture({}, async (page, origin, updateCount) => {
    await page.locator("#firstname").evaluate((node) => { (node as HTMLInputElement).readOnly = true; });
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.equal(result.state, "gate");
    if (result.state !== "gate") return;
    assert.deepEqual({ code: result.gate.code, operation: result.gate.operation, field: result.gate.field, reason: result.gate.reason }, {
      code: "profile_fill_failed", operation: "fill", field: "firstname", reason: "not_editable",
    });
    assert.equal(updateCount(), 0);
    assert.equal(await page.locator("#firstname").inputValue(), "Prefilled");
    assert.equal(JSON.stringify(result).includes("Prefilled"), false);
    assert.equal(JSON.stringify(result).includes(credentials.givenName), false);
    assert.equal(JSON.stringify(result).includes(credentials.email), false);
  });
});

test("profile setup accepts already matching disabled selects and rejects a different disabled value", async () => {
  await withFixture({}, async (page, origin, updateCount) => {
    await page.locator("#adx_preferredlanguageid").selectOption("en");
    await page.locator("#atlas_country").selectOption("cn");
    await page.locator("#adx_preferredlanguageid").evaluate((node) => { (node as HTMLSelectElement).disabled = true; });
    await page.locator("#atlas_country").evaluate((node) => { (node as HTMLSelectElement).disabled = true; });
    assert.equal((await setupUSVisaSchedulingProfile(setupInput(page, origin))).state, "profileSaved");
    assert.equal(updateCount(), 1);
    await page.locator("#atlas_country").evaluate((node) => { (node as HTMLSelectElement).value = "us"; });
    const mismatched = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.equal(mismatched.state, "gate");
    if (mismatched.state !== "gate") return;
    assert.equal(mismatched.gate.field, "country");
    assert.equal(mismatched.gate.reason, "not_editable");
    assert.equal(updateCount(), 1);
  });
});

test("profile setup detects a provider input handler rejecting the contact value", async () => {
  await withFixture({}, async (page, origin, updateCount) => {
    await page.locator("#atlas_emailaddress1").evaluate((node) => {
      node.addEventListener("input", () => { (node as HTMLInputElement).value = "rejected@example.invalid"; });
    });
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.equal(result.state, "gate");
    if (result.state !== "gate") return;
    assert.equal(result.gate.field, "contact_email");
    assert.equal(result.gate.reason, "readback_mismatch");
    assert.equal(updateCount(), 0);
    assert.equal(JSON.stringify(result).includes("rejected@example.invalid"), false);
    assert.equal(JSON.stringify(result).includes(credentials.email), false);
  });
});

test("profile setup verifies earlier fields again after dependent select changes", async () => {
  await withFixture({}, async (page, origin, updateCount) => {
    await page.locator("#atlas_country").evaluate((node) => {
      node.addEventListener("change", () => { (document.querySelector("#firstname") as HTMLInputElement).value = "Reset by country handler"; });
    });
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.equal(result.state, "gate");
    if (result.state !== "gate") return;
    assert.equal(result.gate.field, "firstname");
    assert.equal(result.gate.reason, "readback_mismatch");
    assert.equal(updateCount(), 0);
  });
});

test("profile setup bounds an action timeout and identifies the disappearing field", async () => {
  await withFixture({}, async (page, origin, updateCount) => {
    page.setDefaultTimeout(30_000);
    await page.locator("#atlas_emailaddress1").evaluate((node) => {
      node.addEventListener("input", () => { (document.querySelector("#atlas_country") as HTMLElement).style.display = "none"; });
    });
    const startedAt = Date.now();
    const result = await setupUSVisaSchedulingProfile({ ...setupInput(page, origin), timeoutMs: 1_000 });
    assert.ok(Date.now() - startedAt < 5_000, "Profile operations must honor their own bounded timeout.");
    assert.equal(result.state, "gate");
    if (result.state !== "gate") return;
    assert.equal(result.gate.field, "country");
    assert.equal(result.gate.reason, "operation_timeout");
    assert.equal(updateCount(), 0);
    assert.equal(JSON.stringify(result).includes("locator.inputValue"), false);
  });
});

test("profile setup rejects an unknown same-origin post-update navigation", async () => {
  await withFixture({ action: "unexpected_navigation" }, async (page, origin, updateCount) => {
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.equal(result.state, "gate");
    assert.equal(gateCode(result), "profile_unexpected_redirect");
    assert.equal(result.profileSaved, false);
    assert.equal(updateCount(), 1);
  });
});

test("profile setup reports the official update error without claiming success", async () => {
  await withFixture({ action: "error_message" }, async (page, origin, updateCount) => {
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.equal(result.state, "gate");
    assert.equal(gateCode(result), "profile_update_rejected");
    assert.equal(updateCount(), 1);
    assert.equal(JSON.stringify(result).includes("E-mail Address"), false);
  });
});

test("profile setup keeps a non-success response handled but unsaved", async () => {
  await withFixture({ action: "neutral_message" }, async (page, origin, updateCount) => {
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.deepEqual(result, {
      state: "handled",
      handled: true,
      profileSaved: false,
      evidence: "message_observed",
    });
    assert.equal(updateCount(), 1);
  });
});

test("profile setup stops before mutation when the primary mailto does not match", async () => {
  await withFixture({ primaryEmail: "different@example.com" }, async (page, origin, updateCount) => {
    const result = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.equal(result.state, "gate");
    assert.equal(gateCode(result), "primary_email_mismatch");
    assert.equal(updateCount(), 0);
    assert.equal(await page.locator("#firstname").inputValue(), "Prefilled");
    assert.equal(await page.locator("#lastname").inputValue(), "Name");
    assert.equal(await page.locator("#atlas_emailaddress1").inputValue(), "");
  });
});

test("profile setup returns notprofile for non-profile paths and production origin rejects fixtures", async () => {
  await withFixture({}, async (page, origin, updateCount) => {
    await page.goto(`${origin}/en-US/home/`, { waitUntil: "domcontentloaded" });
    const nonProfile = await setupUSVisaSchedulingProfile(setupInput(page, origin));
    assert.deepEqual(nonProfile, {
      state: "notprofile",
      handled: false,
      profileSaved: false,
      reason: "not_profile_path",
    });
    await page.goto(`${origin}/en-US/profile/`, { waitUntil: "domcontentloaded" });
    const defaultOrigin = await setupUSVisaSchedulingProfile({
      page,
      credentials,
      applyingCountryCode: "CN",
      timeoutMs: 3_000,
    });
    assert.equal(defaultOrigin.state, "notprofile");
    assert.equal(updateCount(), 0);
  });
});

test("profile setup validates country and origin before touching profile controls", async () => {
  await withFixture({}, async (page, origin, updateCount) => {
    const unsupported = await setupUSVisaSchedulingProfile(setupInput(page, origin, "US"));
    assert.equal(unsupported.state, "gate");
    assert.equal(gateCode(unsupported), "unsupported_country");
    assert.equal(await page.locator("#firstname").inputValue(), "Prefilled");
    assert.equal(updateCount(), 0);

    const invalidOrigin = await setupUSVisaSchedulingProfile({
      ...setupInput(page, origin),
      originOverride: "https://not-a-loopback.example",
    });
    assert.equal(invalidOrigin.state, "gate");
    assert.equal(gateCode(invalidOrigin), "invalid_origin_override");
    assert.equal(updateCount(), 0);
  });
});
