import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import vi from "@/messages/vi.json";
import zh from "@/messages/zh.json";

function flatten(value: unknown, prefix = ""): Map<string, string> {
  const result = new Map<string, string>();
  if (typeof value === "string") {
    result.set(prefix, value);
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      for (const [key, text] of flatten(item, `${prefix}.${index}`)) result.set(key, text);
    });
    return result;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      for (const [path, text] of flatten(item, prefix ? `${prefix}.${key}` : key)) {
        result.set(path, text);
      }
    }
  }
  return result;
}

function variables(value: string): string[] {
  return [...value.matchAll(/\{([a-zA-Z0-9_]+)(?:,[^}]*)?\}/g)]
    .map((match) => match[1])
    .sort();
}

describe("Settings message catalogs", () => {
  const english = flatten(en.settings);
  const catalogs = { zh: flatten(zh.settings), es: flatten(es.settings), vi: flatten(vi.settings) };

  it.each(Object.entries(catalogs))("keeps exact key and ICU parity for %s", (_locale, catalog) => {
    expect([...catalog.keys()].sort()).toEqual([...english.keys()].sort());
    for (const [key, englishValue] of english) {
      expect(variables(catalog.get(key) ?? "")).toEqual(variables(englishValue));
    }
  });

  it("contains no locale placeholder markers", () => {
    for (const catalog of Object.values(catalogs)) {
      expect([...catalog.values()].join("\n")).not.toMatch(/\[(?:ES|VI)\]/);
    }
  });
});
