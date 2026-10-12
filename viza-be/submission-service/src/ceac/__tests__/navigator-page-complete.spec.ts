import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { advance, readValidationMessages } from "../navigator";

test("batched validators retain visible errors and observe later visibility changes", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`<div id="ValidationSummary1" hidden>Hidden summary</div>
      ${Array.from({ length: 80 }, (_, index) => `<span id="RequiredFieldValidator${index}" hidden>Hidden ${index}</span>`).join("")}
      <div role="alert"> Visible summary </div>
      <span id="CustomValidatorVisible"> Visible field </span>
      <span class="field-validation-error" style="visibility:hidden">Invisible field</span>`);
    assert.deepEqual(await readValidationMessages(page), {
      summary: ["Visible summary"], fieldErrors: ["Visible field"], all: ["Visible summary", "Visible field"],
    });
    await page.locator("#RequiredFieldValidator17").evaluate(node => node.removeAttribute("hidden"));
    const next = await readValidationMessages(page);
    assert.deepEqual(next.fieldErrors, ["Hidden 17", "Visible field"]);
  } finally { await browser.close(); }
});

const PERSONAL_1_URL =
  "https://ceac.state.gov/GenNIV/General/complete/complete_personal.aspx?node=Personal1";

type PromptAction =
  | "dom"
  | "delayed-redirect"
  | "delayed-same-page"
  | "foreign-redirect"
  | "pending-403"
  | "disabled";

interface FixtureOptions {
  promptVisible: boolean;
  promptDelayMs?: number;
  promptAction?: PromptAction;
  responseDelayMs?: number;
  pageHeading?: string;
}

function pageHtml(options: FixtureOptions): string {
  const hidden = options.promptVisible ? "" : " hidden";
  const promptAction = options.promptAction ?? "dom";
  const nextAction = options.promptVisible || options.promptDelayMs != null
    ? "event.preventDefault();"
    : "event.preventDefault(); document.querySelector('h2').textContent='Personal Information 2';";
  const continuationAction = promptAction === "delayed-redirect"
    ? "window.location.href='/GenNIV/General/complete/complete_personal.aspx?node=Personal2&slow=1'; return false;"
    : promptAction === "delayed-same-page"
      ? "window.location.href='/GenNIV/General/complete/complete_personal.aspx?node=Personal1&slow=1'; return false;"
      : promptAction === "foreign-redirect"
        ? "window.location.href='https://foreign.example/GenNIV/General/complete/complete_personal.aspx?node=Personal2&slow=1'; return false;"
      : promptAction === "pending-403"
        ? "window.location.href='/GenNIV/General/complete/complete_personal.aspx?node=Personal2&forbidden=1'; return false;"
        : promptAction === "disabled"
          ? "event.preventDefault();"
          : "event.preventDefault(); document.querySelector('h2').textContent='Personal Information 2'; document.body.dataset.continued='yes';";
  const continuationDisabled = promptAction === "disabled" ? " disabled" : "";
  const delayedPrompt = options.promptDelayMs == null
    ? ""
    : `<script>setTimeout(() => document.querySelector('#pageCompletePrompt')?.removeAttribute('hidden'), ${options.promptDelayMs});</script>`;
  return `<!doctype html>
<html><body>
  <h2>${options.pageHeading ?? "Personal Information 1"}</h2>
  <form>
    <input id="next" class="next" type="submit" value="Next: Personal 2"
      onclick="${nextAction}">
    <div id="pageCompletePrompt"${hidden}>
      <p>Your DS-160 is complete. Do you want to return to the Review section?</p>
      <input id="yesReview" type="submit" value="Yes – Return to Review"
        onclick="event.preventDefault(); document.body.dataset.returned='yes';">
      <input id="btnNextPageComplete" type="submit" value="No – Continue Form"${continuationDisabled}
        onclick="${continuationAction}">
    </div>
  </form>
  ${delayedPrompt}
</body></html>`;
}

async function openFixture(options: FixtureOptions) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route("https://ceac.state.gov/GenNIV/**", async route => {
    const requestUrl = new URL(route.request().url());
    const node = requestUrl.searchParams.get("node");
    const delayed = requestUrl.searchParams.has("slow") || requestUrl.searchParams.has("forbidden");
    if (delayed) {
      await new Promise(resolve => setTimeout(resolve, options.responseDelayMs ?? 5_500));
    }
    if (requestUrl.searchParams.has("forbidden")) {
      await route.fulfill({
        status: 403,
        contentType: "text/html",
        body: pageHtml({ promptVisible: false, promptAction: "dom" }),
      });
      return;
    }
    await route.fulfill({
      contentType: "text/html",
      body: node === "Personal2" && delayed
        ? pageHtml({ promptVisible: false, promptAction: "dom", pageHeading: "Personal Information 2" })
      : pageHtml(options),
    });
  });
  if (options.promptAction === "foreign-redirect") {
    await page.route("https://foreign.example/**", async route => {
      await new Promise(resolve => setTimeout(resolve, options.responseDelayMs ?? 5_500));
      await route.fulfill({
        contentType: "text/html",
        body: pageHtml({
          promptVisible: false,
          promptAction: "dom",
          pageHeading: "Personal Information 2",
        }),
      });
    });
  }
  await page.goto(PERSONAL_1_URL);
  return { browser, page };
}

