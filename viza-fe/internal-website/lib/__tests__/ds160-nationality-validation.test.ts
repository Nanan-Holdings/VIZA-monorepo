import { describe, expect, it } from "vitest";
import {
  findDs160DuplicateNationalityFields,
  getDs160NationalityDuplicateIssue,
  getDs160NationalityDuplicateMessage,
} from "../ds160-nationality-validation";

describe("DS-160 nationality duplicate validation", () => {
  it("covers primary/other, repeated-other, primary/PR, repeated-PR and cross-group duplicates", () => {
    expect(findDs160DuplicateNationalityFields({
      nationality_country: "中国",
      other_nationality: "yes",
      other_nationality_country: "CHN",
    })).toEqual(["nationality_country", "other_nationality_country"]);

    expect(findDs160DuplicateNationalityFields({
      nationality_country: "CAN",
      other_nationality: "yes",
      other_nationality_country: "Canada",
      other_nationality_country__2: "日本",
      other_nationality_country__3: "JP",
    })).toEqual([
      "nationality_country",
      "other_nationality_country",
      "other_nationality_country__2",
      "other_nationality_country__3",
    ]);

    expect(findDs160DuplicateNationalityFields({
      nationality_country: "CHIN",
      other_nationality: "no",
      permanent_resident_other_country: "yes",
      other_permanent_resident_country: "China",
    })).toEqual(["nationality_country", "other_permanent_resident_country"]);

    expect(findDs160DuplicateNationalityFields({
      nationality_country: "CHIN",
      other_nationality: "no",
      permanent_resident_other_country: "yes",
      other_permanent_resident_country: "FRANCE",
      other_permanent_resident_country__2: "FRAN",
    })).toEqual(["other_permanent_resident_country", "other_permanent_resident_country__2"]);

    const crossGroup = {
      nationality_country: "CHIN",
      other_nationality: "yes",
      other_nationality_country: "JPN",
      permanent_resident_other_country: "yes",
      other_permanent_resident_country: "Japan",
    };
    expect(findDs160DuplicateNationalityFields(crossGroup)).toEqual([
      "other_nationality_country",
      "other_permanent_resident_country",
    ]);

    expect(getDs160NationalityDuplicateIssue(crossGroup, "other_nationality_country")?.kind)
      .toBe("nationality_duplicate");
    expect(getDs160NationalityDuplicateIssue(crossGroup, "other_permanent_resident_country")?.kind)
      .toBe("permanent_resident_duplicate");
  });

  it("ignores rows hidden by No answers and keeps the live CEAC error wording", () => {
    const answers = {
      nationality_country: "CHIN",
      other_nationality: "no",
      other_nationality_country: "China",
      permanent_resident_other_country: "no",
      other_permanent_resident_country: "CHIN",
    };
    expect(findDs160DuplicateNationalityFields(answers)).toEqual([]);
    expect(getDs160NationalityDuplicateMessage({
      kind: "nationality_duplicate",
      fieldNames: ["other_nationality_country"],
    }, false)).toBe("The Other Country/Region of Origin (Nationality) listed has already been (entered or selected).");
    expect(getDs160NationalityDuplicateMessage({
      kind: "permanent_resident_duplicate",
      fieldNames: ["other_permanent_resident_country"],
    }, false)).toBe("The Other Permanent/Resident Country/Region listed has already been (entered or selected).");
  });
});
