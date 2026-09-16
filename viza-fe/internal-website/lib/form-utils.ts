import { type VisaFormFieldRow } from "@/types/visa-form-fields";

type InferredConditionalToggle = {
  fieldName: string;
};

type YesNoToggleMetadata = {
  fieldName: string;
  stems: string[];
};

interface ConditionalInferenceMetadata {
  byField: Map<VisaFormFieldRow, InferredConditionalToggle | null>;
  byFieldName: Map<string, Map<string | null, InferredConditionalToggle | null>>;
  fieldNames: Set<string>;
  yesNoToggles: YesNoToggleMetadata[];
}

// `evaluateShowIf` is used for every field while each dynamic step renders.
// Legacy schemas without an explicit conditionalLogic object used to rebuild
// the complete yes/no toggle list for every field on every render. Keep the
// schema-only inference work with the fields array; the answer lookup remains
// per call so changing a controller value never observes stale visibility.
// A WeakMap bounds the cache to schema arrays that are still in use.
const conditionalInferenceCache = new WeakMap<VisaFormFieldRow[], ConditionalInferenceMetadata>();

function getRepeatGroup(field: VisaFormFieldRow): string | null {
  const rules = field.validationRules as { repeat_group?: unknown } | null;
  const group = rules?.repeat_group;
  return group ? String(group) : null;
}

function isYesNoToggle(field: VisaFormFieldRow): boolean {
  return (
    (field.fieldType === "radio" || field.fieldType === "select") &&
    Array.isArray(field.options) &&
    field.options.some((option) => {
      const value = typeof option === "string" ? option : option.value;
      return value.toLowerCase() === "yes";
    })
  );
}

function conditionalToggleStems(fieldName: string): string[] {
  const stems: string[] = [fieldName];
  const withoutUsed = fieldName.replace(/_used$/, "");
  if (withoutUsed !== fieldName) {
    stems.push(withoutUsed);
    if (withoutUsed.endsWith("s")) stems.push(withoutUsed.slice(0, -1));
  }
  const withoutHas = fieldName.replace(/^has_/, "");
  if (withoutHas !== fieldName) {
    stems.push(withoutHas);
    if (withoutHas.endsWith("s")) stems.push(withoutHas.slice(0, -1));
  }
  return stems;
}

function inferConditionalToggle(
  field: VisaFormFieldRow,
  yesNoToggles: YesNoToggleMetadata[],
  fieldNames: Set<string>,
): InferredConditionalToggle | null {
  // 2a. repeat_group -> look for "<group>_used" or "has_<group>" toggle.
  // Keep the candidate order from the legacy implementation: when both names
  // exist, the *_used field wins.
  const group = getRepeatGroup(field);
  if (group) {
    for (const toggleName of [`${group}_used`, `has_${group}`]) {
      if (fieldNames.has(toggleName)) return { fieldName: toggleName };
    }
  }

  // 2b. Find the first yes/no toggle in schema order whose legacy stem is a
  // prefix of this field. The old implementation re-created this list for
  // every field; the list is schema-only and safe to share across renders.
  for (const toggle of yesNoToggles) {
    for (const stem of toggle.stems) {
      if (field.fieldName.startsWith(stem) && field.fieldName !== toggle.fieldName) {
        return { fieldName: toggle.fieldName };
      }
    }
  }

  return null;
}

function getConditionalInferenceMetadata(allFields: VisaFormFieldRow[]): ConditionalInferenceMetadata {
  const cached = conditionalInferenceCache.get(allFields);
  if (cached) return cached;

  const yesNoToggles = allFields
    .filter(isYesNoToggle)
    .map((field) => ({
      fieldName: field.fieldName,
      stems: conditionalToggleStems(field.fieldName),
    }));
  const fieldNames = new Set(allFields.map((field) => field.fieldName));
  const byField = new Map<VisaFormFieldRow, InferredConditionalToggle | null>();
  const byFieldName = new Map<string, Map<string | null, InferredConditionalToggle | null>>();
  for (const field of allFields) {
    // Explicit logic never reaches the inferred branch. Leaving those fields
    // out also keeps a later in-place logic update from observing stale cache
    // metadata if a caller reuses a schema row object.
    if (!field.conditionalLogic) {
      const inferred = inferConditionalToggle(field, yesNoToggles, fieldNames);
      byField.set(field, inferred);

      // Some callers create a shallow field clone while rendering repeated
      // instances. Cache the same schema-only result by field name and repeat
      // group so those clones avoid rebuilding the toggle list as well.
      const byGroup = byFieldName.get(field.fieldName) ?? new Map();
      const group = getRepeatGroup(field);
      if (!byGroup.has(group)) byGroup.set(group, inferred);
      byFieldName.set(field.fieldName, byGroup);
    }
  }

  const metadata = {
    byField,
    byFieldName,
    fieldNames,
    yesNoToggles,
  } satisfies ConditionalInferenceMetadata;
  conditionalInferenceCache.set(allFields, metadata);
  return metadata;
}

function getCachedConditionalToggle(
  field: VisaFormFieldRow,
  metadata: ConditionalInferenceMetadata,
): InferredConditionalToggle | null | undefined {
  if (metadata.byField.has(field)) return metadata.byField.get(field) ?? null;
  const byGroup = metadata.byFieldName.get(field.fieldName);
  if (!byGroup) return undefined;
  const group = getRepeatGroup(field);
  if (!byGroup.has(group)) return undefined;
  return byGroup.get(group) ?? null;
}

function inferConditionalToggleForUnknownField(
  field: VisaFormFieldRow,
  metadata: ConditionalInferenceMetadata,
): InferredConditionalToggle | null {
  return inferConditionalToggle(field, metadata.yesNoToggles, metadata.fieldNames);
}

