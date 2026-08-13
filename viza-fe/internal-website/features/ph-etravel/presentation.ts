import {
  evaluatePhEtravelEligibility,
  type PhEtravelEligibilityChoice,
} from "./eligibility";

export type PhEtravelPresentationTransport = "AIR" | "SEA";
export type PhEtravelSeaFlow =
  "manual_forms" | "electronic_customs" | "unknown";
export type PhEtravelStayLocationType =
  "RESIDENCE" | "HOTEL" | "TRANSIT" | "TRAVEL_PORT";
export type PhEtravelDeclarationAnswer = "yes" | "no" | null;
export type PhEtravelCurrencyTransportMethod = "physical" | "courier" | null;
export type PhEtravelCurrencySource = "SALARY" | "BUSINESS" | "OTHER";
export type PhEtravelCurrencyTransportPurpose =
  "LEISURE" | "MEDICAL" | "PAYABLES" | "EDUCATION" | "OTHER";
export type PhEtravelReviewProgress =
  | "not_reached"
  | "signature_required"
  | "family_gate"
  | "companion_confirmation"
  | "summary_reached";

export type PhEtravelPresentationInput = {
  eligibilityChoice: PhEtravelEligibilityChoice;
  transportType: PhEtravelPresentationTransport;
  seaFlow?: PhEtravelSeaFlow;
  withTransit?: boolean;
  isDisembarking?: boolean | null;
  stayLocationType?: PhEtravelStayLocationType | null;
  customsDeclaration?: PhEtravelDeclarationAnswer;
  otherGoodsDeclared?: boolean | null;
  currencyDeclaration?: PhEtravelDeclarationAnswer;
  currencyOwnerNotApplicable?: boolean | null;
  currencySources?: readonly PhEtravelCurrencySource[];
  currencyTransportPurposes?: readonly PhEtravelCurrencyTransportPurpose[];
  currencyTransportMethod?: PhEtravelCurrencyTransportMethod;
  requiresBspAuthorization?: boolean | null;
  reviewProgress?: PhEtravelReviewProgress;
};

export type PhEtravelPresentationSectionId =
  | "eligibility"
  | "travel"
  | "destination"
  | "health"
  | "family"
  | "other_travel_details"
  | "customs"
  | "currency"
  | "signature_review";

export type PhEtravelPresentationControl =
  | "select"
  | "text"
  | "date"
  | "boolean"
  | "number"
  | "multi_select"
  | "repeat_group"
  | "static_notice"
  | "signature_pad"
  | "result_artifact";

export type PhEtravelPresentationMode =
  | "input_when_shared_ready"
  | "manual_review"
  | "official_only"
  | "action_required"
  | "result_only";

export type PhEtravelPresentationGate =
  | "ready_for_shared_integration"
  | "needs_review"
  | "official_evidence_required";

export type PhEtravelPresentationField = {
  key: string;
  officialKey?: string;
  control: PhEtravelPresentationControl;
  mode: PhEtravelPresentationMode;
  gate: PhEtravelPresentationGate;
  reason: string;
  requiredWhen?: string;
};

export type PhEtravelPresentationSection = {
  id: PhEtravelPresentationSectionId;
  fields: PhEtravelPresentationField[];
  blockedReason?: string;
};

export type PhEtravelFormPresentation = {
  route: "ordinary_passenger" | "diverted";
  transportType: PhEtravelPresentationTransport;
  seaFlow: PhEtravelSeaFlow | null;
  sections: PhEtravelPresentationSection[];
  resultFields: PhEtravelPresentationField[];
  submitted: false;
};

const sharedField = (
  key: string,
  officialKey: string,
  control: PhEtravelPresentationControl,
  reason: string
): PhEtravelPresentationField => ({
  key,
  officialKey,
  control,
  mode: "input_when_shared_ready",
  gate: "ready_for_shared_integration",
  reason,
});

const reviewField = (
  key: string,
  officialKey: string | undefined,
  control: PhEtravelPresentationControl,
  reason: string
): PhEtravelPresentationField => ({
  key,
  officialKey,
  control,
  mode: "manual_review",
  gate: "needs_review",
  reason,
});

const officialOnlyField = (
  key: string,
  control: PhEtravelPresentationControl,
  reason: string
): PhEtravelPresentationField => ({
  key,
  control,
  mode: "official_only",
  gate: "official_evidence_required",
  reason,
});

