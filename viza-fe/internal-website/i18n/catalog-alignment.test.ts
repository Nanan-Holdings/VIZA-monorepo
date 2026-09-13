import { describe, expect, it } from "vitest";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

function flatten(value: unknown, prefix = "", result: Record<string, string> = {}) {
  if (typeof value === "string") result[prefix] = value;
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, result);
    }
  }
  return result;
}

function argumentsIn(elements: MessageFormatElement[], result = new Set<string>()): string[] {
  for (const element of elements) {
    if (element.type === TYPE.literal || element.type === TYPE.pound) continue;
    result.add(element.value);
    if (element.type === TYPE.select || element.type === TYPE.plural) {
      for (const option of Object.values(element.options)) argumentsIn(option.value, result);
    } else if (element.type === TYPE.tag) argumentsIn(element.children, result);
  }
  return [...result].sort();
}

const english = flatten(en);
const chinese = flatten(zh);

describe("selectable language catalog alignment", () => {
  it("provides the same keys in English and Chinese", () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(chinese).sort());
  });

  it("preserves interpolation variables and rich text tags in both languages", () => {
    const mismatches: string[] = [];
    for (const key of Object.keys(english)) {
      try {
        const enArgs = argumentsIn(parse(english[key]));
        const zhArgs = argumentsIn(parse(chinese[key]));
        if (JSON.stringify(enArgs) !== JSON.stringify(zhArgs)) mismatches.push(key);
      } catch {
        mismatches.push(`${key}: invalid ICU message`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("limits Chinese in English copy to deliberate native-name/telecode examples", () => {
    const nativeExamples = new Set([
      "applicationSteps.personalInfo.fullNameNativePlaceholder",
      "simplifiedForm.identity.hasNativeAlphabetTooltip",
      "simplifiedForm.identity.nativeAlphabetNamePlaceholder",
      "simplifiedForm.identity.hasTelecodeTooltip",
    ]);
    expect(Object.entries(english).filter(([key, value]) => /\p{Script=Han}/u.test(value) && !nativeExamples.has(key))).toEqual([]);
  });
});
