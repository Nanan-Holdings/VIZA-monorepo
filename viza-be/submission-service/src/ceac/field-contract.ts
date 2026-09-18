import { __DERIVATION_TARGETS } from "../ds160-derive-answers";
import { DS160_EXTENDED_METADATA } from "../ds160-extended-mappings";
import { DS160_FIELD_CONTRACTS } from "../ds160-field-contract";
import { ds160ConditionMatches } from "../ds160-conditions";
import {
  DS160_REPEAT_GROUP_CONTRACTS,
  DS160_REPEAT_GROUP_NAMES,
  type Ds160RepeatGroupName,
} from "../ds160-repeat-contract";

const sourceEdges = [
  ...__DERIVATION_TARGETS.keyAliases.map(rule => ({ inputs: [rule.from], outputs: [rule.to] })),
  ...__DERIVATION_TARGETS.dateSplits.map(rule => ({ inputs: [rule.source], outputs: ["day", "month", "year"].map(part => `${rule.targetPrefix}_${part}`) })),
  ...__DERIVATION_TARGETS.naPairs.map(rule => ({ inputs: [rule.source], outputs: [rule.naKey] })),
  ...__DERIVATION_TARGETS.customDerivations.map(rule => ({ inputs: rule.requires, outputs: rule.produces })),
];

export type Ds160SavedAnswer = string | null | undefined;
export type Ds160SavedAnswers = Readonly<Record<string, Ds160SavedAnswer>>;

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function suffixForKey(key: string, base: string): string | null {
  if (key === base) return "";
  if (!key.startsWith(base)) return null;
  const suffix = key.slice(base.length);
  return /^__\d+$/.test(suffix) ? suffix : null;
}

/**
 * Normalize legacy CEAC-side aliases back to the seed's canonical keys for
 * branch evaluation.  The canonical key always wins, including when it is
 * explicitly empty; a stale alias must never replace an intentional clear.
 */
function canonicalizeSavedAnswers(saved: Ds160SavedAnswers): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(saved)) {
    if (typeof value === "string") values[key] = value;
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const alias of __DERIVATION_TARGETS.keyAliases) {
      for (const targetKey of Object.keys(values)) {
        const suffix = suffixForKey(targetKey, alias.to);
        if (suffix === null) continue;
        if (suffix && !DS160_FIELD_CONTRACTS[alias.from]?.repeatGroup) continue;

        const sourceKey = `${alias.from}${suffix}`;
        if (hasOwn(values, sourceKey)) continue;
        values[sourceKey] = values[targetKey];
        changed = true;
      }
    }
  }
  return values;
}

function deleteAnswerFamily(values: Record<string, string>, base: string): void {
  const bases = new Set<string>([base]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const alias of __DERIVATION_TARGETS.keyAliases) {
      if (!bases.has(alias.from) || bases.has(alias.to)) continue;
      bases.add(alias.to);
      changed = true;
    }
  }

  for (const key of Object.keys(values)) {
    for (const candidate of bases) {
      if (key === candidate || suffixForKey(key, candidate) !== null) {
        delete values[key];
        break;
      }
    }
  }
}

/** Trace only mechanical aliases; a source field takes precedence over aliases. */
export function ds160MappingSources(fieldName: string): string[] {
  const base = fieldName.replace(/__\d+$/, "");
  // A direct saved-field alias owns its branch, even if a custom derivation
  // can also produce it. Otherwise intended stay is incorrectly assigned to
  // the repeated arrival/departure group and skipped for "no specific plans".
  const savedFieldAlias = __DERIVATION_TARGETS.keyAliases.find(rule =>
    rule.to === base && DS160_FIELD_CONTRACTS[rule.from]);
  if (savedFieldAlias) return [savedFieldAlias.from];
  if (DS160_FIELD_CONTRACTS[base]) return [base];
  if (DS160_EXTENDED_METADATA[base]) return [DS160_EXTENDED_METADATA[base].seedFieldName];
  const pending = [base];
  const seen = new Set<string>();
  const sources = new Set<string>();
  while (pending.length) {
    const key = pending.pop()!;
    if (seen.has(key)) continue;
    seen.add(key);
    if (DS160_FIELD_CONTRACTS[key]) { sources.add(key); continue; }
    for (const edge of sourceEdges) if (edge.outputs.includes(key)) pending.push(...edge.inputs);
  }
  return [...sources];
}

export function ds160MappingRepeatGroup(fieldName: string): Ds160RepeatGroupName | undefined {
  return ds160MappingSources(fieldName)
    .map(source => DS160_FIELD_CONTRACTS[source]?.repeatGroup as Ds160RepeatGroupName | undefined)
    .find(Boolean);
}