const branchRequiredField = (
  key: string,
  officialKey: string,
  control: PhEtravelPresentationControl,
  requiredWhen: string,
  reason: string
): PhEtravelPresentationField => ({
  key,
  officialKey,
  control,
  mode: "input_when_shared_ready",
  gate: "ready_for_shared_integration",
  requiredWhen,
  reason,
});

const actionRequiredField = (
  key: string,
  control: PhEtravelPresentationControl,
  requiredWhen: string,
  reason: string
): PhEtravelPresentationField => ({
  key,
  control,
  mode: "action_required",
  gate: "ready_for_shared_integration",
  requiredWhen,
  reason,
});

const resultField = (
  key: string,
  reason: string
): PhEtravelPresentationField => ({
  key,
  control: "result_artifact",
  mode: "result_only",
  gate: "official_evidence_required",
  reason,
});

function createTravelSection(
  input: PhEtravelPresentationInput
): PhEtravelPresentationSection {
  const fields: PhEtravelPresentationField[] = [
    reviewField(
      "travel.purpose_code",
      "purpose_of_visit_code",
      "select",
      "Official purpose options and requiredness remain under review."
    ),
    sharedField(
      "travel.origin_country_code",
      "origin_country_code",
      "select",
      "Verified arrival travel field."
    ),
    sharedField(
      "travel.origin_port",
      "origin_port",
      "text",
      "Official port label changes by AIR or SEA."
    ),
    sharedField(
      "travel.origin_departure_date",
      "departure_date",
      "date",
      "SEA voyage alias maps to departure_date."
    ),
    sharedField(
      "travel.arrival_date",
      "arrival_date",
      "date",
      "SEA voyage alias maps to arrival_date."
    ),
    sharedField(
      "travel.with_transit",
      input.transportType === "AIR" ? "with_transit_air" : "with_transit_sea",
      "boolean",
      "Transit is conditional on the selected transport."
    ),
  ];

  if (input.withTransit) {
    fields.push(
      sharedField(
        "travel.transit_country_code",
        "transit_country_code",
        "select",
        "Shown only after With Transit is true."
      ),
      sharedField(
        "travel.transit_port",
        "transit_port",
        "text",
        "Official port label changes by AIR or SEA."
      ),
      sharedField(
        "travel.transit_date",
        "transit_date",
        "date",
        "Shown only after With Transit is true."
      )
    );
  }

  if (input.transportType === "AIR") {
    fields.push(
      reviewField(
        "air.airline_code",
        "travel_company_code",
        "select",
        "AIR airline requiredness and option behavior remain under review."
      ),
      reviewField(
        "air.flight_number",
        "flight_number",
        "text",
        "AIR flight requiredness and special-flight behavior remain under review."
      ),
      reviewField(
        "air.is_special_flight",
        "special_flight",
        "boolean",
        "Only applicable to the official special-flight branch."
      )
    );
  } else {
    fields.push(
      sharedField(
        "sea.vessel_name",
        "vessel_name",
        "text",
        "Verified ordinary SEA passenger field."
      ),
      sharedField(
        "sea.voyage_number",
        "flight_number",
        "text",
        "Official control key is flight_number although the label is Voyage Number."
      )
    );
    if (input.isDisembarking == null) {
      fields.push(
        reviewField(
          "sea.is_disembarking",
          "is_disembarking",
          "boolean",
          "This control is path-specific and was absent from the observed SEA electronic start path."
        )
      );
    }
  }

  return { id: "travel", fields };
}

