/**
 * Playwright adapter for DS-160 repeat groups.
 *
 * This adapter discovers row and control evidence from the current DOM. It
 * does not promote the static repeat contract to official parity: every
 * Add/Remove operation requires a fresh, unique control in the same nearest
 * group container as the mapped row fields. The actual field filler remains
 * an injected callback so the existing CEAC mapping/read-back implementation
 * stays the single source of truth for filling controls.
 */

import type { Locator, Page } from "@playwright/test";
import type { FormFieldMapping } from "../form-mappings";
import {
  DS160_EXTENDED_DATE_SPLITS,
  DS160_EXTENDED_METADATA,
  DS160_EXTENDED_MAPPINGS,
  type Ds160ExtendedFieldMetadata,
} from "../ds160-extended-mappings";
import {
  __DERIVATION_TARGETS,
  deriveDS160Answers,
} from "../ds160-derive-answers";
import { deriveDs160ExtendedAnswers } from "../ds160-extended-derivations";
import { ds160ConditionMatches } from "../ds160-conditions";
import {
  DS160_REPEAT_GROUP_CONTRACTS,
  DS160_REPEAT_GROUP_NAMES,
  type Ds160RepeatGroupContract,
  type Ds160RepeatGroupName,
} from "../ds160-repeat-contract";
import {
  decodeRepeatGroupAnswers,
  executeDs160RepeatGroups,
  repeatStorageKey,
  type Ds160FlatAnswers,
  type Ds160RepeatExecutionAdapter,
  type Ds160RepeatRow,
  type RepeatGroupConditionContext,
  type RepeatRowContext,
  type RepeatSelectorEvidence,
} from "./repeat-groups";
import { waitForAspNetPostback } from "./aspnet";
import { CeacError } from "./errors";

const REPEAT_CONTROL_SELECTOR =
  'a, button, input[type="submit"], input[type="button"], input[type="image"], [role="button"]';
const ADD_CONTROL_PATTERN =
  /\badd\s+(?:another|an additional|a new|new|one|row|item)|\banother\s+(?:row|item|entry|phone|email|country|organization|school|employer|spouse|relative|visit)/i;
const REMOVE_CONTROL_PATTERN = /\b(?:remove|delete)\b/i;

export type Ds160RepeatBrowserErrorCode =
  | "page_mismatch"
  | "missing_repeat_mapping"
  | "unmapped_repeat_field"
  | "missing_repeat_scope"
  | "ambiguous_repeat_scope"
  | "missing_repeat_row"
  | "ambiguous_repeat_row"
  | "missing_add_control"
  | "ambiguous_add_control"
  | "missing_remove_control"
  | "ambiguous_remove_control"
  | "control_click_failed"
  | "condition_evaluator_failed"
  | "missing_repeat_field_control";

/** A browser-discovery error that never embeds applicant answer values. */
export class Ds160RepeatBrowserError extends Error {
  readonly code: Ds160RepeatBrowserErrorCode;
  readonly group: Ds160RepeatGroupName;
  readonly pageId: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: Ds160RepeatBrowserErrorCode,
    group: Ds160RepeatGroupName,
    pageId: string,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "Ds160RepeatBrowserError";
    this.code = code;
    this.group = group;
    this.pageId = pageId;
    this.details = details;
  }
}

export interface Ds160RepeatBrowserFillRowContext {
  /** Row-local, derived keys, for example `foo__2` and `date_day__2`. */
  readonly answers: Record<string, string>;
  /** Row-local mappings use the same suffix as `answers`. */
  readonly mappings: Record<string, FormFieldMapping>;
  /** The verified nearest row scope; callers should keep fills inside it. */
  readonly scope?: Locator;
  /** Rediscover this same row after a controller's WebForms postback. */
  readonly resolveScope?: () => Promise<Locator>;
  readonly page: Page;
  readonly pageId: string;
  readonly group: Ds160RepeatGroupName;
  readonly row: Ds160RepeatRow;
}

export type Ds160RepeatBrowserFillRow = (
  context: Ds160RepeatBrowserFillRowContext,
) => void | Promise<void>;

/**
 * Optional final read-back hook. It runs after every requested repeat group
 * has finished filling, and receives a freshly resolved row scope. Callers
 * can pass `verifyPageFieldValues` here so later WebForms postbacks cannot
 * silently invalidate an earlier row.
 */
export type Ds160RepeatBrowserVerifyRow = (
  context: Ds160RepeatBrowserFillRowContext,
) => void | Promise<void>;

export interface FillDs160RepeatGroupsOptions {
  readonly page: Page;
  readonly pageId: string;
  /** Flat values loaded from `visa_application_answers`. */
  readonly answers: Record<string, string>;
  /** Existing page mappings; extended repeat mappings are used as fallback. */
  readonly mappings: Record<string, FormFieldMapping>;
  /** Existing field filler, typically a scope-aware wrapper around fillPageFields. */
  readonly fillRow: Ds160RepeatBrowserFillRow;
  /** Optional final per-row read-back after all group fills settle. */
  readonly verifyRow?: Ds160RepeatBrowserVerifyRow;
  /** Defaults to all groups belonging to `pageId`. */
  readonly groups?: readonly Ds160RepeatGroupName[];
}

