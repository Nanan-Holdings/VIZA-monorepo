import assert from "node:assert/strict";
import { test } from "node:test";
import { createDs160BranchPolicy, ds160MappingRepeatGroup, ds160MappingSources, ds160RepeatAnswers } from "../field-contract";

test("maps derived dates and aliases back to their seed branch and repeat group", () => {
  assert.deepEqual(ds160MappingSources("intended_arrival_date_day"), ["intended_arrival_date"]);
  assert.equal(ds160MappingRepeatGroup("social_media_provider__2"), "social_media");
  assert.equal(ds160MappingRepeatGroup("purpose_of_trip"), "trip_purpose");
});

test("inactive specific travel dates and dependent old nationality answers stay inactive", () => {
  const policy = createDs160BranchPolicy({
    has_specific_plans: "no", arrival_date: "2030-01-01", intended_arrival_date: "2030-03-01",
    other_nationality: "no", other_nationality_has_passport: "yes", other_nationality_passport_number: "stale",
  });
  assert.equal(policy.isMappingActive("arrival_date_day"), false);
  assert.equal(policy.isMappingActive("intended_arrival_date_day"), true);
  assert.equal(policy.isMappingActive("other_nationality_passport_number"), false);
  assert.equal(policy.values.other_nationality_has_passport, undefined);
});

test("selected specific travel dates activate their actual date controls", () => {
  const policy = createDs160BranchPolicy({ has_specific_plans: "yes" });
  assert.equal(policy.isMappingActive("arrival_date_day"), true);
  assert.equal(policy.isMappingActive("intended_arrival_date_day"), false);
});

test("legacy provider NONE and second-row aliases reach repeat fields without replacing canonical answers", () => {
  const rows = ds160RepeatAnswers({ social_media_platform: "EXISTING" }, {
    social_media_provider: "NONE", social_media_provider__2: "SECOND", social_media_identifier__2: "handle",
  });
  assert.equal(rows.social_media_platform, "EXISTING");
  assert.equal(rows.social_media_platform__2, "SECOND");
  assert.equal(rows.social_media_handle__2, "handle");
  assert.equal(ds160RepeatAnswers({}, { social_media_provider: "NONE" }).social_media_platform, "NONE");
  assert.equal(ds160RepeatAnswers({}, {}).social_media_platform, undefined);
});
