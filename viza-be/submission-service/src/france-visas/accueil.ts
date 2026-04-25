/**
 * France-Visas "My applications" dashboard (accueil.xhtml).
 *
 * The accueil dashboard lists existing draft/submitted applications and
 * exposes a primary CTA to start a new one. Selectors and flow confirmed
 * via live walk 2026-04-24.
 */

import type { Page } from "@playwright/test";
import { waitForPage } from "./pages";
import { NavigationError } from "./errors";

export interface CreateApplicationOptions {
  /** Upper bound for step1 identity check after the CTA click. Default 30s. */
  timeoutMs?: number;
}

/**
 * Click "Create a new application in a new group of applications" and wait
 * for step1.xhtml to load. Returns when the page identity settles on step1.
 *
 * The CTA is a regular anchor/button (not a PrimeFaces widget) that
 * navigates directly — no AJAX dance needed.
 */
export async function startNewApplication(
  page: Page,
  options: CreateApplicationOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  // The button's label is localized — match against EN + FR.
  const cta = page.locator(
    [
      'a:has-text("Create a new application")',
      'button:has-text("Create a new application")',
      'a:has-text("Créer une nouvelle demande")',
      'button:has-text("Créer une nouvelle demande")',
      'input[type="submit"][value*="Create a new application"]',
    ].join(", "),
  ).first();

  const count = await cta.count();
  if (count === 0) {
    throw new NavigationError(
      `"Create a new application" CTA not found on accueil.xhtml`,
      { url: page.url() },
    );
  }

  await cta.click({ force: true });
  await waitForPage(page, "step1", { timeoutMs });
}
