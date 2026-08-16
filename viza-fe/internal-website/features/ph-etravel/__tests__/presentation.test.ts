import { describe, expect, test } from "vitest";

import {
  createPhEtravelFormPresentation,
  getPhEtravelPresentationSection,
} from "../presentation";

const keys = (section: ReturnType<typeof getPhEtravelPresentationSection>) =>
  section.fields.map((field) => field.key);

describe("Philippines eTravel form presentation adapter", () => {
  test("keeps AIR General Declaration item and attachment branches scoped to Q3-Q12", () => {
    const q3Positive = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_air_passenger",
      transportType: "AIR",
      customsDeclaration: "yes",
      generalDeclarationGoodsAmount: "1000",
      generalDeclarationChecklistResponses: [false, false, true],
      reviewProgress: "signature_required",
    });
    const q1Only = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_air_passenger",
      transportType: "AIR",
      customsDeclaration: "yes",
      generalDeclarationChecklistResponses: [true, false],
      reviewProgress: "signature_required",
    });

    const q3Items = getPhEtravelPresentationSection(q3Positive, "customs").fields.filter(
      (field) => field.key === "baggage.items"
    );
    expect(q3Items).toEqual([
      expect.objectContaining({ repeatableItemForQuestion: 3 }),
    ]);
    expect(
      keys(getPhEtravelPresentationSection(q3Positive, "signature_review"))
    ).toContain("attachments.upload_rules");
    expect(
      keys(getPhEtravelPresentationSection(q1Only, "customs"))
    ).not.toContain("baggage.items");
    expect(
      keys(getPhEtravelPresentationSection(q1Only, "signature_review"))
    ).not.toContain("attachments.upload_rules");
  });

  test("keeps SEA manual paths out of AIR electronic customs and signature fields", () => {
    const presentation = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_sea_passenger",
      transportType: "SEA",
      seaFlow: "manual_forms",
      isDisembarking: true,
      stayLocationType: "TRAVEL_PORT",
      customsDeclaration: "yes",
      currencyDeclaration: "yes",
    });

    expect(
      keys(getPhEtravelPresentationSection(presentation, "travel"))
    ).toContain("sea.vessel_name");
    expect(
      keys(getPhEtravelPresentationSection(presentation, "travel"))
    ).toContain("sea.voyage_number");
    expect(
      keys(getPhEtravelPresentationSection(presentation, "travel"))
    ).not.toContain("air.airline_code");
    expect(
      keys(getPhEtravelPresentationSection(presentation, "destination"))
    ).toContain("destination.disembarking_port_code");
    expect(
      getPhEtravelPresentationSection(presentation, "other_travel_details")
        .blockedReason
    ).toContain("manual Baggage and Currency forms");
    expect(
      getPhEtravelPresentationSection(presentation, "customs").fields
    ).toHaveLength(0);
    expect(
      getPhEtravelPresentationSection(presentation, "currency").fields
    ).toHaveLength(0);
    expect(
      keys(getPhEtravelPresentationSection(presentation, "signature_review"))
    ).toContain("signature.manual_sea_path");
  });

  test("shows SEA electronic Yes through Currency while keeping post-Currency gates official-only", () => {
    const positivePresentation = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_sea_passenger",
      transportType: "SEA",
      seaFlow: "electronic_customs",
      customsDeclaration: "yes",
      otherGoodsDeclared: true,
      currencyDeclaration: "yes",
      currencyOwnerNotApplicable: false,
      currencySources: ["OTHER"],
      currencyTransportPurposes: ["OTHER"],
      currencyTransportMethod: "courier",
      requiresBspAuthorization: true,
      reviewProgress: "signature_required",
    });
    const noDeclarationPresentation = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_sea_passenger",
      transportType: "SEA",
      seaFlow: "electronic_customs",
      customsDeclaration: "no",
    });

    expect(
      getPhEtravelPresentationSection(positivePresentation, "destination")
        .blockedReason
    ).toContain("disembarking branch");
    expect(
      keys(
        getPhEtravelPresentationSection(
          positivePresentation,
          "other_travel_details"
        )
      )
    ).toEqual(
      expect.arrayContaining([
        "baggage.checked_count",
        "baggage.hand_carried_count",
        "baggage.first_time_visit",
      ])
    );
    expect(
      keys(
        getPhEtravelPresentationSection(
          noDeclarationPresentation,
          "other_travel_details"
        )
      )
    ).toEqual(
      expect.arrayContaining([
        "baggage.checked_count",
        "baggage.hand_carried_count",
        "baggage.first_time_visit",
      ])
    );
    expect(
      keys(getPhEtravelPresentationSection(positivePresentation, "customs"))
    ).toContain("customs.checklist");
    expect(
      keys(getPhEtravelPresentationSection(positivePresentation, "customs"))
    ).toContain("baggage.items");
    expect(
      keys(getPhEtravelPresentationSection(positivePresentation, "currency"))
    ).toEqual(
      expect.arrayContaining([
        "currency.owner",
        "currency.recipient",
        "currency.items",
        "currency.sources",
        "currency.source_other",
        "currency.transport_purposes",
        "currency.transport_purpose_other",
        "currency.transport_method",
        "currency.courier_name",
        "currency.airway_bill_no",
        "currency.airway_bill_date",
        "currency.bsp_authorization_date",
      ])
    );
    expect(
      keys(
        getPhEtravelPresentationSection(
          positivePresentation,
          "signature_review"
        )
      )
    ).toContain("signature.applicant_signature");
    expect(
      keys(
        getPhEtravelPresentationSection(
          positivePresentation,
          "signature_review"
        )
      )
    ).toContain("attachments.upload_rules");
    const signatureReview = getPhEtravelPresentationSection(
      positivePresentation,
      "signature_review"
    );
    expect(
      signatureReview.fields.find(
        (field) => field.key === "signature.applicant_signature"
      )
    ).toMatchObject({
      control: "signature_pad",
      mode: "action_required",
      requiredWhen: "official signature page is reached",
    });
    expect(
      signatureReview.fields.find(
        (field) => field.key === "attachments.upload_rules"
      )
    ).toMatchObject({
      control: "static_notice",
      mode: "official_only",
    });
    expect(
      getPhEtravelPresentationSection(positivePresentation, "signature_review")
        .blockedReason
    ).toContain("signature is action-required");
  });

  test("keeps SEA electronic No and manual paths out of positive General/Currency fields", () => {
    const electronicNo = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_sea_passenger",
      transportType: "SEA",
      seaFlow: "electronic_customs",
      customsDeclaration: "no",
      currencyDeclaration: "no",
    });

    expect(
      keys(getPhEtravelPresentationSection(electronicNo, "customs"))
    ).not.toContain("customs.checklist");
    expect(
      getPhEtravelPresentationSection(electronicNo, "currency").fields
    ).toHaveLength(0);
    expect(
      getPhEtravelPresentationSection(electronicNo, "currency").blockedReason
    ).toContain("conditional on the official declaration threshold");
  });

  test("applies transit, stay type, goods, and currency transport conditions without global fields", () => {
    const presentation = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_air_passenger",
      transportType: "AIR",
      withTransit: true,
      stayLocationType: "TRANSIT",
      customsDeclaration: "yes",
      otherGoodsDeclared: true,
      currencyDeclaration: "yes",
      currencyTransportMethod: "courier",
    });

    expect(
      keys(getPhEtravelPresentationSection(presentation, "travel"))
    ).toEqual(
      expect.arrayContaining([
        "travel.transit_country_code",
        "travel.transit_port",
        "travel.transit_date",
      ])
    );
    expect(
      keys(getPhEtravelPresentationSection(presentation, "destination"))
    ).toEqual(
      expect.arrayContaining([
        "destination.transit_port_code",
        "destination.transit_destination_country_code",
      ])
    );
    expect(
      keys(getPhEtravelPresentationSection(presentation, "customs"))
    ).toEqual(expect.arrayContaining(["customs.checklist", "baggage.items"]));
    expect(
      keys(getPhEtravelPresentationSection(presentation, "currency"))
    ).toEqual(
      expect.arrayContaining([
        "currency.courier_name",
        "currency.airway_bill_no",
        "currency.airway_bill_date",
      ])
    );
    expect(
      keys(getPhEtravelPresentationSection(presentation, "currency"))
    ).not.toContain("currency.days_in_philippines");
  });

  test("diverts crew and cruise before ordinary passenger form presentation", () => {
    for (const choice of ["crew", "cruise"] as const) {
      const presentation = createPhEtravelFormPresentation({
        eligibilityChoice: choice,
        transportType: "SEA",
        seaFlow: "electronic_customs",
      });

      expect(presentation.route).toBe("diverted");
      expect(presentation.sections).toHaveLength(1);
      expect(presentation.sections[0].id).toBe("eligibility");
      expect(presentation.sections[0].blockedReason).toBeTruthy();
    }
  });

  test("keeps reference and QR as result-only fields and all review gates non-submitted", () => {
    for (const reviewProgress of [
      "signature_required",
      "family_gate",
      "companion_confirmation",
      "summary_reached",
    ] as const) {
      const presentation = createPhEtravelFormPresentation({
        eligibilityChoice: "ordinary_sea_passenger",
        transportType: "SEA",
        seaFlow: "electronic_customs",
        reviewProgress,
      });

      expect(presentation.submitted).toBe(false);
      expect(presentation.resultFields.map((field) => field.key)).toEqual([
        "result.official_reference",
        "result.reference_qr_render",
      ]);
      expect(
        presentation.resultFields.every((field) => field.mode === "result_only")
      ).toBe(true);
      const signatureReview = getPhEtravelPresentationSection(
        presentation,
        "signature_review"
      );
      expect(
        keys(signatureReview).some(
          (key) => key.startsWith("review.") || key.startsWith("signature.")
        )
      ).toBe(true);
      expect(
        signatureReview.fields
          .filter((field) => field.key.startsWith("review."))
          .every((field) => field.mode === "official_only")
      ).toBe(true);
    }
  });

  test("marks unverified controls as manual-review or official-only instead of unconditional inputs", () => {
    const presentation = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_air_passenger",
      transportType: "AIR",
      customsDeclaration: "yes",
      currencyDeclaration: "yes",
      currencyTransportMethod: "physical",
      otherGoodsDeclared: true,
      reviewProgress: "signature_required",
    });

    const travel = getPhEtravelPresentationSection(presentation, "travel");
    const currency = getPhEtravelPresentationSection(presentation, "currency");

    expect(
      travel.fields.find((field) => field.key === "air.airline_code")?.mode
    ).toBe("manual_review");
    expect(
      currency.fields.find(
        (field) => field.key === "currency.owner_not_applicable"
      )?.mode
    ).toBe("manual_review");
    expect(
      currency.fields.find(
        (field) => field.key === "currency.days_in_philippines"
      )?.mode
    ).toBe("manual_review");
    expect(
      keys(getPhEtravelPresentationSection(presentation, "signature_review"))
    ).toContain("attachments.upload_rules");
  });

  test("hides conditional owner and physical/courier children until their exact answers select them", () => {
    const presentation = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_sea_passenger",
      transportType: "SEA",
      seaFlow: "electronic_customs",
      customsDeclaration: "yes",
      currencyDeclaration: "yes",
      currencyOwnerNotApplicable: true,
      currencyTransportMethod: "physical",
    });
    const currency = getPhEtravelPresentationSection(presentation, "currency");

    expect(keys(currency)).not.toContain("currency.owner");
    expect(keys(currency)).not.toContain("currency.recipient");
    expect(keys(currency)).toEqual(
      expect.arrayContaining([
        "currency.days_in_philippines",
        "currency.last_travel_to_philippines",
      ])
    );
    expect(
      currency.fields.find(
        (field) => field.key === "currency.days_in_philippines"
      )
    ).toMatchObject({
      mode: "input_when_shared_ready",
      requiredWhen:
        "currency.transfer_method === is_physically_transferred_by_person",
    });
    expect(
      currency.fields.find(
        (field) => field.key === "currency.last_travel_to_philippines"
      )
    ).toMatchObject({
      mode: "input_when_shared_ready",
      requiredWhen:
        "currency.transfer_method === is_physically_transferred_by_person",
    });
    expect(keys(currency)).not.toContain("currency.courier_name");
  });

  test("does not make SEA physical fields required on courier, No, or manual paths", () => {
    const courier = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_sea_passenger",
      transportType: "SEA",
      seaFlow: "electronic_customs",
      customsDeclaration: "yes",
      currencyDeclaration: "yes",
      currencyTransportMethod: "courier",
    });
    const noDeclaration = createPhEtravelFormPresentation({
      eligibilityChoice: "ordinary_sea_passenger",
      transportType: "SEA",
      seaFlow: "electronic_customs",
      customsDeclaration: "no",
      currencyDeclaration: "no",
      currencyTransportMethod: "physical",
    });

    expect(
      keys(getPhEtravelPresentationSection(courier, "currency"))
    ).not.toContain("currency.days_in_philippines");
    expect(
      getPhEtravelPresentationSection(noDeclaration, "currency").fields
    ).toHaveLength(0);
  });

  test("keeps positive-path Family and Summary official-only even when an external status reaches them", () => {
    for (const reviewProgress of [
      "family_gate",
      "companion_confirmation",
      "summary_reached",
    ] as const) {
      const presentation = createPhEtravelFormPresentation({
        eligibilityChoice: "ordinary_sea_passenger",
        transportType: "SEA",
        seaFlow: "electronic_customs",
        customsDeclaration: "yes",
        reviewProgress,
      });
      const signatureReview = getPhEtravelPresentationSection(
        presentation,
        "signature_review"
      );

      expect(presentation.submitted).toBe(false);
      expect(
        signatureReview.fields.every((field) => field.mode === "official_only")
      ).toBe(true);
      expect(signatureReview.blockedReason).toContain("remain gated");
    }
  });
});
