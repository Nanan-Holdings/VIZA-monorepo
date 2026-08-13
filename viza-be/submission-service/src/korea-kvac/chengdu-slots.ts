import type { Page } from "@playwright/test";

export interface ChengduObservedSlot {
  appointmentDate: string;
  appointmentTime: string;
  appointmentEndTime: string;
  bookingSettingNo: number;
  capacity: number;
}

interface ChengduBookingSchedule {
  bookingSettingNo?: unknown;
  bookingTimeStart?: unknown;
  bookingTimeEnd?: unknown;
  isUse?: unknown;
  ableBookingCount?: unknown;
}

interface ChengduCalendarDate {
  yymmdd?: unknown;
  weekend?: unknown;
  publicHoliday?: unknown;
  consularHoliday?: unknown;
}

function formatOfficialTime(value: string): string | null {
  return /^\d{4}$/.test(value) ? `${value.slice(0, 2)}:${value.slice(2)}` : null;
}

export function parseChengduBookingSchedules(
  appointmentDate: string,
  payload: unknown,
): ChengduObservedSlot[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !Array.isArray(payload)) return [];
  return payload.flatMap((raw): ChengduObservedSlot[] => {
    const item = raw as ChengduBookingSchedule;
    const appointmentTime = formatOfficialTime(typeof item.bookingTimeStart === "string" ? item.bookingTimeStart : "");
    const appointmentEndTime = formatOfficialTime(typeof item.bookingTimeEnd === "string" ? item.bookingTimeEnd : "");
    const bookingSettingNo = typeof item.bookingSettingNo === "number" ? item.bookingSettingNo : Number.NaN;
    const capacity = typeof item.ableBookingCount === "number" ? item.ableBookingCount : 0;
    if (item.isUse !== "Y" || !appointmentTime || !appointmentEndTime || !Number.isFinite(bookingSettingNo) || capacity <= 0) {
      return [];
    }
    return [{ appointmentDate, appointmentTime, appointmentEndTime, bookingSettingNo, capacity }];
  });
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function chinaCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function chengduMinimumBookingDate(referenceTime: Date): string {
  const current = chinaCalendarDate(referenceTime);
  const cursor = new Date(`${current}T12:00:00.000Z`);
  let businessDays = 0;
  while (businessDays < 5) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) businessDays += 1;
  }
  return cursor.toISOString().slice(0, 10);
}

export function selectChengduBookableDates(
  payload: unknown,
  referenceTime: Date,
): string[] {
  if (!Array.isArray(payload)) return [];
  const minimumDate = chengduMinimumBookingDate(referenceTime);
  return payload.flatMap((raw): string[] => {
    const date = raw as ChengduCalendarDate;
    const appointmentDate = typeof date.yymmdd === "string" ? date.yymmdd.slice(0, 10) : "";
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)
      || appointmentDate < minimumDate
      || date.weekend === "Y"
      || date.publicHoliday === "Y"
      || date.consularHoliday === "Y"
    ) {
      return [];
    }
    return [appointmentDate];
  });
}

function monthBounds(month: Date) {
  const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const end = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1) - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function observeChengduAvailableSlots(
  page: Page,
  referenceTime = new Date(),
): Promise<ChengduObservedSlot[]> {
  const observed: ChengduObservedSlot[] = [];
  const bookableDates = new Set<string>();
  for (let monthOffset = 0; monthOffset < 3; monthOffset += 1) {
    const bounds = monthBounds(addMonths(referenceTime, monthOffset));
    const dates = await page.evaluate(async ({ start, end }) => {
      const response = await fetch(`https://be.koreavisa-cd.com/booking/CalendarDates?sDate=${encodeURIComponent(start)}&eDate=${encodeURIComponent(end)}`);
      if (!response.ok) throw new Error(`Chengdu official calendar returned HTTP ${response.status}.`);
      return await response.json();
    }, bounds);
    for (const appointmentDate of selectChengduBookableDates(dates, referenceTime)) {
      bookableDates.add(appointmentDate);
    }
  }
  const dates = [...bookableDates].sort();
  for (let offset = 0; offset < dates.length; offset += 5) {
    const batch = dates.slice(offset, offset + 5);
    const schedulesByDate = await page.evaluate(async (values) => Promise.all(values.map(async (value) => {
      const response = await fetch(`https://be.koreavisa-cd.com/booking/BookingSchedules?bDate=${encodeURIComponent(value)}`);
      if (!response.ok) throw new Error(`Chengdu official schedule returned HTTP ${response.status}.`);
      return { appointmentDate: value, schedules: await response.json() };
    })), batch);
    for (const result of schedulesByDate) {
      observed.push(...parseChengduBookingSchedules(result.appointmentDate, result.schedules));
    }
  }
  const unique = new Map(observed.map((slot) => [`${slot.appointmentDate}|${slot.appointmentTime}`, slot]));
  return [...unique.values()].sort((left, right) =>
    `${left.appointmentDate} ${left.appointmentTime}`.localeCompare(`${right.appointmentDate} ${right.appointmentTime}`),
  );
}
