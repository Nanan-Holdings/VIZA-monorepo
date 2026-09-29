import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { detectPage } from "../pages";

const APPLICATION_ID = "AA00TEST1234";

test("does not classify generic confirmation wording as an official confirmation", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`<h2>Confirmation</h2><p>Application ID: ${APPLICATION_ID}</p>`);
    const detected = await detectPage(page, { expectedApplicationId: APPLICATION_ID });
    assert.equal(detected.id, "unknown");
  } finally {
    await browser.close();
  }
});

test("keeps the first non-empty CEAC heading when empty heading nodes precede it", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <h2></h2>
      <h2>Personal Information 1</h2>
      <h2 hidden>Review</h2>
    `);

    const detected = await detectPage(page);
    assert.equal(detected.id, "personal_information_1");
    assert.equal(detected.heading, "Personal Information 1");
  } finally {
    await browser.close();
  }
});

test("requires all official confirmation controls and the matching Application ID", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <h2>Confirmation</h2>
      <p>Application ID: ${APPLICATION_ID}</p>
      <button>Print Confirmation</button>
      <button>Print Application</button>
      <button>Email Confirmation</button>
    `);

    const matching = await detectPage(page, { expectedApplicationId: APPLICATION_ID });
    assert.equal(matching.id, "confirmation");

    const withoutExpected = await detectPage(page);
    assert.equal(withoutExpected.id, "confirmation");

    const mismatched = await detectPage(page, { expectedApplicationId: "AA00OTHER1234" });
    assert.equal(mismatched.id, "unknown");
  } finally {
    await browser.close();
  }
});

test("does not accept a confirmation surface with a hidden official control", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <h2>Confirmation</h2>
      <p>Application ID: ${APPLICATION_ID}</p>
      <button>Print Confirmation</button>
      <button>Print Application</button>
      <button hidden>Email Confirmation</button>
    `);

    const detected = await detectPage(page, { expectedApplicationId: APPLICATION_ID });
    assert.equal(detected.id, "unknown");
  } finally {
    await browser.close();
  }
});
