import {
  createPhEtravelFormPresentation,
  type PhEtravelFormPresentation,
  type PhEtravelPresentationField,
  type PhEtravelPresentationInput,
  type PhEtravelPresentationSectionId,
} from "./presentation";
import {
  resolvePhEtravelSeaDestinationPortFlow,
  type PhEtravelSeaDestinationPortSnapshot,
  type PhEtravelSeaPortFlowResolution,
} from "./port-flow";

export type PhEtravelOrderedPath =
  | "air_no_declaration"
  | "air_positive"
  | "sea_manual"
  | "sea_electronic_no"
  | "sea_electronic_yes_through_signature";

export type PhEtravelPageEvidence =
  "verified_public" | "official_evidence_required";

export type PhEtravelActionOnlyGate = {
  key: string;
  reason: string;
  evidence: PhEtravelPageEvidence;
};

export type PhEtravelOrderedPage = {
  id: string;
  officialTitle: string;
  wizardPage?: number;
  sectionOrder: PhEtravelPresentationSectionId[];
  fields: PhEtravelPresentationField[];
  conditionalFieldKeys: string[];
  actionOnlyGates: PhEtravelActionOnlyGate[];
  evidence: PhEtravelPageEvidence;
  /** Numeric indexes are route/path observations, never globally stable step identifiers. */
  wizardIndexMeaning: "dynamic_path_result";
};

export type PhEtravelOrderedPageContract = {
  path: PhEtravelOrderedPath;
  pages: PhEtravelOrderedPage[];
  resultFields: PhEtravelPresentationField[];
  submitted: false;
};

export type PhEtravelSeaPortOrderedContract = {
  resolution: PhEtravelSeaPortFlowResolution;
  contract: PhEtravelOrderedPageContract | null;
  actionOnlyGates: PhEtravelActionOnlyGate[];
};

type PageDefinition = Omit<
  PhEtravelOrderedPage,
  "fields" | "wizardIndexMeaning"
> & {
  fieldKeys: string[];
};

const ACTION_ONLY = (
  key: string,
  reason: string,
  evidence: PhEtravelPageEvidence
): PhEtravelActionOnlyGate => ({
  key,
  reason,
  evidence,
});

const commonTravelPage = (fieldKeys: string[]): PageDefinition => ({
  id: "travel_details",
  officialTitle: "Travel Details - Philippine Arrival",
  wizardPage: 0,
  sectionOrder: ["travel", "destination"],
  fieldKeys,
  conditionalFieldKeys: [
    "travel.transit_country_code",
    "travel.transit_port",
    "travel.transit_date",
    "destination.address_text",
    "destination.hotel_name_or_address",
    "destination.transit_port_code",
    "destination.transit_destination_country_code",
    "destination.disembarking_port_code",
  ],
  actionOnlyGates: [],
  evidence: "verified_public",
});

const healthPage: PageDefinition = {
  id: "health_declaration",
  officialTitle: "Health Declaration",
  wizardPage: 1,
  sectionOrder: ["health"],
  fieldKeys: [
    "health.has_exposure_to_sick_person_30d",
    "health.has_been_sick_30d",
    "health.has_recent_travel_history_30d",
    "health.visited_countries_30d",
    "health.sickness_symptoms",
  ],
  conditionalFieldKeys: [
    "health.visited_countries_30d",
    "health.sickness_symptoms",
  ],
  actionOnlyGates: [],
  evidence: "verified_public",
};

const customsConfirmationPage: PageDefinition = {
  id: "customs_confirmation",
  officialTitle: "Customs Declaration Confirmation",
  wizardPage: 2,
  sectionOrder: ["customs"],
  fieldKeys: ["customs.has_baggage_or_currency_to_declare"],
  conditionalFieldKeys: [],
  actionOnlyGates: [],
  evidence: "verified_public",
};

const otherTravelPage: PageDefinition = {
  id: "other_travel_details",
  officialTitle: "Other Travel Details",
  wizardPage: 3,
  sectionOrder: ["other_travel_details", "family"],
  fieldKeys: [
    "family.accompanied_under_18_count",
    "family.accompanied_18_plus_count",
    "baggage.checked_count",
    "baggage.hand_carried_count",
    "baggage.first_time_visit",
  ],
  conditionalFieldKeys: [],
  actionOnlyGates: [],
  evidence: "verified_public",
};

