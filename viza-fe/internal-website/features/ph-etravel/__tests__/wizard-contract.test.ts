import { describe, expect, test } from "vitest";

import {
  createPhEtravelDynamicWizardContract,
  reviewPhEtravelDynamicWizardObservation,
} from "../wizard-contract";

const stepIds = (
  input: Parameters<typeof createPhEtravelDynamicWizardContract>[0]
) => createPhEtravelDynamicWizardContract(input).steps.map((step) => step.id);

describe("Philippines eTravel dynamic wizard contract", () => {
  test("treats numeric wizard indexes as route-specific observation evidence", () => {
    const regular = createPhEtravelDynamicWizardContract({
      route: "regular_arrival",
      path: "sea_electronic_no",
      registrationIncomplete: true,
    });
    const short = createPhEtravelDynamicWizardContract({
      route: "declaration_short",
      path: "sea_electronic_no",
    });

    expect(regular.steps[0]).toMatchObject({
      id: "travel_details",
      evidenceTier: "live_observed",
      observedWizardIndex: 0,
    });
    expect(
      short.steps.every((step) => step.observedWizardIndex === undefined)
    ).toBe(true);
  });

  test("keeps regular Family flow separate from the short declaration route", () => {
    expect(
      stepIds({
        route: "regular_arrival",
        path: "sea_electronic_no",
        registrationIncomplete: true,
      })
    ).toEqual([
      "travel_details",
      "health_declaration",
      "customs_confirmation",
      "other_travel_details",
      "attachments_and_signature",
      "family_members",
      "companion_confirmation",
      "summary",
    ]);
    expect(
      stepIds({
        route: "declaration_short",
        path: "sea_electronic_no",
      })
    ).toEqual([
      "customs_confirmation",
      "other_travel_details",
      "attachments_and_signature",
      "summary",
    ]);
  });

  test("shows SEA Customs Yes post-signature continuation only as a static expectation", () => {
    const contract = createPhEtravelDynamicWizardContract({
      route: "regular_arrival",
      path: "sea_electronic_yes_through_signature",
      registrationIncomplete: true,
    });

    expect(contract.steps.map((step) => step.id).slice(-4)).toEqual([
      "attachments_and_signature",
      "family_members",
      "companion_confirmation",
      "summary",
    ]);
    expect(contract.steps.slice(-3).map((step) => step.evidenceTier)).toEqual([
      "static_bundle_expectation",
      "static_bundle_expectation",
      "static_bundle_expectation",
    ]);
    expect(contract.gates).toContainEqual(
      expect.objectContaining({
        key: "sea_positive_post_signature_live_review",
      })
    );
    expect(contract.signature).toEqual({
      control: "canvas",
      dataEncoding: "image/png data URL",
      actionOnly: true,
    });
  });

  test("routes drift, missing companion confirmation, and early Summary to review", () => {
    expect(
      reviewPhEtravelDynamicWizardObservation({
        route: "unknown",
        path: "sea_manual",
        observedStepIds: [],
      })
    ).toContainEqual(expect.objectContaining({ key: "unknown_wizard_route" }));

    const gates = reviewPhEtravelDynamicWizardObservation({
      route: "regular_arrival",
      path: "sea_electronic_no",
      registrationIncomplete: true,
      observedStepIds: ["travel_details", "summary"],
      noCompanionModalRequired: true,
      noCompanionModalSeen: false,
    });

    expect(gates.map((gate) => gate.key)).toEqual(
      expect.arrayContaining([
        "wizard_step_order_mismatch",
        "summary_appeared_early",
      ])
    );

    expect(
      reviewPhEtravelDynamicWizardObservation({
        route: "regular_arrival",
        path: "sea_electronic_no",
        registrationIncomplete: true,
        observedStepIds: [
          "travel_details",
          "health_declaration",
          "customs_confirmation",
          "other_travel_details",
          "attachments_and_signature",
          "family_members",
        ],
        noCompanionModalRequired: true,
        noCompanionModalSeen: false,
      })
    ).toContainEqual(
      expect.objectContaining({ key: "family_no_companion_modal_missing" })
    );
  });

  test("keeps signature, reference, and QR outside applicant answers and success", () => {
    const contract = createPhEtravelDynamicWizardContract({
      route: "regular_arrival",
      path: "air_positive",
    });

    expect(contract.submitted).toBe(false);
    expect(
      contract.steps.find((step) => step.id === "attachments_and_signature")
    ).toMatchObject({
      actionOnly: true,
    });
    expect(contract.resultFields.map((field) => field.key)).toEqual([
      "result.official_reference",
      "result.reference_qr_render",
    ]);
    expect(
      contract.resultFields.every((field) => field.mode === "result_only")
    ).toBe(true);
  });
});
