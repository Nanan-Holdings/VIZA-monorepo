/**
 * France-Visas step navigation.
 *
 * Single choke point for forward/back/save transitions across step1-step12.
 * Mirrors ceac/navigator.ts: assert current page, click nav button, detect
 * validation failures, verify destination identity.
 *
 * Each transition goes through this module so that:
 *   1. The current page is asserted before the click — catches bad state.
 *   2. JSF validation errors surface with page context, not as "stuck worker".
 *   3. Destination identity is verified — navigation never depends on timing alone.
 */

import type { Locator, Page } from "@playwright/test";
import {
  FV_FIELD_ERROR_SELECTOR,
  FV_NAV_SELECTORS,
  FV_VALIDATION_SUMMARY_SELECTOR,
} from "./selectors";
import { assertPage, detectPage, waitForPage, type FvPageId } from "./pages";
import { NavigationError, ValidationFailedError } from "./errors";

export type FvNavAction = "next" | "back" | "save";

export interface NavigateOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  assertFrom?: boolean;
}

export interface FvValidationReport {
  summary: string[];
  fieldErrors: string[];
  all: string[];
}

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_POLL_INTERVAL_MS = 500;

export async function readValidationMessages(page: Page): Promise<FvValidationReport> {
  const summary = await collectVisibleTexts(page.locator(FV_VALIDATION_SUMMARY_SELECTOR));
  const fieldErrors = await collectVisibleTexts(page.locator(FV_FIELD_ERROR_SELECTOR));
  const all = dedupe([...summary, ...fieldErrors]);
  return { summary, fieldErrors, all };
}

export async function hasValidationErrors(page: Page): Promise<boolean> {
  const report = await readValidationMessages(page);
  return report.all.length > 0;
}

export async function advance(
  page: Page,
  params: { from: FvPageId; to: FvPageId | FvPageId[] } & NavigateOptions,
): Promise<FvPageId> {
  return runTransition(page, { action: "next", from: params.from, to: params.to, options: params });
}

export async function goBack(
  page: Page,
  params: { from: FvPageId; to: FvPageId | FvPageId[] } & NavigateOptions,
): Promise<FvPageId> {
  return runTransition(page, { action: "back", from: params.from, to: params.to, options: params });
}

export async function saveCurrent(
  page: Page,
  params: { at: FvPageId | FvPageId[] } & NavigateOptions,
): Promise<FvPageId> {
  const atList = Array.isArray(params.at) ? params.at : [params.at];
  if (atList.length === 0) {
    throw new NavigationError("saveCurrent requires at least one expected page id", {
      expected: [],
    });
  }
  return runTransition(page, {
    action: "save",
    from: atList[0],
    to: atList,
    options: { ...params, assertFrom: params.assertFrom ?? false },
  });
}

async function runTransition(
  page: Page,
  params: {
    action: FvNavAction;
    from: FvPageId;
    to: FvPageId | FvPageId[];
    options: NavigateOptions;
  },
): Promise<FvPageId> {
  const timeoutMs = params.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = params.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const assertFrom = params.options.assertFrom ?? true;

  if (assertFrom) {
    await assertPage(page, params.from);
  }

  const navButton = await resolveNavButton(page, params.action);
  if (!navButton) {
    throw new NavigationError(
      `France-Visas navigation button for action "${params.action}" not found on page "${params.from}"`,
      {
        expected: params.from,
        url: page.url(),
        details: { action: params.action },
      },
    );
  }

  try {
    await navButton.click();
  } catch (err) {
    throw new NavigationError(
      `Failed to click France-Visas ${params.action} button on page "${params.from}"`,
      {
        expected: params.from,
        url: page.url(),
        details: {
          action: params.action,
          cause: err instanceof Error ? err.message : String(err),
        },
      },
    );
  }

  try {
    await page.waitForLoadState("networkidle", { timeout: Math.min(5_000, timeoutMs) });
  } catch {
    // non-fatal — identity polling below still runs
  }

  const probe = await detectPage(page);
  const expectedList = Array.isArray(params.to) ? params.to : [params.to];
  const alreadyOnDestination = probe.id !== "unknown" && expectedList.includes(probe.id);

  if (!alreadyOnDestination) {
    const validation = await readValidationMessages(page);
    if (validation.all.length > 0) {
      throw new ValidationFailedError(
        `France-Visas ${params.action} rejected on page "${params.from}": ${validation.all[0]}`,
        {
          expected: params.from,
          detected: probe.id,
          url: probe.url,
          validationMessages: validation.all,
          details: {
            action: params.action,
            heading: probe.heading,
            summary: validation.summary,
            fieldErrors: validation.fieldErrors,
          },
        },
      );
    }
  }

  try {
    return await waitForPage(page, expectedList, { timeoutMs, pollIntervalMs });
  } catch (err) {
    const detected = (err as { context?: { detected?: FvPageId | "unknown" } })?.context?.detected;
    throw new NavigationError(
      `France-Visas ${params.action} from "${params.from}" did not reach [${expectedList.join(", ")}] within ${timeoutMs}ms`,
      {
        expected: expectedList,
        detected: detected ?? "unknown",
        url: page.url(),
        details: {
          action: params.action,
          from: params.from,
          cause: err instanceof Error ? err.message : String(err),
        },
      },
    );
  }
}

async function resolveNavButton(page: Page, action: FvNavAction): Promise<Locator | null> {
  const selector = navSelectorFor(action);
  const candidates = page.locator(selector);
  const count = await candidates.count();
  for (let i = 0; i < count; i += 1) {
    const candidate = candidates.nth(i);
    if (await candidate.isVisible()) {
      return candidate;
    }
  }
  return null;
}

function navSelectorFor(action: FvNavAction): string {
  switch (action) {
    case "next":
      return FV_NAV_SELECTORS.next;
    case "back":
      return FV_NAV_SELECTORS.back;
    case "save":
      return FV_NAV_SELECTORS.save;
  }
}

async function collectVisibleTexts(locator: Locator): Promise<string[]> {
  const count = await locator.count();
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const node = locator.nth(i);
    if (!(await node.isVisible())) continue;
    const text = (await node.textContent())?.trim() ?? "";
    if (text.length > 0) out.push(text);
  }
  return out;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}