const generalDeclarationPage: PageDefinition = {
  id: "customs_general_declaration",
  officialTitle: "Customs General Declaration",
  wizardPage: 4,
  sectionOrder: ["customs"],
  fieldKeys: [
    "baggage.goods_amount_currency",
    "baggage.goods_amount",
    "customs.checklist",
    "baggage.items",
  ],
  conditionalFieldKeys: ["baggage.items"],
  actionOnlyGates: [],
  evidence: "verified_public",
};

const currencyDeclarationPage: PageDefinition = {
  id: "currency_declaration",
  officialTitle: "Customs Currency Declaration",
  wizardPage: 5,
  sectionOrder: ["currency"],
  fieldKeys: [
    "currency.items",
    "currency.owner_not_applicable",
    "currency.owner",
    "currency.recipient",
    "currency.sources",
    "currency.source_other",
    "currency.transport_purposes",
    "currency.transport_purpose_other",
    "currency.transport_method",
    "currency.days_in_philippines",
    "currency.last_travel_to_philippines",
    "currency.courier_name",
    "currency.airway_bill_no",
    "currency.airway_bill_date",
    "currency.bsp_authorization_date",
  ],
  conditionalFieldKeys: [
    "currency.owner",
    "currency.recipient",
    "currency.source_other",
    "currency.transport_purpose_other",
    "currency.days_in_philippines",
    "currency.last_travel_to_philippines",
    "currency.courier_name",
    "currency.airway_bill_no",
    "currency.airway_bill_date",
    "currency.bsp_authorization_date",
  ],
  actionOnlyGates: [],
  evidence: "verified_public",
};

const signaturePage = (
  wizardPage: number,
  evidence: PhEtravelPageEvidence
): PageDefinition => ({
  id: "attachments_and_signature",
  officialTitle: "Customs Declaration Attachments and Signature",
  wizardPage,
  sectionOrder: ["signature_review"],
  fieldKeys: ["attachments.upload_rules", "signature.applicant_signature"],
  conditionalFieldKeys: ["attachments.upload_rules"],
  actionOnlyGates: [
    ACTION_ONLY(
      "signature.applicant_signature",
      "The signature canvas is a path-specific action gate, never a file-upload applicant answer or submitted result.",
      evidence
    ),
  ],
  evidence,
});

const familyPage = (wizardPage?: number): PageDefinition => ({
  id: "family_members",
  officialTitle: "Family Member(s)",
  wizardPage,
  sectionOrder: ["family"],
  fieldKeys: ["family.selected_members"],
  conditionalFieldKeys: [],
  actionOnlyGates: [
    ACTION_ONLY(
      "family.independent_declarations",
      "Each selected family member receives an independent travel declaration; this is not a nested applicant answer or submitted success.",
      "verified_public"
    ),
  ],
  evidence: "verified_public",
});

const companionPage = (wizardPage?: number): PageDefinition => ({
  id: "companion_confirmation",
  officialTitle: "No-companion confirmation",
  wizardPage,
  sectionOrder: [],
  fieldKeys: [],
  conditionalFieldKeys: [],
  actionOnlyGates: [
    ACTION_ONLY(
      "review.companion_confirmation",
      "Official confirmation is required before Summary when no family member is selected. It is not an applicant form field or submitted success.",
      "verified_public"
    ),
  ],
  evidence: "verified_public",
});

const summaryPage = (wizardPage?: number): PageDefinition => ({
  id: "summary",
  officialTitle: "New Travel Declaration Summary",
  wizardPage,
  sectionOrder: ["signature_review"],
  fieldKeys: [],
  conditionalFieldKeys: [],
  actionOnlyGates: [
    ACTION_ONLY(
      "summary.review",
      "Summary is read-only review, not an applicant question or submitted success.",
      "verified_public"
    ),
    ACTION_ONLY(
      "summary.final_submit",
      "The official Submit action was observed but not clicked; it cannot create a VIZA submitted result.",
      "official_evidence_required"
    ),
  ],
  evidence: "verified_public",
});

const manualFormsPage: PageDefinition = {
  id: "manual_baggage_currency_forms",
  officialTitle: "Baggage and Currency forms notice",
  sectionOrder: ["other_travel_details", "customs", "currency"],
  fieldKeys: [],
  conditionalFieldKeys: [],
  actionOnlyGates: [
    ACTION_ONLY(
      "customs.manual_forms",
      "This SEA path uses official manual Baggage and Currency forms. Do not substitute AIR or SEA electronic customs fields.",
      "verified_public"
    ),
  ],
  evidence: "verified_public",
};

