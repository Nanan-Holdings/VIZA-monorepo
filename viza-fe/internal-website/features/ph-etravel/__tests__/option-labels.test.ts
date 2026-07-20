import { describe, expect, test } from "vitest";

import {
  PH_ETRAVEL_AIRLINE_LABELS_ZH,
  PH_ETRAVEL_AIRPORT_LABELS_ZH,
  localizePhEtravelOptions,
} from "../option-labels";

describe("Philippines eTravel Chinese option labels", () => {
  test("keeps all 20 official Philippine arrival airports one-to-one and unique", () => {
    const entries = Object.entries(PH_ETRAVEL_AIRPORT_LABELS_ZH);
    expect(entries).toHaveLength(20);
    expect(new Set(entries.map(([code]) => code)).size).toBe(20);
    expect(new Set(entries.map(([, label]) => label)).size).toBe(20);
  });

  test("covers every official airline snapshot code with a Chinese label", async () => {
    const snapshot = await import(
      "../../../../../viza-be/agent-backend/scripts/ph-etravel/official-options.snapshot.json"
    );
    const officialCodes = snapshot.default.airlines.map((airline: { code: string }) => airline.code);
    expect(Object.keys(PH_ETRAVEL_AIRLINE_LABELS_ZH).sort()).toEqual([...officialCodes].sort());
    expect(Object.values(PH_ETRAVEL_AIRLINE_LABELS_ZH).every((label) => /[\u3400-\u9fff]/.test(label))).toBe(true);
  });

  test("localizes country fields while preserving official values", () => {
    const localized = localizePhEtravelOptions("passport_issuing_authority", [
      { value: "CN", text: "China", label_en: "China" },
      { value: "SG", text: "Singapore", label_en: "Singapore" },
    ]);
    expect(localized).toEqual([
      expect.objectContaining({ value: "CN", label_zh: "中国" }),
      expect.objectContaining({ value: "SG", label_zh: "新加坡" }),
    ]);
  });
});
