import { describe, expect, test } from "vitest";

import {
  getPhEtravelSharedIntegrationByGate,
  getPhEtravelSharedIntegrationForTarget,
  PH_ETRAVEL_SHARED_INTEGRATION_PACKAGE,
} from "../shared-integration";

describe("Philippines eTravel shared frontend integration package", () => {
  test("maps frozen shared result/status files to PH helper gates", () => {
    const statusStep = getPhEtravelSharedIntegrationForTarget(
      "SubmissionStatusStep"
    )[0];
    const result = getPhEtravelSharedIntegrationForTarget(
      "sharedSubmissionResult"
    );
    const failure = getPhEtravelSharedIntegrationForTarget("FailureCard")[0];
    const waiting = getPhEtravelSharedIntegrationForTarget("WaitingCard")[0];

    expect(statusStep.sharedFile).toContain("SubmissionStatusStep.tsx");
    expect(statusStep.helperToUse).toContain("classifyPhEtravelResultState");
    expect(statusStep.helperToUse).toContain(
      "createPhEtravelResultRecoveryPresentation"
    );
    expect(statusStep.requiredBehavior.join(" ")).toContain(
      "sea_electronic_signature_required"
    );
    expect(statusStep.forbiddenBehavior.join(" ")).toContain(
      "Review/Summary visibility"
    );
    expect(
      result.some((item) =>
        item.helperToUse.includes(
          "hasPhEtravelAuthoritativePostSubmitReference"
        )
      )
    ).toBe(true);
    expect(failure.helperToUse).toContain("phEtravelUserFacingError");
    expect(failure.forbiddenBehavior.join(" ")).toContain(
      "raw official/provider messages"
    );
    expect(waiting.helperToUse).toContain(
      "createPhEtravelScheduledPortalSummary"
    );
    expect(waiting.forbiddenBehavior.join(" ")).toContain("SG/ICA");
  });

  test("keeps PH dynamic form integration blocked on shared unfreeze", () => {
    const dynamicStep =
      getPhEtravelSharedIntegrationForTarget("dynamicStepForm")[0];
    const dynamicField =
      getPhEtravelSharedIntegrationForTarget("dynamicFormField")[0];

    expect(dynamicStep.releaseGate).toBe("shared_unfreeze_required");
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "AIR and SEA electronic Customs Yes structured UI"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "manual forms path and electronic customs/signature variant"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "signature -> Family Member(s)"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "runner phase gates"
    );
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelFormPresentation"
    );
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelOrderedPageContract"
    );
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelDynamicWizardContract"
    );
    expect(dynamicStep.helperToUse).toContain(
      "getPhEtravelEnabledApplicantCoverage"
    );
    expect(dynamicStep.helperToUse).toContain("getPhEtravelLaunchReadiness");
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelPreflightUserPresentation"
    );
    expect(dynamicStep.helperToUse).toContain("getPhEtravelPreflightReadiness");
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelProfilePresentation"
    );
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelAirDestinationPresentation"
    );
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelHealthPresentation"
    );
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelSeaDestinationPresentation"
    );
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelSeaPortOrderedPageContract"
    );
    expect(dynamicStep.helperToUse).toContain(
      "createPhEtravelAttachmentPresentation"
    );
    expect(dynamicStep.helperToUse).toContain(
      "applyPhEtravelOwnerNaNormalization"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "review/official-only gates"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "SEA electronic positive physical transfer"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "action-required signature canvas"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "E9 no-declaration evidence does not close"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain("Taiwan logic");
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "aggregate/free-text"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "all SEA is manual forms"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "SEA electronic No with positive General Declaration/Currency fields"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "model signature as a file upload question"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "disembarking_port_code"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "attachment count/aggregate or server limit"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "Owner N/A outside the conditional Currency Declaration page"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "reuse /wizard/declaration Family/Summary ordering"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "legacy result.qr_artifact alias"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "retry-submit action"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "versioned, deterministically sorted safe preflight envelope"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "deterministically sorted safe preflight envelope"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "E21 photo, mobile, and residence client contracts"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "photo size, camera mode, upload acceptance"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "E22 AIR/destination branches"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "Do not send air.is_special_flight"
    );
    expect(dynamicStep.requiredBehavior.join(" ")).toContain("E23 Health");
    expect(dynamicStep.requiredBehavior.join(" ")).toContain(
      "E24 SEA ARRIVAL disembarking/stay branch"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "vaccine/age inherited state"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "with_custom_declaration to a manual/electronic customs port flow"
    );
    expect(dynamicStep.forbiddenBehavior.join(" ")).toContain(
      "allowed preflight as submitted"
    );
    expect(dynamicField.forbiddenBehavior.join(" ")).toContain(
      "attachment upload"
    );
    expect(dynamicField.requiredBehavior.join(" ")).toContain("Owner N/A");
  });

  test("keeps final Submit reference QR behind official evidence", () => {
    const officialGates = getPhEtravelSharedIntegrationByGate(
      "official_evidence_required"
    );

    expect(officialGates).toHaveLength(1);
    expect(officialGates[0].entryCondition).toContain(
      "launch-ready submitted success"
    );
    expect(officialGates[0].requiredBehavior.join(" ")).toContain(
      "final Submit"
    );
    expect(officialGates[0].requiredBehavior.join(" ")).toContain("QR");
    expect(officialGates[0].forbiddenBehavior.join(" ")).toContain(
      "Review/Summary evidence"
    );
    expect(officialGates[0].forbiddenBehavior.join(" ")).toContain(
      "full automation"
    );
  });

  test("does not include package or shared dirty edits as executable work", () => {
    expect(
      PH_ETRAVEL_SHARED_INTEGRATION_PACKAGE.every(
        (item) => item.sharedFile !== "package.json"
      )
    ).toBe(true);
    expect(
      PH_ETRAVEL_SHARED_INTEGRATION_PACKAGE.every(
        (item) => item.entryCondition.length > 0
      )
    ).toBe(true);
    expect(
      PH_ETRAVEL_SHARED_INTEGRATION_PACKAGE.some((item) =>
        item.requiredBehavior
          .join(" ")
          .includes(
            "authoritative post-submit registration read supplies a stable reference_number"
          )
      )
    ).toBe(true);
  });
});
