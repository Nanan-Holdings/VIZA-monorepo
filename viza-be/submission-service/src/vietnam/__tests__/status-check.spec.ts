import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVietnamOfficialStatus, toVietnamDob } from "../status-check";

test("vn.status-check: formats DOB for official search", () => {
  assert.equal(toVietnamDob("1997-04-23"), "23/04/1997");
  assert.equal(toVietnamDob("3/4/1997"), "03/04/1997");
});

test("vn.status-check: parses approved status", () => {
  const result = parseVietnamOfficialStatus(`
    Full name: TEST USER
    Registration code: E260101ABC123
    Passport number: P1234567
    Application status: Granted
    Visa number: EVN123456
    Click here Download print visa
  `);
  assert.equal(result.status, "approved");
  assert.equal(result.passportNumber, "P1234567");
  assert.equal(result.visaNumber, "EVN123456");
  assert.equal(result.downloadAvailable, true);
});

test("vn.status-check: maps Acceptance and Get e-Visa from the current portal", () => {
  const result = parseVietnamOfficialStatus(`
    Application status: Acceptance
    Visa number: 999999999
    Allowed to enter Viet Nam from 24/07/2026 to Date 27/07/2026
    Get e-Visa
  `);
  assert.equal(result.status, "approved");
  assert.equal(result.visaNumber, "999999999");
  assert.equal(result.downloadAvailable, true);
});

test("vn.status-check: parses processing and correction statuses", () => {
  assert.equal(parseVietnamOfficialStatus("Application status: Processing").status, "processing");
  assert.equal(parseVietnamOfficialStatus("Application status: Amended Application Click here Edit").status, "needs_correction");
});

test("vn.status-check: parses denial reason", () => {
  const result = parseVietnamOfficialStatus("Application status: Denied\nDenied Reason: invalid portrait photo");
  assert.equal(result.status, "rejected");
  assert.equal(result.deniedReason, "invalid portrait photo");
});

test("vn.status-check: parses Vietnamese portal copy and payment status", () => {
  assert.equal(
    parseVietnamOfficialStatus("Trạng thái hồ sơ: Đang xử lý").status,
    "processing",
  );
  assert.equal(
    parseVietnamOfficialStatus("Application status: Payment required").status,
    "payment_required",
  );
  assert.equal(
    parseVietnamOfficialStatus("Portal maintenance notice").status,
    "unknown",
  );
});
