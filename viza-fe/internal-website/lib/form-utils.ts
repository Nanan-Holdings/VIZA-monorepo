import { type VisaFormFieldRow } from "@/types/visa-form-fields";

/**
 * Evaluate a conditionalLogic.showIf expression against current form values.
 * Supports: "field === value", multiple OR conditions "a === b || c === d".
 *
 * Also infers conditional visibility when explicit conditionalLogic is missing
 * from the DB but the field is clearly subordinate to a yes/no toggle:
 *  - repeat_group "X" → toggle field "X_used"
 *  - field name shares a prefix with a yes/no radio field (e.g.
 *    "other_name_surname" is subordinate to "other_names_used")
 */
export function evaluateShowIf(
  field: VisaFormFieldRow,
  values: Record<string, string>,
  allFields?: VisaFormFieldRow[],
): boolean {
  const logic = field.conditionalLogic;

  // 1. Explicit showIf condition
  if (logic) {
    const showIf = (logic as { showIf?: string }).showIf;
    if (showIf && typeof showIf === "string") {
      // Resolve target: "_empty" sentinel means the empty string
      const resolveTarget = (raw: string): string =>
        raw.toLowerCase() === "_empty" ? "" : raw.toLowerCase();

      // Evaluate a single atomic comparison (=== or !==)
      const evalAtom = (atom: string): boolean => {
        const eqMatch = atom.match(/^(\S+)\s*===\s*(\S+)$/);
        if (eqMatch) {
          const actual = (values[eqMatch[1]] ?? "").toLowerCase();
          return actual === resolveTarget(eqMatch[2]);
        }
        const neqMatch = atom.match(/^(\S+)\s*!==\s*(\S+)$/);
        if (neqMatch) {
          const actual = (values[neqMatch[1]] ?? "").toLowerCase();
          return actual !== resolveTarget(neqMatch[2]);
        }
        return false;
      };

      // Split by || (OR), then within each by && (AND)
      const orGroups = showIf.split("||").map((s) => s.trim());
      return orGroups.some((orGroup) => {
        const andParts = orGroup.split("&&").map((s) => s.trim());
        return andParts.every(evalAtom);
      });
    }
  }

  // 2. Infer conditional visibility when no explicit logic exists
  if (!logic && allFields) {
    // 2a. repeat_group → look for "<group>_used" or "has_<group>" toggle
    const rules = field.validationRules as { repeat_group?: string } | null;
    const group = rules?.repeat_group;
    if (group) {
      const toggleCandidates = [`${group}_used`, `has_${group}`];
      for (const toggleName of toggleCandidates) {
        if (allFields.some((f) => f.fieldName === toggleName)) {
          return (values[toggleName] ?? "").toLowerCase() === "yes";
        }
      }
    }

    // 2b. Find the closest yes/no toggle field that this field's name
    //     is prefixed by.
    const yesNoToggles = allFields.filter(
      (f) =>
        f.fieldName !== field.fieldName &&
        (f.fieldType === "radio" || f.fieldType === "select") &&
        f.options &&
        Array.isArray(f.options) &&
        f.options.some((o) => {
          const val = typeof o === "string" ? o : o.value;
          return val.toLowerCase() === "yes";
        })
    );

    for (const toggle of yesNoToggles) {
      const stems: string[] = [toggle.fieldName];
      const withoutUsed = toggle.fieldName.replace(/_used$/, "");
      if (withoutUsed !== toggle.fieldName) {
        stems.push(withoutUsed);
        if (withoutUsed.endsWith("s")) stems.push(withoutUsed.slice(0, -1));
      }
      const withoutHas = toggle.fieldName.replace(/^has_/, "");
      if (withoutHas !== toggle.fieldName) {
        stems.push(withoutHas);
        if (withoutHas.endsWith("s")) stems.push(withoutHas.slice(0, -1));
      }

      for (const stem of stems) {
        if (field.fieldName.startsWith(stem) && field.fieldName !== toggle.fieldName) {
          return (values[toggle.fieldName] ?? "").toLowerCase() === "yes";
        }
      }
    }
  }

  return true; // no condition → always visible
}
