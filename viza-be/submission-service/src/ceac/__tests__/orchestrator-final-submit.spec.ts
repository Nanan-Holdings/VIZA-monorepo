import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { test } from "node:test";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";
import { orchestrateFill } from "../orchestrator";
import { createRecoveryTracker } from "../artifacts";
import type { CeacSession } from "../session";
import type { Ds160FinalSubmissionGuard, FinalSubmissionEvidence } from "../final-submission-guard";

const APPLICATION_ID = "AA00TEST1234";

const PASSPORT_FLOW_PAGES = [
  ["Passport", "/GenNIV/General/Passport_Visa_Info.aspx?node=Passport"],
  ["U.S. Point of Contact", "/GenNIV/General/complete_uscontact.aspx?node=USContact"],
  ["Present Work/Education/Training", "/GenNIV/General/complete_workeducation1.aspx?node=WorkEducation1"],
  ["Security and Background: Part 1", "/GenNIV/General/complete_securityandbackground1.aspx?node=SecurityBackground1"],
  ["Security and Background: Part 2", "/GenNIV/General/complete_securityandbackground2.aspx?node=SecurityBackground2"],
  ["Security and Background: Part 3", "/GenNIV/General/complete_securityandbackground3.aspx?node=SecurityBackground3"],
  ["Upload Photo", "/GenNIV/General/photo_uploadthephoto.aspx?node=UploadPhoto"],
] as const;

function passportFlowHtml(options: {
  saveToFile: "missing" | "gate";
  pageIndex: number;
}): string {
  const [heading, , nextPath] = [
    PASSPORT_FLOW_PAGES[options.pageIndex]?.[0] ?? PASSPORT_FLOW_PAGES[0][0],
    PASSPORT_FLOW_PAGES[options.pageIndex]?.[1] ?? PASSPORT_FLOW_PAGES[0][1],
    PASSPORT_FLOW_PAGES[options.pageIndex + 1]?.[1] ?? "",
  ];
  const saveToFile = options.pageIndex === 0 && options.saveToFile === "gate"
    ? `<input id="save-to-file" type="submit" value="Save Application to File"
          onclick="event.preventDefault(); fetch('/GenNIV/General/Passport_Visa_Info.aspx', { method: 'POST' }); document.querySelector('#dat-download').click();">
        <a id="dat-download" href="/GenNIV/application.dat" download="application.dat">download</a>`
    : "";
  const next = nextPath
    ? `<input id="next" class="next" type="submit" value="Next"
          onclick="event.preventDefault(); window.location.href='${nextPath}';">`
    : "";
  return `<!doctype html><html><body><h2>${heading}</h2>${saveToFile}${next}</body></html>`;
}

function cleanupTempOutput(outputDir: string, prefix: string): void {
  const tempRoot = resolve(tmpdir()).toLowerCase();
  const resolvedOutput = resolve(outputDir);
  if (
    dirname(resolvedOutput).toLowerCase() !== tempRoot ||
    !basename(resolvedOutput).startsWith(prefix)
  ) {
    throw new Error(`Refusing to remove unexpected test output path: ${resolvedOutput}`);
  }
  rmSync(resolvedOutput, { recursive: true, force: true });
}

test("lost job ownership stops before an expired CEAC session can be rebuilt", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let requestCount = 0;
  let reconnectCount = 0;
  try {
    await page.route("https://ceac.state.gov/**", async route => {
      requestCount += 1;
      await route.fulfill({ contentType: "text/html", body: "<h2>Session Timed Out</h2>" });
    });
    await page.goto("https://ceac.state.gov/GenNIV/SessionTimedOut.aspx");
    const session: CeacSession = {
      browser, context: page.context(), page,
      close: async () => browser.close(),
      reconnect: async () => { reconnectCount += 1; },
    };
    const result = await orchestrateFill(session, {
      answers: {}, profile: {},
      tracker: createRecoveryTracker({ runId: "lost-lease" }),
      recoveryCredentials: {
        applicationId: APPLICATION_ID, surnameFirstFive: "TEST", yearOfBirth: "2000", securityAnswer: "fixture",
      },
      assertActive: () => { throw new Error("job ownership lost"); },
    });
    assert.equal(result.result.status, "failed");
    assert.equal(requestCount, 1);
    assert.equal(reconnectCount, 0);
    assert.equal(page.url(), "https://ceac.state.gov/GenNIV/SessionTimedOut.aspx");
  } finally {
    await browser.close();
  }
});