export interface FillDs160RepeatGroupsResult {
  readonly groups: Awaited<ReturnType<typeof executeDs160RepeatGroups>>["groups"];
  readonly pageId: string;
}

interface MappingEntry {
  readonly key: string;
  readonly mapping: FormFieldMapping;
  readonly metadata?: Ds160ExtendedFieldMetadata;
}

interface CandidateAttributes {
  readonly id: string;
  readonly name: string;
  readonly tagName: string;
  readonly value: string;
  readonly text: string;
  readonly ariaLabel: string;
  readonly title: string;
}

interface VisibleFieldCandidate {
  readonly fieldKey: string;
  readonly mapping: FormFieldMapping;
  readonly locator: Locator;
  readonly identity: string;
  readonly ctlToken: string | null;
  readonly attributes: CandidateAttributes;
}

interface BrowserRepeatRow {
  readonly ordinal: number;
  readonly ctlToken: string | null;
  readonly ctlNumber: number | null;
  readonly scope: Locator;
  readonly candidates: readonly VisibleFieldCandidate[];
}

interface BrowserRepeatRuntime {
  readonly rows: readonly BrowserRepeatRow[];
  readonly candidates: readonly VisibleFieldCandidate[];
}

interface FilledBrowserRepeatRow {
  readonly row: Ds160RepeatRow;
  readonly activeFieldKeys: readonly string[];
  readonly answers: Record<string, string>;
  readonly mappings: Record<string, FormFieldMapping>;
  readonly resolveScope: () => Promise<Locator>;
}

function mappingKeysForContract(
  contract: Ds160RepeatGroupContract,
  pageId: string,
  suppliedMappings: Record<string, FormFieldMapping>,
): MappingEntry[] {
  const keys = new Set<string>(contract.rowFieldKeys);

  // Aliases are applied to a row before it is filled. Include their CEAC
  // targets so a seed key such as social_media_platform can reach the
  // existing social_media_provider mapping.
  for (const alias of __DERIVATION_TARGETS.keyAliases) {
    if (keys.has(alias.from)) keys.add(alias.to);
  }

  for (const [key, metadata] of Object.entries(DS160_EXTENDED_METADATA)) {
    if (metadata.repeatGroup === contract.group && metadata.page === pageId) {
      keys.add(key);
    }
  }

  const entries: MappingEntry[] = [];
  for (const key of keys) {
    const mapping = suppliedMappings[key] ?? DS160_EXTENDED_MAPPINGS[key];
    if (!mapping) continue;
    entries.push({ key, mapping, metadata: DS160_EXTENDED_METADATA[key] });
  }

  if (entries.length === 0) {
    throw new Ds160RepeatBrowserError(
      "missing_repeat_mapping",
      contract.group,
      pageId,
      `No CEAC mapping is available for repeat group "${contract.group}".`,
    );
  }
  return entries;
}

async function readCandidateAttributes(locator: Locator): Promise<CandidateAttributes> {
  return locator.evaluate((element) => ({
    id: element.getAttribute("id") ?? "",
    name: element.getAttribute("name") ?? "",
    tagName: element.tagName,
    value:
      element.getAttribute("value") ??
      ("value" in element ? String((element as HTMLInputElement).value ?? "") : ""),
    text: element.textContent?.trim() ?? "",
    ariaLabel: element.getAttribute("aria-label") ?? "",
    title: element.getAttribute("title") ?? "",
  }));
}

function aspNetCtlTokens(value: string): string[] {
  return [...value.matchAll(/(?:^|[_$])((?:ctl)\d+)(?=[_$]|$)/gi)].map((match) =>
    match[1].toLowerCase(),
  );
}

function ctlTokenFromAttributes(attributes: CandidateAttributes): string | null {
  const idToken = aspNetCtlTokens(attributes.id).at(-1) ?? null;
  const nameToken = aspNetCtlTokens(attributes.name).at(-1) ?? null;
  if (idToken && nameToken && idToken !== nameToken) return null;
  return idToken ?? nameToken;
}

function ctlNumber(token: string | null): number | null {
  if (!token) return null;
  const number = Number(token.slice(3));
  return Number.isSafeInteger(number) ? number : null;
}

