import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTwOfficialTermsConsentAudit,
  parseTwOfficialTermsConsentAudit,
} from "../official-terms-consent.js";

const completeAudit = {
  version: "tw_official_terms_v1",
  entryPromptAccepted: true,
  termsModalAccepted: true,
  recordedAt: "2026-08-14T10:00:00.000Z",
  source: "viza_final_confirmation",
} as const;

describe("Taiwan official terms consent audit", () => {
  it("accepts only a complete, server-recorded two-part authorization", () => {
    assert.deepEqual(parseTwOfficialTermsConsentAudit(completeAudit), completeAudit);
    assert.doesNotThrow(() => assertTwOfficialTermsConsentAudit(completeAudit));
  });

  it("fails closed when either distinct authorization is absent", () => {
    assert.equal(
      parseTwOfficialTermsConsentAudit({ ...completeAudit, entryPromptAccepted: false }),
      null,
    );
    assert.equal(
      parseTwOfficialTermsConsentAudit({ ...completeAudit, termsModalAccepted: false }),
      null,
    );
    assert.throws(
      () => assertTwOfficialTermsConsentAudit({ ...completeAudit, termsModalAccepted: false }),
      /both official entry-prompt and terms-modal authorizations are required/,
    );
  });

  it("rejects unversioned or invalid audit timestamps", () => {
    assert.equal(parseTwOfficialTermsConsentAudit({ ...completeAudit, version: "legacy" }), null);
    assert.equal(parseTwOfficialTermsConsentAudit({ ...completeAudit, recordedAt: "invalid" }), null);
  });
});
