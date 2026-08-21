import assert from "node:assert/strict";
import test from "node:test";
import { runJpVjwPortalSubmission } from "../runner";
import type { JpVjwPortalPayload } from "../normalize";

const payload: JpVjwPortalPayload = {
  applicationId: "jp-compliance-1",
  idempotencyKey: "jp-compliance-key",
  passportType: "Ordinary passport",
  surname: "ZHANG",
  givenNames: "SAN",
  emailAddress: "appl-test@viza.it.com",
  fullName: "ZHANG SAN",
  dateOfBirth: "1990-01-02",
  sex: "MALE",
  nationality: "CHN",
  passportNumber: "E12345678",
  passportExpiryDate: "2030-01-02",
  passportIssuingCountry: "China",
  phoneNumber: "+8613800000000",
  residenceCountry: "China",
  arrivalDate: "2026-09-10",
  portOfEntry: "NARITA",
  flightNumber: "NH900",
  lastEmbarkationCountry: "CHN",
  departureCityOrPort: "Shanghai",
  purposeOfVisit: "Tourism",
  plannedStayDays: 11,
  accommodationName: "Tokyo Hotel",
  accommodationAddress: "1 Tokyo Street",
  accommodationPostalCode: "100-0001",
  accommodationPhone: "+81312345678",
  immigrationAnswers: {
    hasBeenDeported: "no",
    hasCriminalRecord: "no",
    hasControlledSubstancesOrWeapons: "no",
    declarationConfirmed: "yes",
  },
  customsAnswers: {
    hasProhibitedOrRestrictedGoods: "no",
    hasDutiableGoods: "no",
    hasCommercialGoods: "no",
    hasGoodsForOtherPerson: "no",
    hasUnaccompaniedBaggage: "no",
    hasCashOrValuablesOverThreshold: "no",
    declarationConfirmed: "yes",
  },
  customsDeclaration: "no",
  immigrationDeclaration: "yes",
  finalDeclaration: "yes",
};

test("VJW compliance gate blocks live operation before adapter/browser/CAPTCHA", async () => {
  const previousLive = process.env.JP_VJW_LIVE_ENABLED;
  const previousApproval = process.env.JP_VJW_DELEGATED_OPERATION_APPROVED;
  process.env.JP_VJW_LIVE_ENABLED = "true";
  delete process.env.JP_VJW_DELEGATED_OPERATION_APPROVED;
  let adapterCalled = false;
  try {
    const result = await runJpVjwPortalSubmission(payload, {
      liveEnabled: true,
      adapter: {
        submit: async () => {
          adapterCalled = true;
          throw new Error("adapter must not be reached");
        },
      },
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.errorDetails?.code, "jp_vjw_delegated_operation_not_approved");
    assert.equal(adapterCalled, false);
  } finally {
    if (previousLive === undefined) delete process.env.JP_VJW_LIVE_ENABLED;
    else process.env.JP_VJW_LIVE_ENABLED = previousLive;
    if (previousApproval === undefined) delete process.env.JP_VJW_DELEGATED_OPERATION_APPROVED;
    else process.env.JP_VJW_DELEGATED_OPERATION_APPROVED = previousApproval;
  }
});
