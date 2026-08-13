import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";

import {
  runTwRepairSubmissionLoop,
  type TwOfficialValidationIssue,
  type TwRepairOperation,
} from "../repair-loop";
import {
  TwFieldVerificationError,
  TwFileUploadError,
  TwOfficialValidationError,
  TwUnexpectedPageError,
} from "../errors";
import type { TwCaptchaSolveWithTelemetry } from "../captcha";
import type { TwOfficialReceiptEvidence } from "../receipt";

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

async function newPage(): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent("<!doctype html><form><input name='captchaToken'><button>確認資料</button></form>");
  return page;
}

function operation(
  fieldKey: string,
  controlName: string,
  run: () => Promise<void>,
  kind: TwRepairOperation["kind"] = "text",
): TwRepairOperation {
  return { fieldKey, controlName, kind, run };
}

function captchaSolve(attempt: number): TwCaptchaSolveWithTelemetry {
  return {
    solve: { text: "ABCD", solveId: `solve-${attempt}`, durationMs: 10 },
    telemetry: [{ solveId: `solve-${attempt}`, durationMs: 10, attempt, outcome: "solved" }],
  };
}

function receipt(caseNumber: string): TwOfficialReceiptEvidence {
  return {
    source: "official_success_page_with_application_number",
    capturedAt: new Date().toISOString(),
    portalUrl: "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply",
    caseNumber,
  };
}

