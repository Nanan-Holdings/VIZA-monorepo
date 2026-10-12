import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { signAndSubmitApplication } from "../final-submit";
import type {
  Ds160FinalSubmissionGuard,
  FinalSubmissionEvidence,
  FinalSubmissionGuardDecision,
} from "../final-submission-guard";

const APPLICATION_ID = "AA00TEST1234";

function createMemoryGuard(): {
  guard: Ds160FinalSubmissionGuard;
  getState: () => "started" | "unknown" | "confirmed";
} {
  let state: "started" | "unknown" | "confirmed" = "started";
  let acquired = false;
  const decision: FinalSubmissionGuardDecision = {
    kind: "acquired",
    attemptId: "attempt-1",
    state: "started",
  };
  const guard: Ds160FinalSubmissionGuard = {
    async inspect() {
      return acquired ? decision : { kind: "available" as const };
    },
    async begin() {
      if (acquired) throw new Error("reservation reused");
      acquired = true;
      return decision;
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

test("clicks Sign and Submit once and waits through a delayed official confirmation", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const memory = createMemoryGuard();
  try {
    await page.setContent(`
      <h2>Sign and Submit Application</h2>
      <p>Application ID: ${APPLICATION_ID}</p>
      <input id="SIGN_PASSPORT" type="text">
      <input id="btnSignSubmit" type="button" value="Sign and Submit Application">
    `);
    await page.locator("#btnSignSubmit").evaluate((button) => {
      let clicks = 0;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        clicks += 1;
        (window as unknown as { signClicks: number }).signClicks = clicks;
        setTimeout(() => {
          document.body.innerHTML = `
            <h2>Confirmation</h2>
            <p>Application ID: AA00TEST1234</p>
            <button>Print Confirmation</button>
            <button>Print Application</button>
            <button>Email Confirmation</button>
          `;
        }, 600);
      });
    });

    const result = await signAndSubmitApplication(page, {
      passportNumber: "P1234567",
      applicationId: APPLICATION_ID,
      confirmationTimeoutMs: 5_000,
      finalSubmissionGuard: memory.guard,
    });

    assert.equal(result.applicationId, APPLICATION_ID);
    assert.equal(result.confirmationNumber, null);
    assert.equal(memory.getState(), "confirmed");
    assert.equal(result.captchaAttempts, 1);
    assert.equal(
      await page.evaluate(() => (window as unknown as { signClicks?: number }).signClicks),
      1,
    );
  } finally {
    await browser.close();
  }
});

test("times out without confirmation after the one allowed click", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const memory = createMemoryGuard();
  try {
    await page.setContent(`
      <h2>Sign and Submit Application</h2>
      <p>Application ID: ${APPLICATION_ID}</p>
      <input id="SIGN_PASSPORT" type="text">
      <input id="btnSignSubmit" type="button" value="Sign and Submit Application">
    `);
    await page.locator("#btnSignSubmit").evaluate((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        (window as unknown as { signClicks?: number }).signClicks =
          ((window as unknown as { signClicks?: number }).signClicks ?? 0) + 1;
      });
    });

    await assert.rejects(
      signAndSubmitApplication(page, {
        passportNumber: "P1234567",
        applicationId: APPLICATION_ID,
        confirmationTimeoutMs: 100,
        finalSubmissionGuard: memory.guard,
      }),
      /one allowed click/,
    );
    assert.equal(
      await page.evaluate(() => (window as unknown as { signClicks?: number }).signClicks),
      1,
    );
    assert.equal(memory.getState(), "unknown");
  } finally {
    await browser.close();
  }
});

test("rejects an official-looking confirmation with a different Application ID", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const memory = createMemoryGuard();
  try {
    await page.setContent(`
      <h2>Sign and Submit Application</h2>
      <p>Application ID: ${APPLICATION_ID}</p>
      <input id="SIGN_PASSPORT" type="text">
      <input id="btnSignSubmit" type="button" value="Sign and Submit Application">
    `);
    await page.locator("#btnSignSubmit").evaluate((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        (window as unknown as { signClicks?: number }).signClicks =
          ((window as unknown as { signClicks?: number }).signClicks ?? 0) + 1;
        document.body.innerHTML = `
          <h2>Confirmation</h2>
          <p>Application ID: AA00OTHER1234</p>
          <button>Print Confirmation</button>
          <button>Print Application</button>
          <button>Email Confirmation</button>
        `;
      });
    });

    await assert.rejects(
      signAndSubmitApplication(page, {
        passportNumber: "P1234567",
        applicationId: APPLICATION_ID,
        confirmationTimeoutMs: 100,
        finalSubmissionGuard: memory.guard,
      }),
      /one allowed click/,
    );
    assert.equal(
      await page.evaluate(() => (window as unknown as { signClicks?: number }).signClicks),
      1,
    );
    assert.equal(memory.getState(), "unknown");
  } finally {
    await browser.close();
  }
});

test("refuses to click when no persistent final-submission guard is supplied", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <h2>Sign and Submit Application</h2>
      <p>Application ID: ${APPLICATION_ID}</p>
      <input id="SIGN_PASSPORT" type="text">
      <input id="btnSignSubmit" type="button" value="Sign and Submit Application">
    `);
    await page.locator("#btnSignSubmit").evaluate((button) => {
      button.addEventListener("click", () => {
        (window as unknown as { signClicks?: number }).signClicks = 1;
      });
    });

    await assert.rejects(
      signAndSubmitApplication(page, {
        passportNumber: "P1234567",
        applicationId: APPLICATION_ID,
        confirmationTimeoutMs: 100,
      }),
      /Persistent DS-160 final submission guard is required/,
    );
    assert.equal(
      await page.evaluate(() => (window as unknown as { signClicks?: number }).signClicks ?? 0),
      0,
    );
  } finally {
    await browser.close();
  }
});
