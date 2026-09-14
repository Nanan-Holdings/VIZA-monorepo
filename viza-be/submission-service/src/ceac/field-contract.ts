import { __DERIVATION_TARGETS } from "../ds160-derive-answers";
import { DS160_EXTENDED_METADATA } from "../ds160-extended-mappings";
import { DS160_FIELD_CONTRACTS } from "../ds160-field-contract";
import { ds160ConditionMatches } from "../ds160-conditions";
import { DS160_REPEAT_GROUP_CONTRACTS, type Ds160RepeatGroupName } from "../ds160-repeat-contract";

const sourceEdges = [
  ...__DERIVATION_TARGETS.keyAliases.map(rule => ({ inputs: [rule.from], outputs: [rule.to] })),
  ...__DERIVATION_TARGETS.dateSplits.map(rule => ({ inputs: [rule.source], outputs: ["day", "month", "year"].map(part => `${rule.targetPrefix}_${part}`) })),
  ...__DERIVATION_TARGETS.naPairs.map(rule => ({ inputs: [rule.source], outputs: [rule.naKey] })),
  ...__DERIVATION_TARGETS.customDerivations.map(rule => ({ inputs: rule.requires, outputs: rule.produces })),
];

/** Trace only mechanical aliases; a source field takes precedence over aliases. */
export function ds160MappingSources(fieldName: string): string[] {
  const base = fieldName.replace(/__\d+$/, "");
  const repeatedAlias = __DERIVATION_TARGETS.keyAliases.find(rule =>
    rule.to === base && DS160_FIELD_CONTRACTS[rule.from]?.repeatGroup);
  if (repeatedAlias) return [repeatedAlias.from];
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
export function createDs160BranchPolicy(saved: Record<string, string>) {
  const values = { ...saved };
  const active = new Set(Object.keys(DS160_FIELD_CONTRACTS));
  let changed: boolean;
  do {
    changed = false;
    for (const name of active) {
      const field = DS160_FIELD_CONTRACTS[name];
      const group = field.repeatGroup
        ? DS160_REPEAT_GROUP_CONTRACTS[field.repeatGroup as Ds160RepeatGroupName]
        : undefined;
      if ((field.showIf && !ds160ConditionMatches(field.showIf, values)) ||
          (group?.activation && !ds160ConditionMatches(group.activation, values))) {
        active.delete(name);
        delete values[name];
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
