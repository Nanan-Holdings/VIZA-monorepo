import type { ReviewExpectation, ReviewSnapshot, ReviewVerificationIssue, ReviewVerificationResult } from "./review-verification";
import type { ReviewTableRow, ReviewTableRule } from "./review-table-contract";
import { PERSONAL_REVIEW_TABLE_RULES } from "./review-table-personal";
import { WORK_REVIEW_TABLE_RULES } from "./review-table-work";

const RULES: readonly ReviewTableRule[] = [...PERSONAL_REVIEW_TABLE_RULES, ...WORK_REVIEW_TABLE_RULES];
const normalize = (value: string): string => value.trim().replace(/\s+/g, " ").toLowerCase();
const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function dateValue(day: string, month: string, year: string): string | null {
  if (!/^\d{1,2}$/.test(day.trim()) || !/^\d{4}$/.test(year.trim())) return null;
  const monthIndex = months.findIndex(name => [name, name.slice(0, 3)].includes(normalize(month)));
  const dayNumber = Number(day);
  const yearNumber = Number(year);
  if (monthIndex < 0 || dayNumber < 1) return null;
  const date = new Date(Date.UTC(yearNumber, monthIndex, dayNumber));
  if (date.getUTCFullYear() !== yearNumber || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== dayNumber) return null;
  return `${yearNumber}-${monthIndex + 1}-${dayNumber}`;
}

function observedDate(value: string): string | null {
  const match = normalize(value).match(/^(\d{1,2}) ([a-z]+) (\d{4})$/);
  return match ? dateValue(match[1], match[2], match[3]) : null;
}

function monthIndex(value: string): number {
  const normalized = normalize(value);
  const named = months.findIndex(name => normalized === name || normalized === name.slice(0, 3));
  if (named >= 0) return named;
  const numeric = /^0?(\d{1,2})$/.exec(normalized);
  if (!numeric) return -1;
  const month = Number(numeric[1]);
  return month >= 1 && month <= 12 ? month - 1 : -1;
}

function observedPartialDate(value: string, month: string | undefined, year: string, precision: "month" | "year"): boolean {
  if (!/^\d{4}$/.test(year.trim())) return false;
  const normalized = normalize(value);
  const yearPattern = new RegExp(`(?:^|\\D)${year.trim()}(?:\\D|$)`);
  if (!yearPattern.test(normalized)) return false;
  if (precision === "year") return true;
  if (!month?.trim()) return false;
  const index = monthIndex(month);
  if (index < 0) return false;
  const name = months[index];
  if (normalized.includes(name) || normalized.includes(name.slice(0, 3))) return true;
  return new RegExp(`(?:^|\\D)0?${index + 1}(?:\\D|$)`).test(normalized);
}

function fieldIndex(name: string, base: string): number | null {
  if (name === base) return 0;
  if (!name.startsWith(`${base}__`)) return null;
  const suffix = name.slice(base.length + 2);
  if (!/^[1-9]\d*$/.test(suffix) || Number(suffix) < 2) return null;
  return Number(suffix) - 1;
}

function fieldAt(base: string, index: number): string {
  return index === 0 ? base : `${base}__${index + 1}`;
}

function labelAt(label: string, index: number): string {
  return normalize(label.split("{n}").join(String(index + 1)));
}

function anchorMatches(label: string, template: string): boolean {
  const parts = normalize(template).split("{n}");
  if (parts.length !== 2) return normalize(label) === normalize(template);
  const normalized = normalize(label);
  if (!normalized.startsWith(parts[0]) || !normalized.endsWith(parts[1])) return false;
  const middle = normalized.slice(parts[0].length, parts[1] ? -parts[1].length : undefined);
  return /^[1-9]\d*$/.test(middle);
}

function pageKind(snapshot: ReviewSnapshot): string | null {
  try {
    const url = new URL(snapshot.url);
    if (url.origin !== "https://ceac.state.gov") return null;
    return url.pathname.match(/^\/genniv\/general\/review\/review_review(personal|travel|uscontact|family|workeducation|security|location)\.aspx$/i)?.[1].toLowerCase() ?? null;
  } catch { return null; }
}

function matchingRows(snapshots: ReviewSnapshot[], rule: ReviewTableRule, index: number): ReviewTableRow[] {
  const matches: ReviewTableRow[] = [];
  for (const snapshot of snapshots) {
    if (pageKind(snapshot) !== rule.page) continue;
    let rows = (snapshot.rows ?? []).filter(row =>
      normalize(row.group) === normalize(rule.group) && row.container === (rule.container ?? ""));
    if (rule.scopeAnchor) {
      const anchors = rows.flatMap((row, position) => normalize(row.label) === labelAt(rule.scopeAnchor!, index) ? [position] : []);
      if (anchors.length !== 1) {
        if (anchors.length > 1) matches.push(...anchors.map(position => rows[position]));
        continue;
      }
      const start = anchors[0];
      const next = rows.findIndex((row, position) => position > start && anchorMatches(row.label, rule.scopeAnchor!));
      rows = rows.slice(start, next < 0 ? undefined : next);
    }
    for (let position = 0; position < rows.length; position += 1) {
      if (normalize(rows[position].label) !== labelAt(rule.label, index)) continue;
      if (!rule.continuation) matches.push(rows[position]);
      else {
        const next = rows[position + 1];
        if (next && normalize(next.label) === "" && rows[position].position !== undefined &&
          next.position === rows[position].position! + 1) matches.push(next);
      }
    }
  }
  return matches;
}

