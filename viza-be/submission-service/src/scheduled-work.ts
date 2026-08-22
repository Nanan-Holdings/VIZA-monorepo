type ScheduledQueueRow = {
  application_id: string;
  status: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function scheduledForFromResult(result: unknown): string | null {
  if (!isRecord(result)) return null;
  return typeof result.scheduledFor === "string" ? result.scheduledFor.trim() : null;
}

function timeZoneForScheduledStatus(status: string): string {
  if (status.startsWith("vn_")) return "Asia/Ho_Chi_Minh";
  if (status.startsWith("tdac_")) return "Asia/Bangkok";
  if (status.startsWith("phetravel_")) return "Asia/Manila";
  return "Asia/Singapore";
}

function calendarDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function isScheduledSubmissionDue(
  row: ScheduledQueueRow,
  submissionResult: unknown,
  now = new Date(),
): boolean {
  const scheduledFor = scheduledForFromResult(submissionResult);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(scheduledFor ?? "")) {
    // Fail open for work: malformed legacy rows should get one worker pass so
    // the country runner can repair or surface them instead of being stranded.
    return true;
  }
  return scheduledFor! <= calendarDate(now, timeZoneForScheduledStatus(row.status));
}
