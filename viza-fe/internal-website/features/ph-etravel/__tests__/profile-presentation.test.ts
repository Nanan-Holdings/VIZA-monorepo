import { describe, expect, test } from "vitest";

import { createPhEtravelProfilePresentation } from "../profile-presentation";

const keys = (input: ReturnType<typeof createPhEtravelProfilePresentation>) =>
  input.fields.map((field) => field.key);

describe("Philippines eTravel E21 profile presentation", () => {
  test("keeps Filipino and Foreigner passport holders isolated from the residence branch", () => {
    const filipinoForeignResidence = createPhEtravelProfilePresentation({
      passportHolderType: "FILIPINO",
      residenceCountryCode: "SG",
    });
    const foreignerPhilippineResidence = createPhEtravelProfilePresentation({
      passportHolderType: "FOREIGNER",
      residenceCountryCode: "PH",
    });

    expect(filipinoForeignResidence.residenceBranch).toBe("foreign");
    expect(keys(filipinoForeignResidence)).not.toContain(
      "residence.province_code"
    );
    expect(foreignerPhilippineResidence.residenceBranch).toBe("philippines");
    expect(keys(foreignerPhilippineResidence)).toEqual(
      expect.arrayContaining([
        "residence.region_code",
        "residence.province_code",
        "residence.municipality_code",
        "residence.barangay_code",
      ])
    );
  });

  test("records PH residence cascade clearing without treating it as server acceptance", () => {
    const presentation = createPhEtravelProfilePresentation({
      passportHolderType: "FILIPINO",
      residenceCountryCode: "PH",
    });

    expect(presentation.clearOnChange["residence.country_code"]).toEqual([
      "residence.region_code",
      "residence.province_code",
      "residence.municipality_code",
      "residence.barangay_code",
      "residence.address_line1",
      "residence.address_line2",
    ]);
    expect(presentation.clearOnChange["residence.province_code"]).toEqual([
      "residence.municipality_code",
      "residence.barangay_code",
    ]);
    expect(presentation.clearOnChange["residence.municipality_code"]).toEqual([
      "residence.barangay_code",
    ]);
    expect(
      presentation.fields.every(
        (field) =>
          field.clientContract === "verified_public_bundle" &&
          field.serverEvidence === "needs_review" &&
          field.mode === "profile_or_review_gate"
      )
    ).toBe(true);
  });

  test("does not turn photo or mobile client wiring into an upload or acceptance promise", () => {
    const presentation = createPhEtravelProfilePresentation({
      passportHolderType: "FOREIGNER",
    });
    const photo = presentation.fields.find(
      (field) => field.key === "profile.photo_url"
    );
    const mobile = presentation.fields.find(
      (field) => field.key === "traveller.mobile_number"
    );

    expect(photo?.liveServerUnknown).toMatch(/size|server acceptance/i);
    expect(photo?.clientKnown).not.toMatch(/5\s*MB/i);
    expect(mobile?.liveServerUnknown).toMatch(
      /requiredness|server acceptance/i
    );
    expect(mobile?.clientKnown).toContain("Philippines preset");
  });

  test("keeps profile save separate from registration final Submit and non-launching", () => {
    const presentation = createPhEtravelProfilePresentation({
      passportHolderType: "FILIPINO",
      residenceCountryCode: "PH",
    });

    expect(presentation.gate).toMatchObject({
      authorization: "profile_save_checkpoint",
      checkpoint: "profile_review_ready",
      submitAction: "profile_save_submit",
      successStage: "profile_saved_dashboard",
      registrationStopBeforeSubmitTarget: "final_submit",
      requiresOfficialWriteAuthorization: true,
      isRegistrationFinalSubmit: false,
      submitted: false,
      noQueue: true,
      noBrowser: true,
      noResubmit: true,
    });
    expect(JSON.stringify(presentation.gate)).not.toMatch(
      /5\s*MB|accepted|upload/i
    );
  });
});
