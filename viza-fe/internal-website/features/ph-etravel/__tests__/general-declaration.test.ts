import { describe, expect, test } from "vitest";

import {
  createPhEtravelGeneralDeclarationPresentation,
  getPhEtravelGeneralDeclarationMissingItems,
  normalizePhEtravelGeneralDeclarationItemRows,
  PH_ETRAVEL_GENERAL_DECLARATION_ITEM_FIELD_NAMES,
} from "../general-declaration";

describe("Philippines eTravel General Declaration presentation", () => {
  test("shows Add Item only for each Yes answer from Q3 through Q12", () => {
    const presentation = createPhEtravelGeneralDeclarationPresentation({
      checklistResponses: [true, true, true, false, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true],
    });

    expect(presentation.questions.slice(0, 2).every((question) => question.addItemVisible === false)).toBe(true);
    expect(presentation.positiveItemQuestionNumbers).toEqual([3, 12]);
    expect(presentation.questions[2]).toMatchObject({
      officialKey: "check_lists.2.response",
      addItemVisible: true,
      itemFields: PH_ETRAVEL_GENERAL_DECLARATION_ITEM_FIELD_NAMES,
    });
    expect(presentation.questions[11]).toMatchObject({
      officialKey: "check_lists.11.response",
      addItemVisible: true,
      itemFields: PH_ETRAVEL_GENERAL_DECLARATION_ITEM_FIELD_NAMES,
    });
  });

  test("requires a Q3-Q12 Yes only for a positive displayed goods amount", () => {
    expect(
      getPhEtravelGeneralDeclarationMissingItems({
        goodsAmount: "1,000",
        checklistResponses: [true, false, false],
        signaturePresent: true,
      })
    ).toEqual([
      {
        fieldName: "check_lists",
        reason: "positive_goods_amount_requires_q3_to_q12_yes",
        returnTarget: "customs_general_declaration",
      },
    ]);
    expect(
      getPhEtravelGeneralDeclarationMissingItems({
        goodsAmount: 0,
        signaturePresent: true,
      })
    ).toEqual([]);
  });

  test("keeps the confirmed AIR document area optional and returns only missing signatures", () => {
    const presentation = createPhEtravelGeneralDeclarationPresentation({
      checklistResponses: [false, false, true],
    });

    expect(presentation.attachmentAreaVisible).toBe(true);
    expect(presentation.attachmentRequiredness).toBe(
      "not_required_on_confirmed_air_branch"
    );
    expect(presentation.signatureRequired).toBe(true);
    expect(
      getPhEtravelGeneralDeclarationMissingItems({
        checklistResponses: [false, false, true],
        signaturePresent: false,
      })
    ).toEqual([
      {
        fieldName: "signature",
        reason: "required",
        returnTarget: "attachments_and_signature",
      },
    ]);
    expect(
      getPhEtravelGeneralDeclarationMissingItems({
        checklistResponses: Array.from({ length: 12 }, () => false),
        signaturePresent: false,
      })
    ).toEqual([
      {
        fieldName: "signature",
        reason: "required",
        returnTarget: "attachments_and_signature",
      },
    ]);
  });

  test("clears rows as soon as a Q3-Q12 Add Item group becomes hidden", () => {
    expect(
      normalizePhEtravelGeneralDeclarationItemRows({
        checklistResponses: [true, true, false, false, true],
        itemRowsByQuestion: {
          1: [{ numericOfficialId: 7 }],
          3: [{ numericOfficialId: 8 }],
          5: [{ numericOfficialId: 9 }],
        },
      })
    ).toEqual({
      itemRowsByQuestion: { 5: [{ numericOfficialId: 9 }] },
      clearedQuestionNumbers: [1, 3],
    });
  });
});
