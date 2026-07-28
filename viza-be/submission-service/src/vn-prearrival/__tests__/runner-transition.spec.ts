import assert from "node:assert/strict";
import test from "node:test";
import { classifyVietnamPrearrivalTripTransitionFailure } from "../trip-transition";

test("classifies the official invalid E-Visa number response without cascading trip-field errors", () => {
  const failure = classifyVietnamPrearrivalTripTransitionFailure(`
    PASSENGER INFORMATION
    Number
    Invalid visa number
    Trip Information
  `);

  assert.equal(failure.code, "vn_prearrival_invalid_evisa_number");
  assert.match(failure.message, /9-digit numeric/i);
  assert.doesNotMatch(failure.message, /mode_of_travel|flight_number|accommodation_address/);
});

test("returns a focused transition error when the official page does not expose a known validation message", () => {
  const failure = classifyVietnamPrearrivalTripTransitionFailure("PASSENGER INFORMATION");

  assert.equal(failure.code, "vn_prearrival_trip_information_form_not_ready");
  assert.match(failure.portalSummary, /remained on Passenger Information/i);
});
