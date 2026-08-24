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

  it("enters waiting state immediately for every queue-backed form", () => {
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

    expect(dynamicSubmit).toContain(
      "const shouldShowSubmissionImmediately = !isJpTourist && !isKrC39;",
    );
    expect(dynamicSubmit).toMatch(
      /if \(shouldShowSubmissionImmediately\) \{[\s\S]*submissionResultStatus: "waiting",[\s\S]*submissionResult: null,/,
    );
    expect(dynamicSubmit).not.toContain("shouldShowArrivalSubmissionImmediately");
    expect(fallbackSubmit).toMatch(
      /submissionResultStatus: "waiting",[\s\S]*submissionResult: null,/,
    );
    expect(
      pageSource.match(/submissionStarting=\{saving && submittingMode !== null\}/g),
    ).toHaveLength(2);
  });

  it("keeps the Philippines eTravel final action blocked and named until required fields are complete", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/client/application/long-form/page.tsx"),
      "utf8",
    );
    const finalConfirmation = sourceBetween(
      pageSource,
      "function FinalConfirmationPanel({",
      "// ---------------------------------------------------------------------------",
    );

    expect(finalConfirmation).toContain("(isPhEtravel && hasMissing)");
    expect(finalConfirmation).toContain("还缺 ${missingFields.length} 个必填项");
    expect(finalConfirmation).toContain("required ${missingFields.length === 1 ? \"item\" : \"items\"} missing");
  });

  it("uses distinct Philippines eTravel Arrival and Departure Declaration product names on the long form", () => {
    const pageSource = readFileSync(
      join(process.cwd(), "app/client/application/long-form/page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("菲律宾 eTravel 入境申报");
    expect(pageSource).toContain("菲律宾 eTravel 离境申报");
    expect(pageSource).toContain("Philippines eTravel Arrival Declaration");
    expect(pageSource).toContain("Philippines eTravel Departure Declaration");
  });
});
