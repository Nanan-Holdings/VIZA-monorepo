export const PH_ETRAVEL_GENERAL_DECLARATION_ITEM_FIELD_NAMES = [
  "description",
  "quantity",
  "amount_in_usd",
] as const;

export type PhEtravelGeneralDeclarationAnswer = boolean | null | undefined;

export type PhEtravelGeneralDeclarationInput = {
  goodsAmount?: number | string | null;
  checklistResponses?: readonly PhEtravelGeneralDeclarationAnswer[];
};

export type PhEtravelGeneralDeclarationQuestion = {
  number: number;
  officialKey: string;
  addItemVisible: boolean;
  itemFields: typeof PH_ETRAVEL_GENERAL_DECLARATION_ITEM_FIELD_NAMES;
};

export type PhEtravelGeneralDeclarationPresentation = {
  questions: PhEtravelGeneralDeclarationQuestion[];
  positiveItemQuestionNumbers: number[];
  requiresPositiveItemAnswer: boolean;
  attachmentAreaVisible: boolean;
  attachmentRequiredness: "not_required_on_confirmed_air_branch";
  signatureRequired: true;
};

export type PhEtravelGeneralDeclarationItemRows = Readonly<
  Partial<Record<number, readonly unknown[]>>
>;

export type PhEtravelGeneralDeclarationItemNormalization = {
  itemRowsByQuestion: Record<number, readonly unknown[]>;
  clearedQuestionNumbers: number[];
};

export type PhEtravelGeneralDeclarationCompletenessInput =
  PhEtravelGeneralDeclarationInput & {
    signaturePresent?: boolean | null;
  };

export type PhEtravelGeneralDeclarationMissingItem = {
  fieldName: "check_lists" | "signature";
  reason: "positive_goods_amount_requires_q3_to_q12_yes" | "required";
  returnTarget: "customs_general_declaration" | "attachments_and_signature";
};

function isPositiveAmount(value: number | string | null | undefined): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value !== "string" || value.trim() === "") return false;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0;
}

function isYes(value: PhEtravelGeneralDeclarationAnswer): boolean {
  return value === true;
}

/**
 * E42/E43 UI contract. It describes the observed General Declaration branch
 * without claiming that a goods row is server-required. E45 confirms that the
 * AIR attachment area is optional when this branch is reached.
 */
export function createPhEtravelGeneralDeclarationPresentation(
  input: PhEtravelGeneralDeclarationInput
): PhEtravelGeneralDeclarationPresentation {
  const positiveItemQuestionNumbers = Array.from({ length: 10 }, (_, index) =>
    index + 3
  ).filter((questionNumber) =>
    isYes(input.checklistResponses?.[questionNumber - 1])
  );

  return {
    questions: Array.from({ length: 12 }, (_, index) => {
      const number = index + 1;
      return {
        number,
        officialKey: `check_lists.${index}.response`,
        addItemVisible:
          number >= 3 && isYes(input.checklistResponses?.[index]),
        itemFields: PH_ETRAVEL_GENERAL_DECLARATION_ITEM_FIELD_NAMES,
      };
    }),
    positiveItemQuestionNumbers,
    requiresPositiveItemAnswer: isPositiveAmount(input.goodsAmount),
    attachmentAreaVisible: positiveItemQuestionNumbers.length > 0,
    attachmentRequiredness: "not_required_on_confirmed_air_branch",
    signatureRequired: true,
  };
}

/** Clears rows for an Add Item group as soon as its question is hidden. */
export function normalizePhEtravelGeneralDeclarationItemRows(input: {
  checklistResponses?: readonly PhEtravelGeneralDeclarationAnswer[];
  itemRowsByQuestion?: PhEtravelGeneralDeclarationItemRows;
}): PhEtravelGeneralDeclarationItemNormalization {
  const itemRowsByQuestion: Record<number, readonly unknown[]> = {};
  const clearedQuestionNumbers: number[] = [];

  for (const [rawQuestionNumber, rows] of Object.entries(
    input.itemRowsByQuestion ?? {}
  )) {
    if (!rows) continue;
    const questionNumber = Number(rawQuestionNumber);
    const canShowItems =
      Number.isInteger(questionNumber) &&
      questionNumber >= 3 &&
      questionNumber <= 12 &&
      isYes(input.checklistResponses?.[questionNumber - 1]);

    if (canShowItems) {
      itemRowsByQuestion[questionNumber] = rows;
    } else if (rows.length > 0) {
      clearedQuestionNumbers.push(questionNumber);
    }
  }

  return { itemRowsByQuestion, clearedQuestionNumbers };
}

export function getPhEtravelGeneralDeclarationMissingItems(
  input: PhEtravelGeneralDeclarationCompletenessInput
): PhEtravelGeneralDeclarationMissingItem[] {
  const presentation = createPhEtravelGeneralDeclarationPresentation(input);
  const missing: PhEtravelGeneralDeclarationMissingItem[] = [];

  if (
    presentation.requiresPositiveItemAnswer &&
    presentation.positiveItemQuestionNumbers.length === 0
  ) {
    missing.push({
      fieldName: "check_lists",
      reason: "positive_goods_amount_requires_q3_to_q12_yes",
      returnTarget: "customs_general_declaration",
    });
  }
  if (input.signaturePresent !== true) {
    missing.push({
      fieldName: "signature",
      reason: "required",
      returnTarget: "attachments_and_signature",
    });
  }

  return missing;
}