const airNoContinuationPage: PageDefinition = {
  id: "air_no_declaration_continuation_unobserved",
  officialTitle: "AIR Customs No continuation",
  sectionOrder: [],
  fieldKeys: [],
  conditionalFieldKeys: [],
  actionOnlyGates: [
    ACTION_ONLY(
      "air.no_declaration_continuation",
      "The AIR Customs No continuation page order was not separately observed. Do not borrow SEA electronic No or AIR positive pages.",
      "official_evidence_required"
    ),
  ],
  evidence: "official_evidence_required",
};

function findPresentationFields(
  presentation: PhEtravelFormPresentation,
  sectionOrder: PhEtravelPresentationSectionId[],
  fieldKeys: string[]
): PhEtravelPresentationField[] {
  const byKey = new Map(
    presentation.sections
      .filter((section) => sectionOrder.includes(section.id))
      .flatMap((section) =>
        section.fields.map((field) => [field.key, field] as const)
      )
  );

  return fieldKeys.flatMap((key) => {
    const field = byKey.get(key);
    return field ? [field] : [];
  });
}

function buildContract(
  path: PhEtravelOrderedPath,
  input: PhEtravelPresentationInput,
  pages: PageDefinition[]
): PhEtravelOrderedPageContract {
  const presentation = createPhEtravelFormPresentation(input);

  return {
    path,
    pages: pages.map(({ fieldKeys, ...page }) => ({
      ...page,
      wizardIndexMeaning: "dynamic_path_result",
      fields: findPresentationFields(
        presentation,
        page.sectionOrder,
        fieldKeys
      ),
    })),
    resultFields: presentation.resultFields,
    submitted: false,
  };
}

export function createPhEtravelOrderedPageContract(
  path: PhEtravelOrderedPath
): PhEtravelOrderedPageContract {
  switch (path) {
    case "air_no_declaration":
      return buildContract(
        path,
        {
          eligibilityChoice: "ordinary_air_passenger",
          transportType: "AIR",
          customsDeclaration: "no",
        },
        [
          commonTravelPage([
            "travel.purpose_code",
            "travel.origin_country_code",
            "travel.origin_port",
            "travel.origin_departure_date",
            "travel.arrival_date",
            "travel.with_transit",
            "air.airline_code",
            "air.flight_number",
            "air.is_special_flight",
            "destination.stay_location_type",
          ]),
          healthPage,
          customsConfirmationPage,
          airNoContinuationPage,
        ]
      );
    case "air_positive":
      return buildContract(
        path,
        {
          eligibilityChoice: "ordinary_air_passenger",
          transportType: "AIR",
          customsDeclaration: "yes",
          otherGoodsDeclared: true,
          currencyDeclaration: "yes",
          currencyTransportMethod: "physical",
          reviewProgress: "signature_required",
        },
        [
          commonTravelPage([
            "travel.purpose_code",
            "travel.origin_country_code",
            "travel.origin_port",
            "travel.origin_departure_date",
            "travel.arrival_date",
            "travel.with_transit",
            "air.airline_code",
            "air.flight_number",
            "air.is_special_flight",
            "destination.stay_location_type",
          ]),
          healthPage,
          customsConfirmationPage,
          otherTravelPage,
          generalDeclarationPage,
          currencyDeclarationPage,
          signaturePage(6, "verified_public"),
          familyPage(7),
          companionPage(7),
          summaryPage(8),
        ]
      );
    case "sea_manual":
      return buildContract(
        path,
        {
          eligibilityChoice: "ordinary_sea_passenger",
          transportType: "SEA",
          seaFlow: "manual_forms",
          isDisembarking: true,
          stayLocationType: "TRAVEL_PORT",
        },
        [
          commonTravelPage([
            "travel.purpose_code",
            "travel.origin_country_code",
            "travel.origin_port",
            "travel.origin_departure_date",
            "travel.arrival_date",
            "travel.with_transit",
            "sea.vessel_name",
            "sea.voyage_number",
            "destination.stay_location_type",
            "destination.disembarking_port_code",
          ]),
          healthPage,
          manualFormsPage,
          familyPage(),
          companionPage(),
          summaryPage(),
        ]
      );
    case "sea_electronic_no":
      return buildContract(
        path,
        {
          eligibilityChoice: "ordinary_sea_passenger",
          transportType: "SEA",
          seaFlow: "electronic_customs",
          customsDeclaration: "no",
          reviewProgress: "signature_required",
        },
        [
          commonTravelPage([
            "travel.purpose_code",
            "travel.origin_country_code",
            "travel.origin_port",
            "travel.origin_departure_date",
            "travel.arrival_date",
            "travel.with_transit",
            "sea.vessel_name",
            "sea.voyage_number",
          ]),
          healthPage,
          customsConfirmationPage,
          otherTravelPage,
          signaturePage(4, "verified_public"),
          familyPage(5),
          companionPage(5),
          summaryPage(6),
        ]
      );
    case "sea_electronic_yes_through_signature":
      return buildContract(
        path,
        {
          eligibilityChoice: "ordinary_sea_passenger",
          transportType: "SEA",
          seaFlow: "electronic_customs",
          customsDeclaration: "yes",
          otherGoodsDeclared: true,
          currencyDeclaration: "yes",
          currencyTransportMethod: "physical",
          reviewProgress: "signature_required",
        },
        [
          commonTravelPage([
            "travel.purpose_code",
            "travel.origin_country_code",
            "travel.origin_port",
            "travel.origin_departure_date",
            "travel.arrival_date",
            "travel.with_transit",
            "sea.vessel_name",
            "sea.voyage_number",
          ]),
          healthPage,
          customsConfirmationPage,
          otherTravelPage,
          generalDeclarationPage,
          currencyDeclarationPage,
          signaturePage(6, "verified_public"),
          {
            id: "post_signature_positive_unobserved",
            officialTitle: "Positive SEA post-signature continuation",
            sectionOrder: [],
            fieldKeys: [],
            conditionalFieldKeys: [],
            actionOnlyGates: [
              ACTION_ONLY(
                "sea.positive_post_signature_continuation",
                "Family Member(s), no-companion confirmation, Summary, final Submit, reference, and QR are not yet observed after SEA Customs Yes signature.",
                "official_evidence_required"
              ),
            ],
            evidence: "official_evidence_required",
          },
        ]
      );
  }
}

