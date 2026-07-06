const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type VietnamPrearrivalSubmissionWindow =
  | {
      status: "open";
      arrivalDate: string;
      earliestSubmissionDate: string;
    }
  | {
      status: "scheduled";
      arrivalDate: string;
      earliestSubmissionDate: string;
    }
  | {
      status: "past";
      arrivalDate: string;
      earliestSubmissionDate: string;
    }
  | {
      status: "invalid";
      arrivalDate: string | null;
      earliestSubmissionDate: null;
    };

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function evaluateVietnamPrearrivalSubmissionWindow(
  arrivalDate: string | null | undefined,
  now: Date = new Date(),
): VietnamPrearrivalSubmissionWindow {
  const parsedArrival = parseDateOnly(arrivalDate);
  if (!parsedArrival) {
    return {
      status: "invalid",
      arrivalDate: arrivalDate ?? null,
      earliestSubmissionDate: null,
    };
  }

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const earliest = new Date(parsedArrival.getTime() - 2 * MS_PER_DAY);
  const arrival = toDateOnly(parsedArrival);
  const earliestSubmissionDate = toDateOnly(earliest);

  if (parsedArrival.getTime() < today.getTime()) {
    return { status: "past", arrivalDate: arrival, earliestSubmissionDate };
  }
  if (earliest.getTime() > today.getTime()) {
    return { status: "scheduled", arrivalDate: arrival, earliestSubmissionDate };
  }
  return { status: "open", arrivalDate: arrival, earliestSubmissionDate };
}
