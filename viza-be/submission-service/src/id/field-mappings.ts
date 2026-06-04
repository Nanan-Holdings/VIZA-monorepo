/**
 * Indonesia e-Visa field mappings (RUN-ID-001).
 *
 * Maps the canonical answer set → Indonesia molina/evisa portal form fields.
 *
 * ⚠️ Selectors are BEST-EFFORT pending a live recon harvest
 * (src/id/form-recon.ts + DATA-001). They follow the generic
 * name="..."/id="..." conventions seen on evisa.imigrasi.go.id and MUST be
 * promoted from a recon snapshot before production submit. The mapping
 * structure + transforms below are the stable, unit-tested part.
 */

export interface IdFieldMapping {
  /** Canonical answer key (see src/queue/answers.ts). */
  canonicalKey: string;
  /** Portal selector to fill. */
  selector: string;
  /** Optional value transform (e.g. date reformat). */
  transform?: (value: string) => string;
  /** When true, a missing value should gate the run (needs_human). */
  required?: boolean;
  /** input | select — affects how the runner sets the value. */
  kind?: "input" | "select";
}

/** YYYY-MM-DD → DD/MM/YYYY (Indonesia portal date convention). */
export function toIdDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export const ID_FIELD_MAPPINGS: IdFieldMapping[] = [
  { canonicalKey: "surname", selector: 'input[name="surname"]', required: true },
  { canonicalKey: "given_names", selector: 'input[name="given_names"]', required: true },
  { canonicalKey: "email", selector: 'input[name="email"]', required: true },
  { canonicalKey: "phone", selector: 'input[name="phone"]' },
  { canonicalKey: "date_of_birth", selector: 'input[name="date_of_birth"]', transform: toIdDate, required: true },
  { canonicalKey: "nationality", selector: 'select[name="nationality"]', kind: "select", required: true },
  { canonicalKey: "passport_number", selector: 'input[name="passport_number"]', required: true },
  { canonicalKey: "passport_expiry_date", selector: 'input[name="passport_expiry"]', transform: toIdDate, required: true },
  { canonicalKey: "passport_issuing_country", selector: 'select[name="passport_issuing_country"]', kind: "select" },
  { canonicalKey: "intended_arrival_date", selector: 'input[name="arrival_date"]', transform: toIdDate },
];

export interface MappedField {
  selector: string;
  value: string;
  kind: "input" | "select";
}

/**
 * Resolve canonical answers to (selector, value) pairs in form order.
 * Pure function — the unit-tested core of the runner.
 */
export function mapIdAnswers(answers: Record<string, string>): MappedField[] {
  const out: MappedField[] = [];
  for (const m of ID_FIELD_MAPPINGS) {
    const raw = answers[m.canonicalKey];
    if (raw == null || raw === "") continue;
    out.push({
      selector: m.selector,
      value: m.transform ? m.transform(raw) : raw,
      kind: m.kind ?? "input",
    });
  }
  return out;
}

/** Canonical keys that must be present, else the run should gate to needs_human. */
export function missingRequired(answers: Record<string, string>): string[] {
  return ID_FIELD_MAPPINGS.filter(
    (m) => m.required && (answers[m.canonicalKey] == null || answers[m.canonicalKey] === ""),
  ).map((m) => m.canonicalKey);
}
