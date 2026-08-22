import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function occurrences(source: string, value: string): number {
  return source.split(value).length - 1;
}

describe("application submit navigation", () => {
  it("keeps every successful submit in place and navigates only for missing-field errors", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/client/application/long-form/page.tsx"),
      "utf8",
    );
    const dynamicSubmit = sourceBetween(
      pageSource,
      "const handleDynamicReviewComplete = async",
      "const handleReviewComplete = async",
    );
    const fallbackSubmit = sourceBetween(
      pageSource,
      "const handleReviewComplete = async",
      "const focusFirstMissingField =",
    );

    expect(occurrences(dynamicSubmit, "scrollToStepPanel(statusStepIndex);")).toBe(1);
    expect(dynamicSubmit).toMatch(
      /if \(missing\.length > 0\) \{\s*scrollToStepPanel\(statusStepIndex\);/,
    );
    expect(dynamicSubmit).not.toMatch(
      /setSubmitMissingFields\(\[\]\);[\s\S]{0,240}scrollToStepPanel\(statusStepIndex\);/,
    );

    expect(occurrences(fallbackSubmit, "scrollToStepPanel(fallbackStatusStepIndex);")).toBe(1);
    expect(fallbackSubmit).toMatch(
      /if \(missing\.length > 0\) \{\s*scrollToStepPanel\(fallbackStatusStepIndex\);/,
    );
    expect(fallbackSubmit).not.toMatch(
      /setSubmitMissingFields\(\[\]\);[\s\S]{0,240}scrollToStepPanel\(fallbackStatusStepIndex\);/,
    );
  });

  it("shows dynamic submission status only after the queue endpoint accepts the job", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/client/application/long-form/page.tsx"),
      "utf8",
    );
    const dynamicSubmit = sourceBetween(
      pageSource,
      "const handleDynamicReviewComplete = async",
      "const handleReviewComplete = async",
    );
    const fallbackSubmit = sourceBetween(
      pageSource,
      "const handleReviewComplete = async",
      "const focusFirstMissingField =",
    );

    expect(dynamicSubmit).not.toContain("shouldShowSubmissionImmediately");
    expect(dynamicSubmit.indexOf("queueAccepted = true;")).toBeGreaterThan(
      dynamicSubmit.indexOf("await insertSubmissionQueueJob"),
    );
    expect(dynamicSubmit.indexOf("submissionResultStatus: queueJob.submissionResultStatus")).toBeGreaterThan(
      dynamicSubmit.indexOf("queueAccepted = true;"),
    );
    expect(dynamicSubmit).toContain("submissionResultStatus: queueJob.submissionResultStatus");
    expect(dynamicSubmit).toContain("if (queueAccepted) return;");
    expect(fallbackSubmit).toMatch(
      /submissionResultStatus: "waiting",[\s\S]*submissionResult: null,/,
    );
    expect(
      pageSource.match(/submissionStarting=\{saving && submittingMode !== null\}/g),
    ).toHaveLength(2);
  });

  it("shows specific Chinese Korea queue errors instead of leaking English server copy", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/client/application/long-form/page.tsx"),
      "utf8",
    );
    const queueHelper = sourceBetween(
      pageSource,
      "async function insertSubmissionQueueJob",
      "async function insertOfficialFeeSubmissionQueueJobWithCard",
    );

    expect(queueHelper).toContain("kr_eac_stay_address_required");
    expect(queueHelper).toContain("确认韩文地址、英文地址和 5 位邮编均已自动填写");
    expect(queueHelper).toContain("登录状态已过期，请刷新页面或重新登录后再提交");
    expect(queueHelper).toContain("input.locale.toLowerCase().startsWith(\"zh\")");
  });
});
