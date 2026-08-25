import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTwSubmissionAuthorizationAudit,
  parseTwSubmissionAuthorizationAudit,
} from "../submission-authorization.js";

const completeAudit = {
  version: "tw_submission_authorization_v1",
  applicantTruthDeclarationAccepted: true,
  electronicSubmissionAuthorized: true,
  officialFeeResponsibilityAccepted: true,
  recordedAt: "2026-08-25T10:00:00.000Z",
  source: "viza_final_confirmation",
} as const;

describe("Taiwan VIZA submission authorization audit", () => {
  it("accepts a complete, versioned final-confirmation audit", () => {
    assert.deepEqual(parseTwSubmissionAuthorizationAudit(completeAudit), completeAudit);
    assert.doesNotThrow(() => assertTwSubmissionAuthorizationAudit(completeAudit));
  });

  it("fails closed when any applicant authorization is absent", () => {
    for (const key of [
      "applicantTruthDeclarationAccepted",
      "electronicSubmissionAuthorized",
      "officialFeeResponsibilityAccepted",
    ] as const) {
      assert.equal(parseTwSubmissionAuthorizationAudit({ ...completeAudit, [key]: false }), null);
    }
    assert.throws(
      () => assertTwSubmissionAuthorizationAudit({
        ...completeAudit,
        electronicSubmissionAuthorized: false,
      }),
      /electronic submission authorization/,
    );
  });

  it("rejects invalid versions, timestamps, and sources", () => {
    assert.equal(parseTwSubmissionAuthorizationAudit({ ...completeAudit, version: "legacy" }), null);
    assert.equal(parseTwSubmissionAuthorizationAudit({ ...completeAudit, recordedAt: "invalid" }), null);
    assert.equal(parseTwSubmissionAuthorizationAudit({ ...completeAudit, source: "client_only" }), null);
  });
});