function createDestinationSection(
  input: PhEtravelPresentationInput
): PhEtravelPresentationSection {
  const seaDestinationVisible =
    input.transportType === "SEA" && input.isDisembarking === true;
  const destinationVisible =
    input.transportType === "AIR" || seaDestinationVisible;

  if (!destinationVisible) {
    return {
      id: "destination",
      fields: [],
      blockedReason:
        "SEA stay destination fields are shown only on the official disembarking branch. The observed SEA electronic path did not show them before Health.",
    };
  }

  const fields: PhEtravelPresentationField[] = [
    sharedField(
      "destination.stay_location_type",
      "stay_location_type",
      "select",
      input.transportType === "SEA"
        ? "SEA disembarking values are Residence, Hotel, and Travel Port."
        : "AIR values include Residence, Hotel, and Transit."
    ),
  ];

  if (input.stayLocationType === "RESIDENCE") {
    fields.push(
      reviewField(
        "destination.same_as_residence",
        "is_destination_same_as_permanent_address",
        "boolean",
        "Official requiredness for the same-as-residence control remains under review."
      ),
      sharedField(
        "destination.address_text",
        "destination_upon_arrival_in_philippines",
        "text",
        "Shown for the Residence branch only."
      )
    );
  }

  if (input.stayLocationType === "HOTEL") {
    fields.push(
      sharedField(
        "destination.hotel_name_or_address",
        "destination_upon_arrival_in_philippines",
        "text",
        "Shown for the Hotel branch only; option completeness remains a shared integration concern."
      )
    );
  }

  if (input.transportType === "AIR" && input.stayLocationType === "TRANSIT") {
    fields.push(
      reviewField(
        "destination.transit_port_code",
        "transit_port_code",
        "select",
        "AIR transit option completeness remains under review."
      ),
      reviewField(
        "destination.transit_destination_country_code",
        "transit_destination_country_code",
        "select",
        "AIR transit option completeness remains under review."
      )
    );
  }

  if (
    input.transportType === "SEA" &&
    input.stayLocationType === "TRAVEL_PORT"
  ) {
    fields.push(
      sharedField(
        "destination.disembarking_port_code",
        "disembarking_port_code",
        "select",
        "SEA Travel Port is available only when the official disembarking branch is visible."
      )
    );
  }

  return { id: "destination", fields };
}

function createHealthSection(): PhEtravelPresentationSection {
  return {
    id: "health",
    fields: [
      sharedField(
        "health.has_exposure_to_sick_person_30d",
        "is_with_history_exposure",
        "boolean",
        "Contract-backed health declaration field."
      ),
      sharedField(
        "health.has_been_sick_30d",
        "is_sicked_within_thirty_days",
        "boolean",
        "Contract-backed health declaration field."
      ),
      reviewField(
        "health.has_recent_travel_history_30d",
        "with_recent_travel_history",
        "boolean",
        "Current branch requiredness remains under review."
      ),
      reviewField(
        "health.visited_countries_30d",
        "visited_countries",
        "multi_select",
        "Shown only under the official recent-travel branch."
      ),
      reviewField(
        "health.sickness_symptoms",
        "sickness_symptoms",
        "multi_select",
        "Shown only under the official sickness branch."
      ),
    ],
  };
}

function createFamilySection(
  input: PhEtravelPresentationInput
): PhEtravelPresentationSection {
  const fields: PhEtravelPresentationField[] = [
    reviewField(
      "family.selected_members",
      undefined,
      "multi_select",
      "Official family-profile selection remains separate; each selected member creates a separate declaration."
    ),
  ];

  const hasObservedElectronicOtherTravelDetails =
    (input.transportType === "AIR" && input.customsDeclaration === "yes") ||
    (input.transportType === "SEA" &&
      input.seaFlow === "electronic_customs" &&
      (input.customsDeclaration === "no" ||
        input.customsDeclaration === "yes"));

  if (hasObservedElectronicOtherTravelDetails) {
    fields.push(
      sharedField(
        "family.accompanied_under_18_count",
        "accompanied_family_members.below_eighteen",
        "number",
        "Electronic other-travel-details field."
      ),
      sharedField(
        "family.accompanied_18_plus_count",
        "accompanied_family_members.above_or_equal_eighteen",
        "number",
        "Electronic other-travel-details field."
      )
    );
  }

  return { id: "family", fields };
}

