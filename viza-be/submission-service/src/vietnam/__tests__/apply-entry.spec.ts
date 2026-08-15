import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium, type Page } from "@playwright/test";
import { chooseVietnamApplyEntry } from "../apply-entry.js";
import { advanceVietnamToReview } from "../run.js";
import { RunnerJobOwnershipLostError, type RunnerExecutionContext } from "../../queue/execution-context.js";

test("vn.apply-entry: prefers the visible Apply button over direct route navigation", () => {
  assert.deepEqual(
    chooseVietnamApplyEntry({
      buttons: [
        { index: 0, text: "Login", visible: true },
        { index: 1, text: "Apply now", visible: true },
      ],
      links: [{ href: "https://evisa.gov.vn/e-visa/foreigners" }],
    }),
    { kind: "button", index: 1 },
  );
});

test("vn.apply-entry: falls back to the official form link when no visible button exists", () => {
  assert.deepEqual(
    chooseVietnamApplyEntry({
      buttons: [{ index: 0, text: "Apply now", visible: false }],
      links: [{ href: "https://evisa.gov.vn/e-visa/foreigners" }],
    }),
    { kind: "link", href: "https://evisa.gov.vn/e-visa/foreigners" },
  );
});

test("vn.review: ownership is checked immediately before Save/Next", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <button type="button" class="ant-btn ant-btn-primary" onclick="window.reviewClicked = true">Save and Next</button>
      </main>
    `);
    const ownershipLost = new RunnerJobOwnershipLostError("lease lost before review transition");
    const execution: RunnerExecutionContext = {
      jobId: "job-vietnam-apply-test",
      workerId: "worker-vietnam-apply-test",
      signal: new AbortController().signal,
      assertOwned: () => {
        throw ownershipLost;
      },
      checkpoint: () => {
        throw ownershipLost;
      },
    };

    await assert.rejects(
      () => (advanceVietnamToReview as unknown as (
        page: Page,
        timeoutMs: number,
        executionContext: RunnerExecutionContext,
      ) => Promise<unknown>)(page, 100, execution),
      (error: unknown) => error === ownershipLost,
    );
    assert.equal(
      await page.evaluate(() => Boolean((window as typeof window & { reviewClicked?: boolean }).reviewClicked)),
      false,
    );
  } finally {
    await browser.close();
  }
});
