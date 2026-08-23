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
  occupation: "Engineer",
  residenceCity: "Shanghai",
  arrivalDate: "2026-09-10",
  portOfEntry: "NARITA",
  arrivalAirline: "NH",
  flightNumber: "900",
  lastEmbarkationCountry: "CHN",
  departureCityOrPort: "Shanghai",
  purposeOfVisit: "Tourism",
  plannedStayDays: 11,
  accommodationName: "Tokyo Hotel",
  accommodationPrefecture: "TOKYO",
  accommodationCity: "CHIYODA KU",
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
    hasProhibitedGoods: "no",
    hasRestrictedGoods: "no",
    hasGoldOrGoldProducts: "no",
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

test("VJW adapter path reaches qr_ready only with official QR element evidence", async () => {
  const result = await runJpVjwPortalSubmission(payload, {
    liveEnabled: true,
    delegatedOperationApproved: true,
    adapter: {
      submit: async () => ({
        portalUrl: "https://www.vjw.digital.go.jp/main/#/vjwpic026",
        referenceNumber: null,
        submittedAt: "2026-08-23T00:00:00.000Z",
        qrArtifactPath: "C:/evidence/vjw-official-qr.png",
        bodyText: "入境审查及海关申报的QR码",
      }),
    },
  });

  assert.equal(result.status, "qr_ready");
  assert.equal(result.submitted, true);
  assert.equal(result.qrReady, true);
  assert.equal(result.artifacts?.qrCodes[0], "C:/evidence/vjw-official-qr.png");
});