function splitSelectors(selector: string): string[] {
  return selector
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

async function collectVisibleCandidates(
  page: Page,
  entries: readonly MappingEntry[],
  contract: Ds160RepeatGroupContract,
  pageId: string,
): Promise<VisibleFieldCandidate[]> {
  const candidates: VisibleFieldCandidate[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    for (const selector of splitSelectors(entry.mapping.selector)) {
      let locator: Locator;
      try {
        locator = page.locator(selector);
      } catch {
        continue;
      }
      const count = await locator.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        const candidateLocator = locator.nth(index);
        if (!(await candidateLocator.isVisible().catch(() => false))) continue;
        const attributes = await readCandidateAttributes(candidateLocator).catch(() => null);
        if (!attributes) continue;

        const identity = `${attributes.id}\u0000${attributes.name}`;
        const dedupeKey = `${entry.key}\u0000${identity || `${selector}\u0000${index}`}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        candidates.push({
          fieldKey: entry.key,
          mapping: entry.mapping,
          locator: candidateLocator,
          identity,
          ctlToken: ctlTokenFromAttributes(attributes),
          attributes,
        });
      }
    }
  }

  if (candidates.length === 0) {
    throw new Ds160RepeatBrowserError(
      "missing_repeat_scope",
      contract.group,
      pageId,
      `No visible mapped control identifies repeat group "${contract.group}".`,
      { mappingCount: entries.length },
    );
  }
  return candidates;
}

async function locatorContains(root: Locator, child: Locator): Promise<boolean> {
  const rootHandle = await root.elementHandle().catch(() => null);
  if (!rootHandle) return false;
  return child
    .evaluate(
      (element, rootElement) =>
        rootElement instanceof Element && rootElement.contains(element),
      rootHandle,
    )
    .catch(() => false);
}

async function commonAncestor(
  candidates: readonly VisibleFieldCandidate[],
  contract: Ds160RepeatGroupContract,
  pageId: string,
): Promise<Locator> {
  const first = candidates[0];
  if (!first) {
    throw new Ds160RepeatBrowserError(
      "missing_repeat_scope",
      contract.group,
      pageId,
      `No mapped control is available for repeat group "${contract.group}".`,
    );
  }

  // Start at the parent rather than the mapped control itself. A one-field
  // row otherwise gets a scope equal to its input and the scoped verifier
  // cannot see that input as a descendant. Walking parents also avoids
  // depending on XPath axis ordering across Playwright/browser versions.
  let root = first.locator.locator("xpath=..");
  for (let depth = 0; depth < 128; depth += 1) {
    const tagName = await root.evaluate((element) => element.tagName.toLowerCase()).catch(() => "");
    if (!tagName || tagName === "html" || tagName === "body") break;

    let containsAll = true;
    for (const candidate of candidates) {
      if (!(await locatorContains(root, candidate.locator))) {
        containsAll = false;
        break;
      }
    }
    if (containsAll) return root;

    const parent = root.locator("xpath=..");
    const parentTag = await parent
      .evaluate((element) => element.tagName.toLowerCase())
      .catch(() => "");
    if (!parentTag || (parentTag === tagName && tagName === "html")) break;
    root = parent;
  }

  throw new Ds160RepeatBrowserError(
    "ambiguous_repeat_scope",
    contract.group,
    pageId,
    `Could not find a unique DOM row scope for repeat group "${contract.group}".`,
    { candidateCount: candidates.length },
  );
}

async function discoverRows(
  candidates: readonly VisibleFieldCandidate[],
  contract: Ds160RepeatGroupContract,
  pageId: string,
): Promise<BrowserRepeatRuntime> {
  const tokenGroups = new Map<string, VisibleFieldCandidate[]>();
  const unscoped: VisibleFieldCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.ctlToken) {
      unscoped.push(candidate);
      continue;
    }
    const current = tokenGroups.get(candidate.ctlToken) ?? [];
    current.push(candidate);
    tokenGroups.set(candidate.ctlToken, current);
  }

  const rows: BrowserRepeatRow[] = [];
  if (tokenGroups.size === 0) {
    const fieldCounts = new Map<string, number>();
    for (const candidate of candidates) {
      fieldCounts.set(candidate.fieldKey, (fieldCounts.get(candidate.fieldKey) ?? 0) + 1);
    }
    if ([...fieldCounts.values()].some((count) => count > 1)) {
      throw new Ds160RepeatBrowserError(
        "ambiguous_repeat_row",
        contract.group,
        pageId,
        `Multiple visible controls have no ASP.NET row index for repeat group "${contract.group}".`,
        { candidateCount: candidates.length },
      );
    }
    rows.push({
      ordinal: 0,
      ctlToken: null,
      ctlNumber: null,
      scope: await commonAncestor(candidates, contract, pageId),
      candidates,
    });
  } else {
    const sortedTokens = [...tokenGroups.keys()].sort((left, right) => {
      const leftNumber = ctlNumber(left);
      const rightNumber = ctlNumber(right);
      if (leftNumber === null || rightNumber === null) return left.localeCompare(right);
      return leftNumber - rightNumber;
    });
    const seenNumbers = new Set<number>();
    for (const [ordinal, token] of sortedTokens.entries()) {
      const number = ctlNumber(token);
      if (number !== null && seenNumbers.has(number)) {
        throw new Ds160RepeatBrowserError(
          "ambiguous_repeat_row",
          contract.group,
          pageId,
          `Two ASP.NET row tokens resolve to the same index for repeat group "${contract.group}".`,
          { token },
        );
      }
      if (number !== null) seenNumbers.add(number);
      const rowCandidates = tokenGroups.get(token) ?? [];
      rows.push({
        ordinal,
        ctlToken: token,
        ctlNumber: number,
        scope: await commonAncestor(rowCandidates, contract, pageId),
        candidates: rowCandidates,
      });
    }

    for (const candidate of unscoped) {
      const containingRows: BrowserRepeatRow[] = [];
      for (const row of rows) {
        if (await locatorContains(row.scope, candidate.locator)) containingRows.push(row);
      }
      if (containingRows.length === 1) continue;
      if (containingRows.length === 0 && rows.length === 1) continue;
      throw new Ds160RepeatBrowserError(
        "ambiguous_repeat_scope",
        contract.group,
        pageId,
        `A mapped control without an ASP.NET row index cannot be assigned uniquely to "${contract.group}".`,
        { fieldKey: candidate.fieldKey, rowCount: rows.length },
      );
    }
  }

  if (rows.length === 0) {
    throw new Ds160RepeatBrowserError(
      "missing_repeat_row",
      contract.group,
      pageId,
      `No visible DOM row was identified for repeat group "${contract.group}".`,
    );
  }
  return { rows, candidates };
}

function controlLabel(attributes: CandidateAttributes): string {
  return [attributes.value, attributes.text, attributes.ariaLabel, attributes.title]
    .filter((value) => value.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ControlCandidate {
  readonly locator: Locator;
  readonly label: string;
  readonly ctlToken: string | null;
}

async function controlsIn(container: Locator, pattern: RegExp): Promise<ControlCandidate[]> {
  const locators = container.locator(REPEAT_CONTROL_SELECTOR);
  const count = await locators.count().catch(() => 0);
  const controls: ControlCandidate[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < count; index += 1) {
    const locator = locators.nth(index);
    if (!(await locator.isVisible().catch(() => false))) continue;
    if (!(await locator.isEnabled().catch(() => true))) continue;
    const attributes = await readCandidateAttributes(locator).catch(() => null);
    if (!attributes) continue;
    const label = controlLabel(attributes);
    if (!pattern.test(label)) continue;
    const identity = `${attributes.id}\u0000${attributes.name}\u0000${label}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    controls.push({
      locator,
      label,
      ctlToken: ctlTokenFromAttributes(attributes),
    });
  }
  return controls;
}

async function rowAncestors(row: BrowserRepeatRow): Promise<Locator[]> {
  const ancestors: Locator[] = [];
  let current = row.scope;
  for (let depth = 0; depth < 128; depth += 1) {
    const tagName = await current
      .evaluate((element) => element.tagName.toLowerCase())
      .catch(() => "");
    if (!tagName || tagName === "html" || tagName === "body") break;
    ancestors.push(current);
    current = current.locator("xpath=..");
  }
  return ancestors;
}

interface RepeatBoundaryInfo {
  readonly isBoundary: boolean;
  readonly declaredGroup: string | null;
}

async function repeatBoundaryInfo(container: Locator): Promise<RepeatBoundaryInfo> {
  return container
    .evaluate((element) => {
      const declaredGroup =
        element.getAttribute("data-repeat-group") ??
        element.getAttribute("data-group");
      const descriptor = [
        element.id,
        element.className,
        element.getAttribute("role"),
        declaredGroup ?? "",
      ]
        .join(" ")
        .toLowerCase();
      // A row marker is useful for diagnostics but is not the group boundary;
      // controls commonly sit beside the row inside its repeater container.
      const isRow =
        element.hasAttribute("data-repeat-row") ||
        element.hasAttribute("data-row") ||
        /(?:^|[-_ ])(?:row|item)(?:[-_ ]|$)/.test(descriptor);
      return {
        isBoundary:
          !isRow &&
          (declaredGroup !== null || /(?:repeat|repeater|group)/.test(descriptor)),
        declaredGroup: declaredGroup?.trim() || null,
      };
    })
    .catch(() => ({ isBoundary: false, declaredGroup: null }));
}

function groupControlToken(group: Ds160RepeatGroupName): string[] {
  return group
    .split("_")
    .map((part) => part.toLowerCase())
    .filter((part) => !["additional", "other", "specific", "planned", "previous"].includes(part))
    .map((part) => part.replace(/ies$/, "y").replace(/s$/, ""))
    .filter((part) => part.length >= 4);
}

function controlMatchesGroup(
  control: ControlCandidate,
  group: Ds160RepeatGroupName,
): boolean {
  const label = control.label.toLowerCase();
  return groupControlToken(group).some((token) => label.includes(token));
}

async function findAddControl(
  runtime: BrowserRepeatRuntime,
  row: BrowserRepeatRow,
  contract: Ds160RepeatGroupContract,
  pageId: string,
): Promise<ControlCandidate> {
  for (const ancestor of await rowAncestors(row)) {
    const controls = await controlsIn(ancestor, ADD_CONTROL_PATTERN);
    const boundary = await repeatBoundaryInfo(ancestor);
    if (controls.length > 1) {
      throw new Ds160RepeatBrowserError(
        "ambiguous_add_control",
        contract.group,
        pageId,
        `Multiple Add Another controls remain ambiguous for repeat group "${contract.group}".`,
        { candidateCount: controls.length },
      );
    }
    if (controls.length === 1) {
      const control = controls[0];
      const declaredOtherGroup =
        boundary.declaredGroup !== null && boundary.declaredGroup !== contract.group;
      if (!declaredOtherGroup && (boundary.isBoundary || controlMatchesGroup(control, contract.group))) {
        return control;
      }
    }
    if (boundary.isBoundary) break;
  }
  throw new Ds160RepeatBrowserError(
    "missing_add_control",
    contract.group,
    pageId,
    `No unique Add Another control is visible in the row container for "${contract.group}".`,
  );
}

async function findRemoveControl(
  runtime: BrowserRepeatRuntime,
  row: BrowserRepeatRow,
  contract: Ds160RepeatGroupContract,
  pageId: string,
): Promise<ControlCandidate> {
  let ambiguousCount = 0;
  for (const ancestor of await rowAncestors(row)) {
    const controls = await controlsIn(ancestor, REMOVE_CONTROL_PATTERN);
    const boundary = await repeatBoundaryInfo(ancestor);
    const rowMatched = row.ctlToken
      ? controls.filter((control) => control.ctlToken === row.ctlToken)
      : [];
    const declaredOtherGroup =
      boundary.declaredGroup !== null && boundary.declaredGroup !== contract.group;
    if (rowMatched.length === 1 && !declaredOtherGroup) return rowMatched[0];
    if (rowMatched.length > 1) ambiguousCount = Math.max(ambiguousCount, rowMatched.length);
    if (rowMatched.length === 0 && controls.length === 1) {
      const control = controls[0];
      if (!declaredOtherGroup && (boundary.isBoundary || controlMatchesGroup(control, contract.group))) {
        return control;
      }
    }
    if (controls.length > 1) ambiguousCount = Math.max(ambiguousCount, controls.length);
    if (boundary.isBoundary) break;
  }
  if (ambiguousCount > 1) {
    throw new Ds160RepeatBrowserError(
      "ambiguous_remove_control",
      contract.group,
      pageId,
      `Multiple Remove controls remain ambiguous for repeat group "${contract.group}".`,
      { candidateCount: ambiguousCount, rowIndex: row.ordinal },
    );
  }
  throw new Ds160RepeatBrowserError(
    "missing_remove_control",
    contract.group,
    pageId,
    `No unique Remove control is visible for row ${row.ordinal} of "${contract.group}".`,
    { rowIndex: row.ordinal },
  );
}

async function clickControl(
  control: ControlCandidate,
  page: Page,
  contract: Ds160RepeatGroupContract,
  pageId: string,
): Promise<void> {
  try {
    await control.locator.click({ timeout: 5_000 });
    await waitForAspNetPostback(page, 8_000);
  } catch (error) {
    if (error instanceof CeacError) throw error;
    throw new Ds160RepeatBrowserError(
      "control_click_failed",
      contract.group,
      pageId,
      `The verified repeat control could not be clicked for "${contract.group}".`,
      { label: control.label, cause: error instanceof Error ? error.name : "unknown" },
    );
  }
}

function suffixKey(key: string, index: number): string {
  return repeatStorageKey(key, index);
}

function derivedRepeatRowAnswers(row: Ds160RepeatRow): Record<string, string> {
  // Run the ordinary aliases/value/date derivations against the row's base
  // namespace, then restore the row suffix. Extended date derivations run a
  // second time on the suffixed namespace, which preserves date parts for
  // rows after row 0.
  const baseAnswers = deriveDS160Answers({ ...row.values });
  const rowAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseAnswers)) {
    rowAnswers[suffixKey(key, row.index)] = value;
  }
  deriveDs160ExtendedAnswers(rowAnswers);
  return rowAnswers;
}

