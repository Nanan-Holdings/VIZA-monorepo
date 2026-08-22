export type KoreaEArrivalAnswerRow = {
  field_name?: unknown;
  value_text?: unknown;
  value_json?: unknown;
};

export type KoreaEArrivalApplicationFallback = {
  arrival_date?: string | null;
  departure_date?: string | null;
  accommodation_address?: string | null;
};

export type KoreaEArrivalAnswerSnapshot = {
  arrivalDate: string | null;
  departureDate: string | null;
  arrivalMode: string | null;
  stayAddressProvided: boolean;
};

function answerValueToText(row: KoreaEArrivalAnswerRow): string | null {
  if (typeof row.value_text === "string" && row.value_text.trim()) return row.value_text.trim();
  if (typeof row.value_json === "string" && row.value_json.trim()) return row.value_json.trim();
  if (typeof row.value_json === "number" || typeof row.value_json === "boolean") {
    return String(row.value_json);
  }
  return null;
}

function firstText(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function extractKoreaEArrivalAnswers(
  rows: KoreaEArrivalAnswerRow[],
  fallback: KoreaEArrivalApplicationFallback = {},
): KoreaEArrivalAnswerSnapshot {
  const answers: Record<string, string> = {};
  for (const row of rows) {
    if (typeof row.field_name !== "string") continue;
    const value = answerValueToText(row);
    if (value) answers[row.field_name] = value;
  }

  return {
    arrivalDate: firstText([answers.arrival_date, fallback.arrival_date]),
    departureDate: firstText([answers.departure_date, fallback.departure_date]),
    arrivalMode: firstText([answers.arrival_mode]),
    stayAddressProvided: Boolean(
      firstText([
        answers.stay_address_ko,
        answers.stay_address_en,
        fallback.accommodation_address,
      ]),
    ),
  };
}
