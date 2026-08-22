const SEOUL_TIME_ZONE = "Asia/Seoul";
const MILLIS_PER_DAY = 86_400_000;

export type KoreaTravelDateValidation =
  | { ok: true; arrivalDate: string; departureDate: string }
  | { ok: false; code: "arrival_date_required" | "departure_date_required" | "invalid_date" | "departure_before_arrival"; message: string };

export type KoreaSubmissionWindow =
  | { status: "invalid" }
  | { status: "past"; arrivalDate: string; today: string }
  | { status: "scheduled"; arrivalDate: string; earliestSubmissionDate: string; daysUntilOpen: number }
  | { status: "open"; arrivalDate: string; earliestSubmissionDate: string; daysUntilOpen: 0 };

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Convert a Korean calendar date to the UTC instant for 00:00 in Seoul. */
export function koreaSeoulMidnightIso(value: string | null | undefined): string | undefined {
  const date = parseIsoDate(value?.trim() ?? "");
  if (!date) return undefined;
  return new Date(`${isoDate(date)}T00:00:00+09:00`).toISOString();
}

function seoulDateParts(value: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: "year" | "month" | "day") => Number(parts.find((entry) => entry.type === type)?.value ?? NaN);
  return { year: part("year"), month: part("month"), day: part("day") };
}

/** Return the current calendar date in Korea, independent of server locale. */
export function seoulCalendarDate(now: Date = new Date()): string {
  const { year, month, day } = seoulDateParts(now);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function validateKoreaEArrivalCardTravelDates(
  arrivalDate: string | null | undefined,
  departureDate: string | null | undefined,
): KoreaTravelDateValidation {
  if (!arrivalDate?.trim()) {
    return { ok: false, code: "arrival_date_required", message: "Korea e-Arrival Card arrival date is required." };
  }
  if (!departureDate?.trim()) {
    return { ok: false, code: "departure_date_required", message: "Korea e-Arrival Card departure date is required." };
  }
  const arrival = parseIsoDate(arrivalDate.trim());
  const departure = parseIsoDate(departureDate.trim());
  if (!arrival || !departure) {
    return { ok: false, code: "invalid_date", message: "Korea e-Arrival Card travel dates must use YYYY-MM-DD." };
  }
  if (departure.getTime() < arrival.getTime()) {
    return { ok: false, code: "departure_before_arrival", message: "Departure date cannot be before arrival date." };
  }
  return { ok: true, arrivalDate: isoDate(arrival), departureDate: isoDate(departure) };
}

/**
 * Korea accepts the declaration from two calendar days before arrival (three
 * Korean calendar days including arrival). Scheduling is date-based in KST;
 * the runner may apply the official 72-hour validity calculation after submit.
 */
export function evaluateKoreaEArrivalCardSubmissionWindow(
  arrivalDate: string | null | undefined,
  now: Date = new Date(),
): KoreaSubmissionWindow {
  const arrival = parseIsoDate(arrivalDate?.trim() ?? "");
  if (!arrival) return { status: "invalid" };
  const earliest = new Date(arrival.getTime());
  earliest.setUTCDate(earliest.getUTCDate() - 2);
  const today = seoulCalendarDate(now);
  const todayDate = parseIsoDate(today);
  if (!todayDate) return { status: "invalid" };
  const earliestSubmissionDate = isoDate(earliest);
  if (todayDate.getTime() > arrival.getTime()) {
    return { status: "past", arrivalDate: isoDate(arrival), today };
  }
  const daysUntilOpen = Math.max(0, Math.round((earliest.getTime() - todayDate.getTime()) / MILLIS_PER_DAY));
  if (daysUntilOpen > 0) {
    return { status: "scheduled", arrivalDate: isoDate(arrival), earliestSubmissionDate, daysUntilOpen };
  }
  return { status: "open", arrivalDate: isoDate(arrival), earliestSubmissionDate, daysUntilOpen: 0 };
}
