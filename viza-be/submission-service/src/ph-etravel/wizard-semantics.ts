export type PhEtravelWizardRoute = "regular_me" | "declaration" | "unknown";

export type PhEtravelPostSignatureSemantic =
  | "signature"
  | "family"
  | "no_companion_confirmation"
  | "summary";

export type PhEtravelPostSignatureEvidencePath =
  | "air_electronic_positive_family_live"
  | "sea_electronic_no_live"
  | "sea_electronic_positive_pending"
  | "unverified";

export type PhEtravelWizardPostSignatureGuard =
  | { status: "action_required"; code: string }
  | { status: "review_stop_only" };

/**
 * E15 proves that wizard_page is an array index. The route and visible
 * semantics, rather than any number in the query string, determine this gate.
 */
export function resolvePhEtravelWizardRoute(url: string): PhEtravelWizardRoute {
  try {
    const pathname = new URL(url, "https://etravel.gov.ph").pathname.replace(/\/+$/, "");
    if (pathname === "/wizard/me") return "regular_me";
    if (pathname === "/wizard/declaration") return "declaration";
  } catch {
    // Unknown routes are intentionally handled as action-required below.
  }
  return "unknown";
}

export function classifyPhEtravelPostSignatureSemantic(portalText: string): PhEtravelPostSignatureSemantic | null {
  if (/new travel declaration summary|kindly double check the information before submitting|travel declaration summary/i.test(portalText)) {
    return "summary";
  }
  if (/haven't selected any family members|not traveling with a companion|traveling with a companion/i.test(portalText)) {
    return "no_companion_confirmation";
  }
  if (/family member\(s\)|add family member|travel declarations will also be generated for the selected family members|no record found/i.test(portalText)) {
    return "family";
  }
  if (
    /customs declaration attachments and signature|for customs\s*-\s*declaration signature|declaration signature/i.test(portalText) &&
    /\bsignature\b/i.test(portalText) &&
    /\bclear\b/i.test(portalText)
  ) {
    return "signature";
  }
  return null;
}

function hasSeaElectronicNoSequence(previous: readonly PhEtravelPostSignatureSemantic[]): boolean {
  return previous.length === 3 &&
    previous[0] === "signature" &&
    previous[1] === "family" &&
    previous[2] === "no_companion_confirmation";
}

/**
 * This is an action-only contract. Even the E9 live-observed SEA electronic
 * No sequence never authorizes automated modal acceptance or final Submit.
 */
export function guardPhEtravelPostSignatureWizardStep(input: {
  route: PhEtravelWizardRoute;
  evidencePath: PhEtravelPostSignatureEvidencePath;
  semantic: PhEtravelPostSignatureSemantic;
  previous: readonly PhEtravelPostSignatureSemantic[];
}): PhEtravelWizardPostSignatureGuard {
  if (input.route === "unknown") {
    return { status: "action_required", code: "ph_etravel_wizard_route_unverified" };
  }
  if (input.semantic === "signature") {
    return { status: "action_required", code: "ph_etravel_signature_required" };
  }
  if (input.route === "declaration") {
    return { status: "action_required", code: "ph_etravel_wizard_route_sequence_unverified" };
  }
  if (input.evidencePath === "sea_electronic_positive_pending") {
    return { status: "action_required", code: "sea_electronic_positive_post_signature_evidence_pending" };
  }
  if (input.evidencePath === "air_electronic_positive_family_live") {
    // E45 observed Family after a user-provided signature. A resumed runner may
    // enter directly at Family without retaining pre-signature page history.
    if (input.semantic === "family" &&
      (input.previous.length === 0 || (input.previous.length === 1 && input.previous[0] === "signature"))) {
      return { status: "action_required", code: "ph_etravel_family_member_action_required" };
    }
    return { status: "action_required", code: "ph_etravel_post_signature_live_evidence_required" };
  }
  if (input.evidencePath !== "sea_electronic_no_live") {
    return { status: "action_required", code: "ph_etravel_post_signature_live_evidence_required" };
  }
  if (input.semantic === "family") {
    return input.previous.length === 1 && input.previous[0] === "signature"
      ? { status: "action_required", code: "ph_etravel_family_member_action_required" }
      : { status: "action_required", code: "ph_etravel_wizard_route_sequence_unverified" };
  }
  if (input.semantic === "no_companion_confirmation") {
    return input.previous.length === 2 && input.previous[0] === "signature" && input.previous[1] === "family"
      ? { status: "action_required", code: "ph_etravel_family_companion_confirmation" }
      : { status: "action_required", code: "ph_etravel_wizard_route_sequence_unverified" };
  }
  return hasSeaElectronicNoSequence(input.previous)
    ? { status: "review_stop_only" }
    : { status: "action_required", code: "ph_etravel_wizard_route_sequence_unverified" };
}
