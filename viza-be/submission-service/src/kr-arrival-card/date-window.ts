const KOREA_TIME_ZONE = "Asia/Seoul" as const;
const DAY_MS = 86_400_000;

export type KrEArrivalSubmissionWindow =
  | {
      status: "open";
      arrivalDate: string;
      earliestSubmissionDate: string;
      earliestSubmissionAt: string;
      daysUntilOpen: 0;
    }
  | {
      status: "scheduled";
      arrivalDate: string;
      earliestSubmissionDate: string;
      earliestSubmissionAt: string;
      daysUntilOpen: number;
    }
  | {
      status: "past";
      arrivalDate: string;
      earliestSubmissionDate: string;
      earliestSubmissionAt: string;
      daysUntilOpen: 0;
    }
  | {
      status: "invalid";
      arrivalDate: string | null;
      earliestSubmissionDate: null;
      earliestSubmissionAt: null;
      daysUntilOpen: null;
    };

export type KrEArrivalTravelDateValidation =
  | { ok: true; arrivalDate: string; departureDate: string }
  | {
      ok: false;
      code: "missing_date" | "invalid_date" | "departure_before_arrival";
      message: string;
    };

function parseIsoDateOnly(value: string | null | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(time / DAY_MS);
}

function dayNumberToIso(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

function koreaDateParts(now: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function todayKoreaDayNumber(now: Date): number {
  return parseIsoDateOnly(koreaDateParts(now)) ?? 0;
}

/** Return the official earliest KST instant (arrival date minus two days). */
export function krEArrivalEarliestSubmissionAt(arrivalDate: string): string {
  const arrivalDay = parseIsoDateOnly(arrivalDate);
  if (arrivalDay === null) throw new Error("Korea e-Arrival Card arrival date must be YYYY-MM-DD.");
  return `${dayNumberToIso(arrivalDay - 2)}T00:00:00+09:00`;
}

export function evaluateKrEArrivalSubmissionWindow(
  arrivalDate: string | null | undefined,
  now = new Date(),
): KrEArrivalSubmissionWindow {
  const arrivalDay = parseIsoDateOnly(arrivalDate);
  if (arrivalDay === null) {
    return {
      status: "invalid",
      arrivalDate: arrivalDate?.trim() || null,
      earliestSubmissionDate: null,
      earliestSubmissionAt: null,
      daysUntilOpen: null,
    };
  }

  const today = todayKoreaDayNumber(now);
  const earliestDay = arrivalDay - 2;
  const earliestSubmissionDate = dayNumberToIso(earliestDay);
  const normalizedArrivalDate = dayNumberToIso(arrivalDay);
  const earliestSubmissionAt = `${earliestSubmissionDate}T00:00:00+09:00`;

  if (today < earliestDay) {
    return {
      status: "scheduled",
      arrivalDate: normalizedArrivalDate,
      earliestSubmissionDate,
      earliestSubmissionAt,
      daysUntilOpen: earliestDay - today,
    };
  }

  if (today > arrivalDay) {
    return {
      status: "past",
      arrivalDate: normalizedArrivalDate,
      earliestSubmissionDate,
      earliestSubmissionAt,
      daysUntilOpen: 0,
    };
  }

  return {
    status: "open",
    arrivalDate: normalizedArrivalDate,
    earliestSubmissionDate,
    earliestSubmissionAt,
    daysUntilOpen: 0,
  };
}

export function validateKrEArrivalTravelDates(
  arrivalDate: string | null | undefined,
  departureDate: string | null | undefined,
): KrEArrivalTravelDateValidation {
  if (!arrivalDate?.trim() || !departureDate?.trim()) {
    return {
      ok: false,
      code: "missing_date",
      message: "Korea e-Arrival Card requires both arrival and departure dates.",
    };
  }

  const arrivalDay = parseIsoDateOnly(arrivalDate);
  const departureDay = parseIsoDateOnly(departureDate);
  if (arrivalDay === null || departureDay === null) {
    return {
      ok: false,
      code: "invalid_date",
      message: "Korea e-Arrival Card travel dates must use YYYY-MM-DD.",
    };
  }
  if (departureDay < arrivalDay) {
    return {
      ok: false,
      code: "departure_before_arrival",
      message: "Departure date cannot be earlier than arrival date.",
    };
  }
  return {
    ok: true,
    arrivalDate: dayNumberToIso(arrivalDay),
    departureDate: dayNumberToIso(departureDay),
  };
}

export { KOREA_TIME_ZONE };
