const DAY_MS = 86_400_000;

export type PhEtravelSubmissionWindow =
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

export type PhEtravelTravelDateValidation =
  | { ok: true; arrivalDate: string; departureDate: string }
  | { ok: false; code: "missing_date" | "invalid_date" | "departure_after_arrival"; message: string };

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
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
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

export function evaluatePhEtravelSubmissionWindow(
  flightArrivalDate: string | null | undefined,
  now = new Date(),
): PhEtravelSubmissionWindow {
  const arrivalDay = parseIsoDateOnly(flightArrivalDate);
  if (arrivalDay === null) {
    return {
      status: "invalid",
      arrivalDate: flightArrivalDate?.trim() || null,
      earliestSubmissionDate: null,
      daysUntilOpen: null,
    };
  }

  const today = todayDayNumber(now);
  const earliestSubmissionDay = arrivalDay - 3;
  const earliestSubmissionDate = dayNumberToIso(earliestSubmissionDay);
  const normalizedArrivalDate = dayNumberToIso(arrivalDay);

  if (today < earliestSubmissionDay) {
    return {
      status: "scheduled",
      arrivalDate: normalizedArrivalDate,
      earliestSubmissionDate,
      daysUntilOpen: earliestSubmissionDay - today,
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

export function validatePhEtravelFlightDates(
  flightDepartureDate: string | null | undefined,
  flightArrivalDate: string | null | undefined,
): PhEtravelTravelDateValidation {
  if (!flightDepartureDate?.trim() || !flightArrivalDate?.trim()) {
    return {
      ok: false,
      code: "missing_date",
      message: "Philippines eTravel requires both flight departure date and flight arrival date.",
    };
  }

  const departureDay = parseIsoDateOnly(flightDepartureDate);
  const arrivalDay = parseIsoDateOnly(flightArrivalDate);
  if (departureDay === null || arrivalDay === null) {
    return {
      ok: false,
      code: "invalid_date",
      message: "Philippines eTravel flight dates must use YYYY-MM-DD.",
    };
  }

  if (departureDay > arrivalDay) {
    return {
      ok: false,
      code: "departure_after_arrival",
      message: "Philippines eTravel flight departure date cannot be later than the flight arrival date.",
    };
  }

  return {
    ok: true,
    arrivalDate: dayNumberToIso(arrivalDay),
    departureDate: dayNumberToIso(departureDay),
  };
}
