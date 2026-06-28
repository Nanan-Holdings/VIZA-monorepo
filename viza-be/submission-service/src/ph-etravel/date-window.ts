export type PhEtravelSubmissionWindow =
  | {
      status: "open";
      earliestSubmissionDate: string;
      latestSubmissionDate: string;
      daysUntilOpen: 0;
    }
  | {
      status: "scheduled";
      earliestSubmissionDate: string;
      latestSubmissionDate: string;
      daysUntilOpen: number;
    }
  | {
      status: "past";
      earliestSubmissionDate: string | null;
      latestSubmissionDate: string | null;
      daysUntilOpen: 0;
    }
  | {
      status: "invalid";
      earliestSubmissionDate: null;
      latestSubmissionDate: null;
      daysUntilOpen: 0;
    };

function parseIsoDateOnly(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function dateOnlyUtc(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function evaluatePhEtravelSubmissionWindow(
  arrivalDate: string | null | undefined,
  now: Date = new Date(),
): PhEtravelSubmissionWindow {
  const arrival = parseIsoDateOnly(arrivalDate);
  if (!arrival) {
    return {
      status: "invalid",
      earliestSubmissionDate: null,
      latestSubmissionDate: null,
      daysUntilOpen: 0,
    };
  }

  const today = dateOnlyUtc(now);
  const earliest = addDays(arrival, -3);
  const latest = arrival;
  const earliestSubmissionDate = isoDate(earliest);
  const latestSubmissionDate = isoDate(latest);

  if (today > latest) {
    return {
      status: "past",
      earliestSubmissionDate,
      latestSubmissionDate,
      daysUntilOpen: 0,
    };
  }

  if (today < earliest) {
    const daysUntilOpen = Math.ceil((earliest.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    return {
      status: "scheduled",
      earliestSubmissionDate,
      latestSubmissionDate,
      daysUntilOpen,
    };
  }

  return {
    status: "open",
    earliestSubmissionDate,
    latestSubmissionDate,
    daysUntilOpen: 0,
  };
}
