import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { waitForAspNetPostback } from "./aspnet";
import { captureApplicationId } from "./checkpoints";
import { detectPage } from "./pages";

export interface ReviewExpectation {
  section: string;
  fieldName: string;
  controlId: string;
  /** The display value already read back from the filled CEAC control. */
  value: string;
}

export interface ReviewSnapshot {
  url: string;
  applicationId: string;
  values: Array<{ id: string; text: string }>;
}

export interface ReviewVerificationIssue {
  fieldName: string;
  reason: string;
}

export interface ReviewVerificationResult {
  status: "passed" | "failed" | "unverified";
  matched: number;
  issues: ReviewVerificationIssue[];
}

const OFFICIAL_CEAC_ORIGIN = "https://ceac.state.gov";
const CONTROL_KIND_PATTERN = /(?:^|_)(tbx|ddl|rbl|cbx|lbl)_?/i;

function normalizeValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/**
 * Reduce the control and review-label IDs to the same semantic field ID.
 * CEAC's ASP.NET prefixes and input-kind tokens are presentation details;
 * anything without a recognized token remains unknown and cannot pass.
 */
function normalizeSemanticId(value: string): string | null {
  const cleaned = value
    .trim()
    .replace(/^#/, "")
    .replace(/[^a-z0-9_]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  const match = cleaned.match(CONTROL_KIND_PATTERN);
  if (!match) return null;
  const kind = match[1].toLocaleLowerCase();
  const semantic = cleaned
    .slice((match.index ?? 0) + match[0].length)
    .replace(/^_+|_+$/g, "")
    .toLocaleLowerCase();
  const normalized = kind === "rbl"
    ? semantic.replace(/_(?:0|1)$/, "")
    : semantic;
  return normalized || null;
}

function officialReviewUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    if (url.origin.toLocaleLowerCase() !== OFFICIAL_CEAC_ORIGIN) return null;
    if (!/^\/genniv\//i.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function readVisibleReviewValues(page: Page): Promise<Array<{ id: string; text: string }>> {
  const nodes = page.locator("span[id], td[id]").filter({ visible: true });
  return nodes.evaluateAll((elements) => elements.map((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const textParts: string[] = [];
    let node = walker.nextNode();
    while (node) {
      const parent = node.parentElement;
      const owner = parent?.closest("span[id], td[id]");
      let visible = owner === element;
      let current = parent;
      while (visible && current) {
        const style = window.getComputedStyle(current);
        const rect = current.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0" ||
          (rect.width === 0 && rect.height === 0)
        ) {
          visible = false;
        }
        current = current.parentElement;
      }
      if (visible) textParts.push(node.textContent ?? "");
      node = walker.nextNode();
    }
    return {
      id: element.id,
      text: textParts.join(" ").replace(/\s+/g, " ").trim(),
    };
  }));
}

/**
 * Capture only the review values whose own visible span/td has an ID. The
 * screenshot and JSON are private artifacts in outputDir; neither is logged.
 */
export async function captureOfficialReviewPage(
  page: Page,
  applicationId: string,
  outputDir: string,
  index: number,
): Promise<ReviewSnapshot> {
  const expectedApplicationId = applicationId.trim().toUpperCase();
  if (!expectedApplicationId || !Number.isInteger(index) || index < 0) {
    throw new Error("CEAC review capture arguments are invalid.");
  }

  const url = officialReviewUrl(page.url());
  if (!url) throw new Error("CEAC review capture requires the official CEAC review origin.");
  if ((await detectPage(page)).id !== "review") {
    throw new Error("CEAC review capture requires the official Review page.");
  }

  await waitForAspNetPostback(page, 8_000);

  const captured = await captureApplicationId(page);
  if (
    !captured.applicationId ||
    captured.applicationId.trim().toUpperCase() !== expectedApplicationId
  ) {
    throw new Error("CEAC review page Application ID did not match the expected application.");
  }

  const values = await readVisibleReviewValues(page);
  await page.waitForTimeout(250);
  const settledValues = await readVisibleReviewValues(page);
  if (JSON.stringify(values) !== JSON.stringify(settledValues)) {
    throw new Error("CEAC review page changed during evidence capture.");
  }

  const snapshot: ReviewSnapshot = {
    url: url.toString(),
    applicationId: captured.applicationId.trim(),
    values: settledValues,
  };

  await fs.mkdir(outputDir, { recursive: true });
  try {
    await page.screenshot({
      path: path.join(outputDir, `review-${index}.png`),
      fullPage: true,
    });
    await fs.writeFile(
      path.join(outputDir, `review-${index}.json`),
      JSON.stringify(snapshot, null, 2),
      "utf8",
    );
  } catch {
    throw new Error("CEAC review evidence could not be captured.");
  }

  return snapshot;
}

function addIssue(
  issues: ReviewVerificationIssue[],
  fieldName: string,
  reason: string,
): void {
  if (!issues.some((issue) => issue.fieldName === fieldName && issue.reason === reason)) {
    issues.push({ fieldName, reason });
  }
}

/**
 * Verify exact, uniquely identified review values. Unknown page IDs, duplicate
 * semantic IDs, and missing structure remain unverified; a known value that
 * differs from the read-back value is a failed review.
 */
export function verifyOfficialReview(
  expectations: ReviewExpectation[],
  snapshots: ReviewSnapshot[],
): ReviewVerificationResult {
  const issues: ReviewVerificationIssue[] = [];
  if (expectations.length === 0) {
    return { status: "unverified", matched: 0, issues: [{ fieldName: "$review", reason: "no_expectations" }] };
  }
  if (snapshots.length === 0) {
    return { status: "unverified", matched: 0, issues: [{ fieldName: "$review", reason: "no_snapshots" }] };
  }

  const applicationIds = new Set(snapshots.map((snapshot) => snapshot.applicationId.trim().toUpperCase()));
  if (applicationIds.size !== 1 || applicationIds.has("")) {
    addIssue(issues, "$review", "application_id_mismatch");
  }
  if (snapshots.some((snapshot) => !officialReviewUrl(snapshot.url))) {
    addIssue(issues, "$review", "invalid_review_url");
  }

  const observed = new Map<string, Array<{ text: string }>>();
  for (const snapshot of snapshots) {
    for (const value of snapshot.values) {
      const semanticId = normalizeSemanticId(value.id);
      if (!semanticId) continue;
      const entries = observed.get(semanticId) ?? [];
      entries.push({ text: value.text });
      observed.set(semanticId, entries);
    }
  }

  const expectedIds = new Set<string>();
  let matched = 0;
  for (const expectation of expectations) {
    const fieldName = expectation.fieldName.trim() || "$review";
    const semanticId = normalizeSemanticId(expectation.controlId);
    if (!semanticId) {
      addIssue(issues, fieldName, "invalid_expectation_id");
      continue;
    }
    if (expectedIds.has(semanticId)) {
      addIssue(issues, fieldName, "duplicate_expectation_id");
      continue;
    }
    expectedIds.add(semanticId);

    const values = observed.get(semanticId) ?? [];
    if (values.length === 0) {
      addIssue(issues, fieldName, "missing_observed_value");
      continue;
    }
    if (values.length !== 1) {
      addIssue(issues, fieldName, "ambiguous_observed_id");
      continue;
    }
    if (!normalizeValue(expectation.value)) {
      addIssue(issues, fieldName, "empty_expected_value");
      continue;
    }
    if (normalizeValue(values[0].text) !== normalizeValue(expectation.value)) {
      addIssue(issues, fieldName, "review_value_mismatch");
      continue;
    }
    matched += 1;
  }

  const structuralIssue = issues.some((issue) =>
    issue.reason !== "review_value_mismatch",
  );
  return {
    status: structuralIssue ? "unverified" : issues.length > 0 ? "failed" : "passed",
    matched,
    issues,
  };
}
