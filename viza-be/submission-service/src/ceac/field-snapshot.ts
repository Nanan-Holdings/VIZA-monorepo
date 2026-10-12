import type { Locator, Page } from "@playwright/test";
import type { FormFieldMapping } from "../form-mappings";

type Ds160FieldScope = Page | Locator;

type SnapshotStatus = "verified" | "missing" | "mismatch" | "unsupported";

export interface Ds160FieldObservation {
  readonly matches: boolean;
  readonly canSkipWrite: boolean;
  readonly maxLength: number;
  readonly controlId: string;
  readonly displayValue: string;
  readonly resolvedSelectValue: string | null;
  readonly ambiguousSelect: boolean;
  readonly visible: boolean;
  readonly enabled: boolean;
  readonly editable: boolean;
  /** The selector branch which produced this observation. */
  readonly selector: string;
}

export interface Ds160FieldSnapshot {
  readonly fieldName: string;
  readonly type: FormFieldMapping["type"];
  readonly status: SnapshotStatus;
  /** True when a visible, supported, enabled/editable candidate was found. */
  readonly sawEligible: boolean;
  /** True when at least one visible candidate was observed for this field. */
  readonly sawVisible: boolean;
  readonly ambiguous: boolean;
  readonly unsupportedSelectors: readonly string[];
  readonly reason?:
    | "not_requested"
    | "no_visible_control"
    | "control_disabled"
    | "control_readonly"
    | "ambiguous_selector"
    | "unsupported_selector"
    | "unsupported_control"
    | "unsupported_type";
  readonly observation?: Ds160FieldObservation;
}

export interface Ds160VerifiedField {
  readonly fieldName: string;
  readonly controlId: string;
  readonly value: string;
  readonly allowEmptyValue?: boolean;
}

export interface SnapshotDs160FieldsOptions {
  /** Only observe checkbox/radio controls. */
  readonly choicesOnly?: boolean;
  /** Apply the same branch gate used by the page filler before DOM access. */
  readonly isFieldActive?: (fieldName: string) => boolean;
  /** Called only for exact, uniquely identified matching controls. */
  readonly observeVerified?: (field: Ds160VerifiedField) => void;
}

export interface Ds160FieldSnapshotResult {
  /** One entry exists for every requested (non-skipped) mapping key. */
  readonly fields: Readonly<Record<string, Ds160FieldSnapshot>>;
  readonly requestedFieldNames: readonly string[];
  /** True only when every requested field had a supported eligible candidate. */
  readonly complete: boolean;
  readonly usedBatchedEvaluation: boolean;
}

interface CandidateSnapshot {
  readonly elementIndex: number;
  readonly matchedSelectors: readonly number[];
  readonly supportedTypes: readonly FormFieldMapping["type"][];
  readonly supported: boolean;
  readonly unsupportedSemantics: boolean;
  readonly disabled: boolean;
  readonly readonly: boolean;
  readonly enabled: boolean;
  readonly editable: boolean;
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly displayValue: string;
  readonly maxLength: number;
  readonly checked: boolean;
  readonly selectedValue: string;
  readonly selectedText: string;
  readonly selectCandidates: readonly {
    readonly value: string;
    readonly text: string;
    readonly disabled: boolean;
  }[];
}

interface SelectorEntry {
  readonly fieldName: string;
  readonly type: FormFieldMapping["type"];
  readonly selector: string;
  readonly index: number;
}

interface RequestedField {
  readonly fieldName: string;
  readonly mapping: FormFieldMapping;
  readonly selectors: readonly string[];
  readonly value: string;
  readonly allowEmptyValue: boolean;
}

