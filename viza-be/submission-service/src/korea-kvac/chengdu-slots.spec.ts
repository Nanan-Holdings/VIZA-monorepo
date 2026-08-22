import assert from "node:assert/strict";
import test from "node:test";
import {
  chengduCalendarMonthBounds,
  chengduMinimumBookingDate,
  parseChengduBookingSchedules,
  selectChengduBookableDates,
} from "./chengdu-slots";

test("keeps only Chengdu schedules that the official API marks usable with capacity", () => {
  assert.deepEqual(parseChengduBookingSchedules("2026-08-20", [
    { bookingSettingNo: 1, bookingTimeStart: "0900", bookingTimeEnd: "0930", isUse: "Y", ableBookingCount: 1 },
    { bookingSettingNo: 2, bookingTimeStart: "0930", bookingTimeEnd: "1000", isUse: "N", ableBookingCount: 2 },
    { bookingSettingNo: 3, bookingTimeStart: "1000", bookingTimeEnd: "1030", isUse: "Y", ableBookingCount: 0 },
  ]), [{
    appointmentDate: "2026-08-20",
    appointmentTime: "09:00",
    appointmentEndTime: "09:30",
    bookingSettingNo: 1,
    capacity: 1,
  }]);
});

test("matches the official Chengdu five-business-day booking boundary", () => {
  const referenceTime = new Date("2026-08-13T14:00:00.000Z");
  assert.equal(chengduMinimumBookingDate(referenceTime), "2026-08-20");
  assert.deepEqual(selectChengduBookableDates([
    { yymmdd: "2026-08-19T00:00:00", weekend: "N", publicHoliday: "N", consularHoliday: "N" },
    { yymmdd: "2026-08-20T00:00:00", weekend: "N", publicHoliday: "N", consularHoliday: "N" },
    { yymmdd: "2026-08-21T00:00:00", weekend: "N", publicHoliday: "Y", consularHoliday: "N" },
    { yymmdd: "2026-08-22T00:00:00", weekend: "Y", publicHoliday: "N", consularHoliday: "N" },
    { yymmdd: "2026-08-24T00:00:00", weekend: "N", publicHoliday: "N", consularHoliday: "N" },
  ], referenceTime), ["2026-08-20", "2026-08-24"]);
});

test("queries complete Chengdu calendar months in China Standard Time", () => {
  assert.deepEqual(chengduCalendarMonthBounds(new Date("2026-08-13T14:00:00.000Z")), {
    start: "2026-07-31T16:00:00.000Z",
    end: "2026-08-31T15:59:59.999Z",
  });
});
