const DAY_MS = 86_400_000;

export type SgacSubmissionWindow =
  | { status: "open"; earliestSubmissionDate: string; daysUntilOpen: 0 }
  | { status: "scheduled"; earliestSubmissionDate: string; daysUntilOpen: number }
  | { status: "past"; earliestSubmissionDate: string; daysUntilOpen: 0 }
  | { status: "invalid"; earliestSubmissionDate: null; daysUntilOpen: null };

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
    return { status: "invalid", earliestSubmissionDate: null, daysUntilOpen: null };
  }

  const earliestDay = arrivalDay - 2;
  const today = todayDayNumber(now);
  const earliestSubmissionDate = dayNumberToIso(earliestDay);

  if (today < earliestDay) {
    return {
      status: "scheduled",
      earliestSubmissionDate,
      daysUntilOpen: earliestDay - today,
    };
  }
  if (today > arrivalDay) {
    return { status: "past", earliestSubmissionDate, daysUntilOpen: 0 };
  }
  return { status: "open", earliestSubmissionDate, daysUntilOpen: 0 };
}