export { derivedRepeatRowAnswers as deriveDs160RepeatRowAnswers };

const DERIVATION_SOURCE_KEYS = new Set([
  ...__DERIVATION_TARGETS.dateSplits.map((split) => split.source),
  ...DS160_EXTENDED_DATE_SPLITS.map((split) => split.source),
]);
const DERIVATION_ALIASES = __DERIVATION_TARGETS.keyAliases;

function baseKeyForRowKey(key: string, rowIndex: number): string {
  if (rowIndex === 0) return key;
  const suffix = `__${rowIndex + 1}`;
  return key.endsWith(suffix) ? key.slice(0, -suffix.length) : key;
}

function isAllowedUnmappedDerivedSource(
  key: string,
  rowIndex: number,
  mappedKeys: ReadonlySet<string>,
): boolean {
  const baseKey = baseKeyForRowKey(key, rowIndex);
  const aliases = DERIVATION_ALIASES.filter((alias) => alias.from === baseKey);
  if (aliases.some((alias) => mappedKeys.has(suffixKey(alias.to, rowIndex)))) return true;

  if (DERIVATION_SOURCE_KEYS.has(baseKey)) {
    const hasDateConsumer = [
      `${baseKey}_day`,
      `${baseKey}_month`,
      `${baseKey}_year`,
    ].some((part) => mappedKeys.has(suffixKey(part, rowIndex)));
    if (hasDateConsumer) return true;
  }
  return false;
}

