/**
 * Evaluate the small condition grammar used by the DS-160 seed.
 *
 * This module deliberately has no AST/database dependency so CEAC runtime
 * code can evaluate a field's `showIf` expression without importing the
 * static seed audit parser.
 */

const MARITAL_STATUS_CODES: Readonly<Record<string, string>> = {
  S: "single",
  M: "married",
  C: "common_law",
  P: "civil_union",
  W: "widowed",
  D: "divorced",
  L: "legally_separated",
  O: "other",
};

type Ds160ConditionValue = string | null | undefined;

function normalizeActualToken(key: string, raw: Ds160ConditionValue): string {
  // The form treats an absent value, an empty value, and an explicit null as
  // the same unanswered state.  Keep that distinction out of the small
  // expression grammar so `field !== null` cannot accidentally activate a
  // dependent field when its controller has not been answered yet.
  if (raw === null || raw === undefined) return "";
  const value = raw.trim();
  if (!value || value.toLowerCase() === "null") return "";
  if (value.toUpperCase() === "Y") return "yes";
  if (value.toUpperCase() === "N") return "no";
  if (key === "marital_status") {
    return MARITAL_STATUS_CODES[value.toUpperCase()] ?? value.toLowerCase();
  }
  return value.toLowerCase();
}

function normalizeExpectedToken(key: string, raw: string): string {
  const value = raw.trim().toLowerCase();
  if (value === "_empty") return "";
  if (key === "marital_status") {
    return MARITAL_STATUS_CODES[value.toUpperCase()] ?? value;
  }
  return value;
}

/** Evaluate the DS-160 seed's `===`/`!==` + `&&`/`||` grammar. */
export function ds160ConditionMatches(
  expression: string,
  values: Readonly<Record<string, Ds160ConditionValue>>,
): boolean {
  const groups = expression.split("||").map((group) => group.split("&&").map((part) => {
    const match = /^\s*([a-z_][a-z0-9_]*)\s*(===|!==)\s*(\S+)\s*$/i.exec(part);
    if (!match) throw new Error(`Unsupported DS-160 condition: ${expression}`);
    const [, key, operator, token] = match;
    return { key, operator, token };
  }));

  return groups.some((group) => group.every(({ key, operator, token }) => {
    const actual = normalizeActualToken(key, values[key]);
    const expected = normalizeExpectedToken(key, token);
    if (expected === "null") {
      // `null` is a null-like sentinel for the frontend condition grammar.
      // Missing, empty, and explicit null values therefore satisfy `=== null`
      // and fail `!== null`.
      return operator === "===" ? actual === "" : actual !== "";
    }
    return operator === "===" ? actual === expected : actual !== expected;
  }));
}
