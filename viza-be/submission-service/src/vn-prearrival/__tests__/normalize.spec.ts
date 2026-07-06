import assert from "node:assert/strict";
import test from "node:test";
import type { SubmissionPayload } from "../../country-submissions/types";
import { evaluateVietnamPrearrivalSubmissionWindow } from "../date-window";
import {
  VnPrearrivalPortalValidationError,
  normalizeVnPrearrivalPortalPayload,
} from "../normalize";

function payload(overrides: Record<string, string> = {}): SubmissionPayload {
  return {
    payloadVersion: "2026-07-06",
    countryCode: "VN",
    visaType: "VN_PREARRIVAL_DECLARATION",
    applicationId: "app_vn_prearrival",
    dryRun: false,
    idempotencyKey: "test",
    personal: {},
    trip: {},
    metadata: {},
    countrySpecific: {
      official_free_acknowledgement: "true",
      prearrival_window_acknowledgement: "true",
      health_declaration_status: "inactive_no_routine_health_declaration",
      full_name: "NGUYEN VAN A",
      date_of_birth: "1990-01-02",
      sex: "male",
      nationality: "SINGAPORE",
      email_address: "traveller@example.com",
      phone_country_code: "+65",
      phone_number: "91234567",
      passport_number: "E1234567",
      passport_issue_date: "2024-01-01",
      passport_expiry_date: "2034-01-01",
      entry_permission_type: "e_visa",
      arrival_date: "2026-07-08",
      transport_mode: "air",
      flight_or_transport_number: "VN650",
      entry_port: "tan_son_nhat_int_airport",
      country_boarded: "SINGAPORE",
      purpose_of_entry: "tourism",
      address_in_vietnam: "1 Dong Khoi",
      province_city: "HO CHI MINH CITY",
      is_group_submission: "false",
      final_declaration: "true",
      ...overrides,
    },
  };
}

test("normalizes Vietnam Pre-Arrival portal payload without fallback", () => {
  const normalized = normalizeVnPrearrivalPortalPayload(payload());
  assert.equal(normalized.entryPort, "tan_son_nhat_int_airport");
  assert.equal(normalized.officialFreeAcknowledgement, true);
  assert.equal(normalized.isGroupSubmission, false);
});

test("rejects unsupported or missing Vietnam Pre-Arrival values with field list", () => {
  assert.throws(
    () => normalizeVnPrearrivalPortalPayload(payload({
      entry_port: "",
      is_group_submission: "true",
    })),
    (error) => {
      assert.ok(error instanceof VnPrearrivalPortalValidationError);
      assert.deepEqual([...error.missingFields].sort(), [
        "answers.entry_port",
        "answers.is_group_submission(v1_individual_only)",
      ].sort());
      return true;
    },
  );
});

test("evaluates Vietnam Pre-Arrival 72-hour submission window", () => {
  const now = new Date("2026-07-06T03:00:00.000Z");
  assert.equal(
    evaluateVietnamPrearrivalSubmissionWindow("2026-07-08", now).status,
    "open",
  );
  assert.equal(
    evaluateVietnamPrearrivalSubmissionWindow("2026-07-09", now).status,
    "scheduled",
  );
  assert.equal(
    evaluateVietnamPrearrivalSubmissionWindow("2026-07-05", now).status,
    "past",
  );
});
