import {
  createPhEtravelOrderedPageContract,
  type PhEtravelOrderedPage,
  type PhEtravelOrderedPageContract,
  type PhEtravelOrderedPath,
} from "./page-contract";

export type PhEtravelWizardRoute = "regular_arrival" | "declaration_short";
export type PhEtravelWizardEvidenceTier =
  "live_observed" | "static_bundle_expectation" | "official_review_required";

export type PhEtravelDynamicWizardStep = {
  id: string;
  officialTitle: string;
  evidenceTier: PhEtravelWizardEvidenceTier;
  observedWizardIndex?: number;
  actionOnly: boolean;
};

export type PhEtravelDynamicWizardGate = {
  key:
    | "unknown_wizard_route"
    | "wizard_step_order_mismatch"
    | "family_no_companion_modal_missing"
    | "summary_appeared_early"
    | "sea_positive_post_signature_live_review";
  reason: string;
};

export type PhEtravelDynamicWizardContract = {
  route: PhEtravelWizardRoute;
  path: PhEtravelOrderedPath;
  steps: PhEtravelDynamicWizardStep[];
  gates: PhEtravelDynamicWizardGate[];
  resultFields: PhEtravelOrderedPageContract["resultFields"];
  signature: {
    control: "canvas";
    dataEncoding: "image/png data URL";
    actionOnly: true;
  };
  submitted: false;
};

const LIVE_OBSERVED_PATHS = new Set<PhEtravelOrderedPath>([
  "air_positive",
  "sea_manual",
  "sea_electronic_no",
]);

function evidenceTierForPage(
  path: PhEtravelOrderedPath,
  page: PhEtravelOrderedPage
): PhEtravelWizardEvidenceTier {
  if (page.evidence === "official_evidence_required")
    return "official_review_required";
  return LIVE_OBSERVED_PATHS.has(path)
    ? "live_observed"
    : "static_bundle_expectation";
}

function stepFromPage(
  path: PhEtravelOrderedPath,
  page: PhEtravelOrderedPage
): PhEtravelDynamicWizardStep {
  return {
    id: page.id,
    officialTitle: page.officialTitle,
    evidenceTier: evidenceTierForPage(path, page),
    observedWizardIndex: page.wizardPage,
    actionOnly:
      page.actionOnlyGates.length > 0 ||
      page.id === "attachments_and_signature" ||
      page.id === "family_members" ||
      page.id === "companion_confirmation" ||
      page.id === "summary",
  };
}

function staticActionStep(
  id: string,
  officialTitle: string
): PhEtravelDynamicWizardStep {
  return {
    id,
    officialTitle,
    evidenceTier: "static_bundle_expectation",
    actionOnly: true,
  };
}

function regularSteps(
  path: PhEtravelOrderedPath,
  registrationIncomplete: boolean | null | undefined
) {
  const baseSteps = createPhEtravelOrderedPageContract(path).pages.map((page) =>
    stepFromPage(path, page)
  );
  if (path === "sea_electronic_yes_through_signature") {
    const throughSignature = baseSteps.filter(
      (step) => step.id !== "post_signature_positive_unobserved"
    );
    const afterSignature =
      registrationIncomplete === false
        ? [staticActionStep("summary", "New Travel Declaration Summary")]
        : [
            staticActionStep("family_members", "Family Member(s)"),
            staticActionStep(
              "companion_confirmation",
              "No companion confirmation"
            ),
            staticActionStep("summary", "New Travel Declaration Summary"),
          ];
    return [...throughSignature, ...afterSignature];
  }

  if (registrationIncomplete !== false) return baseSteps;
  return baseSteps.filter(
    (step) =>
      step.id !== "family_members" && step.id !== "companion_confirmation"
  );
}

function shortDeclarationSteps(
  path: PhEtravelOrderedPath
): PhEtravelDynamicWizardStep[] {
  const pages = createPhEtravelOrderedPageContract(path).pages;
  const customsPageIds = new Set([
    "customs_confirmation",
    "other_travel_details",
    "customs_general_declaration",
    "currency_declaration",
    "attachments_and_signature",
  ]);
  const steps = pages
    .filter((page) => customsPageIds.has(page.id))
    .map((page) => ({
      ...stepFromPage(path, page),
      evidenceTier: "static_bundle_expectation" as const,
      observedWizardIndex: undefined,
    }));

  return [
    ...steps,
    {
      id: "summary",
      officialTitle: "New Travel Declaration Summary",
      evidenceTier: "static_bundle_expectation",
      actionOnly: true,
    },
  ];
}

export function createPhEtravelDynamicWizardContract(input: {
  route: PhEtravelWizardRoute;
  path: PhEtravelOrderedPath;
  registrationIncomplete?: boolean | null;
}): PhEtravelDynamicWizardContract {
  const steps =
    input.route === "regular_arrival"
      ? regularSteps(input.path, input.registrationIncomplete)
      : shortDeclarationSteps(input.path);
  const gates: PhEtravelDynamicWizardGate[] = [];

  if (input.path === "sea_electronic_yes_through_signature") {
    gates.push({
      key: "sea_positive_post_signature_live_review",
      reason:
        "Family, no-companion confirmation, and Summary after SEA Customs Yes signature are static regular-wizard expectations only; live continuation remains blocked.",
    });
  }

  return {
    route: input.route,
    path: input.path,
    steps,
    gates,
    resultFields: createPhEtravelOrderedPageContract(input.path).resultFields,
    signature: {
      control: "canvas",
      dataEncoding: "image/png data URL",
      actionOnly: true,
    },
    submitted: false,
  };
}

export function reviewPhEtravelDynamicWizardObservation(input: {
  route: PhEtravelWizardRoute | "unknown";
  path: PhEtravelOrderedPath;
  registrationIncomplete?: boolean | null;
  observedStepIds: readonly string[];
  noCompanionModalRequired?: boolean;
  noCompanionModalSeen?: boolean;
}): PhEtravelDynamicWizardGate[] {
  if (input.route === "unknown") {
    return [
      {
        key: "unknown_wizard_route",
        reason:
          "The official wizard route is not recognized. Do not reuse a regular or short-route page sequence.",
      },
    ];
  }

  const expected = createPhEtravelDynamicWizardContract({
    route: input.route,
    path: input.path,
    registrationIncomplete: input.registrationIncomplete,
  }).steps.map((step) => step.id);
  const gates: PhEtravelDynamicWizardGate[] = [];
  const expectedPrefix = expected.slice(0, input.observedStepIds.length);
  if (
    input.observedStepIds.some((step, index) => step !== expectedPrefix[index])
  ) {
    gates.push({
      key: "wizard_step_order_mismatch",
      reason:
        "The observed wizard step sequence differs from the route-specific semantic contract. Stop and request review.",
    });
  }

  const summaryIndex = input.observedStepIds.indexOf("summary");
  if (summaryIndex >= 0 && summaryIndex < expected.length - 1) {
    gates.push({
      key: "summary_appeared_early",
      reason:
        "Summary appeared before the expected route-specific sequence completed. It is review-only and never submitted success.",
    });
  }

  if (
    input.noCompanionModalRequired &&
    input.observedStepIds.includes("family_members") &&
    !input.noCompanionModalSeen
  ) {
    gates.push({
      key: "family_no_companion_modal_missing",
      reason:
        "The regular wizard Family step requires the no-companion modal before proceeding with no selected family member. Stop for review.",
    });
  }

  return gates;
}