describe("Taiwan same-session repair submission loop", () => {
  it("submits directly when the first full pass is valid and receipt appears", async () => {
    const page = await newPage();
    const calls: string[] = [];
    try {
      const result = await runTwRepairSubmissionLoop({
        page,
        operations: [operation("name_chinese", "traveller.chineseName", async () => { calls.push("name"); })],
        validate: async () => [],
        submit: async () => { calls.push("submit"); return captchaSolve(1); },
        readReceipt: async () => receipt("TW12345678"),
      });
      assert.equal(result.status, "submitted");
      assert.equal(result.receipt.caseNumber, "TW12345678");
      assert.deepEqual(calls, ["name", "submit"]);
    } finally {
      await page.close();
    }
  });

  it("pre-submit mode prepares CAPTCHA and never clicks final submit", async () => {
    const page = await newPage();
    const calls: string[] = [];
    try {
      const result = await runTwRepairSubmissionLoop({
        page,
        mode: "pre_submit",
        operations: [operation("name_chinese", "traveller.chineseName", async () => { calls.push("name"); })],
        validate: async () => [],
        prepareSubmit: async () => { calls.push("prepare-submit"); return captchaSolve(1); },
        submit: async () => { calls.push("submit"); return captchaSolve(99); },
        readReceipt: async () => receipt("TW-SHOULD-NOT-READ"),
      });
      assert.equal(result.status, "ready_to_submit");
      assert.deepEqual(calls, ["name", "prepare-submit"]);
    } finally {
      await page.close();
    }
  });

  it("revalidates after CAPTCHA preparation and repairs before declaring ready", async () => {
    const page = await newPage();
    let runs = 0;
    let prepares = 0;
    try {
      const result = await runTwRepairSubmissionLoop({
        page,
        mode: "pre_submit",
        operations: [operation("kin_father_name", "kinships[0].chineseName", async () => { runs += 1; })],
        validate: async () =>
          prepares === 1 && runs === 1
            ? [{
                fieldKey: "kin_father_name",
                controlName: "kinships[0].chineseName",
                errorType: "official_required",
              }]
            : [],
        prepareSubmit: async () => {
          prepares += 1;
          return captchaSolve(prepares);
        },
        submit: async () => captchaSolve(99),
        readReceipt: async () => null,
      });

      assert.equal(result.status, "ready_to_submit");
      assert.equal(result.rounds, 2);
      assert.equal(runs, 2);
      assert.equal(prepares, 2);
    } finally {
      await page.close();
    }
  });

  it("fails closed on an official format error discovered after CAPTCHA preparation", async () => {
    const page = await newPage();
    let prepared = false;
    try {
      await assert.rejects(
        () => runTwRepairSubmissionLoop({
          page,
          mode: "pre_submit",
          operations: [operation("company_name", "careersInformations[0].unitTitle", async () => undefined)],
          validate: async () => prepared
            ? [{
                fieldKey: "company_name",
                controlName: "careersInformations[0].unitTitle",
                errorType: "official_invalid",
              }]
            : [],
          prepareSubmit: async () => {
            prepared = true;
            return captchaSolve(1);
          },
          submit: async () => captchaSolve(99),
          readReceipt: async () => null,
        }),
        (error) => error instanceof TwOfficialValidationError && error.validationKeys.includes("company_name"),
      );
    } finally {
      await page.close();
    }
  });

  it("continues after a missing control, repairs it, and succeeds on the second submit path", async () => {
    const page = await newPage();
    let first = true;
    const calls: string[] = [];
    try {
      const result = await runTwRepairSubmissionLoop({
        page,
        operations: [
          operation("name_chinese", "traveller.chineseName", async () => {
            calls.push("name");
            if (first) {
              first = false;
              throw new TwFieldVerificationError("name_chinese", "text control not found", {
                details: { controlName: "traveller.chineseName", kind: "text" },
              });
            }
          }),
          operation("passport_number", "traveller.passportNo", async () => { calls.push("passport"); }),
        ],
        validate: async () => [],
        submit: async () => { calls.push("submit"); return captchaSolve(1); },
        readReceipt: async () => receipt("TW87654321"),
      });
      assert.equal(result.status, "submitted");
      assert.equal(result.rounds, 2);
      assert.equal(result.receipt.caseNumber, "TW87654321");
      assert.deepEqual(calls, ["name", "passport", "name", "submit"]);
    } finally {
      await page.close();
    }
  });

  it("waits through a delayed dependent dropdown by repairing the same select operation", async () => {
    const page = await newPage();
    let ready = false;
    let runs = 0;
    try {
      const result = await runTwRepairSubmissionLoop({
        page,
        operations: [operation("embassy_office", "overseaOfficeId", async () => {
          runs += 1;
          if (!ready) {
            ready = true;
            throw new TwFieldVerificationError("embassy_office", "select control not available", {
              details: { controlName: "overseaOfficeId", kind: "select" },
            });
          }
        }, "select")],
        validate: async () => [],
        submit: async () => captchaSolve(1),
        readReceipt: async () => receipt("TW11112222"),
      });
      assert.equal(result.rounds, 2);
      assert.equal(runs, 2);
    } finally {
      await page.close();
    }
  });

  it("repairs an upload verification failure", async () => {
    const page = await newPage();
    let runs = 0;
    try {
      const result = await runTwRepairSubmissionLoop({
        page,
        operations: [operation("photo", "documents[0].attachs[0]", async () => {
          runs += 1;
          if (runs === 1) {
            throw new TwFileUploadError("photo", "uploaded file is not present in the official page file input", {
              details: { controlName: "documents[0].attachs[0]", kind: "file" },
            });
          }
        }, "file")],
        validate: async () => [],
        submit: async () => captchaSolve(1),
        readReceipt: async () => receipt("TW22223333"),
      });
      assert.equal(result.rounds, 2);
      assert.equal(runs, 2);
    } finally {
      await page.close();
    }
  });

  it("re-submits with a refreshed CAPTCHA when official validation reports CAPTCHA", async () => {
    const page = await newPage();
    let submits = 0;
    try {
      const result = await runTwRepairSubmissionLoop({
        page,
        operations: [operation("name_chinese", "traveller.chineseName", async () => undefined)],
        validate: async (): Promise<TwOfficialValidationIssue[]> => submits === 1 ? [{ errorType: "captcha" }] : [],
        submit: async () => {
          submits += 1;
          return captchaSolve(submits);
        },
        readReceipt: async () => submits >= 2 ? receipt("TW33334444") : null,
      });
      assert.equal(result.status, "submitted");
      assert.equal(result.receipt.caseNumber, "TW33334444");
      assert.equal(submits, 2);
    } finally {
      await page.close();
    }
  });

  it("fails after three repair rounds without a receipt", async () => {
    const page = await newPage();
    try {
      await assert.rejects(
        () => runTwRepairSubmissionLoop({
          page,
          operations: [operation("name_chinese", "traveller.chineseName", async () => undefined)],
          validate: async () => [{ fieldKey: "name_chinese", controlName: "traveller.chineseName", errorType: "official_required" }],
          submit: async () => captchaSolve(1),
          readReceipt: async () => null,
          maxRounds: 3,
        }),
        (error) => error instanceof TwUnexpectedPageError && /exhausted/.test(error.message),
      );
    } finally {
      await page.close();
    }
  });

  it("fails closed on unknown post-submit state with no receipt and no validation errors", async () => {
    const page = await newPage();
    try {
      await assert.rejects(
        () => runTwRepairSubmissionLoop({
          page,
          operations: [operation("name_chinese", "traveller.chineseName", async () => undefined)],
          validate: async () => [],
          submit: async () => captchaSolve(1),
          readReceipt: async () => null,
        }),
        (error) => error instanceof TwUnexpectedPageError && /neither official receipt/.test(error.message),
      );
    } finally {
      await page.close();
    }
  });

  it("treats bad VIZA values and missing local files as integrity fatal", async () => {
    const page = await newPage();
    try {
      await assert.rejects(
        () => runTwRepairSubmissionLoop({
          page,
          operations: [
            operation("name_chinese", "traveller.chineseName", async () => {
              throw new TwFieldVerificationError("name_chinese", "missing required VIZA value", {
                details: { controlName: "traveller.chineseName", kind: "text" },
              });
            }),
            operation("photo", "documents[0].attachs[0]", async () => {
              throw new TwFileUploadError("photo", "missing required local file", {
                details: { controlName: "documents[0].attachs[0]", kind: "file" },
              });
            }, "file"),
          ],
          validate: async () => [],
          submit: async () => captchaSolve(1),
          readReceipt: async () => null,
        }),
        (error) => error instanceof TwUnexpectedPageError && /integrity-fatal/.test(error.message),
      );
    } finally {
      await page.close();
    }
  });
});