/**
 * Evaluate a boolean expression against current form values.
 * Supports:
 *  - Equality / inequality: "field === value" / "field !== value"
 *  - List membership: "field in [val1, val2, val3]" / "field not in [val1, val2]"
 *  - Multi-select intersection: "field contains_any [val1, val2]"
 *  - Empty-string sentinel: "field === _empty"
 *  - Boolean composition: "a === b || c === d" and "a === yes && b === yes"
 *
 * Returns false for unparseable atoms.
 */
export function evaluateExpression(
  expr: string,
  values: Record<string, string>,
): boolean {
  const readValue = (key: string): string => {
    const direct = values[key];
    if (direct !== undefined) return direct;

    // Some older DS-160 seed rows used the shorter alias in showIf clauses
    // while the real form field is has_specific_travel_plans.
    if (key === "has_specific_plans") {
      return values.has_specific_travel_plans ?? "";
    }

    return "";
  };

  const resolveTarget = (raw: string): string =>
    raw.toLowerCase() === "_empty" ? "" : raw.toLowerCase();

  const parseList = (raw: string): string[] =>
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);

  const parseMultiValue = (raw: string): string[] =>
    raw
      .split(/[,;\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);

  // "not in" is checked before "in" so the longer keyword wins.
  const evalAtom = (atom: string): boolean => {
    const containsAnyMatch = atom.match(/^(\S+)\s+contains_any\s+\[([^\]]*)\]$/);
    if (containsAnyMatch) {
      const actual = new Set(parseMultiValue(readValue(containsAnyMatch[1])));
      return parseList(containsAnyMatch[2]).some((candidate) => actual.has(candidate));
    }
    const notInMatch = atom.match(/^(\S+)\s+not\s+in\s+\[([^\]]*)\]$/);
    if (notInMatch) {
      const actual = readValue(notInMatch[1]).toLowerCase();
      return !parseList(notInMatch[2]).includes(actual);
    }
    const inMatch = atom.match(/^(\S+)\s+in\s+\[([^\]]*)\]$/);
    if (inMatch) {
      const actual = readValue(inMatch[1]).toLowerCase();
      return parseList(inMatch[2]).includes(actual);
    }
    const eqMatch = atom.match(/^(\S+)\s*===\s*(\S+)$/);
    if (eqMatch) {
      const target = resolveTarget(eqMatch[2]);
      const actual = readValue(eqMatch[1]).toLowerCase();
      // Checkbox fields write "" (not the literal "false") when unchecked —
      // both at initial render and every time the box is toggled off (see
      // dynamic-form-field.tsx's onCheckedChange). Treat "" as "false" so
      // "checkboxField === false" showIf clauses work for the unchecked
      // state, not just the checked ("=== true") state.
      if (target === "false" && actual === "") return true;
      return actual === target;
    }
    const neqMatch = atom.match(/^(\S+)\s*!==\s*(\S+)$/);
    if (neqMatch) {
      const target = resolveTarget(neqMatch[2]);
      const actual = readValue(neqMatch[1]).toLowerCase();
      if (target === "false" && actual === "") return false;
      return actual !== target;
    }
    return false;
  };

  const orGroups = expr.split("||").map((s) => s.trim());
  return orGroups.some((orGroup) => {
    const andParts = orGroup.split("&&").map((s) => s.trim());
    return andParts.every(evalAtom);
  });
}

/**
 * Evaluate a `validation_rules.required_unless` expression. Returns true when
 * the field should be treated as optional (exemption matched), false otherwise.
 * Used to implement Annex-I-style starred fields where a rule like
 * "required_unless: has_eu_family_member === yes" lets EU Withdrawal
 * Agreement beneficiaries skip the starred fields.
 */
export function isRequiredUnlessSatisfied(
  field: VisaFormFieldRow,
  values: Record<string, string>,
): boolean {
  const rules = field.validationRules as { required_unless?: string } | null;
  const expr = rules?.required_unless;
  if (!expr || typeof expr !== "string") return false;
  return evaluateExpression(expr, values);
}

export function isRequiredWhenSatisfied(
  field: VisaFormFieldRow,
  values: Record<string, string>,
): boolean {
  const rules = field.validationRules as { required_when?: string; requiredWhen?: string } | null;
  const expr = rules?.required_when ?? rules?.requiredWhen;
  if (!expr || typeof expr !== "string") return false;
  return evaluateExpression(expr, values);
}

/**
 * Evaluate a conditionalLogic.showIf expression against current form values.
 * Also infers conditional visibility when explicit conditionalLogic is missing
 * from the DB but the field is clearly subordinate to a yes/no toggle:
 *  - repeat_group "X" → toggle field "X_used"
 *  - field name shares a prefix with a yes/no radio field (e.g.
 *    "other_name_surname" is subordinate to "other_names_used")
 */
export function evaluateShowIf(
  field: VisaFormFieldRow,
  values: Record<string, string>,
  allFields?: VisaFormFieldRow[],
): boolean {
  const logic = field.conditionalLogic;

  // 1. Explicit showIf condition
  if (logic) {
    const showIf = (logic as { showIf?: string }).showIf;
    if (showIf && typeof showIf === "string") {
      return evaluateExpression(showIf, values);
    }
  }

  // 2. Infer conditional visibility when no explicit logic exists
  if (!logic && allFields) {
    const metadata = getConditionalInferenceMetadata(allFields);
    const cachedToggle = getCachedConditionalToggle(field, metadata);
    const inferredToggle = cachedToggle === undefined
      ? inferConditionalToggleForUnknownField(field, metadata)
      : cachedToggle;
    if (inferredToggle) {
      return (values[inferredToggle.fieldName] ?? "").toLowerCase() === "yes";
    }
  }

  return true; // no condition → always visible
}
