const DAY_MS = 86_400_000;

export type SgacSubmissionWindow =
  | {
      status: "open";
      arrivalDate: string;
      earliestSubmissionDate: string;
      daysUntilOpen: 0;
    }
  | {
      status: "scheduled";
      arrivalDate: string;
      earliestSubmissionDate: string;
      daysUntilOpen: number;
    }
  | {
      status: "past";
      arrivalDate: string;
      earliestSubmissionDate: string;
      daysUntilOpen: 0;
    }
  | {
      status: "invalid";
      arrivalDate: string | null;
      earliestSubmissionDate: null;
      daysUntilOpen: null;
    };

export type SgacTravelDateValidation =
  | { ok: true; arrivalDate: string; departureDate: string }
  | { ok: false; code: "missing_date" | "invalid_date" | "departure_before_arrival"; message: string };

function parseIsoDateOnly(value: string | null | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

function todayDayNumber(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

export function evaluateSgacSubmissionWindow(
  arrivalDate: string | null | undefined,
  now = new Date(),
): SgacSubmissionWindow {
  const arrivalDay = parseIsoDateOnly(arrivalDate);
  if (arrivalDay === null) {
    return {
      status: "invalid",
      arrivalDate: arrivalDate?.trim() || null,
      earliestSubmissionDate: null,
      daysUntilOpen: null,
    };
  }

  const today = todayDayNumber(now);
  const earliestDay = arrivalDay - 2;
  const earliestSubmissionDate = dayNumberToIso(earliestDay);
  const normalizedArrivalDate = dayNumberToIso(arrivalDay);

  if (today < earliestDay) {
    return {
      status: "scheduled",
      arrivalDate: normalizedArrivalDate,
      earliestSubmissionDate,
      daysUntilOpen: earliestDay - today,
    };
  }

  if (today > arrivalDay) {
    return {
      status: "past",
      arrivalDate: normalizedArrivalDate,
      earliestSubmissionDate,
      daysUntilOpen: 0,
    };
  }

  return {
    status: "open",
    arrivalDate: normalizedArrivalDate,
    earliestSubmissionDate,
    daysUntilOpen: 0,
  };
}

export function validateSgacTravelDates(
  arrivalDate: string | null | undefined,
  departureDate: string | null | undefined,
): SgacTravelDateValidation {
  if (!arrivalDate?.trim() || !departureDate?.trim()) {
    return {
      ok: false,
      code: "missing_date",
      message: "SGAC requires both arrival date and departure date.",
    };
  }

  const arrivalDay = parseIsoDateOnly(arrivalDate);
  const departureDay = parseIsoDateOnly(departureDate);
  if (arrivalDay === null || departureDay === null) {
    return {
      ok: false,
      code: "invalid_date",
      message: "SGAC travel dates must use YYYY-MM-DD.",
    };
  }

  if (departureDay < arrivalDay) {
    return {
      ok: false,
      code: "departure_before_arrival",
      message: "SGAC departure date cannot be earlier than arrival date.",
    };
  }

  return {
    ok: true,
    arrivalDate: dayNumberToIso(arrivalDay),
    departureDate: dayNumberToIso(departureDay),
  };
}