function isDerivedKeyForActiveField(
  key: string,
  rowIndex: number,
  activeFieldKeys: ReadonlySet<string>,
): boolean {
  const baseKey = baseKeyForRowKey(key, rowIndex);
  if (activeFieldKeys.has(baseKey)) return true;

  if (__DERIVATION_TARGETS.keyAliases.some(
    (alias) => alias.to === baseKey && activeFieldKeys.has(alias.from),
  )) return true;

  if ([
    ...__DERIVATION_TARGETS.dateSplits,
    ...DS160_EXTENDED_DATE_SPLITS,
  ].some((split) =>
    activeFieldKeys.has(split.source) &&
    [
      `${split.targetPrefix}_day`,
      `${split.targetPrefix}_month`,
      `${split.targetPrefix}_year`,
    ].includes(baseKey),
  )) return true;

  if (__DERIVATION_TARGETS.naPairs.some(
    (pair) => pair.naKey === baseKey && activeFieldKeys.has(pair.source),
  )) return true;

  return __DERIVATION_TARGETS.customDerivations.some(
    (derivation) =>
      derivation.produces.includes(baseKey) &&
      derivation.requires.some((required) => activeFieldKeys.has(required)),
  );
}

function rowMappingsAndAnswers(
  row: Ds160RepeatRow,
  entries: readonly MappingEntry[],
  activeFieldKeys: readonly string[],
  pageId: string,
): { answers: Record<string, string>; mappings: Record<string, FormFieldMapping> } {
  const derivedAnswers = derivedRepeatRowAnswers(row);
  const activeFields = new Set(activeFieldKeys);
  const mappings: Record<string, FormFieldMapping> = {};
  for (const entry of entries) {
    if (!isDerivedKeyForActiveField(entry.key, row.index, activeFields)) continue;
    mappings[suffixKey(entry.key, row.index)] = entry.mapping;
  }
  const mappedKeys = new Set(Object.keys(mappings));
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(derivedAnswers)) {
    if (!value.trim()) continue;
    if (!isDerivedKeyForActiveField(key, row.index, activeFields)) continue;
    if (mappedKeys.has(key)) {
      answers[key] = value;
      continue;
    }
    if (isAllowedUnmappedDerivedSource(key, row.index, mappedKeys)) continue;
    throw new Ds160RepeatBrowserError(
      "unmapped_repeat_field",
      row.group,
      pageId,
      `Derived repeat answer key "${baseKeyForRowKey(key, row.index)}" has no CEAC mapping.`,
      { fieldKey: baseKeyForRowKey(key, row.index), rowIndex: row.index },
    );
  }
  return { answers, mappings };
}