test("a missing optional Save-to-File control does not block passport page advance", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-dat-optional-"));
  try {
    await page.route("https://ceac.state.gov/**", route => {
      const pageIndex = PASSPORT_FLOW_PAGES.findIndex(([, path]) => route.request().url().includes(path));
      return route.fulfill({
        contentType: "text/html",
        body: passportFlowHtml({ saveToFile: "missing", pageIndex: pageIndex < 0 ? 0 : pageIndex }),
      });
    });
    await page.goto(
      "https://ceac.state.gov/GenNIV/General/Passport_Visa_Info.aspx?node=Passport",
      { waitUntil: "domcontentloaded" },
    );

    const session = {
      browser,
      context: page.context(),
      page,
      runId: "run-dat-optional",
      close: async () => browser.close(),
    } satisfies CeacSession;
    const result = await orchestrateFill(session, {
      answers: {},
      profile: {},
      tracker: createRecoveryTracker({ runId: "run-dat-optional", delegate: { async record() {} } }),
      outputDir,
    });

    assert.equal(result.result.status, "handoff_ready");
    assert.ok(result.sectionCoverage.filled.includes("passport"));
    assert.match(page.url(), /photo_uploadthephoto\.aspx\?node=UploadPhoto$/);
  } finally {
    await browser.close();
    cleanupTempOutput(outputDir, "ceac-dat-optional-");
  }
});

test("a Save-to-File postback gate still blocks orchestration", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-dat-gate-"));
  try {
    await page.route("https://ceac.state.gov/**", async route => {
      if (route.request().method() === "POST") {
        await new Promise(resolve => setTimeout(resolve, 50));
        await route.fulfill({
          status: 403,
          contentType: "text/html",
          body: "<h2>Request rejected</h2>",
        });
        return;
      }
      if (route.request().url().endsWith("/GenNIV/application.dat")) {
        await route.fulfill({
          status: 200,
          headers: {
            "Content-Disposition": "attachment; filename=application.dat",
            "Content-Type": "application/octet-stream",
          },
          body: "fixture",
        });
        return;
      }
      const pageIndex = PASSPORT_FLOW_PAGES.findIndex(([, path]) => route.request().url().includes(path));
      await route.fulfill({
        contentType: "text/html",
        body: passportFlowHtml({ saveToFile: "gate", pageIndex: pageIndex < 0 ? 0 : pageIndex }),
      });
    });
    await page.goto(
      "https://ceac.state.gov/GenNIV/General/Passport_Visa_Info.aspx?node=Passport",
      { waitUntil: "domcontentloaded" },
    );

    const session = {
      browser,
      context: page.context(),
      page,
      runId: "run-dat-gate",
      close: async () => browser.close(),
    } satisfies CeacSession;
    const result = await orchestrateFill(session, {
      answers: {},
      profile: {},
      tracker: createRecoveryTracker({ runId: "run-dat-gate", delegate: { async record() {} } }),
      outputDir,
    });

    assert.equal(result.result.status, "failed");
    assert.equal(result.result.error?.code, "GATE_DETECTED");
    assert.equal(result.sectionCoverage.filled.includes("passport"), true);
    assert.equal(await page.locator("#next").count(), 1);
  } finally {
    await browser.close();
    cleanupTempOutput(outputDir, "ceac-dat-gate-");
  }
});

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

test("does not sign from a retrieved sign page without current fill and official review evidence", async () => {
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

    assert.equal(result.result.status, "failed");
    assert.deepEqual(await memory.guard.inspect(), { kind: "available" });
    assert.match(page.url(), /complete_signandsubmit/);
    assert.equal(await page.locator("#passport").inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("an unverified review leaves preparer, passport, and final-submit controls untouched", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const memory = createMemoryGuard();
  const tracker = createRecoveryTracker({ runId: "run-preparer", delegate: { async record() {} } });
  tracker.setApplicationId(APPLICATION_ID);
  try {
    await page.route("https://ceac.state.gov/**", route => route.fulfill({
      contentType: "text/html",
      body: `<h2>Sign and Submit Application</h2>
        <input type="radio" name="unrelated" value="N">
        <label><input id="ctl00_rblPreparer_0" name="Preparer" type="radio" value="Y">Yes</label>
        <label><input id="ctl00_rblPreparer_1" name="Preparer" type="radio" value="N">No</label>
        <input id="passport" type="text">
        <input type="submit" value="Sign and Submit" onclick="document.body.dataset.clicked='yes'">`,
    }));
    await page.goto("https://ceac.state.gov/GenNIV/General/complete_signandsubmit.aspx?node=SignSubmit");
    const session = { browser, context: page.context(), page, runId: "run-preparer", close: () => browser.close() } satisfies CeacSession;
    const outcome = await orchestrateFill(session, {
      answers: {}, profile: {}, tracker,
      finalSubmit: { passportNumber: "P1234567", finalSubmissionGuard: memory.guard },
    });
    assert.equal(outcome.result.status, "failed");
    assert.equal(await page.locator("input:checked").count(), 0);
    assert.equal(await page.locator("#passport").inputValue(), "");
    assert.equal(await page.locator("body").getAttribute("data-clicked"), null);
    assert.deepEqual(await memory.guard.inspect(), { kind: "available" });
  } finally {
    await browser.close();
  }
});