function compareRule(rule: ReviewTableRule, fields: Array<ReviewExpectation | undefined>, na: ReviewExpectation | undefined, actual: string): "match" | "mismatch" | "incomplete" {
  if (rule.format === "date" && na && normalize(na.value) === "yes") {
    if (fields.some(Boolean)) return "incomplete";
    return normalize(actual) === "does not apply" ? "match" : "mismatch";
  }
  if (rule.format === "date" && rule.partialDate) {
    const month = fields[1];
    const year = fields[2];
    if (!year || !year.value.trim() || (rule.partialDate === "month" && (!month || !month.value.trim()))) return "incomplete";
    const day = fields[0];
    if (day?.value.trim()) {
      if (!month?.value.trim()) return "incomplete";
      const expectedDate = dateValue(day.value, month.value, year.value);
      if (!expectedDate) return "incomplete";
      return observedDate(actual) === expectedDate ? "match" : "mismatch";
    }
    return observedPartialDate(actual, month?.value, year.value, rule.partialDate) ? "match" : "mismatch";
  }
  if (fields.some(field => !field)) return "incomplete";
  const present = fields as ReviewExpectation[];
  if (present.some(field => !field.value.trim() && !field.allowEmptyValue)) return "incomplete";
  const values = present.map(field => field.value.trim());
  const observed = normalize(actual);
  let expected: string;
  switch (rule.format ?? "text") {
    case "date": {
      if (values.length !== 3 || (na && normalize(na.value) !== "no")) return "incomplete";
      const expectedDate = dateValue(values[0], values[1], values[2]);
      if (!expectedDate) return "incomplete";
      return observedDate(actual) === expectedDate ? "match" : "mismatch";
    }
    case "na":
    case "unknown":
      if (values.length !== 1 || normalize(values[0]) !== "yes") return "incomplete";
      expected = rule.format === "na" ? "DOES NOT APPLY" : "DO NOT KNOW";
      break;
    case "name":
      if (values.length !== 2) return "incomplete";
      expected = values.join(", ");
      break;
    case "place": expected = values.join(", "); break;
    case "length":
      if (values.length !== 2) return "incomplete";
      expected = values.join(" ");
      break;
    case "locality":
      if (values.length !== 3) return "incomplete";
      expected = `${values[0]}, ${values[1]} ${values[2]}`;
      break;
    case "aliases":
      if (values.length < 1 || values.some(value => normalize(value) !== normalize(values[0]))) return "incomplete";
      expected = values[0];
      break;
    default:
      if (values.length !== 1) return "incomplete";
      expected = values[0];
  }
  return observed === normalize(expected) ? "match" : "mismatch";
}

/** Match only catalogued, scoped official rows; every read-back must be covered. */
export function verifyTableReview(expectations: ReviewExpectation[], snapshots: ReviewSnapshot[], initialIssues: ReviewVerificationIssue[] = []): ReviewVerificationResult {
  const issues = [...initialIssues];
  const matched = new Set<ReviewExpectation>();
  const visited = new Set<ReviewExpectation>();
  const addIssue = (fieldName: string, reason: string): void => {
    if (!issues.some(issue => issue.fieldName === fieldName && issue.reason === reason)) issues.push({fieldName, reason});
  };
  for (const rule of RULES) {
    const bases = [...rule.fields, ...(rule.naField ? [rule.naField] : [])];
    const section = expectations.filter(field => field.section === rule.section);
    const indexes = new Set(section.flatMap(field => bases.flatMap(base => {
      const index = fieldIndex(field.fieldName, base);
      return index === null ? [] : [index];
    })));
    for (const index of indexes) {
      const entries = bases.map(base => section.filter(field => field.fieldName === fieldAt(base, index)));
      const covered = entries.flat();
      covered.forEach(field => visited.add(field));
      if (entries.some(list => list.length > 1)) {
        covered.forEach(field => addIssue(field.fieldName, "duplicate_expectation_id"));
        continue;
      }
      if (index > 0 && !rule.label.includes("{n}") && !rule.scopeAnchor) {
        covered.forEach(field => addIssue(field.fieldName, "unsupported_repeat_review"));
        continue;
      }
      if (covered.some(field => !/(?:^|_)(?:tbx|tb|ddl|rbl|cbx|cbex|lbl)_?/i.test(field.controlId))) {
        covered.forEach(field => addIssue(field.fieldName, "invalid_expectation_id"));
        continue;
      }
      const rows = matchingRows(snapshots, rule, index);
      if (rows.length !== 1) {
        covered.forEach(field => addIssue(field.fieldName, rows.length ? "ambiguous_observed_row" : "missing_observed_value"));
        continue;
      }
      const comparison = compareRule(rule, entries.slice(0, rule.fields.length).map(list => list[0]), rule.naField ? entries.at(-1)?.[0] : undefined, rows[0].value);
      if (comparison === "match") covered.forEach(field => matched.add(field));
      else covered.forEach(field => addIssue(field.fieldName, comparison === "incomplete" ? "incomplete_composite_expectation" : "review_value_mismatch"));
    }
  }
  for (const field of expectations) if (!visited.has(field)) addIssue(field.fieldName, "unsupported_review_field");
  const structural = issues.some(issue => issue.reason !== "review_value_mismatch");
  return {status: structural ? "unverified" : issues.length ? "failed" : "passed", matched: matched.size, issues};
}
