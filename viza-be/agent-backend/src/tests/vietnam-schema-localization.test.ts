import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const seedSource = readFileSync(
  new URL("../../scripts/seed-vn-e-visa-form-fields.ts", import.meta.url),
  "utf8",
);

function extractFieldLabels(): Map<string, string> {
  const labels = new Map<string, string>();
  const pattern = /\{\s*field_name:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g;
  for (const match of seedSource.matchAll(pattern)) {
    labels.set(match[1], match[2]);
  }
  return labels;
}

function extractChineseLabels(): Map<string, string> {
  const block = seedSource.match(/const FIELD_LABEL_ZH: Record<string, string> = \{([\s\S]*?)\n\};/);
  expect(block).not.toBeNull();

  const labels = new Map<string, string>();
  const pattern = /^\s*([a-z0-9_]+):\s*"([^"]+)"/gm;
  for (const match of (block?.[1] ?? "").matchAll(pattern)) {
    labels.set(match[1], match[2]);
  }
  return labels;
}

function hasCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

describe("Vietnam e-Visa schema localization seed", () => {
  test("every Vietnam field has clear Chinese and English labels", () => {
    const fieldLabels = extractFieldLabels();
    const chineseLabels = extractChineseLabels();
    const vagueChineseLabels = new Set(["过往", "补充", "说明", "详情", "类型"]);
    const vagueEnglishLabels = new Set(["To", "Type", "Passport", "Full name", "Relationship"]);

    expect(fieldLabels.size).toBeGreaterThan(50);
    expect(chineseLabels.size).toBe(fieldLabels.size);

    for (const [fieldName, labelEn] of fieldLabels) {
      const labelZh = chineseLabels.get(fieldName);
      expect(labelZh, `${fieldName} is missing label_zh`).toBeTruthy();
      expect(hasCjk(labelZh ?? ""), `${fieldName} label_zh must be Chinese`).toBe(true);
      expect(vagueChineseLabels.has(labelZh ?? ""), `${fieldName} label_zh is too vague`).toBe(false);
      expect(labelEn.trim(), `${fieldName} is missing label_en`).toBeTruthy();
      expect(vagueEnglishLabels.has(labelEn), `${fieldName} label_en is too vague`).toBe(false);
    }
  });

  test("Vietnam option seeding writes bilingual display labels without changing values", () => {
    expect(seedSource).toContain("label_zh: OPTION_LABEL_ZH[option.value]");
    expect(seedSource).toContain("label_en: option.text");
    expect(seedSource).toContain("official_label: option.official_label ?? option.text");
    expect(seedSource).toContain('single: "单次入境"');
    expect(seedSource).toContain('ordinary_passport: "普通护照"');
    expect(seedSource).toContain('tourist: "旅游"');
  });
});
