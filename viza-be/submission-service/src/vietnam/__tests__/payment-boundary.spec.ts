import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import type { Page } from "@playwright/test";
import { __VIETNAM_PAYMENT_BOUNDARY_INTERNALS } from "../run.js";

test("Vietnam boundary-only path captures redacted evidence before return and never resolves a card", async (t) => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "viza-vn-pay-boundary-"));
  t.after(() => fs.rm(outputDir, { recursive: true, force: true }));
  const screenshotPath = path.join(outputDir, "payment-boundary.png");
  const events: string[] = [];
  let cardHookCalls = 0;
  const maskLocator = { kind: "masked-controls" };
  const page = {
    url: () => "https://evisa.gov.vn/payment",
    locator: () => maskLocator,
    screenshot: async (options: { mask?: unknown[] }) => {
      events.push("screenshot");
      assert.deepEqual(options.mask, [maskLocator]);
      return Buffer.from("redacted-vietnam-payment-boundary");
    },
  } as unknown as Page;

  const boundary = await __VIETNAM_PAYMENT_BOUNDARY_INTERNALS.prepareVietnamPaymentBoundary({
    page,
    screenshotPath,
    allowFixedCardPayment: false,
    resolveFixedCard: async () => {
      cardHookCalls += 1;
      throw new Error("card hook must remain unreachable in boundary-only mode");
    },
  });

  assert.equal(cardHookCalls, 0);
  assert.equal(boundary.card, null);
  assert.deepEqual(events, ["screenshot"]);
  assert.equal(boundary.artifact.kind, "payment_boundary");
  assert.equal(boundary.artifact.redacted, true);
  assert.equal(await fs.readFile(boundary.artifact.path, "utf8"), "redacted-vietnam-payment-boundary");
});

