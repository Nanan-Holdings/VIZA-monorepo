/**
 * CEAC start-page location helper.
 *
 * This module intentionally handles only the location dropdown and the
 * post-location information modal. CAPTCHA remains a manual applicant action
 * in live assisted DS-160 runs.
 */

import type { Page } from "@playwright/test";
import { waitForAspNetPostback } from "./aspnet";

export const LOCATION_SELECT_SELECTOR =
  'select[id*="ucLocation_ddlLocation"], select[name*="ucLocation$ddlLocation"]';

const POST_LOCATION_MODAL_CLOSE_SELECTOR =
  'a[id*="ucPostMessage"][id*="lnkClose"], a[id*="ucPost"][id*="lnkClose"]';

const POST_LOCATION_MODAL_HIDE_CSS =
  '.modalBackground, .modal-content, [id*="modalConfirm_backgroundElement"] { display: none !important; }';

export type StartPageLocationOutcome =
  | { status: "selected"; locationCode: string }
  | { status: "already_selected"; locationCode: string }
  | { status: "missing_selector"; locationCode: string }
  | { status: "missing_option"; locationCode: string }
  | { status: "failed"; locationCode: string; reason: string };

export interface SelectStartPageLocationOptions {
  locationCode: string;
  timeoutMs?: number;
}

export async function selectStartPageLocation(
  page: Page,
  options: SelectStartPageLocationOptions,
): Promise<StartPageLocationOutcome> {
  const locationCode = options.locationCode.trim().toUpperCase();
  const timeoutMs = options.timeoutMs ?? 10_000;
  const locationSelect = page.locator(LOCATION_SELECT_SELECTOR).first();

  try {
    await locationSelect.waitFor({ state: "attached", timeout: timeoutMs });
  } catch {
    return { status: "missing_selector", locationCode };
  }

  const optionExists = await locationSelect
    .evaluate((select, target) => {
      if (!(select instanceof HTMLSelectElement)) return false;
      return Array.from(select.options).some((option) => option.value.trim().toUpperCase() === target);
    }, locationCode)
    .catch(() => false);

  if (!optionExists) {
    return { status: "missing_option", locationCode };
  }

  let currentValue = "";
  try {
    currentValue = (await locationSelect.inputValue()).trim().toUpperCase();
  } catch {
    // Fall through and attempt selection.
  }

  if (currentValue !== locationCode) {
    try {
      await locationSelect.selectOption(locationCode);
    } catch (err) {
      return {
        status: "failed",
        locationCode,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
    await waitForAspNetPostback(page, 15_000);
  }

  await dismissPostLocationModal(page);
  return {
    status: currentValue === locationCode ? "already_selected" : "selected",
    locationCode,
  };
}

async function dismissPostLocationModal(page: Page): Promise<void> {
  const closeBtn = page.locator(POST_LOCATION_MODAL_CLOSE_SELECTOR).first();
  let closeAppeared = false;

  try {
    await closeBtn.waitFor({ state: "visible", timeout: 8_000 });
    closeAppeared = true;
  } catch {
    // The modal is location/deployment dependent. No modal means no ack needed.
  }

  if (closeAppeared) {
    try {
      await closeBtn.click({ timeout: 5_000 });
    } catch {
      try {
        await closeBtn.evaluate((el) => {
          const clickable = el as Element & { click?: () => void };
          if (typeof clickable.click === "function") {
            clickable.click();
          } else {
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          }
        });
      } catch {
        // Best effort; CSS fallback below prevents visual residue blocking input.
      }
    }

    try {
      await closeBtn.waitFor({ state: "hidden", timeout: 8_000 });
    } catch {
      // Best effort; wait for ASP.NET postback regardless.
    }
    await waitForAspNetPostback(page, 10_000);
  }

  try {
    await page.addStyleTag({ content: POST_LOCATION_MODAL_HIDE_CSS });
  } catch {
    // Best effort.
  }
}