function createOtherTravelDetailsSection(
  input: PhEtravelPresentationInput
): PhEtravelPresentationSection {
  if (input.transportType === "SEA" && input.seaFlow === "manual_forms") {
    return {
      id: "other_travel_details",
      fields: [],
      blockedReason:
        "This SEA path uses official manual Baggage and Currency forms; do not render electronic other-travel-details fields.",
    };
  }

  if (input.transportType === "SEA" && input.seaFlow !== "electronic_customs") {
    return {
      id: "other_travel_details",
      fields: [],
      blockedReason:
        "SEA customs path has not been identified. Do not assume the electronic details page is available.",
    };
  }

  if (input.transportType === "AIR" && input.customsDeclaration !== "yes") {
    return {
      id: "other_travel_details",
      fields: [],
      blockedReason:
        "AIR Other Travel Details were observed on the positive electronic customs path only; do not infer this page for another AIR answer.",
    };
  }

  if (
    input.transportType === "SEA" &&
    input.customsDeclaration !== "no" &&
    input.customsDeclaration !== "yes"
  ) {
    return {
      id: "other_travel_details",
      fields: [],
      blockedReason:
        "SEA electronic Other Travel Details require a confirmed Customs Yes or No branch. Do not infer this page before the official choice is known.",
    };
  }

  return {
    id: "other_travel_details",
    fields: [
      sharedField(
        "baggage.checked_count",
        "no_of_checked_in_baggages",
        "number",
        "Electronic customs other-travel-details field."
      ),
      sharedField(
        "baggage.hand_carried_count",
        "no_of_hand_carried_baggages",
        "number",
        "Electronic customs other-travel-details field."
      ),
      sharedField(
        "baggage.first_time_visit",
        "first_time_visit",
        "boolean",
        "Electronic customs other-travel-details field."
      ),
    ],
  };
}

function createCustomsSection(
  input: PhEtravelPresentationInput
): PhEtravelPresentationSection {
  if (input.transportType === "SEA" && input.seaFlow === "manual_forms") {
    return {
      id: "customs",
      fields: [],
      blockedReason:
        "SEA manual Baggage and Currency forms require official/manual handling; this is not an electronic customs declaration form.",
    };
  }

  if (input.transportType === "SEA" && input.seaFlow !== "electronic_customs") {
    return {
      id: "customs",
      fields: [],
      blockedReason:
        "SEA customs variant is unobserved. Do not expose AIR customs fields on this path.",
    };
  }

  const fields: PhEtravelPresentationField[] = [
    sharedField(
      "customs.has_baggage_or_currency_to_declare",
      "with_something_to_declare_arrival",
      "boolean",
      "Electronic customs confirmation is verified for AIR and one SEA electronic path."
    ),
  ];

  const hasPositiveElectronicCustoms =
    input.customsDeclaration === "yes" &&
    (input.transportType === "AIR" ||
      (input.transportType === "SEA" &&
        input.seaFlow === "electronic_customs"));

  if (hasPositiveElectronicCustoms) {
    fields.push(
      sharedField(
        "baggage.goods_amount_currency",
        "amount_of_goods_acquired.currency",
        "select",
        "Positive electronic customs selector confirmed for AIR and SEA through Currency Declaration."
      ),
      sharedField(
        "baggage.goods_amount",
        "amount_of_goods_acquired.amount",
        "text",
        "Positive electronic customs selector confirmed for AIR and SEA through Currency Declaration."
      ),
      sharedField(
        "customs.checklist",
        "check_lists.*.response",
        "repeat_group",
        "Positive electronic 12-item declaration confirmed for AIR and SEA; do not collapse it into one answer."
      )
    );
    if (input.otherGoodsDeclared) {
      fields.push(
        sharedField(
          "baggage.items",
          "description|quantity|amount",
          "repeat_group",
          "Positive electronic Other Goods modal/table branch confirmed for AIR and SEA through Currency Declaration."
        )
      );
    }
  }

  return { id: "customs", fields };
}

