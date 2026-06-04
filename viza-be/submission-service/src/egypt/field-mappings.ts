/**
 * Egypt e-Visa field mappings (RUN-EG-001).
 *
 * Canonical answer set → visa2egypt.gov.eg form fields.
 *
 * ⚠️ Selectors are BEST-EFFORT pending a live recon harvest
 * (src/egypt/form-recon.ts + DATA-001). The mapping structure + transforms
 * are the stable, unit-tested part.
 */

export interface EgFieldMapping {
  canonicalKey: string;
  selector: string;
  transform?: (value: string) => string;
  required?: boolean;
  kind?: "input" | "select";
}

/** YYYY-MM-DD → DD-MM-YYYY (Egypt portal date convention). */
export function toEgDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return value;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export const EG_FIELD_MAPPINGS: EgFieldMapping[] = [
  { canonicalKey: "surname", selector: 'input[name="surname"]', required: true },
  { canonicalKey: "given_names", selector: 'input[name="given_names"]', required: true },
  { canonicalKey: "email", selector: 'input[name="email"]', required: true },
  { canonicalKey: "phone", selector: 'input[name="phone"]' },
  { canonicalKey: "date_of_birth", selector: 'input[name="date_of_birth"]', transform: toEgDate, required: true },
  { canonicalKey: "nationality", selector: 'select[name="nationality"]', kind: "select", required: true },
  { canonicalKey: "passport_number", selector: 'input[name="passport_number"]', required: true },
  { canonicalKey: "passport_expiry_date", selector: 'input[name="passport_expiry"]', transform: toEgDate, required: true },
  { canonicalKey: "passport_issuing_country", selector: 'select[name="passport_issuing_country"]', kind: "select" },
  { canonicalKey: "intended_arrival_date", selector: 'input[name="arrival_date"]', transform: toEgDate },
];

export interface MappedField {
  selector: string;
  value: string;
  kind: "input" | "select";
}

export function mapEgAnswers(answers: Record<string, string>): MappedField[] {
  const out: MappedField[] = [];
  for (const m of EG_FIELD_MAPPINGS) {
    const raw = answers[m.canonicalKey];
    if (raw == null || raw === "") continue;
    out.push({ selector: m.selector, value: m.transform ? m.transform(raw) : raw, kind: m.kind ?? "input" });
  }
  return out;
}

export function missingRequired(answers: Record<string, string>): string[] {
  return EG_FIELD_MAPPINGS.filter(
    (m) => m.required && (answers[m.canonicalKey] == null || answers[m.canonicalKey] === ""),
  ).map((m) => m.canonicalKey);
}
