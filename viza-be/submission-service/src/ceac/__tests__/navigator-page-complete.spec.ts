import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { advance } from "../navigator";

const PERSONAL_1_URL =
  "https://ceac.state.gov/GenNIV/General/complete/complete_personal.aspx?node=Personal1";

function pageHtml(options: { promptVisible: boolean; promptDelayMs?: number }): string {
  const hidden = options.promptVisible ? "" : " hidden";
  const nextAction = options.promptVisible || options.promptDelayMs != null
    ? "event.preventDefault();"
    : "event.preventDefault(); document.querySelector('h2').textContent='Personal Information 2';";
  const delayedPrompt = options.promptDelayMs == null
    ? ""
    : `<script>setTimeout(() => document.querySelector('#pageCompletePrompt')?.removeAttribute('hidden'), ${options.promptDelayMs});</script>`;
  return `<!doctype html>
<html><body>
  <h2>Personal Information 1</h2>
  <form>
    <input id="next" class="next" type="submit" value="Next: Personal 2"
      onclick="${nextAction}">
    <div id="pageCompletePrompt"${hidden}>
      <p>Your DS-160 is complete. Do you want to return to the Review section?</p>
      <input id="yesReview" type="submit" value="Yes – Return to Review"
        onclick="event.preventDefault(); document.body.dataset.returned='yes';">
      <input id="btnNextPageComplete" type="submit" value="No – Continue Form"
        onclick="event.preventDefault(); document.querySelector('h2').textContent='Personal Information 2'; document.body.dataset.continued='yes';">
    </div>
  </form>
  ${delayedPrompt}
</body></html>`;
}

async function openFixture(options: { promptVisible: boolean; promptDelayMs?: number }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route("https://ceac.state.gov/GenNIV/**", route =>
    route.fulfill({ contentType: "text/html", body: pageHtml(options) }),
  );
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
