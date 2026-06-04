/**
 * Malaysia eVISA/MDAC field mappings (RUN-MY-001).
 *
 * Canonical answer set → Malaysia eVISA (malaysiavisa.imi.gov.my) / MDAC form
 * fields. ⚠️ Selectors BEST-EFFORT pending recon (src/my/form-recon.ts +
 * DATA-001). Mapping structure + transforms are the unit-tested core.
 */

export interface MyFieldMapping {
  canonicalKey: string;
  selector: string;
  transform?: (value: string) => string;
  required?: boolean;
  kind?: "input" | "select";
}

/** YYYY-MM-DD → DD/MM/YYYY (Malaysia portal date convention). */
export function toMyDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export const MY_FIELD_MAPPINGS: MyFieldMapping[] = [
  { canonicalKey: "surname", selector: 'input[name="surname"]', required: true },
  { canonicalKey: "given_names", selector: 'input[name="given_names"]', required: true },
  { canonicalKey: "email", selector: 'input[name="email"]', required: true },
  { canonicalKey: "phone", selector: 'input[name="phone"]' },
  { canonicalKey: "date_of_birth", selector: 'input[name="date_of_birth"]', transform: toMyDate, required: true },
  { canonicalKey: "nationality", selector: 'select[name="nationality"]', kind: "select", required: true },
  { canonicalKey: "passport_number", selector: 'input[name="passport_number"]', required: true },
  { canonicalKey: "passport_expiry_date", selector: 'input[name="passport_expiry"]', transform: toMyDate, required: true },
  { canonicalKey: "passport_issuing_country", selector: 'select[name="passport_issuing_country"]', kind: "select" },
  { canonicalKey: "intended_arrival_date", selector: 'input[name="arrival_date"]', transform: toMyDate },
];

export interface MappedField {
  selector: string;
  value: string;
  kind: "input" | "select";
}

export function mapMyAnswers(answers: Record<string, string>): MappedField[] {
  const out: MappedField[] = [];
  for (const m of MY_FIELD_MAPPINGS) {
    const raw = answers[m.canonicalKey];
    if (raw == null || raw === "") continue;
    out.push({ selector: m.selector, value: m.transform ? m.transform(raw) : raw, kind: m.kind ?? "input" });
  }
  return out;
}

export function missingRequired(answers: Record<string, string>): string[] {
  return MY_FIELD_MAPPINGS.filter(
    (m) => m.required && (answers[m.canonicalKey] == null || answers[m.canonicalKey] === ""),
  ).map((m) => m.canonicalKey);
}
