import { describe, expect, it } from "vitest";
import {
  getFormerSpouseCountIssue,
  getFormerSpouseCountValidationMessage,
  getFormerSpousePopulatedRowCount,
  getFormerSpouseRepeatLimit,
  parseFormerSpouseDeclaredCount,
} from "@/lib/former-spouse-count";

describe("former-spouse count contract", () => {
  it("accepts only positive integer declarations", () => {
    expect(parseFormerSpouseDeclaredCount("1")).toBe(1);
    expect(parseFormerSpouseDeclaredCount("02")).toBe(2);
    expect(parseFormerSpouseDeclaredCount("99")).toBe(99);
    expect(parseFormerSpouseDeclaredCount(0)).toBeNull();
    expect(parseFormerSpouseDeclaredCount("1.5")).toBeNull();
    expect(parseFormerSpouseDeclaredCount("100")).toBeNull();
  });

  it("counts populated canonical rows and ignores bilingual mirrors", () => {
    expect(getFormerSpousePopulatedRowCount({
      former_spouse_surname: "ZHANG",
      former_spouse_surname_zh: "张",
      former_spouse_surname_en: "ZHANG",
      former_spouse_given_names__2: "LI",
      former_spouse_given_names__2_zh: "李",
    })).toBe(2);
    expect(getFormerSpousePopulatedRowCount({})).toBe(0);
  });

  it("reports missing and mismatched declarations", () => {
    expect(getFormerSpouseCountIssue({})).toEqual({
      kind: "required",
      declaredCount: null,
      populatedRowCount: 0,
    });
    expect(getFormerSpouseCountIssue({
      number_of_former_spouses: "2",
      former_spouse_surname: "ZHANG",
    })).toEqual({
      kind: "mismatch",
      declaredCount: 2,
      populatedRowCount: 1,
    });
    expect(getFormerSpouseCountIssue({
      number_of_former_spouses: "2",
      former_spouse_surname: "ZHANG",
      former_spouse_surname__2: "LI",
    })).toBeNull();
  });

  it("limits the add control to the declaration while preserving the schema ceiling", () => {
    expect(getFormerSpouseRepeatLimit({}, 5)).toBe(1);
    expect(getFormerSpouseRepeatLimit({ number_of_former_spouses: "2" }, 5)).toBe(2);
    expect(getFormerSpouseRepeatLimit({ number_of_former_spouses: "99" }, 5)).toBe(5);
  });

  it("localizes required and mismatch messages", () => {
    const issue = getFormerSpouseCountIssue({
      number_of_former_spouses: "2",
      former_spouse_surname: "ZHANG",
    });
    expect(issue).not.toBeNull();
    expect(getFormerSpouseCountValidationMessage(issue!, true)).toContain("声明的前任配偶人数为 2");
    expect(getFormerSpouseCountValidationMessage(issue!, false)).toContain("declared number of former spouses is 2");
  });
});