async function verifyScopedMappedControls(
  scope: Locator,
  answers: Readonly<Record<string, string>>,
  mappings: Readonly<Record<string, FormFieldMapping>>,
  group: Ds160RepeatGroupName,
  pageId: string,
): Promise<void> {
  for (const [key, value] of Object.entries(answers)) {
    if (!value.trim()) continue;
    const mapping = mappings[key];
    if (!mapping) {
      throw new Ds160RepeatBrowserError(
        "unmapped_repeat_field",
        group,
        pageId,
        `Repeat answer key "${key}" has no row mapping.`,
        { fieldKey: key },
      );
    }
    let visibleCount = 0;
    for (const selector of splitSelectors(mapping.selector)) {
      const controls = scope.locator(selector);
      const count = await controls.count().catch(() => 0);
      for (let index = 0; index < count; index += 1) {
        if (await controls.nth(index).isVisible().catch(() => false)) visibleCount += 1;
      }
    }
    if (visibleCount === 0) {
      throw new Ds160RepeatBrowserError(
        "missing_repeat_field_control",
        group,
        pageId,
        `No visible mapped control exists in row scope for repeat key "${key}".`,
        { fieldKey: key },
      );
    }
  }
}

function conditionValues(
  answers: Record<string, string>,
  row?: Ds160RepeatRow,
): Record<string, string> {
  const canonical = deriveDS160Answers({ ...answers });
  if (!row) return canonical;
  const rowCanonical = deriveDS160Answers({ ...row.values });
  return { ...canonical, ...rowCanonical };
}

function evaluateCondition(
  context: RepeatGroupConditionContext,
  pageId: string,
): boolean {
  try {
    return ds160ConditionMatches(
      context.expression,
      conditionValues(context.answers as Record<string, string>, context.row),
    );
  } catch (error) {
    throw new Ds160RepeatBrowserError(
      "condition_evaluator_failed",
      context.contract.group,
      pageId,
      `The repeat condition could not be evaluated for "${context.contract.group}".`,
      { expression: context.expression, cause: error instanceof Error ? error.name : "unknown" },
    );
  }
}

/**
 * Fill all repeat groups belonging to one already-detected CEAC page.
 *
 * `fillRow` receives row-local derived answers, suffixed mappings, and the
 * nearest DOM row scope. It can call the existing field filler without
 * copying its selector/value verification logic.
 */
