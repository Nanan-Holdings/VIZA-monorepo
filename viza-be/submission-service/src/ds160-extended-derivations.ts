/**
 * Deterministic derivations for the additional DS-160 branches.
 *
 * CEAC represents these dates as three controls.  The intake stores one
 * yyyy-mm-dd value, so this module only performs a strict ISO-date split.  It
 * never supplies a date, changes an invalid value, or overwrites a value that
 * is already present.  Repeat rows use the existing `__2`, `__3`, ... suffix
 * convention and are split independently.
 */

import { DS160_EXTENDED_DATE_SPLITS } from "./ds160-extended-mappings";

export interface Ds160ExtendedDerivationTargets {
  dateSplits: readonly {
    source: string;
    targetPrefix: string;
    monthAsAbbrev: true;
  }[];
  naPairs: readonly { source: string; naKey: string }[];
  keyAliases: readonly { from: string; to: string }[];
  customDerivations: readonly { requires: string[]; produces: string[] }[];
}

export const DS160_EXTENDED_DERIVATION_TARGETS: Ds160ExtendedDerivationTargets = {
  dateSplits: DS160_EXTENDED_DATE_SPLITS,
  naPairs: [],
  keyAliases: [],
  customDerivations: [],
};

const MONTH_ABBREVIATIONS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

interface IsoDateParts {
  day: string;
  month: number;
  year: string;
}

function parseStrictIsoDate(value: string): IsoDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, monthText, day] = match;
  const month = Number(monthText);
  const dayNumber = Number(day);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) return null;

  const candidate = new Date(Date.UTC(Number(year), month - 1, dayNumber));
  if (
    candidate.getUTCFullYear() !== Number(year) ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== dayNumber
  ) {
    return null;
  }
  return { day, month, year };
}

function isNonApplicableToken(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return normalized === "DOES_NOT_APPLY" || normalized === "DOES NOT APPLY" ||
    normalized === "DO_NOT_KNOW" || normalized === "DO NOT KNOW" || normalized === "N/A";
}

/** Apply only the additional date splits; returns the same answer object. */
export function deriveDs160ExtendedAnswers(
  answers: Record<string, string>,
): Record<string, string> {
  for (const split of DS160_EXTENDED_DATE_SPLITS) {
    const sourceKeys = Object.keys(answers).filter((key) =>
      key === split.source || new RegExp(`^${split.source}__\\d+$`).test(key),
    );
    for (const sourceKey of sourceKeys) {
      const raw = answers[sourceKey];
      if (!raw || isNonApplicableToken(raw)) continue;
      const parts = parseStrictIsoDate(raw);
      if (!parts) continue;
      const suffix = sourceKey.slice(split.source.length);
      const dayKey = `${split.targetPrefix}_day${suffix}`;
      const monthKey = `${split.targetPrefix}_month${suffix}`;
      const yearKey = `${split.targetPrefix}_year${suffix}`;
      if (answers[dayKey] === undefined) answers[dayKey] = parts.day;
      if (answers[monthKey] === undefined) answers[monthKey] = MONTH_ABBREVIATIONS[parts.month - 1];
      if (answers[yearKey] === undefined) answers[yearKey] = parts.year;
    }
  }
  return answers;
}