/** Eliminate persisted answers from inactive parent branches before child gates. */
export function createDs160BranchPolicy(saved: Ds160SavedAnswers) {
  const values = canonicalizeSavedAnswers(saved);
  const active = new Set(Object.keys(DS160_FIELD_CONTRACTS));
  let changed: boolean;
  do {
    changed = false;
    for (const name of active) {
      const field = DS160_FIELD_CONTRACTS[name];
      const group = field.repeatGroup
        ? DS160_REPEAT_GROUP_CONTRACTS[field.repeatGroup as Ds160RepeatGroupName]
        : undefined;
      // Repeat-row conditions are evaluated against each decoded row by the
      // repeat adapter.  Evaluating them against the base row here would make
      // row 1's NONE choice deactivate row 2's real social-media handle.
      const globalShowIf = field.repeatGroup ? undefined : field.showIf;
      if ((globalShowIf && !ds160ConditionMatches(globalShowIf, values)) ||
          (group?.activation && !ds160ConditionMatches(group.activation, values))) {
        active.delete(name);
        deleteAnswerFamily(values, name);
        changed = true;
      }
    }
  } while (changed);
  return {
    values,
    isSeedActive: (name: string) => active.has(name),
    isMappingActive: (name: string) => {
      const sources = ds160MappingSources(name);
      return sources.length === 0 || sources.some(source => active.has(source));
    },
  };
}

export class Ds160RequiredAnswersError extends Error {
  readonly missingFields: readonly string[];

  constructor(missingFields: readonly string[]) {
    super(`Missing required DS-160 answer fields: ${missingFields.join(", ")}`);
    this.name = "Ds160RequiredAnswersError";
    this.missingFields = [...missingFields];
  }
}

export class Ds160PlaceholderAnswersError extends Error {
  readonly placeholderFields: readonly string[];

  constructor(placeholderFields: readonly string[]) {
    super(`Replace placeholder DS-160 answers in fields: ${placeholderFields.join(", ")}`);
    this.name = "Ds160PlaceholderAnswersError";
    this.placeholderFields = [...placeholderFields];
  }
}

function isPlaceholderPrompt(value: string | undefined): boolean {
  if (!value) return false;
  const text = value.normalize("NFKC").trim();
  // Recognize input instructions, not arbitrary prose containing "please" or
  // generic test-looking names. This check cannot establish factual accuracy.
  return /^(?:请(?:填写|输入|选择|提供|填入)|(?:例如|示例|如)\s*[:：]|please\s+(?:enter|provide|fill(?:\s+in)?|select)\b|enter\s+your\b|for\s+example\s*[,，:]|e\.g\.\s*[,，:]?)/i.test(text)
    || /^[^.!?\n]{0,160}\(\s*leave\s+blank\s+if\s+(?:none|not\s+applicable)\s*\)\s*,?\s*for\s+example\s*[:：]/i.test(text)
    || /^(?:placeholder|<placeholder>|\[placeholder\]|待填写|待补充)$/i.test(text);
}

/** Inspect the values actually selected for filling, including English aliases. */
export function findDs160PlaceholderFields(saved: Ds160SavedAnswers): string[] {
  const effective: Record<string, string> = {};
  for (const [key, value] of Object.entries(saved)) {
    if (typeof value === "string") effective[key] = value;
  }
  for (const [key, value] of Object.entries(effective)) {
    if (!key.endsWith("_en") || !value.trim()) continue;
    const base = key.slice(0, -3);
    if (base === "full_name_native_alphabet") continue;
    // Match applyEnglishAliases: an existing Latin-script canonical answer
    // takes precedence. A clean alias must not hide the prompt actually used.
    if (!effective[base] || /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(effective[base])) {
      effective[base] = value;
    }
  }
  const policy = createDs160BranchPolicy(effective);
  const fields = new Set<string>();
  for (const [name, field] of Object.entries(DS160_FIELD_CONTRACTS)) {
    if (!field.repeatGroup && policy.isSeedActive(name) && isPlaceholderPrompt(policy.values[name])) {
      fields.add(name);
    }
  }
  for (const group of DS160_REPEAT_GROUP_NAMES) {
    const contract = DS160_REPEAT_GROUP_CONTRACTS[group];
    const groupFields = Object.entries(DS160_FIELD_CONTRACTS)
      .filter(([, field]) => field.repeatGroup === group);
    for (const index of repeatRowIndexes(effective, policy.values, group)) {
      const suffix = index === 0 ? "" : `__${index + 1}`;
      const values = rowValues(policy.values, suffix);
      if (contract.activation && !ds160ConditionMatches(contract.activation, values)) continue;
      for (const [name, field] of groupFields) {
        if (!policy.isSeedActive(name)) continue;
        if (field.showIf && !ds160ConditionMatches(field.showIf, values)) continue;
        const rowCondition = contract.fieldShowIf[name];
        if (rowCondition && !ds160ConditionMatches(rowCondition, values)) continue;
        const key = `${name}${suffix}`;
        if (isPlaceholderPrompt(policy.values[key])) fields.add(key);
      }
    }
  }
  return [...fields];
}

function hasStoredAnswer(values: Readonly<Record<string, string>>, key: string): boolean {
  // Explicit NA tokens count as supplied answers. The assertion only
  // checks presence; field-specific option/date validation remains owned by
  // the form contract and CEAC read-back.
  return typeof values[key] === "string" && values[key].trim().length > 0;
}