function splitSelectors(selector: string): string[] {
  return selector
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function requestedValue(
  fieldName: string,
  mapping: FormFieldMapping,
  answers: Readonly<Record<string, string>>,
  profile: Readonly<Record<string, unknown>>,
): { value: string | null; allowEmptyValue: boolean } {
  const value = answers[fieldName] ?? (profile[fieldName] as string | undefined) ?? null;
  const allowEmptyValue = value === "" &&
    Object.prototype.hasOwnProperty.call(answers, fieldName) &&
    (mapping.type === "text" || mapping.type === "date");
  if (value === null || (value === "" && !allowEmptyValue)) {
    return { value: null, allowEmptyValue: false };
  }
  return { value, allowEmptyValue };
}

function selectorEntries(requested: readonly RequestedField[]): SelectorEntry[] {
  const entries: SelectorEntry[] = [];
  for (const field of requested) {
    for (const selector of field.selectors) {
      entries.push({
        fieldName: field.fieldName,
        type: field.mapping.type,
        selector,
        index: entries.length,
      });
    }
  }
  return entries;
}

function truthyChoice(value: string): boolean {
  return /^(Y|1|true|yes)$/i.test(value);
}

function makeSkippedSnapshot(
  fieldName: string,
  type: FormFieldMapping["type"],
): Ds160FieldSnapshot {
  return {
    fieldName,
    type,
    status: "missing",
    sawEligible: false,
    sawVisible: false,
    ambiguous: false,
    unsupportedSelectors: [],
    reason: "not_requested",
  };
}


function buildRequested(
  mappings: Readonly<Record<string, FormFieldMapping>>,
  answers: Readonly<Record<string, string>>,
  profile: Readonly<Record<string, unknown>>,
  options: SnapshotDs160FieldsOptions,
): { fields: RequestedField[]; snapshots: Record<string, Ds160FieldSnapshot> } {
  const fields: RequestedField[] = [];
  const snapshots: Record<string, Ds160FieldSnapshot> = {};
  for (const [fieldName, mapping] of Object.entries(mappings)) {
    if (options.isFieldActive?.(fieldName) === false) continue;
    const { value, allowEmptyValue } = requestedValue(fieldName, mapping, answers, profile);
    if (value === null || (options.choicesOnly && mapping.type !== "checkbox" && mapping.type !== "radio")) {
      snapshots[fieldName] = makeSkippedSnapshot(fieldName, mapping.type);
      continue;
    }
    fields.push({
      fieldName,
      mapping,
      selectors: splitSelectors(mapping.selector),
      value,
      allowEmptyValue,
    });
  }
  return { fields, snapshots };
}


function observeCandidate(
  candidate: CandidateSnapshot,
  selector: string,
  type: FormFieldMapping["type"],
  expected: string,
): Ds160FieldObservation {
  const normalized = expected.trim().toLowerCase();
  let matches = false;
  let canSkipWrite = false;
  let resolvedSelectValue: string | null = null;
  let ambiguousSelect = false;
  if (type === "select") {
    const exactValues = candidate.selectCandidates.filter(option => !option.disabled && option.value === expected);
    const candidates = exactValues.length ? exactValues : candidate.selectCandidates.filter(option =>
      !option.disabled && (option.value.trim().toLowerCase() === normalized || option.text.trim().toLowerCase() === normalized));
    ambiguousSelect = candidates.length > 1;
    resolvedSelectValue = candidates.length === 1 ? candidates[0].value : null;
    matches = Boolean(candidate.selectedValue) &&
      (candidate.selectedValue.trim().toLowerCase() === normalized || candidate.selectedText.toLowerCase() === normalized);
    canSkipWrite = matches && resolvedSelectValue !== null && candidate.selectedValue === resolvedSelectValue;
  } else if (type === "radio") {
    matches = candidate.checked && candidate.value === expected;
    canSkipWrite = matches;
  } else if (type === "checkbox") {
    const checked = truthyChoice(expected);
    matches = candidate.checked === checked;
    canSkipWrite = matches;
  } else if (type === "text" || type === "date") {
    matches = candidate.value === expected;
    canSkipWrite = matches;
  }
  return {
    matches,
    canSkipWrite,
    maxLength: candidate.maxLength,
    controlId: candidate.id || candidate.name,
    displayValue: type === "checkbox" || type === "radio"
      ? (truthyChoice(expected) ? "Yes" : "No")
      : candidate.displayValue,
    resolvedSelectValue,
    ambiguousSelect,
    visible: true,
    enabled: candidate.enabled,
    editable: candidate.editable,
    selector,
  };
}

function pickFieldSnapshot(
  field: RequestedField,
  candidates: readonly CandidateSnapshot[],
  invalidSelectors: readonly string[],
): Ds160FieldSnapshot {
  const selectorCandidates = field.selectors.map((selector, selectorIndex) => ({
    selector,
    selectorIndex,
    candidates: candidates.filter(candidate => candidate.matchedSelectors.includes(selectorIndex)),
  }));
  const visible = selectorCandidates.flatMap(entry => entry.candidates);
  const firstVisible = visible[0];
  let sawUnsupportedControl = false;
  let sawIneligible = false;
  let sawAmbiguous = false;
  for (const entry of selectorCandidates) {
    // findVisibleRadio appends [value="..."] to each selector branch. Apply
    // the same target-value narrowing before checking uniqueness; otherwise a
    // normal Yes/No radio group would always look ambiguous.
    const branchCandidates = field.mapping.type === "radio"
      ? entry.candidates.filter(candidate => candidate.value === field.value)
      : entry.candidates;
    // A visible candidate of the wrong native type (or with ambiguous ARIA
    // semantics) makes this selector branch unsafe. The sequential locator
    // path would see that candidate too and refuse an ambiguous match; do not
    // silently accept a second candidate from the same branch. Alias branches
    // remain eligible and are evaluated in their declared order.
    if (branchCandidates.some(candidate =>
      !candidate.supportedTypes.includes(field.mapping.type) || candidate.unsupportedSemantics)) {
      sawUnsupportedControl = true;
      continue;
    }
    const typed = branchCandidates.map(candidate => {
      const supported = candidate.supportedTypes.includes(field.mapping.type) && !candidate.unsupportedSemantics;
      const enabled = supported && !candidate.disabled;
      const editable = supported && (field.mapping.type !== "text" && field.mapping.type !== "date"
        ? true
        : enabled && !candidate.readonly);
      return { ...candidate, supported, enabled, editable };
    }).filter(candidate => {
      if (!candidate.supported) {
        sawUnsupportedControl = true;
        return false;
      }
      return true;
    });
    const eligible = typed.filter(candidate => candidate.enabled && candidate.editable);
    if (typed.length > 0 && eligible.length === 0) sawIneligible = true;
    if (eligible.length > 1) {
      sawAmbiguous = true;
      continue;
    }
    const candidate = eligible[0];
    if (!candidate) continue;
    const observation = observeCandidate(candidate, entry.selector, field.mapping.type, field.value);
    if (observation.ambiguousSelect) {
      sawAmbiguous = true;
      continue;
    }
    return {
      fieldName: field.fieldName,
      type: field.mapping.type,
      status: observation.matches ? "verified" : "mismatch",
      sawEligible: true,
      sawVisible: true,
      ambiguous: observation.ambiguousSelect,
      unsupportedSelectors: invalidSelectors,
      observation,
    };
  }
  const firstTypedVisible = visible.find(candidate => candidate.supportedTypes.includes(field.mapping.type));
  const firstObservation = firstTypedVisible
    ? observeCandidate({
      ...firstTypedVisible,
      supported: true,
      disabled: firstTypedVisible.disabled,
      enabled: !firstTypedVisible.disabled,
      editable: field.mapping.type === "text" || field.mapping.type === "date"
        ? !firstTypedVisible.disabled && !firstTypedVisible.readonly
        : !firstTypedVisible.disabled,
    }, field.selectors[0] ?? "", field.mapping.type, field.value)
    : undefined;
  const reason = invalidSelectors.length > 0 && !firstVisible
    ? "unsupported_selector"
    : sawUnsupportedControl
      ? "unsupported_control"
      : sawAmbiguous || firstObservation?.ambiguousSelect
        ? "ambiguous_selector"
        : sawIneligible && firstVisible?.enabled === false
          ? "control_disabled"
          : sawIneligible
            ? "control_readonly"
            : firstVisible
              ? "unsupported_type"
              : "no_visible_control";
  return {
    fieldName: field.fieldName,
    type: field.mapping.type,
    status: invalidSelectors.length > 0 || sawUnsupportedControl || sawAmbiguous || Boolean(firstObservation?.ambiguousSelect)
      ? "unsupported"
      : "missing",
    sawEligible: false,
    sawVisible: Boolean(firstVisible),
    ambiguous: sawAmbiguous || Boolean(firstObservation?.ambiguousSelect),
    unsupportedSelectors: invalidSelectors,
    reason,
    ...(firstObservation ? { observation: firstObservation } : {}),
  };
}

/**
 * Read one fresh page/row snapshot for all requested DS-160 mappings.
 *
 * The returned observation is deliberately ephemeral: callers must invoke
 * this function again after every write, postback, or scope re-resolution.
 * Selector discovery uses one visible union and one evaluateAll where the
 * browser supports the requested CSS/native controls. Invalid selectors or
 * unsupported control types are reported as `unsupported`, never skipped.
 */
export async function snapshotDs160Fields(
  scope: Ds160FieldScope,
  mappings: Readonly<Record<string, FormFieldMapping>>,
  answers: Readonly<Record<string, string>>,
  profile: Readonly<Record<string, unknown>>,
  options: SnapshotDs160FieldsOptions = {},
): Promise<Ds160FieldSnapshotResult> {
  const { fields, snapshots } = buildRequested(mappings, answers, profile, options);
  const requestedFieldNames = fields.map(field => field.fieldName);
  if (fields.length === 0) {
    return { fields: snapshots, requestedFieldNames, complete: true, usedBatchedEvaluation: false };
  }

  const entries = selectorEntries(fields);
  const validEntries: SelectorEntry[] = [];
  const invalidByField = new Map<string, string[]>();
  for (const entry of entries) {
    try {
      // Locator construction validates Playwright's selector grammar without
      // performing a browser round trip. The union operation below is still
      // guarded because engines can reject a selector at evaluation time.
      scope.locator(entry.selector);
      validEntries.push(entry);
    } catch {
      const list = invalidByField.get(entry.fieldName) ?? [];
      list.push(entry.selector);
      invalidByField.set(entry.fieldName, list);
    }
  }

  let candidates: CandidateSnapshot[] = [];
  let usedBatchedEvaluation = false;
  if (validEntries.length > 0) {
    const selectors = validEntries.map(entry => entry.selector);
    try {
      const selectorUnion = selectors.join(", ");
      const visible = scope.locator(selectorUnion).filter({ visible: true });
      candidates = await visible.evaluateAll((elements, payload) => {
        return elements.map((element, elementIndex) => {
          const matchedSelectors: number[] = [];
          for (let index = 0; index < payload.selectors.length; index += 1) {
            try {
              if (element.matches(payload.selectors[index])) matchedSelectors.push(index);
            } catch {
              // Invalid selectors are classified by the host-side fallback.
            }
          }
          // A candidate is considered supported if at least one mapping type
          // which selected it can operate on it. Per-field type checks happen
          // again in pickFieldSnapshot.
          const matchedTypes = new Set(payload.entries
            .filter(entry => matchedSelectors.includes(entry.index))
            .map(entry => entry.type));
          const supportedTypes = [...matchedTypes].filter(type =>
            ((type === "text" || type === "date") &&
              (element instanceof HTMLTextAreaElement ||
                (element instanceof HTMLInputElement &&
                  !["checkbox", "radio", "file", "hidden", "button", "submit", "reset", "image", "color", "range"]
                    .includes(element.type.toLowerCase())))) ||
            (type === "select" && element instanceof HTMLSelectElement) ||
            (type === "radio" && element instanceof HTMLInputElement && element.type === "radio") ||
            (type === "checkbox" && element instanceof HTMLInputElement && element.type === "checkbox"));
          const supported = supportedTypes.length > 0;
          let ariaDisabled = false;
          let unsupportedSemantics = false;
          let sawAriaTrue = false;
          let sawAriaFalse = false;
          for (let current: Element | null = element; current; current = current.parentElement) {
            const aria = current.getAttribute("aria-disabled")?.trim().toLowerCase();
            if (!aria) continue;
            if (aria === "true") {
              ariaDisabled = true;
              sawAriaTrue = true;
            } else if (aria === "false") {
              sawAriaFalse = true;
            } else {
              unsupportedSemantics = true;
            }
          }
          // aria-disabled is inherited. A conflicting true/false chain needs
          // Playwright's native semantics rather than a guessed interpretation.
          if (sawAriaTrue && sawAriaFalse) unsupportedSemantics = true;
          let disabled = ariaDisabled || element.matches(":disabled");
          const fieldset = element.closest("fieldset[disabled]");
          if (fieldset) {
            const legend = fieldset.querySelector(":scope > legend");
            if (!(legend && legend.contains(element))) disabled = true;
          }
          const enabled = supported && !disabled;
          const text = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element : null;
          const select = element instanceof HTMLSelectElement ? element : null;
          const selected = select?.selectedOptions[0];
          return {
            elementIndex,
            matchedSelectors,
            supportedTypes,
            supported,
            unsupportedSemantics,
            disabled,
            readonly: Boolean(text && text.getAttribute("aria-readonly")?.trim().toLowerCase() === "true" ||
              text && "readOnly" in text && text.readOnly),
            enabled,
            editable: Boolean(text && !disabled && !text.readOnly &&
              text.getAttribute("aria-readonly")?.trim().toLowerCase() !== "true"),
            id: element.getAttribute("id") ?? "",
            name: element.getAttribute("name") ?? "",
            value: text?.value ?? select?.value ?? element.getAttribute("value") ?? "",
            displayValue: select ? (selected?.textContent ?? "").trim() : text?.value ?? "",
            maxLength: text?.maxLength ?? -1,
            checked: text instanceof HTMLInputElement ? text.checked : false,
            selectedValue: select?.value ?? "",
            selectedText: (selected?.textContent ?? "").trim(),
            selectCandidates: select
              ? Array.from(select.options).map(option => ({
                value: option.value,
                text: (option.textContent ?? "").trim(),
                disabled: option.disabled || Boolean(option.closest("optgroup[disabled]")),
              }))
              : [],
          } satisfies CandidateSnapshot;
        });
      }, {
        selectors,
        entries: validEntries.map((entry, index) => ({ ...entry, index })),
      });
      // The evaluateAll callback above only knows the type of each selector
      // entry. Recompute per-field support/disabled/read-only semantics in the
      // host below; the browser-side batch remains the sole DOM snapshot.
      usedBatchedEvaluation = true;
    } catch {
      // The caller must use the established per-field path when the browser
      // cannot evaluate this batch. Do not issue a second set of remote calls
      // here: that would erase the performance benefit and could observe a DOM
      // that has changed between the two reads.
      candidates = [];
    }
  }

  for (const field of fields) {
    const invalid = invalidByField.get(field.fieldName) ?? [];
    const fieldCandidates = candidates.map(candidate => {
      // The batched path stores indexes relative to validEntries. Normalize to
      // the requested field's selector indexes before choosing a branch.
      const matchedSelectors = candidate.matchedSelectors.flatMap(globalIndex => {
        const entry = validEntries[globalIndex];
        if (!entry || entry.fieldName !== field.fieldName) return [];
        return [field.selectors.indexOf(entry.selector)];
      }).filter(index => index >= 0);
      return { ...candidate, matchedSelectors };
    }).filter(candidate => candidate.matchedSelectors.length > 0);
    const snapshot = pickFieldSnapshot(field, fieldCandidates, invalid);
    snapshots[field.fieldName] = snapshot;
    if (snapshot.status === "verified" && snapshot.observation && options.observeVerified) {
      options.observeVerified({
        fieldName: field.fieldName,
        controlId: snapshot.observation.controlId,
        value: snapshot.observation.displayValue,
        ...(field.allowEmptyValue ? { allowEmptyValue: true } : {}),
      });
    }
  }
  const complete = requestedFieldNames.every(fieldName => {
    const snapshot = snapshots[fieldName];
    return snapshot?.status === "verified" || snapshot?.status === "mismatch";
  });
  return { fields: snapshots, requestedFieldNames, complete, usedBatchedEvaluation };
}