export async function fillDs160RepeatGroups(
  options: FillDs160RepeatGroupsOptions,
): Promise<FillDs160RepeatGroupsResult> {
  const requestedGroups = options.groups ??
    DS160_REPEAT_GROUP_NAMES.filter(
      (group) => DS160_REPEAT_GROUP_CONTRACTS[group].page === options.pageId,
    );

  for (const group of requestedGroups) {
    const contract = DS160_REPEAT_GROUP_CONTRACTS[group];
    if (!contract || contract.page !== options.pageId) {
      throw new Ds160RepeatBrowserError(
        "page_mismatch",
        group,
        options.pageId,
        `Repeat group "${group}" does not belong to CEAC page "${options.pageId}".`,
        { expectedPage: contract?.page ?? null },
      );
    }
  }

  const entriesByGroup = new Map<Ds160RepeatGroupName, readonly MappingEntry[]>();
  for (const group of requestedGroups) {
    entriesByGroup.set(
      group,
      mappingKeysForContract(
        DS160_REPEAT_GROUP_CONTRACTS[group],
        options.pageId,
        options.mappings,
      ),
    );
  }

  let desiredRowsByGroup = new Map<Ds160RepeatGroupName, number>();
  const filledRowsByGroup = new Map<
    Ds160RepeatGroupName,
    Map<number, FilledBrowserRepeatRow>
  >();
  const adapter: Ds160RepeatExecutionAdapter<Page, Locator> = {
    resolvePage: ({ contract, rows }) => {
      desiredRowsByGroup = new Map(desiredRowsByGroup).set(
        contract.group,
        rows.length > 0 ? Math.max(...rows.map((row) => row.index)) + 1 : 0,
      );
      return options.page;
    },
    getRowCount: async ({ contract, page }) => {
      const entries = entriesByGroup.get(contract.group);
      if (!entries) {
        throw new Ds160RepeatBrowserError(
          "missing_repeat_mapping",
          contract.group,
          options.pageId,
          `No mapping set was prepared for repeat group "${contract.group}".`,
        );
      }
      const candidates = await collectVisibleCandidates(page, entries, contract, options.pageId);
      const runtime = await discoverRows(candidates, contract, options.pageId);
      return runtime.rows.length;
    },
    addRow: async ({ contract, page, expectedIndex }) => {
      const entries = entriesByGroup.get(contract.group);
      if (!entries) throw new Error(`Missing mapping set for ${contract.group}`);
      const runtime = await discoverRuntime(page, entries, contract, options.pageId);
      if (runtime.rows.length !== expectedIndex) {
        throw new Ds160RepeatBrowserError(
          "ambiguous_repeat_row",
          contract.group,
          options.pageId,
          `The repeat row count changed before adding row ${expectedIndex} of "${contract.group}".`,
          { expectedIndex, actualCount: runtime.rows.length },
        );
      }
      const control = await findAddControl(
        runtime,
        runtime.rows[0],
        contract,
        options.pageId,
      );
      await clickControl(control, page, contract, options.pageId);
    },
    removeRow: async ({ contract, page, rowIndex }) => {
      const entries = entriesByGroup.get(contract.group);
      if (!entries) throw new Error(`Missing mapping set for ${contract.group}`);
      const runtime = await discoverRuntime(page, entries, contract, options.pageId);
      const row = runtime.rows[rowIndex];
      if (!row) {
        throw new Ds160RepeatBrowserError(
          "missing_repeat_row",
          contract.group,
          options.pageId,
          `Could not locate row ${rowIndex} of repeat group "${contract.group}" for removal.`,
          { rowIndex, actualCount: runtime.rows.length },
        );
      }
      const control = await findRemoveControl(runtime, row, contract, options.pageId);
      await clickControl(control, page, contract, options.pageId);
    },
    resolveRow: async ({ contract, page, row }) => {
      const entries = entriesByGroup.get(contract.group);
      if (!entries) throw new Error(`Missing mapping set for ${contract.group}`);
      const runtime = await discoverRuntime(page, entries, contract, options.pageId);
      const browserRow = runtime.rows[row.index];
      if (!browserRow) {
        throw new Ds160RepeatBrowserError(
          "missing_repeat_row",
          contract.group,
          options.pageId,
          `Could not locate persisted row ${row.index} of repeat group "${contract.group}".`,
          { rowIndex: row.index, actualCount: runtime.rows.length },
        );
      }
      return browserRow.scope;
    },
    fillRow: async (context: RepeatRowContext<Page, Locator>) => {
      const entries = entriesByGroup.get(context.contract.group);
      if (!entries) throw new Error(`Missing mapping set for ${context.contract.group}`);
      const rowHandle = context.rowHandle;
      if (!rowHandle) {
        throw new Ds160RepeatBrowserError(
          "missing_repeat_scope",
          context.contract.group,
          options.pageId,
          `No row scope was resolved for row ${context.row.index} of "${context.contract.group}".`,
          { rowIndex: context.row.index },
        );
      }
      const rowData = rowMappingsAndAnswers(
        context.row,
        entries,
        context.activeFieldKeys,
        options.pageId,
      );
      let expectedToken: string | null | undefined;
      let expectedCount: number | undefined;
      const resolveScope = async (): Promise<Locator> => {
        const candidates = await collectVisibleCandidates(options.page, entries, context.contract, options.pageId);
        const runtime = await discoverRows(candidates, context.contract, options.pageId);
        const current = runtime.rows[context.row.index];
        if (!current || (expectedCount !== undefined &&
          (runtime.rows.length !== expectedCount || current.ctlToken !== expectedToken))) {
          throw new Ds160RepeatBrowserError(
            "ambiguous_repeat_row", context.contract.group, options.pageId,
            "Repeat row identity changed while filling its conditional controls.",
            { rowIndex: context.row.index },
          );
        }
        expectedToken = current.ctlToken;
        expectedCount = runtime.rows.length;
        return current.scope;
      };
      await options.fillRow({
        answers: rowData.answers,
        mappings: rowData.mappings,
        scope: await resolveScope(),
        resolveScope,
        page: options.page,
        pageId: options.pageId,
        group: context.contract.group,
        row: context.row,
      });
      // A mapped child may be hidden until the row callback fills a visible
      // controller and waits for its WebForms postback. Verify after that
      // callback, otherwise a legitimate conditional branch fails before it
      // has had a chance to render.
      await verifyScopedMappedControls(
        await resolveScope(),
        rowData.answers,
        rowData.mappings,
        context.contract.group,
        options.pageId,
      );
      const filledRows = filledRowsByGroup.get(context.contract.group) ?? new Map();
      filledRows.set(context.row.index, {
        row: context.row,
        activeFieldKeys: [...context.activeFieldKeys],
        answers: rowData.answers,
        mappings: rowData.mappings,
        resolveScope,
      });
      filledRowsByGroup.set(context.contract.group, filledRows);
    },
    selectorEvidence: async (contract): Promise<RepeatSelectorEvidence> => {
      const entries = entriesByGroup.get(contract.group);
      if (!entries) {
        throw new Ds160RepeatBrowserError(
          "missing_repeat_mapping",
          contract.group,
          options.pageId,
          `No mapping set was prepared for repeat group "${contract.group}".`,
        );
      }
      const runtime = await discoverRuntime(options.page, entries, contract, options.pageId);
      const desired = desiredRowsByGroup.get(contract.group) ?? runtime.rows.length;
      if (desired > runtime.rows.length) {
        await findAddControl(runtime, runtime.rows[0], contract, options.pageId);
      } else if (desired < runtime.rows.length) {
        const row = runtime.rows[desired] ?? runtime.rows[runtime.rows.length - 1];
        await findRemoveControl(runtime, row, contract, options.pageId);
      }
      return {
        verified: true,
        source: "current-dom",
        note:
          `Current DOM exposed ${runtime.rows.length} mapped row(s) with ASP.NET tokens ` +
          `${runtime.rows.map((row) => row.ctlToken ?? "unindexed").join(", ")}; ` +
          "control evidence applies only to this page instance and is not official parity.",
      };
    },
    isGroupActive: (context) => evaluateCondition(context, options.pageId),
    isFieldActive: (context) => evaluateCondition(context, options.pageId),
  };

  const result = await executeDs160RepeatGroups({
    answers: options.answers as Ds160FlatAnswers,
    adapter,
    groups: requestedGroups,
  });

  if (options.verifyRow) {
    for (const groupResult of result.groups) {
      if (groupResult.status !== "filled") continue;
      const filledRows = filledRowsByGroup.get(groupResult.group);
      if (!filledRows) continue;

      for (const rowIndex of groupResult.filledRowIndices) {
        const filled = filledRows.get(rowIndex);
        if (!filled) {
          throw new Ds160RepeatBrowserError(
            "missing_repeat_row",
            groupResult.group,
            options.pageId,
            `No final verification context was retained for row ${rowIndex} of "${groupResult.group}".`,
            { rowIndex },
          );
        }

        // Retain the original row identity guard even after later groups'
        // postbacks; an existing ordinal alone does not establish identity.
        await options.verifyRow({
          answers: filled.answers,
          mappings: filled.mappings,
          scope: await filled.resolveScope(),
          page: options.page,
          pageId: options.pageId,
          group: groupResult.group,
          row: filled.row,
        });
      }
    }
  }
  return { pageId: options.pageId, groups: result.groups };
}

async function discoverRuntime(
  page: Page,
  entries: readonly MappingEntry[],
  contract: Ds160RepeatGroupContract,
  pageId: string,
): Promise<BrowserRepeatRuntime> {
  const candidates = await collectVisibleCandidates(page, entries, contract, pageId);
  return discoverRows(candidates, contract, pageId);
}

/** Exposed for focused local/browser diagnostics without changing the runner. */
export async function inspectDs160RepeatDom(
  page: Page,
  pageId: string,
  group: Ds160RepeatGroupName,
  mappings: Record<string, FormFieldMapping>,
): Promise<{ rowCount: number; ctlTokens: readonly (string | null)[] }> {
  const contract = DS160_REPEAT_GROUP_CONTRACTS[group];
  if (!contract || contract.page !== pageId) {
    throw new Ds160RepeatBrowserError(
      "page_mismatch",
      group,
      pageId,
      `Repeat group "${group}" does not belong to page "${pageId}".`,
    );
  }
  const entries = mappingKeysForContract(contract, pageId, mappings);
  const runtime = await discoverRuntime(page, entries, contract, pageId);
  return {
    rowCount: runtime.rows.length,
    ctlTokens: runtime.rows.map((row) => row.ctlToken),
  };
}