test("continues through the visible CEAC complete prompt on Personal Information 1", async () => {
  const { browser, page } = await openFixture({ promptVisible: true });
  try {
    const destination = await advance(page, {
      from: "personal_information_1",
      to: "personal_information_2",
      timeoutMs: 4_000,
      pollIntervalMs: 20,
    });

    assert.equal(destination, "personal_information_2");
    assert.equal(await page.locator("body").getAttribute("data-continued"), "yes");
    assert.equal(await page.locator("body").getAttribute("data-returned"), null);
  } finally {
    await browser.close();
  }
});

test("does not click a hidden complete prompt during ordinary navigation", async () => {
  const { browser, page } = await openFixture({ promptVisible: false });
  try {
    const destination = await advance(page, {
      from: "personal_information_1",
      to: "personal_information_2",
      timeoutMs: 4_000,
      pollIntervalMs: 20,
    });

    assert.equal(destination, "personal_information_2");
    assert.equal(await page.locator("body").getAttribute("data-continued"), null);
  } finally {
    await browser.close();
  }
});

test("waits for a delayed complete prompt before probing the destination", async () => {
  const { browser, page } = await openFixture({ promptVisible: false, promptDelayMs: 50 });
  try {
    const destination = await advance(page, {
      from: "personal_information_1",
      to: "personal_information_2",
      timeoutMs: 4_000,
      pollIntervalMs: 20,
    });

    assert.equal(destination, "personal_information_2");
    assert.equal(await page.locator("body").getAttribute("data-continued"), "yes");
  } finally {
    await browser.close();
  }
});

test("reconciles a continuation redirect that exceeds Playwright's click timeout without clicking twice", async () => {
  const { browser, page } = await openFixture({
    promptVisible: true,
    promptAction: "delayed-redirect",
    responseDelayMs: 5_500,
  });
  let personal2Requests = 0;
  page.on("request", request => {
    if (new URL(request.url()).searchParams.get("node") === "Personal2") personal2Requests += 1;
  });
  try {
    const destination = await advance(page, {
      from: "personal_information_1",
      to: "personal_information_2",
      timeoutMs: 9_000,
      pollIntervalMs: 20,
    });

    assert.equal(destination, "personal_information_2");
    assert.equal(personal2Requests, 1);
  } finally {
    await browser.close();
  }
});

test("surfaces a gate when an ambiguous continuation receives HTTP 403", async () => {
  const { browser, page } = await openFixture({
    promptVisible: true,
    promptAction: "pending-403",
    responseDelayMs: 5_500,
  });
  try {
    await assert.rejects(
      () => advance(page, {
        from: "personal_information_1",
        to: "personal_information_2",
        timeoutMs: 9_000,
        pollIntervalMs: 20,
      }),
      (error: unknown) => error instanceof Error
        && "code" in error
        && error.code === "GATE_DETECTED",
    );
  } finally {
    await browser.close();
  }
});

test("rejects an expected next heading after a foreign-origin continuation", async () => {
  const { browser, page } = await openFixture({
    promptVisible: true,
    promptAction: "foreign-redirect",
    responseDelayMs: 5_500,
  });
  try {
    await assert.rejects(
      () => advance(page, {
        from: "personal_information_1",
        to: "personal_information_2",
        timeoutMs: 9_000,
        pollIntervalMs: 20,
      }),
      (error: unknown) => error instanceof Error
        && "code" in error
        && error.code === "NAVIGATION_FAILED",
    );
    await page.waitForURL(/foreign\.example/, { timeout: 3_000 });
    assert.equal(await page.locator("h2").textContent(), "Personal Information 2");
  } finally {
    await browser.close();
  }
});

test("rejects an ambiguous continuation that returns to the unchanged source page", async () => {
  const { browser, page } = await openFixture({
    promptVisible: true,
    promptAction: "delayed-same-page",
    responseDelayMs: 5_500,
  });
  try {
    await assert.rejects(
      () => advance(page, {
        from: "personal_information_1",
        to: "personal_information_2",
        timeoutMs: 9_000,
        pollIntervalMs: 20,
      }),
      (error: unknown) => error instanceof Error
        && "code" in error
        && error.code === "NAVIGATION_FAILED",
    );
    assert.equal(await page.locator("h2").textContent(), "Personal Information 1");
  } finally {
    await browser.close();
  }
});

test("does not treat a pre-dispatch continuation timeout as a successful navigation", async () => {
  const { browser, page } = await openFixture({
    promptVisible: true,
    promptAction: "disabled",
  });
  try {
    await assert.rejects(
      () => advance(page, {
        from: "personal_information_1",
        to: "personal_information_2",
        timeoutMs: 6_000,
        pollIntervalMs: 20,
      }),
      (error: unknown) => error instanceof Error && error.name === "TimeoutError",
    );
    assert.equal(await page.locator("h2").textContent(), "Personal Information 1");
    assert.equal(await page.locator("#btnNextPageComplete").isVisible(), true);
  } finally {
    await browser.close();
  }
});
