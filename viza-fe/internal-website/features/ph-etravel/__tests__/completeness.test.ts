import { describe, expect, test } from "vitest";

import {
  getPhEtravelCompletenessByOwner,
  getPhEtravelP0CompletenessGaps,
  PH_ETRAVEL_FORM_COMPLETENESS_MATRIX,
} from "../completeness";

describe("Philippines eTravel frontend form completeness audit", () => {
  test("keeps PH-only covered items focused on eligibility and status semantics", () => {
    const covered = getPhEtravelCompletenessByOwner("covered").map(
      (item) => item.label
    );

    expect(covered).toContain(
      "Ordinary passenger eligibility and unsupported identity diversion"
    );
    expect(covered).toContain(
      "Family Member(s) gate and no-companion confirmation"
    );
    expect(covered).toContain("Signature is path-specific");
    expect(covered).toContain(
      "SEA electronic post-signature Family/Summary boundary"
    );
    expect(covered).toContain("Review/Summary reached is not submitted");
    expect(covered).toContain(
      "Submitted candidate requires authoritative reference and derived QR consistency"
    );
  });

  test("marks dynamic form one-to-one field gaps as shared-unfreeze work", () => {
    const shared = getPhEtravelCompletenessByOwner("shared_unfreeze_required");
    const sharedLabels = shared.map((item) => item.label);

    expect(sharedLabels).toContain("AIR travel details one-to-one fields");
    expect(sharedLabels).toContain(
      "SEA vessel, voyage, date, and disembarking fields"
    );
    expect(sharedLabels).toContain("SEA destination branch gate");
    expect(sharedLabels).toContain("Health declaration fields");
    expect(sharedLabels).toContain(
      "Customs, baggage, goods, and currency structure"
    );
    expect(sharedLabels).toContain(
      "Positive AIR electronic customs/currency shared UI integration"
    );
    expect(
      shared.some((item) =>
        item.currentFrontendState.includes("voyage_number -> flight_number")
      )
    ).toBe(true);
    expect(
      shared.some((item) =>
        item.requiredNextStep.includes("official branch displays it")
      )
    ).toBe(true);
    expect(
      shared.some((item) =>
        item.currentFrontendState.includes("electronic signature variants")
      )
    ).toBe(true);
  });

  test("does not hide P0 gaps that need official evidence or shared result integration", () => {
    const p0Gaps = getPhEtravelP0CompletenessGaps();
    const labels = p0Gaps.map((item) => item.label);

    expect(labels).toContain(
      "SEA vessel, voyage, date, and disembarking fields"
    );
    expect(labels).toContain("Customs, baggage, goods, and currency structure");
    expect(labels).toContain(
      "Positive AIR electronic customs/currency shared UI integration"
    );
    expect(labels).toContain(
      "Remaining AIR customs/currency official evidence gaps"
    );
    expect(labels).toContain(
      "Final Submit, official reference, QR, and recovery page"
    );
    expect(p0Gaps.every((item) => item.owner !== "covered")).toBe(true);
  });

  test("moves AIR positive selectors to shared integration while preserving evidence gaps", () => {
    const shared = getPhEtravelCompletenessByOwner("shared_unfreeze_required");
    const evidence = getPhEtravelCompletenessByOwner(
      "official_evidence_required"
    );

    expect(
      shared.some(
        (item) =>
          item.label ===
            "Positive AIR electronic customs/currency shared UI integration" &&
          item.currentFrontendState.includes(
            "PH-A completed AIR positive selector evidence"
          )
      )
    ).toBe(true);
    expect(
      evidence.some(
        (item) =>
          item.label ===
            "Remaining AIR customs/currency official evidence gaps" &&
          item.currentFrontendState.includes("attachment requiredness") &&
          item.currentFrontendState.includes("Owner N/A stable selector") &&
          item.currentFrontendState.includes(
            "Other goods no-row page-level blocking"
          ) &&
          item.currentFrontendState.includes("complete option lists")
      )
    ).toBe(true);
  });

  test("tracks SEA electronic E9 as action-required rather than submitted success", () => {
    const covered = getPhEtravelCompletenessByOwner("covered");
    const seaElectronic = covered.find(
      (item) =>
        item.label === "SEA electronic post-signature Family/Summary boundary"
    );
    const signature = covered.find(
      (item) => item.label === "Signature is path-specific"
    );

    expect(seaElectronic?.currentFrontendState).toContain(
      "signature -> Family Member(s)"
    );
    expect(seaElectronic?.currentFrontendState).toContain("Summary");
    expect(seaElectronic?.requiredNextStep).toContain(
      "authoritative post-submit registration read"
    );
    expect(seaElectronic?.requiredNextStep).toContain("stable reference");
    expect(signature?.currentFrontendState).toContain(
      "SEA manual-forms reached Summary without signature"
    );
    expect(signature?.currentFrontendState).toContain(
      "SEA electronic no-declaration can stop at signature"
    );
  });

  test("keeps result artifacts out of applicant-form completeness", () => {
    const resultItems = PH_ETRAVEL_FORM_COMPLETENESS_MATRIX.filter(
      (item) => item.area === "result_success_gate"
    );

    expect(resultItems).toHaveLength(2);
    expect(
      resultItems.some((item) =>
        item.currentFrontendState.includes(
          "authoritative post-submit registration read"
        )
      )
    ).toBe(true);
    expect(
      resultItems.some((item) => item.currentFrontendState.includes("Review"))
    ).toBe(true);
    expect(resultItems.map((item) => item.label)).toContain(
      "Submitted candidate requires authoritative reference and derived QR consistency"
    );
  });
});
