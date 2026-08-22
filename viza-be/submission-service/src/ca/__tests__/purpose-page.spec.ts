import assert from "node:assert/strict";
import { test } from "node:test";
import type { Page } from "@playwright/test";
import {
  CANADA_PURPOSE_PAGE,
  buildCanadaPurposePlan,
  fillCanadaPurposePage,
  parseCanadaIsoDate,
} from "../purpose-page.js";

test("CA purpose radio labels target the verified Angular input ids", () => {
  assert.equal(
    CANADA_PURPOSE_PAGE.visitorVisaLabel,
    'label[for="applyingFor_radio-button-464-input"]',
  );
  assert.equal(
    CANADA_PURPOSE_PAGE.touristPurposeLabel,
    'label[for="visaPurpose_radio-button-470-input"]',
  );
});

test("CA purpose plan reports the exact missing portal inputs", () => {
  assert.deepEqual(buildCanadaPurposePlan({}), {
    ready: false,
    missingFields: ["visit_details", "intended_stay_from", "intended_stay_to"],
    invalidFields: [],
  });
});

test("CA purpose plan never normalizes invalid or impossible dates", () => {
  assert.equal(parseCanadaIsoDate("2026-02-30"), null);
  assert.equal(parseCanadaIsoDate("18/08/2026"), null);
  assert.deepEqual(parseCanadaIsoDate("2026-08-18"), {
    year: "2026",
    month: "08",
    day: "18",
  });
});

test("CA purpose plan distinguishes malformed values from missing values", () => {
  assert.deepEqual(
    buildCanadaPurposePlan({
      visit_details: "Tourism",
      intended_stay_from: "2026-02-30",
      intended_stay_to: "2026-10-15",
    }),
    { ready: false, missingFields: [], invalidFields: ["intended_stay_from"] },
  );
});

test("CA purpose plan rejects a departure before arrival", () => {
  assert.deepEqual(
    buildCanadaPurposePlan({
      visit_details: "Tourism",
      intended_stay_from: "2027-01-08",
      intended_stay_to: "2026-12-29",
    }),
    {
      ready: false,
      missingFields: [],
      invalidFields: ["intended_stay_to"],
    },
  );
});

test("CA purpose plan preserves applicant narrative and optional UCI", () => {
  const result = buildCanadaPurposePlan({
    visit_details: "Visit Banff from 10 to 15 October.",
    intended_stay_from: "2026-10-10",
    intended_stay_to: "2026-10-15",
    uci: "1234-5678",
  });
  assert.equal(result.ready, true);
  if (!result.ready) return;
  assert.equal(result.plan.visitDetails, "Visit Banff from 10 to 15 October.");
  assert.equal(result.plan.uci, "1234-5678");
});

test("CA purpose flow refuses a mirrored form before reading selectors or entering PII", async () => {
  let locatorTouched = false;
  const mirroredPage = {
    url: () => "https://tr-rt.apps.cic.gc.ca.evil.example/purpose",
    locator: () => {
      locatorTouched = true;
      throw new Error("mirrored selector must not be touched");
    },
  } as unknown as Page;

  const result = await fillCanadaPurposePage({
    page: mirroredPage,
    answers: {
      visit_details: "Tourism",
      intended_stay_from: "2026-10-10",
      intended_stay_to: "2026-10-15",
      uci: "1234-5678",
    },
    advance: true,
  });
  assert.deepEqual(result, {
    checkpoint: "unexpected_redirect",
    detail: "untrusted_destination:[redacted-url]",
  });
  assert.equal(locatorTouched, false);
});
