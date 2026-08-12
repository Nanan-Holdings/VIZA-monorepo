import assert from "node:assert/strict";
import test from "node:test";
import { parseChengduBookingSchedules } from "./chengdu-slots";

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
