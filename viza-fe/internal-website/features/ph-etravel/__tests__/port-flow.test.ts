import { describe, expect, test } from "vitest";

import { createPhEtravelSeaPortOrderedPageContract } from "../page-contract";
import { resolvePhEtravelSeaDestinationPortFlow } from "../port-flow";
import { createPhEtravelSeaDestinationPresentation } from "../sea-destination-presentation";

const now = new Date("2026-08-04T12:00:00.000Z");
const snapshot = {
  retrievedAt: "2026-08-04T10:00:00.000Z",
  ports: [
    { code: "TP0103", label: "Manila South Harbor", withCustomDeclaration: 1 },
    { code: "TP0011", label: "Port of Cebu (PHCEB)", withCustomDeclaration: 0 },
  ] as const,
};

const fieldKeys = (
  presentation: ReturnType<typeof createPhEtravelSeaDestinationPresentation>
) => presentation.fields.map((field) => field.key);

describe("Philippines eTravel E24 SEA destination presentation", () => {
  test("treats destination-port metadata as only a dynamic page-array gate", () => {
    expect(
      resolvePhEtravelSeaDestinationPortFlow("TP0103", snapshot, now)
    ).toMatchObject({
      status: "resolved",
      dynamicPageArrayGate: "electronic_sections_inserted",
      port: { code: "TP0103", withCustomDeclaration: 1 },
      requiresLiveContinuationReview: true,
    });
    expect(
      resolvePhEtravelSeaDestinationPortFlow("TP0011", snapshot, now)
    ).toMatchObject({
      status: "resolved",
      dynamicPageArrayGate: "electronic_sections_not_inserted",
      port: { code: "TP0011", withCustomDeclaration: 0 },
      requiresLiveContinuationReview: true,
    });
  });

  test("fails closed for missing, unknown, invalid, or stale port metadata", () => {
    expect(
      resolvePhEtravelSeaDestinationPortFlow(undefined, snapshot, now).status
    ).toBe("missing_destination_port");
    expect(
      resolvePhEtravelSeaDestinationPortFlow("UNKNOWN", snapshot, now).status
    ).toBe("unknown_destination_port");
    expect(
      resolvePhEtravelSeaDestinationPortFlow(
        "TP0103",
        {
          retrievedAt: "2026-08-04T10:00:00.000Z",
          ports: [{ code: "TP0103", label: "", withCustomDeclaration: 1 }],
        },
        now
      ).status
    ).toBe("invalid_port_metadata");
    expect(
      resolvePhEtravelSeaDestinationPortFlow(
        "TP0103",
        { ...snapshot, retrievedAt: "2026-08-03T10:00:00.000Z" },
        now
      ).status
    ).toBe("stale_port_metadata");
  });

  test("does not select a SEA ordered customs path from either metadata value", () => {
    for (const destinationPortCode of ["TP0103", "TP0011"]) {
      const result = createPhEtravelSeaPortOrderedPageContract({
        destinationPortCode,
        snapshot,
        now,
      });

      expect(result.contract).toBeNull();
      expect(result.actionOnlyGates[0]).toMatchObject({
        key: "sea.destination_port_dynamic_page_array_review",
        evidence: "official_evidence_required",
      });
    }
  });

  test("shows the SEA disembarking control only for SEA ARRIVAL and falsey hides the stay subtree", () => {
    const air = createPhEtravelSeaDestinationPresentation({
      transportType: "AIR",
      flightType: "ARRIVAL",
    });
    const departure = createPhEtravelSeaDestinationPresentation({
      transportType: "SEA",
      flightType: "DEPARTURE",
    });
    const falsey = createPhEtravelSeaDestinationPresentation({
      transportType: "SEA",
      flightType: "ARRIVAL",
      isDisembarking: false,
      destinationPortCode: "TP0103",
      portSnapshot: snapshot,
      now,
    });

    expect(air.route).toBe("not_applicable");
    expect(departure.route).toBe("not_applicable");
    expect(falsey.route).toBe("sea_arrival");
    expect(falsey.falseyHidesStayDestination).toBe(true);
    expect(fieldKeys(falsey)).toEqual([
      "sea.is_disembarking",
      "sea.destination_port_code",
    ]);
    expect(fieldKeys(falsey)).not.toContain("destination.stay_location_type");
    expect(fieldKeys(falsey)).not.toContain(
      "destination.disembarking_port_code"
    );
  });

  test("keeps the two port fields independent and only exposes the stay child for true/TRAVEL_PORT", () => {
    const trueTravelPort = createPhEtravelSeaDestinationPresentation({
      transportType: "SEA",
      flightType: "ARRIVAL",
      isDisembarking: true,
      stayLocationType: "TRAVEL_PORT",
      destinationPortCode: "TP0103",
      disembarkingPortCode: "UNRELATED-PORT",
      portSnapshot: snapshot,
      now,
    });
    const differentVoyagePort = createPhEtravelSeaDestinationPresentation({
      transportType: "SEA",
      flightType: "ARRIVAL",
      isDisembarking: true,
      stayLocationType: "TRAVEL_PORT",
      destinationPortCode: "TP0011",
      disembarkingPortCode: "UNRELATED-PORT",
      portSnapshot: snapshot,
      now,
    });

    expect(fieldKeys(trueTravelPort)).toEqual(
      expect.arrayContaining([
        "sea.destination_port_code",
        "destination.disembarking_port_code",
      ])
    );
    expect(trueTravelPort.portIdentityBoundary).toBe(
      "destination_port_code_is_independent_from_disembarking_port_code"
    );
    expect(trueTravelPort.destinationPortResolution?.dynamicPageArrayGate).toBe(
      "electronic_sections_inserted"
    );
    expect(
      differentVoyagePort.destinationPortResolution?.dynamicPageArrayGate
    ).toBe("electronic_sections_not_inserted");
    expect(trueTravelPort.clearBoundary).toBe(
      "no_disembarking_clear_rule_observed"
    );
  });

  test("keeps all E24 display states review-gated and non-launching", () => {
    const presentation = createPhEtravelSeaDestinationPresentation({
      transportType: "SEA",
      flightType: "ARRIVAL",
      isDisembarking: true,
      stayLocationType: "HOTEL",
      destinationPortCode: "TP0103",
      portSnapshot: snapshot,
      now,
    });

    expect(
      presentation.fields.every(
        (field) =>
          field.clientContract === "verified_public_bundle" &&
          field.serverEvidence === "needs_review" &&
          field.mode === "review_gate"
      )
    ).toBe(true);
    expect(presentation.gate).toMatchObject({
      authorization: "stop_before_submit",
      submitted: false,
      noQueue: true,
      noBrowser: true,
      noResubmit: true,
    });
  });
});