export function getPhEtravelOrderedPage(
  path: PhEtravelOrderedPath,
  pageId: string
): PhEtravelOrderedPage {
  const page = createPhEtravelOrderedPageContract(path).pages.find(
    (item) => item.id === pageId
  );
  if (!page) {
    throw new Error(
      `Unknown PH eTravel page contract entry: ${path}/${pageId}`
    );
  }
  return page;
}

export function createPhEtravelSeaPortOrderedPageContract(input: {
  destinationPortCode: string | null | undefined;
  snapshot: PhEtravelSeaDestinationPortSnapshot | null | undefined;
  customsDeclaration?: "yes" | "no" | null;
  now?: Date;
}): PhEtravelSeaPortOrderedContract {
  const resolution = resolvePhEtravelSeaDestinationPortFlow(
    input.destinationPortCode,
    input.snapshot,
    input.now
  );

  if (resolution.status !== "resolved") {
    return {
      resolution,
      contract: null,
      actionOnlyGates: [
        ACTION_ONLY(
          "sea.destination_port_metadata_review",
          "Destination-port metadata is required before VIZA can choose the SEA manual or electronic customs presentation.",
          "official_evidence_required"
        ),
      ],
    };
  }

  if (resolution.customsFlowHint === "manual_forms") {
    return {
      resolution,
      contract: createPhEtravelOrderedPageContract("sea_manual"),
      actionOnlyGates: [
        ACTION_ONLY(
          "sea.manual_forms_page_content_review",
          "with_custom_declaration=0 is a manual-forms hint. The rendered official manual notice must still match; do not show electronic customs fields.",
          "verified_public"
        ),
      ],
    };
  }

  if (input.customsDeclaration === "yes") {
    return {
      resolution,
      contract: createPhEtravelOrderedPageContract(
        "sea_electronic_yes_through_signature"
      ),
      actionOnlyGates: [
        ACTION_ONLY(
          "sea.electronic_page_content_review",
          "with_custom_declaration=1 is an electronic-customs hint. Rendered official page content must still match before continuing.",
          "verified_public"
        ),
      ],
    };
  }

  if (input.customsDeclaration === "no") {
    return {
      resolution,
      contract: createPhEtravelOrderedPageContract("sea_electronic_no"),
      actionOnlyGates: [
        ACTION_ONLY(
          "sea.electronic_page_content_review",
          "with_custom_declaration=1 is an electronic-customs hint. Rendered official page content must still match before continuing.",
          "verified_public"
        ),
      ],
    };
  }

  return {
    resolution,
    contract: null,
    actionOnlyGates: [
      ACTION_ONLY(
        "sea.electronic_customs_choice_required",
        "with_custom_declaration=1 can show the electronic customs confirmation, but the applicant's Yes/No branch is needed before VIZA can render downstream electronic customs questions.",
        "verified_public"
      ),
    ],
  };
}
