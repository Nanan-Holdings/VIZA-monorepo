import fs from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { waitForAspNetPostback } from "./aspnet";
import { detectPage } from "./pages";
import { waitForExpectedApplicationId } from "./recovered-application";
import type { ReviewTableRow } from "./review-table-contract";
import { verifyTableReview } from "./review-table";

export interface ReviewExpectation {
  section: string;
  fieldName: string;
  controlId: string;
  /** The display value already read back from the filled CEAC control. */
  value: string;
  /** Set only when an explicitly supplied empty answer was verified in CEAC. */
  allowEmptyValue?: boolean;
}

export interface ReviewCaptureOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface ReviewSnapshot {
  url: string;
  applicationId: string;
  values: Array<{ id: string; text: string }>;
  rows?: ReviewTableRow[];
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
const CONTROL_KIND_PATTERN = /(?:^|_)(tbx|tb|ddl|rbl|cbx|cbex|lbl)_?/i;

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

async function readVisibleReviewRows(page: Page): Promise<ReviewTableRow[]> {
  return page.locator(".ReviewSection").filter({visible: true}).evaluateAll(sections => {
    const result: ReviewTableRow[] = [];
    for (const section of sections) {
      const titles = Array.from(section.querySelectorAll("table.title")).filter(title =>
        title.closest(".ReviewSection") === section && title.getClientRects().length > 0);
      if (titles.length !== 1) throw new Error("CEAC review section title is ambiguous.");
      const group = (titles[0] as HTMLElement).innerText.replace(/\s+/g, " ").trim();
      if (!/^Edit\b/i.test(group)) throw new Error("CEAC review section title is unsupported.");
      let position = -1;
      for (const row of Array.from(section.querySelectorAll("tr"))) {
        position += 1;
        if (row.closest(".ReviewSection") !== section || !row.getClientRects().length) continue;
        let ancestor: Element | null = row;
        let hidden = false;
        while (ancestor) {
          const style = window.getComputedStyle(ancestor);
          const rect = ancestor.getBoundingClientRect();
          if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0" ||
            (rect.width === 0 && rect.height === 0)) { hidden = true; break; }
          ancestor = ancestor.parentElement;
        }
        if (hidden) continue;
        const table = row.closest("table");
        if (!table?.classList.contains("mainstyle")) continue;
        const cells = Array.from(row.children).filter(cell => cell.tagName === "TD");
        if (cells.length !== 2) continue;
        const data = Array.from(cells[1].children).filter(child => child.matches("div.data"));
        if (data.length === 0) continue;
        if (data.length !== 1) throw new Error("CEAC review value cell is ambiguous.");
        const style = window.getComputedStyle(data[0]);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
        const containerElement = row.closest("[id]");
        const container = containerElement && containerElement !== section && section.contains(containerElement)
          ? containerElement.id : "";
        result.push({
          group,
          container,
          position,
          label: (cells[0] as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
          value: (data[0] as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
        });
      }
    }
    return result;
  });
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
  options: ReviewCaptureOptions = {},
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

  await waitForExpectedApplicationId(
    page,
    expectedApplicationId,
    options,
    "CEAC review page Application ID did not match the expected application.",
  );
  const initialReviewUrl = officialReviewUrl(page.url());
  if (!initialReviewUrl || (await detectPage(page)).id !== "review") {
    throw new Error("CEAC review page changed during evidence capture.");
  }

  const values = await readVisibleReviewValues(page);
  const rows = await readVisibleReviewRows(page);
  await page.waitForTimeout(250);
  const settledValues = await readVisibleReviewValues(page);
  const settledRows = await readVisibleReviewRows(page);
  if (JSON.stringify(values) !== JSON.stringify(settledValues) || JSON.stringify(rows) !== JSON.stringify(settledRows)) {
    throw new Error("CEAC review page changed during evidence capture.");
  }
  const capturedApplicationId = await waitForExpectedApplicationId(
    page,
    expectedApplicationId,
    options,
    "CEAC review page Application ID did not match the expected application.",
  );
  const settledUrl = officialReviewUrl(page.url());
  if (!settledUrl || (await detectPage(page)).id !== "review") {
    throw new Error("CEAC review page changed during evidence capture.");
  }

  const snapshot: ReviewSnapshot = {
    url: settledUrl.toString(),
    applicationId: capturedApplicationId,
    values: settledValues,
    rows: settledRows,
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

function canShareReviewComparison(
  first: ReviewExpectation,
  next: ReviewExpectation,
): boolean {
  return first.controlId === next.controlId
    && first.section === next.section
    && normalizeValue(first.value) === normalizeValue(next.value)
    && Boolean(first.allowEmptyValue) === Boolean(next.allowEmptyValue);
}

/**
 * Verify exact, uniquely identified review values. Unknown expectation IDs,
 * conflicting duplicate semantic IDs, and missing structure remain
 * unverified; a known value that differs from the read-back value is a failed
 * review.
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

  if (snapshots.some(snapshot => (snapshot.rows?.length ?? 0) > 0)) {
    return verifyTableReview(expectations, snapshots, issues);
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

  const expectedBySemanticId = new Map<string, ReviewExpectation>();
  let matched = 0;
  for (const expectation of expectations) {
    const fieldName = expectation.fieldName.trim() || "$review";
    const semanticId = normalizeSemanticId(expectation.controlId);
    if (!semanticId) {
      addIssue(issues, fieldName, "invalid_expectation_id");
      continue;
    }
    const firstExpectation = expectedBySemanticId.get(semanticId);
    if (firstExpectation) {
      if (!canShareReviewComparison(firstExpectation, expectation)) {
        addIssue(issues, fieldName, "duplicate_expectation_id");
        continue;
      }
    } else {
      expectedBySemanticId.set(semanticId, expectation);
    }

    const values = observed.get(semanticId) ?? [];
    if (values.length === 0) {
      addIssue(issues, fieldName, "missing_observed_value");
      continue;
    }
    if (values.length !== 1) {
      addIssue(issues, fieldName, "ambiguous_observed_id");
      continue;
    }
    const expectedValue = normalizeValue(expectation.value);
    const observedValue = normalizeValue(values[0].text);
    if (!expectedValue) {
      if (!expectation.allowEmptyValue) {
        addIssue(issues, fieldName, "empty_expected_value");
        continue;
      }
      if (observedValue !== "") {
        addIssue(issues, fieldName, "review_value_mismatch");
        continue;
      }
      matched += 1;
      continue;
    }
    if (observedValue !== expectedValue) {
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
