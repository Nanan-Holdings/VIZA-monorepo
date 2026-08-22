import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CANADA_REPRESENTATIVE_PAGE,
  CANADA_TOURIST_APPLICATION_TYPE_PAGE,
  classifyCanadaPostPurposeRoute,
} from "../post-purpose.js";

test("CA post-purpose routing recognizes only the verified portal paths", () => {
  assert.equal(
    classifyCanadaPostPurposeRoute(
      "https://tr-rt.apps.cic.gc.ca/application-type/tourist?lang=en",
    ),
    "tourist_application_type",
  );
  assert.equal(
    classifyCanadaPostPurposeRoute(
      "https://tr-rt.apps.cic.gc.ca/representative?lang=en",
    ),
    "representative",
  );
  assert.equal(
    classifyCanadaPostPurposeRoute("https://tr-rt.apps.cic.gc.ca/purpose"),
    "other",
  );
  assert.equal(
    classifyCanadaPostPurposeRoute(
      "http://tr-rt.apps.cic.gc.ca/application-type/tourist",
    ),
    "other",
  );
  assert.equal(
    classifyCanadaPostPurposeRoute(
      "https://tr-rt.apps.cic.gc.ca.evil.example/representative",
    ),
    "other",
  );
  assert.equal(classifyCanadaPostPurposeRoute("not-a-url"), "other");
});

test("CA post-purpose selectors match the live application-type and representative controls", () => {
  assert.equal(CANADA_TOURIST_APPLICATION_TYPE_PAGE.continue, "#next_path");
  assert.equal(
    CANADA_REPRESENTATIVE_PAGE.applyingForSomeoneElseYes,
    "#hasRepresentative_radio-button-01-input",
  );
  assert.equal(
    CANADA_REPRESENTATIVE_PAGE.applyingForSomeoneElseNo,
    "#hasRepresentative_radio-button-02-input",
  );
});
