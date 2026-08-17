import assert from "node:assert/strict";
import test from "node:test";

import {
  consumePhEtravelFinalSubmitAuthorization,
  PH_ETRAVEL_FINAL_SUBMIT_ENABLED,
  type PhEtravelFinalSubmitAuthorization,
} from "../final-submit-gate";
import { isPhEtravelReviewSummaryText } from "../form-filler";

test("PH final Submit remains statically disabled even when Review/Summary exposes Submit", () => {
  assert.equal(PH_ETRAVEL_FINAL_SUBMIT_ENABLED, false);
  assert.equal(
    isPhEtravelReviewSummaryText("New Travel Declaration Summary Kindly double check the information before submitting. Submit"),
    true,
  );
  assert.deepEqual(consumePhEtravelFinalSubmitAuthorization({ finalSubmitEnabled: false }), {
    status: "blocked",
    code: "ph_etravel_final_submit_disabled",
  });
});

test("PH final Submit contract requires a valid single-use authorization", () => {
  const authorization: PhEtravelFinalSubmitAuthorization = {
    scope: "PH_ETRAVEL_ARRIVAL_CARD",
    authorizationId: "synthetic-auth-0001",
    singleUse: true,
  };
  assert.deepEqual(consumePhEtravelFinalSubmitAuthorization({ finalSubmitEnabled: true }), {
    status: "blocked",
    code: "ph_etravel_final_submit_authorization_required",
  });
  assert.deepEqual(consumePhEtravelFinalSubmitAuthorization({ finalSubmitEnabled: true, authorization }), {
    status: "authorized",
  });
  assert.deepEqual(consumePhEtravelFinalSubmitAuthorization({ finalSubmitEnabled: true, authorization }), {
    status: "blocked",
    code: "ph_etravel_final_submit_authorization_consumed",
  });
});
