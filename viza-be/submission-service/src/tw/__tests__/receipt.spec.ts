import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTwOfficialReceiptEvidence } from "../receipt.js";

test("tw.receipt: captures success page text plus an official application number as submit evidence", () => {
  const receipt = parseTwOfficialReceiptEvidence(
    "申請資料送出成功\n申請案號：TW20260801ABC123",
    "https://coa.immigration.gov.tw/coa-frontend/confirm",
    "2026-08-01T00:00:00.000Z",
  );

  assert.equal(receipt?.source, "official_success_page_with_application_number");
  assert.equal(receipt?.caseNumber, "TW20260801ABC123");
  assert.equal(receipt?.capturedAt, "2026-08-01T00:00:00.000Z");
  assert.match(receipt?.confirmationText ?? "", /送出成功/);
});

test("tw.receipt: rejects success text without an official application or receipt number", () => {
  assert.equal(parseTwOfficialReceiptEvidence(
    "您的申請已送出成功，請等待移民署審核。",
    "https://coa.immigration.gov.tw/coa-frontend/result",
    "2026-08-01T00:00:00.000Z",
  ), null);

  assert.equal(
    parseTwOfficialReceiptEvidence(
      "請輸入驗證碼。驗證碼不正確。",
      "https://coa.immigration.gov.tw/coa-frontend/apply",
    ),
    null,
  );
});

test("tw.receipt: rejects CAPTCHA disappearance or a number without success-page evidence", () => {
  assert.equal(parseTwOfficialReceiptEvidence(
    "系統處理中，請稍候。",
    "https://coa.immigration.gov.tw/coa-frontend/apply",
  ), null);

  assert.equal(parseTwOfficialReceiptEvidence(
    "申請案號：TW20260801ABC123",
    "https://coa.immigration.gov.tw/coa-frontend/apply",
  ), null);
});