function createCurrencySection(
  input: PhEtravelPresentationInput
): PhEtravelPresentationSection {
  if (input.transportType === "SEA" && input.seaFlow === "manual_forms") {
    return {
      id: "currency",
      fields: [],
      blockedReason:
        "This SEA manual path uses official Baggage and Currency forms rather than VIZA electronic currency fields.",
    };
  }

  if (input.currencyDeclaration !== "yes") {
    return {
      id: "currency",
      fields: [],
      blockedReason:
        "Currency details are conditional on the official declaration threshold/branch.",
    };
  }

  const hasPositiveElectronicCurrency =
    input.customsDeclaration === "yes" &&
    (input.transportType === "AIR" ||
      (input.transportType === "SEA" &&
        input.seaFlow === "electronic_customs"));

  if (!hasPositiveElectronicCurrency) {
    return {
      id: "currency",
      fields: [],
      blockedReason:
        "Currency fields require the verified electronic Customs Yes path. Do not infer them for AIR without Customs Yes, SEA manual, SEA electronic No, or an unknown path.",
    };
  }

  const fields: PhEtravelPresentationField[] = [
    sharedField(
      "currency.items",
      "currency_id|monetary_instrument_id|amount",
      "repeat_group",
      "Positive currency item modal/table confirmed for AIR and SEA through Currency Declaration."
    ),
    reviewField(
      "currency.owner_not_applicable",
      "owner_details_not_applicable",
      "boolean",
      "Owner N/A lacks a stable official selector."
    ),
    sharedField(
      "currency.sources",
      "currency_sources",
      "multi_select",
      "Positive source checkbox array confirmed for AIR and SEA through Currency Declaration."
    ),
    sharedField(
      "currency.transport_purposes",
      "transport_purposes",
      "multi_select",
      "Positive purpose checkbox array confirmed for AIR and SEA through Currency Declaration."
    ),
    sharedField(
      "currency.transport_method",
      "physical_or_shipped",
      "select",
      "Positive physical/courier branch selector confirmed for AIR and SEA through Currency Declaration."
    ),
  ];

  if (input.currencyOwnerNotApplicable !== true) {
    fields.push(
      reviewField(
        "currency.owner",
        undefined,
        "repeat_group",
        "Owner requiredness and third-party condition remain under review."
      ),
      reviewField(
        "currency.recipient",
        undefined,
        "repeat_group",
        "Recipient requiredness and third-party condition remain under review."
      )
    );
  }
  if (input.currencySources?.includes("OTHER")) {
    fields.push(
      sharedField(
        "currency.source_other",
        "currency_source_other",
        "text",
        "Shown only when the official source array contains OTHER."
      )
    );
  }
  if (input.currencyTransportPurposes?.includes("OTHER")) {
    fields.push(
      sharedField(
        "currency.transport_purpose_other",
        "transport_purpose_other",
        "text",
        "Shown only when the official purpose array contains OTHER."
      )
    );
  }
  if (input.requiresBspAuthorization) {
    fields.push(
      reviewField(
        "currency.bsp_authorization_date",
        "bsp_authorization_date",
        "date",
        "BSP condition and supporting-document requiredness remain under review."
      )
    );
  }

  if (input.currencyTransportMethod === "physical") {
    const isSeaElectronicPositivePhysical =
      input.transportType === "SEA" &&
      input.seaFlow === "electronic_customs" &&
      input.customsDeclaration === "yes";

    fields.push(
      isSeaElectronicPositivePhysical
        ? branchRequiredField(
            "currency.days_in_philippines",
            "no_of_days_in_philippines",
            "number",
            "currency.transfer_method === is_physically_transferred_by_person",
            "E11 directly validated this SEA electronic positive physical-branch field as required."
          )
        : reviewField(
            "currency.days_in_philippines",
            "no_of_days_in_philippines",
            "number",
            "Physical-branch requiredness outside the E11 SEA electronic positive path remains under review."
          ),
      isSeaElectronicPositivePhysical
        ? branchRequiredField(
            "currency.last_travel_to_philippines",
            "last_travel_to_philippines",
            "date",
            "currency.transfer_method === is_physically_transferred_by_person",
            "E11 directly validated this SEA electronic positive physical-branch field as required."
          )
        : reviewField(
            "currency.last_travel_to_philippines",
            "last_travel_to_philippines",
            "date",
            "Physical-branch requiredness outside the E11 SEA electronic positive path remains under review."
          )
    );
  }
  if (input.currencyTransportMethod === "courier") {
    fields.push(
      sharedField(
        "currency.courier_name",
        "courier_name",
        "text",
        "Positive courier branch validation was observed."
      ),
      sharedField(
        "currency.airway_bill_no",
        "airway_bill_no",
        "text",
        "Positive courier branch validation was observed."
      ),
      sharedField(
        "currency.airway_bill_date",
        "airway_bill_date",
        "date",
        "Positive courier branch validation was observed."
      )
    );
  }

  return { id: "currency", fields };
}

