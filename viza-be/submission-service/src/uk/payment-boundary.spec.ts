import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import type { Page } from "@playwright/test";
import { __UK_RESUME_INTERNALS } from "./resume.js";

test("UK boundary-only path captures redacted evidence and never acquires a card", async (t) => {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "viza-uk-pay-boundary-"));
  t.after(() => fs.rm(outputDir, { recursive: true, force: true }));
  const events: string[] = [];
  let cardHookCalls = 0;
  const maskLocator = { kind: "masked-controls" };
  const page = {
    title: async () => "Payment - Apply for a UK visa",
    url: () => "https://visas-immigration.service.gov.uk/pay",
    textContent: async () => "Your application reference number is GWF123456789",
    locator: () => maskLocator,
    screenshot: async (options: { mask?: unknown[] }) => {
      events.push("screenshot");
      assert.deepEqual(options.mask, [maskLocator]);
      return Buffer.from("redacted-payment-boundary");
    },
  } as unknown as Page;

  const result = await __UK_RESUME_INTERNALS.handleVisiblePaymentBoundary(
    page,
    {
      resumeUrl: "https://visas-immigration.service.gov.uk/resume/example",
      password: "not-used",
      email: "managed-alias@example.invalid",
      answers: {},
    },
    {
      runId: "uk-boundary-test",
      paymentBoundaryOutputDir: outputDir,
      stopBeforePayment: true,
      takePaymentCard: async () => {
        cardHookCalls += 1;
        throw new Error("card hook must remain unreachable in boundary-only mode");
      },
    },
    "uk-boundary-test",
    ["__declaration_1__"],
    [],
  );

  assert.equal(cardHookCalls, 0);
  assert.equal(result.status, "stopped_at_pay");
  assert.deepEqual(events, ["screenshot"]);
  if (result.status !== "stopped_at_pay") return;
  assert.equal(result.paymentBoundaryScreenshot.kind, "payment_boundary");
  assert.equal(result.paymentBoundaryScreenshot.redacted, true);
  assert.equal(
    await fs.readFile(result.paymentBoundaryScreenshot.path, "utf8"),
    "redacted-payment-boundary",
  );
});
