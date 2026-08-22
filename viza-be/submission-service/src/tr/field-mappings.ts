/**
 * Legacy Türkiye mapping contract retained for schema/recon compatibility.
 *
 * Keep this module pure: importing a field map must not initialize the worker,
 * Supabase, artifact storage, or payment clients. The live Türkiye state
 * machine uses `live-flow.ts` because the official portal controls are
 * multi-step Kendo widgets rather than this generic ten-field shape.
 */
export interface TrFieldMapping {
  canonicalKey: string;
  selector: string;
  transform?: (value: string) => string;
  required?: boolean;
  kind?: "input" | "select";
}

export interface TrMappedField {
  selector: string;
  value: string;
  kind: "input" | "select";
}

function isoToDmySlash(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export const TR_FIELD_MAPPINGS: TrFieldMapping[] = [
  { canonicalKey: "surname", selector: 'input[name="surname"]', required: true },
  { canonicalKey: "given_names", selector: 'input[name="given_names"]', required: true },
  { canonicalKey: "email", selector: 'input[name="email"]', required: true },
  { canonicalKey: "phone", selector: 'input[name="phone"]' },
  {
    canonicalKey: "date_of_birth",
    selector: 'input[name="date_of_birth"]',
    transform: isoToDmySlash,
    required: true,
  },
  {
    canonicalKey: "nationality",
    selector: 'select[name="nationality"]',
    kind: "select",
    required: true,
  },
  {
    canonicalKey: "passport_number",
    selector: 'input[name="passport_number"]',
    required: true,
  },
  {
    canonicalKey: "passport_expiry_date",
    selector: 'input[name="passport_expiry"]',
    transform: isoToDmySlash,
    required: true,
  },
  {
    canonicalKey: "passport_issuing_country",
    selector: 'select[name="passport_issuing_country"]',
    kind: "select",
  },
  {
    canonicalKey: "intended_arrival_date",
    selector: 'input[name="arrival_date"]',
    transform: isoToDmySlash,
  },
];

export function mapTrAnswers(answers: Record<string, string>): TrMappedField[] {
  return TR_FIELD_MAPPINGS.flatMap((mapping) => {
    const value = answers[mapping.canonicalKey];
    if (!value) return [];
    return [{
      selector: mapping.selector,
      value: mapping.transform ? mapping.transform(value) : value,
      kind: mapping.kind ?? "input",
    }];
  });
}

export function trMissingRequired(answers: Record<string, string>): string[] {
  return TR_FIELD_MAPPINGS
    .filter((mapping) => mapping.required && !answers[mapping.canonicalKey])
    .map((mapping) => mapping.canonicalKey);
}
