import { describe, expect, it } from "vitest";
import {
  findFormerSpouseDuplicateIssues,
  getFormerSpouseCountIssue,
  getFormerSpouseCountValidationMessage,
  getFormerSpouseDuplicateIssue,
  getFormerSpouseDuplicateMessage,
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

  it("rejects only complete duplicate surname, given-name and DOB identities", () => {
    const duplicate = {
      marital_status: "divorced",
      former_spouse_surname: "ZHANG",
      former_spouse_given_names: "SAN",
      former_spouse_date_of_birth: "1980-01-02",
      former_spouse_nationality: "CN",
      former_spouse_city_of_birth: "BEIJING",
      former_spouse_country_of_birth: "CHINA",
      former_spouse_date_of_marriage: "2000-01-01",
      former_spouse_date_marriage_ended: "2010-01-01",
      former_spouse_how_marriage_ended: "DIVORCE",
      former_spouse_country_marriage_terminated: "CN",
      former_spouse_surname__2: "ZHANG",
      former_spouse_given_names__2: "SAN",
      former_spouse_date_of_birth__2: "1980-01-02",
      former_spouse_nationality__2: "US",
      former_spouse_city_of_birth__2: "NEW YORK",
      former_spouse_country_of_birth__2: "USA",
      former_spouse_date_of_marriage__2: "2001-01-01",
      former_spouse_date_marriage_ended__2: "2011-01-01",
      former_spouse_how_marriage_ended__2: "ANNULMENT",
      former_spouse_country_marriage_terminated__2: "US",
    };

    expect(findFormerSpouseDuplicateIssues(duplicate)).toEqual([{
      kind: "duplicate",
      firstRow: 1,
      duplicateRow: 2,
      fieldNames: [
        "former_spouse_surname__2",
        "former_spouse_given_names__2",
        "former_spouse_date_of_birth__2",
      ],
    }]);
    expect(getFormerSpouseDuplicateIssue(duplicate, "former_spouse_given_names__2")).not.toBeNull();
    expect(getFormerSpouseDuplicateIssue(duplicate, "former_spouse_surname")).toBeNull();
    expect(getFormerSpouseDuplicateMessage(
      findFormerSpouseDuplicateIssues(duplicate)[0],
      false,
    )).toBe("You cannot enter a duplicate Former Spouse");

    expect(findFormerSpouseDuplicateIssues({
      ...duplicate,
      former_spouse_date_of_birth__2: "1981-01-02",
    })).toEqual([]);
    expect(findFormerSpouseDuplicateIssues({
      ...duplicate,
      former_spouse_given_names__2: "ER",
    })).toEqual([]);
    expect(findFormerSpouseDuplicateIssues({
      ...duplicate,
      former_spouse_date_of_birth__2: "",
    })).toEqual([]);
    expect(findFormerSpouseDuplicateIssues({
      ...duplicate,
      marital_status: "married",
    })).toEqual([]);
  });

  it("compares bilingual names using the official English values", () => {
    const answers = {
      marital_status: "离婚",
      former_spouse_surname: "张三",
      former_spouse_surname_en: "ZHANG SAN",
      former_spouse_given_names: "小明",
      former_spouse_given_names_en: "XIAO MING",
      former_spouse_date_of_birth: "1980-01-02",
      former_spouse_surname__2: "ZHANG SAN",
      former_spouse_given_names__2: "XIAO MING",
      former_spouse_date_of_birth__2: "1980-01-02",
    };

    expect(findFormerSpouseDuplicateIssues(answers)).toHaveLength(1);
  });
});
