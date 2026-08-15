export type PhEtravelCompletenessOwner =
  | "covered"
  | "ph_only_ready"
  | "shared_unfreeze_required"
  | "official_evidence_required";

export type PhEtravelCompletenessSeverity = "P0" | "P1" | "P2";

export type PhEtravelCompletenessArea =
  | "eligibility"
  | "travel_registration"
  | "residence"
  | "air_travel_details"
  | "sea_travel_details"
  | "destination"
  | "health"
  | "customs_currency"
  | "family_gate"
  | "signature"
  | "sea_electronic_post_signature"
  | "review_status"
  | "result_success_gate";

export type PhEtravelCompletenessItem = {
  area: PhEtravelCompletenessArea;
  owner: PhEtravelCompletenessOwner;
  severity: PhEtravelCompletenessSeverity;
  label: string;
  currentFrontendState: string;
  requiredNextStep: string;
};

export const PH_ETRAVEL_FORM_COMPLETENESS_MATRIX: PhEtravelCompletenessItem[] =
  [
    {
      area: "eligibility",
      owner: "covered",
      severity: "P0",
      label:
        "Ordinary passenger eligibility and unsupported identity diversion",
      currentFrontendState:
        "PH eligibility page diverts crew, cruise, special registration, diplomats, 9(e), and diplomatic/official/service passports before the ordinary form.",
      requiredNextStep:
        "Keep unsupported identities outside PH_ETRAVEL_ARRIVAL_CARD; do not submit them through ordinary passenger answers.",
    },
    {
      area: "travel_registration",
      owner: "shared_unfreeze_required",
      severity: "P0",
      label: "Arrival-only Travel Registration and consent gate",
      currentFrontendState:
        "The PH-only Travel Registration contract locks PH_ETRAVEL_ARRIVAL_CARD to ARRIVAL, preserves FOR_ME/FOR_OTHER and AIR/SEA official values, and requires a separate versioned privacy-and-affidavit consent audit before enqueue. Consent is explicitly excluded from the official answer projection.",
      requiredNextStep:
        "Shared dynamic form must render ARRIVAL as a locked value, never expose DEPARTURE, persist the consent audit through an authenticated server boundary, use its missing-field anchor in completeness, and block enqueue until all Travel Registration gates pass.",
    },
    {
      area: "residence",
      owner: "shared_unfreeze_required",
      severity: "P0",
      label: "Philippine permanent-residence official cascade",
      currentFrontendState:
        "PH-only residence helpers parse the current official State/Province, City/Municipality, and Barangay responses, preserve exact official codes, clear descendants on parent changes, and return clickable missing-field targets. The shared dynamic form and same-origin official-options proxy are not connected yet.",
      requiredNextStep:
        "Add the four residence fields to the PH schema, proxy the three verified read-only official endpoints, and consume the PH-only cascade helper in dynamic-step-form without deriving codes from labels. Keep non-PH residence as country plus address line 1 and optional line 2.",
    },
    {
      area: "air_travel_details",
      owner: "shared_unfreeze_required",
      severity: "P0",
      label: "AIR travel details one-to-one fields",
      currentFrontendState:
        "PH-only helpers do not render dynamic AIR fields; shared dynamic form owns purpose, airline, flight, origin, transit, destination, baggage, and conditional branches.",
      requiredNextStep:
        "After shared dynamic form is clean, verify AIR fields map to official keys without adding Taiwan-derived fields.",
    },
    {
      area: "sea_travel_details",
      owner: "shared_unfreeze_required",
      severity: "P0",
      label: "SEA vessel, voyage, date, and disembarking fields",
      currentFrontendState:
        "PH helpers document SEA alias rules and path-specific copy, including manual-forms and electronic signature variants, but the applicant form still needs shared dynamic form support for vessel_name, voyage_number -> flight_number, voyage dates -> departure_date/arrival_date, is_disembarking where shown, destination_port_code, and disembarking_port_code.",
      requiredNextStep:
        "Expose SEA-only fields and branch by official page content from the PH field contract once shared form files are available; do not treat crew as an ordinary passenger path.",
    },
    {
      area: "destination",
      owner: "shared_unfreeze_required",
      severity: "P0",
      label: "SEA destination branch gate",
      currentFrontendState:
        "PH-only copy states SEA destination is path-specific: one disembarking path shows Residence/Hotel/Port when is_disembarking=true, while the electronic variant did not show stay UI before Health. Actual conditional rendering is in shared dynamic form.",
      requiredNextStep:
        "Gate stay_location_type by AIR or SEA is_disembarking=true when the official branch displays it; never leak AIR TRANSIT into SEA, and use TRAVEL_PORT -> disembarking_port_code for SEA Port.",
    },
    {
      area: "health",
      owner: "shared_unfreeze_required",
      severity: "P1",
      label: "Health declaration fields",
      currentFrontendState:
        "PH-only helpers do not render health controls. Contract maps recent travel, visited countries, exposure, sick-in-30-days, and symptoms; negative antigen and animal exposure remain needs_review.",
      requiredNextStep:
        "Shared dynamic form should render only contract-backed PH health fields and leave unverified branches gated.",
    },
    {
      area: "customs_currency",
      owner: "shared_unfreeze_required",
      severity: "P0",
      label: "Customs, baggage, goods, and currency structure",
      currentFrontendState:
        "PH-only status can show SEA manual customs action-required and SEA electronic signature action-required. AIR positive customs/currency selectors and SEA electronic no-declaration flow are now live-observed, but shared dynamic form is frozen and runner implementation remains phased.",
      requiredNextStep:
        "After shared dynamic form is clean, render structured 12-item checklist, goods modal/table fields, currency item/source/purpose/transfer groups, plus SEA manual/electronic branches; keep positive branches action-required until runner phase gates pass.",
    },
    {
      area: "family_gate",
      owner: "covered",
      severity: "P0",
      label: "Family Member(s) gate and no-companion confirmation",
      currentFrontendState:
        "PH status helpers express family_gate and companion_confirmation as action-required, not submitted; eligibility copy says each family member generates a separate declaration.",
      requiredNextStep:
        "Shared form must not fake selected family members with counts; family profile selection remains separate until implemented.",
    },
    {
      area: "signature",
      owner: "covered",
      severity: "P0",
      label: "Signature is path-specific",
      currentFrontendState:
        "PH status copy treats signature_required and sea_electronic_signature_required as path-specific stops. SEA manual-forms reached Summary without signature; SEA electronic no-declaration can stop at signature before Family Member(s), no-companion confirmation, and Summary.",
      requiredNextStep:
        "Shared documents/form UI must not require customs_signature_file or universal SEA signature; use signature pad only where the official signature page appears.",
    },
    {
      area: "sea_electronic_post_signature",
      owner: "covered",
      severity: "P0",
      label: "SEA electronic post-signature Family/Summary boundary",
      currentFrontendState:
        "PH-A E9 confirms the SEA electronic no-declaration path goes signature -> Family Member(s) -> no-companion confirmation when no family is selected -> Summary. PH status copy keeps this action-required and not submitted.",
      requiredNextStep:
        "Shared result/status integration must preserve this as Review-reached/action-required until final Submit and an authoritative post-submit registration read with a stable reference are observed.",
    },
    {
      area: "review_status",
      owner: "covered",
      severity: "P0",
      label: "Review/Summary reached is not submitted",
      currentFrontendState:
        "PH status helpers classify review_reached_not_submitted, stopped-before-submit, family gate, companion confirmation, and SEA manual customs as action-required.",
      requiredNextStep:
        "Shared result/status cards must call PH helpers before displaying success.",
    },
    {
      area: "result_success_gate",
      owner: "covered",
      severity: "P0",
      label:
        "Submitted candidate requires authoritative reference and derived QR consistency",
      currentFrontendState:
        "PH result helpers require an authoritative post-submit registration read with a stable reference number. The QR is rendered from that reference, and missing, failed, or inconsistent rendering becomes recovery-required rather than success.",
      requiredNextStep:
        "Shared result card integration remains frozen; when clean, wire the recovery helper so HTTP 200, navigation, Summary, Submit visibility, or local reference/QR values never show success or trigger re-submit.",
    },
    {
      area: "customs_currency",
      owner: "shared_unfreeze_required",
      severity: "P0",
      label: "Positive AIR electronic customs/currency shared UI integration",
      currentFrontendState:
        "PH-A completed AIR positive selector evidence for page order, checklist selectors, goods/currency modals, source/purpose arrays, and courier branch validation. PH frontend still cannot render the full branch while shared dynamic form files are frozen.",
      requiredNextStep:
        "Implement shared dynamic form integration later without claiming complete automation; coordinate with runner phase gates for autofill and validation.",
    },
    {
      area: "customs_currency",
      owner: "official_evidence_required",
      severity: "P0",
      label: "Remaining AIR customs/currency official evidence gaps",
      currentFrontendState:
        "AIR positive selector evidence is complete enough for shared UI planning, but attachment requiredness/file input, Owner N/A stable selector, owner/recipient full requiredness, physical branch empty validation, Other goods no-row page-level blocking, and complete option lists remain unverified.",
      requiredNextStep:
        "Wait for PH-A/coordinator evidence before making these fields mandatory or claiming final customs/currency acceptance.",
    },
    {
      area: "result_success_gate",
      owner: "official_evidence_required",
      severity: "P0",
      label: "Final Submit, official reference, QR, and recovery page",
      currentFrontendState:
        "No PH frontend helper treats Review, HTTP 200, navigation, local reference, or local QR as success. Official post-submit read, QR rendering, scanability, and recovery evidence remain incomplete.",
      requiredNextStep:
        "Wait for authorized PH-A/coordinator controlled-live evidence before a submitted candidate can be promoted to a user-facing submitted result.",
    },
  ];

export function getPhEtravelCompletenessByOwner(
  owner: PhEtravelCompletenessOwner
): PhEtravelCompletenessItem[] {
  return PH_ETRAVEL_FORM_COMPLETENESS_MATRIX.filter(
    (item) => item.owner === owner
  );
}

export function getPhEtravelP0CompletenessGaps(): PhEtravelCompletenessItem[] {
  return PH_ETRAVEL_FORM_COMPLETENESS_MATRIX.filter(
    (item) => item.severity === "P0" && item.owner !== "covered"
  );
}
