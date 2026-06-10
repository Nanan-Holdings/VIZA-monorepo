/**
 * Saudi Arabia e-Visa field mappings (RUN-SA-001).
 *
 * Canonical answer set → Saudi e-Visa portal (visitsaudi / MOFA e-visa) form
 * fields. ⚠️ Selectors are BEST-EFFORT pending a live recon harvest
 * (src/sa/form-recon.ts + DATA-001). The mapping structure + transforms are
 * the stable, unit-tested part.
 */

export interface SaFieldMapping {
  canonicalKey: string;
  selector: string;
  transform?: (value: string) => string;
  required?: boolean;
  kind?: "input" | "select";
}

/** YYYY-MM-DD → DD/MM/YYYY (Saudi portal date convention). */
export function toSaDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export const SA_FIELD_MAPPINGS: SaFieldMapping[] = [
  { canonicalKey: "surname", selector: 'input[name="surname"]', required: true },
  { canonicalKey: "given_names", selector: 'input[name="given_names"]', required: true },
  { canonicalKey: "email", selector: 'input[name="email"]', required: true },
  { canonicalKey: "phone", selector: 'input[name="phone"]' },
  { canonicalKey: "date_of_birth", selector: 'input[name="date_of_birth"]', transform: toSaDate, required: true },
  { canonicalKey: "nationality", selector: 'select[name="nationality"]', kind: "select", required: true },
  { canonicalKey: "passport_number", selector: 'input[name="passport_number"]', required: true },
  { canonicalKey: "passport_expiry_date", selector: 'input[name="passport_expiry"]', transform: toSaDate, required: true },
  { canonicalKey: "passport_issuing_country", selector: 'select[name="passport_issuing_country"]', kind: "select" },
  { canonicalKey: "intended_arrival_date", selector: 'input[name="arrival_date"]', transform: toSaDate },
];

export interface MappedField {
  selector: string;
  value: string;
  kind: "input" | "select";
}

export function mapSaAnswers(answers: Record<string, string>): MappedField[] {
  const out: MappedField[] = [];
  for (const m of SA_FIELD_MAPPINGS) {
    const raw = answers[m.canonicalKey];
    if (raw == null || raw === "") continue;
    out.push({ selector: m.selector, value: m.transform ? m.transform(raw) : raw, kind: m.kind ?? "input" });
  }
  return out;
}

export function missingRequired(answers: Record<string, string>): string[] {
  return SA_FIELD_MAPPINGS.filter(
    (m) => m.required && (answers[m.canonicalKey] == null || answers[m.canonicalKey] === ""),
  ).map((m) => m.canonicalKey);
}