function createSignatureReviewSection(
  input: PhEtravelPresentationInput
): PhEtravelPresentationSection {
  const fields: PhEtravelPresentationField[] = [];
  const positiveElectronicCustoms =
    input.customsDeclaration === "yes" &&
    (input.transportType === "AIR" || input.seaFlow === "electronic_customs");
  const seaPositiveStopsAfterCurrency =
    input.transportType === "SEA" && positiveElectronicCustoms;
  const signaturePageReached = input.reviewProgress === "signature_required";
  const positiveElectronicSignaturePageReached =
    positiveElectronicCustoms && signaturePageReached;

  if (input.transportType === "SEA" && input.seaFlow === "manual_forms") {
    fields.push(
      officialOnlyField(
        "signature.manual_sea_path",
        "signature_pad",
        "The observed SEA manual path reached Summary without a signature page; do not require a universal SEA signature."
      )
    );
  }

  if (positiveElectronicSignaturePageReached) {
    fields.push(
      officialOnlyField(
        "attachments.upload_rules",
        "static_notice",
        "E14 confirms a conditional multi-file client hint of PNG/JPG/JPEG and 5.00 MB per file. Attachment count, live requiredness, and server rules remain unverified; do not model this as a required file-upload question."
      )
    );
  }

  if (signaturePageReached) {
    fields.push(
      actionRequiredField(
        "signature.applicant_signature",
        "signature_pad",
        "official signature page is reached",
        "E11 directly validated a required signature canvas. This is an action-required canvas step, never a file upload or submitted result."
      )
    );
  }

  if (input.reviewProgress === "family_gate") {
    fields.push(
      officialOnlyField(
        "review.family_gate",
        "multi_select",
        "Family Member(s) is an action-required gate, not a submitted result."
      )
    );
  }
  if (input.reviewProgress === "companion_confirmation") {
    fields.push(
      officialOnlyField(
        "review.companion_confirmation",
        "boolean",
        "No-companion confirmation is action-required, not a submitted result."
      )
    );
  }
  if (input.reviewProgress === "summary_reached") {
    fields.push(
      officialOnlyField(
        "review.summary",
        "boolean",
        "Summary and visible final Submit are not proof of submission."
      )
    );
  }

  return {
    id: "signature_review",
    fields,
    blockedReason: positiveElectronicSignaturePageReached
      ? "E14 confirms conditional attachment client hints only. Upload rules remain official-only; signature is action-required; Family Member(s), no-companion confirmation, and Summary remain unverified for the SEA positive path."
      : seaPositiveStopsAfterCurrency
        ? "SEA electronic positive evidence is confirmed through Currency Declaration only. Attachments, signature, Family Member(s), no-companion confirmation, and Summary remain gated until the official page is reached."
        : undefined,
  };
}

export function createPhEtravelFormPresentation(
  input: PhEtravelPresentationInput
): PhEtravelFormPresentation {
  const eligibility = evaluatePhEtravelEligibility(input.eligibilityChoice);
  const resultFields = [
    resultField(
      "result.official_reference",
      "Official reference/confirmation is a result, never an applicant question."
    ),
    resultField(
      "result.reference_qr_render",
      "A QR is client-rendered from an authoritative result reference, never an applicant question or a standalone success artifact."
    ),
  ];

  if (eligibility.status === "unsupported") {
    return {
      route: "diverted",
      transportType: input.transportType,
      seaFlow:
        input.transportType === "SEA" ? (input.seaFlow ?? "unknown") : null,
      sections: [
        {
          id: "eligibility",
          fields: [],
          blockedReason: eligibility.messageEn,
        },
      ],
      resultFields,
      submitted: false,
    };
  }

  return {
    route: "ordinary_passenger",
    transportType: input.transportType,
    seaFlow:
      input.transportType === "SEA" ? (input.seaFlow ?? "unknown") : null,
    sections: [
      createTravelSection(input),
      createDestinationSection(input),
      createHealthSection(),
      createFamilySection(input),
      createOtherTravelDetailsSection(input),
      createCustomsSection(input),
      createCurrencySection(input),
      createSignatureReviewSection(input),
    ],
    resultFields,
    submitted: false,
  };
}

export function getPhEtravelPresentationSection(
  presentation: PhEtravelFormPresentation,
  id: PhEtravelPresentationSectionId
): PhEtravelPresentationSection {
  const section = presentation.sections.find(
    (candidate) => candidate.id === id
  );
  if (!section) {
    throw new Error(`Missing PH eTravel presentation section: ${id}`);
  }
  return section;
}
