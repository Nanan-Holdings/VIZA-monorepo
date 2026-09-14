function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function toISODate(year: number, month: number, day: number): string | null {
  if (!isValidDate(year, month, day)) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function parseUSAppointmentDate(text: string): string | null {
  const normalized = normalizeText(text);
  const yearFirst = normalized.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (yearFirst) {
    return toISODate(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      Number(yearFirst[3]),
    );
  }

  const monthFirst = normalized.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (monthFirst) {
    return toISODate(
      Number(monthFirst[3]),
      Number(monthFirst[1]),
      Number(monthFirst[2]),
    );
  }

  return null;
}

export function parseUSAppointmentTime(text: string): string | null {
  const normalized = normalizeText(text);
  const match = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*(AM|PM)?\b/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const meridiem = match[4]?.toUpperCase();
  if (meridiem === "AM") hour = hour === 12 ? 0 : hour;
  if (meridiem === "PM") hour = hour === 12 ? 12 : hour + 12;
  return `${hour.toString().padStart(2, "0")}:${match[2]}`;
}

export function hasUSAppointmentNoSlotsMessage(text: string): boolean {
  const normalized = normalizeText(text).toLowerCase();
  return /no\s+(?:appointment\s+)?(?:slots?|dates?)\s+(?:are\s+)?available/.test(normalized)
    || /no\s+appointments?\s+available/.test(normalized)
    || /no\s+available\s+(?:appointment\s+)?(?:slots?|dates?)/.test(normalized)
    || /暂无.*(?:预约|名额|日期)|没有.*(?:预约|名额|日期)/.test(normalized);
}

const RESERVED_CONFIRMATION_WORDS = new Set([
  "APPOINTMENT",
  "CONFIRMATION",
  "NUMBER",
  "REFERENCE",
  "REQUEST",
  "PENDING",
  "SUCCESS",
]);

function normalizeConfirmationCandidate(value: string | null | undefined): string | null {
  const candidate = normalizeText(value).replace(/^['"\s]+|['"\s.,;:]+$/g, "").toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{5,}$/.test(candidate)) return null;
  if (RESERVED_CONFIRMATION_WORDS.has(candidate)) return null;
  return candidate;
}

export function extractUSAppointmentConfirmationNumber(
  text: string,
  explicitReference?: string | null,
): string | null {
  const explicit = normalizeConfirmationCandidate(explicitReference);
  if (explicit) return explicit;

  const normalized = normalizeText(text);
  const labelled = normalized.match(
    /(?:confirmation|reference|appointment)\s+(?:number|no\.?|#|id)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{5,})/i,
  );
  const labelledCandidate = normalizeConfirmationCandidate(labelled?.[1]);
  if (labelledCandidate) return labelledCandidate;
  return null;
}