function rowValues(
  values: Readonly<Record<string, string>>,
  suffix: string,
): Record<string, string> {
  if (!suffix) return { ...values };
  const scoped = { ...values };
  for (const [key, value] of Object.entries(values)) {
    if (!key.endsWith(suffix)) continue;
    const base = key.slice(0, -suffix.length);
    if (base) scoped[base] = value;
  }
  return scoped;
}

function repeatFieldNames(group: Ds160RepeatGroupName): Set<string> {
  const names = new Set<string>(
    Object.entries(DS160_FIELD_CONTRACTS)
      .filter(([, field]) => field.repeatGroup === group)
      .map(([name]) => name),
  );
  // Include legacy alias keys when discovering persisted row indexes.  The
  // canonical source is added by canonicalizeSavedAnswers when it has a
  // scalar value, while this set also preserves a row represented by null.
  for (const alias of __DERIVATION_TARGETS.keyAliases) {
    if (DS160_FIELD_CONTRACTS[alias.from]?.repeatGroup === group) {
      names.add(alias.from);
      names.add(alias.to);
    }
  }
  return names;
}

function repeatRowIndexes(
  saved: Ds160SavedAnswers,
  values: Readonly<Record<string, string>>,
  group: Ds160RepeatGroupName,
): number[] {
  const fieldNames = repeatFieldNames(group);
  const indexes = new Set<number>([0]);
  const keys = new Set([...Object.keys(saved), ...Object.keys(values)]);

  for (const key of keys) {
    for (const fieldName of fieldNames) {
      const suffix = suffixForKey(key, fieldName);
      if (suffix === null) continue;
      if (!suffix) {
        indexes.add(0);
        break;
      }
      const number = Number(suffix.slice(2));
      if (Number.isSafeInteger(number) && number >= 2) indexes.add(number - 1);
      break;
    }
  }

  return [...indexes].sort((left, right) => left - right);
}

/**
 * Assert that every active required DS-160 source field has a supplied saved
 * answer before CEAC derivation/filling.  Repeated fields are checked for
 * every persisted row index, including partially populated later rows.
 * Missing field names are safe to log; answer values are intentionally never
 * included in the error.
 */
export function assertDs160RequiredAnswers(saved: Ds160SavedAnswers): void {
  const placeholders = findDs160PlaceholderFields(saved);
  if (placeholders.length) throw new Ds160PlaceholderAnswersError(placeholders);
  const policy = createDs160BranchPolicy(saved);
  const missing: string[] = [];

  for (const [fieldName, field] of Object.entries(DS160_FIELD_CONTRACTS)) {
    if (!field.required || field.repeatGroup) continue;
    if (!policy.isSeedActive(fieldName)) continue;
    if (!hasStoredAnswer(policy.values, fieldName)) missing.push(fieldName);
  }

  const requiredGroups = new Set<Ds160RepeatGroupName>();
  for (const field of Object.values(DS160_FIELD_CONTRACTS)) {
    if (field.required && field.repeatGroup) {
      requiredGroups.add(field.repeatGroup as Ds160RepeatGroupName);
    }
  }

  for (const group of DS160_REPEAT_GROUP_NAMES) {
    if (!requiredGroups.has(group)) continue;
    const contract = DS160_REPEAT_GROUP_CONTRACTS[group];
    const requiredFields = Object.entries(DS160_FIELD_CONTRACTS)
      .filter(([, field]) => field.required && field.repeatGroup === group);

    for (const index of repeatRowIndexes(saved, policy.values, group)) {
      const suffix = index === 0 ? "" : `__${index + 1}`;
      const values = rowValues(policy.values, suffix);
      if (contract.activation && !ds160ConditionMatches(contract.activation, values)) continue;

      for (const [fieldName, field] of requiredFields) {
        if (!policy.isSeedActive(fieldName)) continue;
        if (field.showIf && !ds160ConditionMatches(field.showIf, values)) continue;
        const groupShowIf = contract.fieldShowIf[fieldName];
        if (groupShowIf && !ds160ConditionMatches(groupShowIf, values)) continue;
        const storageKey = `${fieldName}${suffix}`;
        if (!hasStoredAnswer(policy.values, storageKey)) missing.push(storageKey);
      }
    }
  }

  if (missing.length > 0) {
    throw new Ds160RequiredAnswersError([...new Set(missing)]);
  }
}

/** Preserve legacy row aliases, including an explicitly derived NONE choice. */
export function ds160RepeatAnswers(
  saved: Record<string, string>,
  derived: Record<string, string>,
): Record<string, string> {
  const rows = { ...saved };
  for (const alias of __DERIVATION_TARGETS.keyAliases) {
    if (!DS160_FIELD_CONTRACTS[alias.from]?.repeatGroup) continue;
    for (const [key, value] of Object.entries(derived)) {
      if (key !== alias.to && !key.startsWith(`${alias.to}__`)) continue;
      const suffix = key.slice(alias.to.length);
      if (suffix && !/^__\d+$/.test(suffix)) continue;
      const source = `${alias.from}${suffix}`;
      if (rows[source] === undefined && value.trim()) rows[source] = value;
    }
  }
  return rows;
}
