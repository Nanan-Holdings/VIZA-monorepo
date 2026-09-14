import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { orchestrateFill } from "../orchestrator";
import { createRecoveryTracker } from "../artifacts";
import type { CeacSession } from "../session";
import type { Ds160FinalSubmissionGuard, FinalSubmissionEvidence } from "../final-submission-guard";

const APPLICATION_ID = "AA00TEST1234";

function createMemoryGuard(): {
  guard: Ds160FinalSubmissionGuard;
  getState: () => "started" | "unknown" | "confirmed";
} {
  let state: "started" | "unknown" | "confirmed" = "started";
  let acquired = false;
  const guard: Ds160FinalSubmissionGuard = {
    async inspect() {
      return acquired
        ? { kind: "acquired" as const, attemptId: "attempt-certify-1", state: "started" as const }
        : { kind: "available" as const };
    },
    async begin() {
      acquired = true;
      return { kind: "acquired", attemptId: "attempt-certify-1", state: "started" };
    },
    async markUnknown() {
      state = "unknown";
    },
    async markConfirmed(_evidence: FinalSubmissionEvidence) {
      state = "confirmed";
    },
  };
  return { guard, getState: () => state };
}

test("guards the SignCertify click when it directly reaches official confirmation", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const memory = createMemoryGuard();
  const tracker = createRecoveryTracker({ runId: "run-certify", delegate: { async record() {} } });
  tracker.setApplicationId(APPLICATION_ID);

  try {
    await page.route("https://ceac.state.gov/**", async (route) => {
      await route.fulfill({
        contentType: "text/html",
        body: `
          <h2>Sign and Submit Application</h2>
          <input id="passport" type="text">
          <input id="btnCertify" type="submit" value="Sign and Submit">
          <script>
            document.getElementById("btnCertify").addEventListener("click", (event) => {
              event.preventDefault();
              setTimeout(() => {
                history.pushState({}, "", "/GenNIV/General/Confirmation.aspx");
                document.body.innerHTML = ` + "`" + `
                  <h2>Confirmation</h2>
                  <p>Application ID: AA00TEST1234</p>
                  <button>Print Confirmation</button>
                  <button>Print Application</button>
                  <button>Email Confirmation</button>
                ` + "`" + `;
              }, 600);
            });
          </script>
        `,
      });
    });
    await page.goto(
      "https://ceac.state.gov/GenNIV/General/complete_signandsubmit.aspx?node=SignSubmit",
      { waitUntil: "domcontentloaded" },
    );

    const session = {
      browser,
      context: page.context(),
      page,
      runId: "run-certify",
      close: async () => browser.close(),
    } satisfies CeacSession;

    const result = await orchestrateFill(session, {
      answers: {},
      profile: {},
      tracker,
      runId: "run-certify",
      finalSubmit: {
        passportNumber: "P1234567",
        confirmationTimeoutMs: 3_000,
        finalSubmissionGuard: memory.guard,
      },
    });

    assert.equal(result.result.status, "submitted");
    if (result.result.status === "submitted") {
      assert.equal(result.result.applicationId, APPLICATION_ID);
      assert.equal(result.result.confirmationNumber, null);
    }
    assert.equal(memory.getState(), "confirmed");
  } finally {
    await browser.close();
  }
});
