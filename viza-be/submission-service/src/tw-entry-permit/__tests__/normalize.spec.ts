import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTaiwanEntryPermitPortalPayload, TaiwanEntryPermitValidationError } from "../normalize";

const payload = () => ({ payloadVersion: "test", countryCode: "TW", visaType: "TW_OVERSEAS_CN_TOURISM_ENTRY_PERMIT", applicationId: "tw-test", dryRun: false, idempotencyKey: "test", personal: {}, trip: {}, metadata: {}, countrySpecific: {
  alias_email_address: "appl-test@haggstorm.com", real_email_address: "user@example.com", eligibility_route: "work_one_year", permit_type: "single", passport_number: "E12345678", passport_expiry_date: "2030-12-31", surname: "ZHANG", given_names: "SAN", chinese_name: "张三", date_of_birth: "1990-01-01", gender: "male", singapore_residence_pass_number: "EP123", singapore_residence_expiry_date: "2030-12-31", phone_country_code: "+65", phone_number: "81234567", intended_arrival_date: "2027-01-01", intended_departure_date: "2027-01-10", taiwan_accommodation_address: "Taipei", official_declaration: "true",
} });

test("normalizes the Taiwan overseas-China entry permit payload", () => {
  const output = normalizeTaiwanEntryPermitPortalPayload(payload());
  assert.equal(output.aliasEmailAddress, "appl-test@haggstorm.com");
  assert.equal(output.permitType, "single");
});
test("rejects an unsigned Taiwan entry permit payload", () => {
  const input = payload(); input.countrySpecific.official_declaration = "false";
  assert.throws(() => normalizeTaiwanEntryPermitPortalPayload(input), TaiwanEntryPermitValidationError);
});
