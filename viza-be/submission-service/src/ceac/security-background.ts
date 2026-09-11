import type { Page } from "@playwright/test";
import type { FormFieldMapping } from "../form-mappings";
import {
  clickVerifiedBooleanRadio,
  fillVerifiedText,
} from "./verified-controls";

export const DS160_SECURITY_BACKGROUND_KEYS = [
  "has_communicable_disease",
  "has_physical_mental_disorder",
  "is_drug_abuser",
  "has_arrest_conviction",
  "has_violated_controlled_substance",
  "has_prostitution",
  "has_money_laundering",
  "has_human_trafficking",
  "has_aided_human_trafficking",
  "has_trafficking_beneficiary",
  "intend_illegal_activity",
  "intend_terrorist_activity",
  "has_provided_terrorist_support",
  "is_terrorist_member",
  "is_terrorist_family",
  "has_genocide",
  "has_torture",
  "has_extrajudicial_killings",
  "has_child_soldier",
  "has_religious_freedom_violation",
  "has_population_control",
  "has_coercive_transplant",
  "has_immigration_fraud",
  "has_removal_deportation_hearing",
  "has_failed_removal_hearing",
  "has_overstayed",
  "has_removal_order",
  "has_withheld_child_custody",
  "has_voted_illegally",
  "has_renounced_citizenship",
] as const;

export type Ds160SecurityBackgroundKey = typeof DS160_SECURITY_BACKGROUND_KEYS[number];

const SECURITY_BACKGROUND_INPUT_ALIASES: Partial<
  Record<Ds160SecurityBackgroundKey, readonly string[]>
> = {
  has_removal_deportation_hearing: ["subject_to_removal_order"],
  has_failed_removal_hearing: ["failed_removal_hearing", "has_failed_to_attend_removal"],
  has_overstayed: ["has_unlawful_presence"],
};

export interface Ds160SecurityBackgroundAnswer {
  key: Ds160SecurityBackgroundKey;
  answer: boolean;
  explanation: string | null;
}

function normalizedBoolean(value: unknown): boolean | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["y", "yes", "true", "1"].includes(normalized)) return true;
  if (["n", "no", "false", "0"].includes(normalized)) return false;
  return null;
}

function mergedAnswers(
  answers: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...profile, ...answers };
}

function resolveSecurityAnswer(
  record: Record<string, unknown>,
  key: Ds160SecurityBackgroundKey,
): { answer: boolean | null; sourceKey: string } {
  for (const candidate of [key, ...(SECURITY_BACKGROUND_INPUT_ALIASES[key] ?? [])]) {
    if (!Object.prototype.hasOwnProperty.call(record, candidate)) continue;
    return { answer: normalizedBoolean(record[candidate]), sourceKey: candidate };
  }
  return { answer: null, sourceKey: key };
}

function resolveSecurityExplanation(
  record: Record<string, unknown>,
  key: Ds160SecurityBackgroundKey,
  sourceKey: string,
): string | null {
  const candidates = sourceKey === key
    ? [`${key}_explain`]
    : [`${sourceKey}_explain`, `${key}_explain`];
  for (const candidate of candidates) {
    const explanation = String(record[candidate] ?? "").trim();
    if (explanation) return explanation;
  }
  return null;
}

export function findMissingDs160SecurityBackgroundAnswers(
  answers: Record<string, unknown>,
  keys: readonly Ds160SecurityBackgroundKey[] = DS160_SECURITY_BACKGROUND_KEYS,
  profile: Record<string, unknown> = {},
): string[] {
  const record = mergedAnswers(answers, profile);
  const missing: string[] = [];
  for (const key of keys) {
    const resolved = resolveSecurityAnswer(record, key);
    const answer = resolved.answer;
    if (answer === null) {
      missing.push(key);
      continue;
    }
    if (answer && !resolveSecurityExplanation(record, key, resolved.sourceKey)) {
      missing.push(`${key}_explain`);
    }
  }
  return missing;
}

export function buildDs160SecurityBackgroundPlan(
  mappings: Record<string, FormFieldMapping>,
  answers: Record<string, unknown>,
  profile: Record<string, unknown> = {},
): Ds160SecurityBackgroundAnswer[] {
  const keys = Object.entries(mappings)
    .filter(([key, mapping]) => mapping.type === "radio" && !key.endsWith("_explain"))
    .map(([key]) => key as Ds160SecurityBackgroundKey);
  const unsupported = keys.filter((key) => !DS160_SECURITY_BACKGROUND_KEYS.includes(key));
  if (unsupported.length > 0) {
    throw new Error(`DS-160 Security mapping contains unsupported keys: ${unsupported.join(", ")}`);
  }
  for (const key of keys) {
    if (!mappings[`${key}_explain`]) {
      throw new Error(`DS-160 Security mapping is missing ${key}_explain`);
    }
  }

  const record = mergedAnswers(answers, profile);
  const missing = findMissingDs160SecurityBackgroundAnswers(record, keys);
  if (missing.length > 0) {
    throw new Error(`DS-160 Security and Background is incomplete: ${missing.join(", ")}`);
  }
  return keys.map((key) => {
    const resolved = resolveSecurityAnswer(record, key);
    const answer = resolved.answer!;
    return {
      key,
      answer,
      explanation: answer
        ? resolveSecurityExplanation(record, key, resolved.sourceKey)!
        : null,
    };
  });
}

/** Fill and read back one Security and Background page without advancing. */
export async function fillSecurityBackgroundPage(
  page: Page,
  mappings: Record<string, FormFieldMapping>,
  answers: Record<string, string>,
  profile: Record<string, unknown> = {},
): Promise<void> {
  const plan = buildDs160SecurityBackgroundPlan(mappings, answers, profile);
  for (const item of plan) {
    const gate = mappings[item.key];
    const explanation = mappings[`${item.key}_explain`];
    await clickVerifiedBooleanRadio(page, gate.selector, item.answer, item.key);
    if (item.answer) {
      await fillVerifiedText(page, explanation.selector, item.explanation!, `${item.key}_explain`);
    }
  }
}
