/**
 * Step-1 choices France-Visas publishes no code list for (city of
 * submission, specific purpose) are picked from the live dropdown by label.
 * Nothing is guessed: when no single option matches, the run stops with
 * `FranceOptionUnmatchedError`, whose message lists the labels on offer.
 */

import type { Page } from "@playwright/test";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * VIZA `submission_centre` key → the centre's city as France-Visas spells it
 * in English. Keys match the 15 mainland-China TLScontact centres in the
 * France form (migration 0216) and the next-steps guide.
 */
export const SUBMISSION_CENTRE_CITIES: Readonly<Record<string, string>> = {
  beijing: "Beijing",
  guangzhou: "Guangzhou",
  chengdu: "Chengdu",
  shanghai: "Shanghai",
  shenyang: "Shenyang",
  wuhan: "Wuhan",
  jinan: "Jinan",
  chongqing: "Chongqing",
  shenzhen: "Shenzhen",
  changsha: "Changsha",
  hangzhou: "Hangzhou",
  kunming: "Kunming",
  xian: "Xi'an",
  nanjing: "Nanjing",
  fuzhou: "Fuzhou",
};

export function submissionCentreCity(centre: string | null | undefined): string | undefined {
  const key = centre?.trim().toLowerCase() ?? "";
  return SUBMISSION_CENTRE_CITIES[key];
}

/** Lowercase, accents and punctuation removed: "Xi'an" and "XIAN" compare equal. */
export function normalizeLabel(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * The option whose label is `wanted`, or the only option whose label
 * contains it. Null when nothing (or more than one option) matches.
 */
export function pickOptionByLabel(options: readonly SelectOption[], wanted: string): string | null {
  const target = normalizeLabel(wanted);
  if (!target) return null;
  const exact = options.filter((option) => normalizeLabel(option.label) === target);
  if (exact.length === 1) return exact[0].value;
  const partial = options.filter((option) => normalizeLabel(option.label).includes(target));
  return partial.length === 1 ? partial[0].value : null;
}

export class FranceOptionUnmatchedError extends Error {
  readonly code = "france_option_unmatched" as const;
  readonly context: { field: string; wanted: string; available: string[] };
  constructor(field: string, wanted: string, options: readonly SelectOption[]) {
    const available = options.map((option) => option.label);
    super(
      `France-Visas ${field}: no single option matches "${wanted || "(only option)"}"; available: ${available.join(" | ") || "(none)"}`,
    );
    this.name = "FranceOptionUnmatchedError";
    this.context = { field, wanted, available };
  }
}

/** The non-empty options of the native <select> behind a PrimeFaces widget. */
export async function readSelectOptions(page: Page, selectName: string): Promise<SelectOption[]> {
  const safeName = JSON.stringify(selectName).replace(/</g, "\\u003c");
  const options = await page.evaluate(`(() => {
    const name = ${safeName};
    const sel = document.querySelector('select[name="' + name.replace(/"/g, '\\\\"') + '"]');
    if (!sel) return [];
    return Array.from(sel.options)
      .filter((option) => option.value && option.value.trim())
      .map((option) => ({ value: option.value, label: (option.textContent || "").trim() }));
  })()`);
  return Array.isArray(options) ? (options as SelectOption[]) : [];
}

/** Pick by label (or the only option when `wanted` is empty), else throw. */
export async function resolveOptionFromPage(
  page: Page,
  field: string,
  selectName: string,
  wanted: string,
): Promise<string> {
  const options = await readSelectOptions(page, selectName);
  const value = wanted
    ? pickOptionByLabel(options, wanted)
    : options.length === 1
      ? options[0].value
      : null;
  if (!value) throw new FranceOptionUnmatchedError(field, wanted, options);
  return value;
}
