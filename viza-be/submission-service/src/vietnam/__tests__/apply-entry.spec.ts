import { test } from "node:test";
import assert from "node:assert/strict";
import type { Page } from "@playwright/test";
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
  // Keep this ordering assertion independent of browser scheduling. Under a
  // loaded full-suite run, a real Playwright scroll can consume the tiny
  // review timeout before clickOwned reaches its ownership check. The narrow
  // locator double below still exercises the production path through
  // scrollIntoViewIfNeeded and clickOwned, while making those operations
  // deterministic and recording their order.
  const events: string[] = [];
  let clicked = false;
  const ownershipLost = new RunnerJobOwnershipLostError("lease lost before review transition");
  const button = {
    scrollIntoViewIfNeeded: async (): Promise<void> => {
      events.push("scroll");
    },
    click: async (): Promise<void> => {
      events.push("click");
      clicked = true;
    },
  };
  const emptyLocator = {
    first: () => emptyLocator,
    count: async (): Promise<number> => 0,
  };
  const reviewLocator = {
    evaluateAll: async (): Promise<unknown[]> => [
      {
        domIndex: 0,
        label: "Save and Next",
        isPrimary: true,
        type: "button",
        top: 0,
        tagName: "button",
        disabled: false,
        visible: true,
      },
    ],
    nth: (): typeof button => button,
  };
  const page = {
    locator: (selector: string) =>
      selector.startsWith("button,") ? reviewLocator : emptyLocator,
    url: (): string => "https://example.test/application",
  } as unknown as Page;
  const execution: RunnerExecutionContext = {
    jobId: "job-vietnam-apply-test",
    workerId: "worker-vietnam-apply-test",
    signal: new AbortController().signal,
    assertOwned: () => {
      events.push("assert");
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
  assert.deepEqual(events, ["scroll", "assert"]);
  assert.equal(clicked, false);
});
