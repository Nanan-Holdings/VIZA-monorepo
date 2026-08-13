import { describe, expect, test } from "vitest";

import { createPhEtravelAirDestinationPresentation } from "../air-destination-presentation";

const keys = (
  input: ReturnType<typeof createPhEtravelAirDestinationPresentation>
) => input.fields.map((field) => field.key);

describe("Philippines eTravel E22 AIR/destination presentation", () => {
  test("keeps Special Flight derived and maps only its detail to flight_number_special", () => {
    const presentation = createPhEtravelAirDestinationPresentation({
      passportHolderType: "FOREIGNER",
      transportType: "AIR",
      direction: "ARRIVAL",
      flightNumber: "SPECIAL FLIGHT",
    });

    expect(presentation.derived.specialFlight).toEqual({
      active: true,
      condition: "flight_number === SPECIAL FLIGHT",
      isApplicantAnswer: false,
      excludedFromPayload: ["air.is_special_flight"],
    });
    expect(keys(presentation)).toContain("air.special_flight_number");
    expect(
      presentation.fields.find(
        (field) => field.key === "air.special_flight_number"
      )?.officialKey
    ).toBe("flight_number_special");
    expect(keys(presentation)).not.toContain("air.is_special_flight");
  });

  test("isolates AIR from SEA and applies Transit/return-date conditions", () => {
    const air = createPhEtravelAirDestinationPresentation({
      passportHolderType: "FOREIGNER",
      transportType: "AIR",
      direction: "ARRIVAL",
      purposeCode: "POV001",
      withTransit: true,
      stayLocationType: "TRANSIT",
    });
    const sea = createPhEtravelAirDestinationPresentation({
      passportHolderType: "FOREIGNER",
      transportType: "SEA",
      direction: "ARRIVAL",
      purposeCode: "POV001",
      withTransit: true,
      stayLocationType: "TRANSIT",
    });

    expect(air.route).toBe("air_review");
    expect(keys(air)).toEqual(
      expect.arrayContaining([
        "travel.transit_country_code",
        "travel.transit_port",
        "travel.transit_date",
        "travel.return_date",
        "destination.transit_port_code",
        "destination.transit_destination_country_code",
      ])
    );
    expect(sea.route).toBe("not_applicable");
    expect(sea.fields).toHaveLength(0);
  });

  test("keeps Residence and Hotel display paths separate and review-gated", () => {
    const residence = createPhEtravelAirDestinationPresentation({
      passportHolderType: "FILIPINO",
      transportType: "AIR",
      direction: "ARRIVAL",
      stayLocationType: "RESIDENCE",
    });
    const hotel = createPhEtravelAirDestinationPresentation({
      passportHolderType: "FILIPINO",
      transportType: "AIR",
      direction: "ARRIVAL",
      stayLocationType: "HOTEL",
    });

    expect(keys(residence)).toEqual(
      expect.arrayContaining([
        "destination.same_as_residence",
        "destination.address_text",
      ])
    );
    expect(keys(residence)).not.toContain("destination.hotel_name_or_address");
    expect(keys(hotel)).toContain("destination.hotel_name_or_address");
    expect(keys(hotel)).not.toContain("destination.same_as_residence");
    expect(
      hotel.fields.find(
        (field) => field.key === "destination.hotel_name_or_address"
      )?.liveServerUnknown
    ).toMatch(/dynamic|stable hotel code|server acceptance/i);
  });

  test("keeps every E22 branch non-launching and without acceptance promises", () => {
    const presentation = createPhEtravelAirDestinationPresentation({
      passportHolderType: "FOREIGNER",
      transportType: "AIR",
      direction: "ARRIVAL",
      purposeCode: "POV007",
      withTransit: true,
      stayLocationType: "HOTEL",
    });

    expect(presentation.gate).toMatchObject({
      authorization: "stop_before_submit",
      submitted: false,
      noQueue: true,
      noBrowser: true,
      noResubmit: true,
    });
    expect(
      presentation.fields.every(
        (field) =>
          field.mode === "review_gate" &&
          field.clientContract === "verified_public_bundle"
      )
    ).toBe(true);
    expect(JSON.stringify(presentation.gate.userCopy)).not.toMatch(/accepted/i);
  });
});
