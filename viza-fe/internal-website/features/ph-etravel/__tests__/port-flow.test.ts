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
    { code: "TP120", label: "Port of Legazpi", withCustomDeclaration: 1 },
    { code: "LEGAZPI", label: "Port of Legazpi", withCustomDeclaration: 1 },
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
      customsFlowHint: "electronic_customs",
      port: { code: "TP0103", withCustomDeclaration: 1 },
      requiresLiveContinuationReview: true,
    });
    expect(
      resolvePhEtravelSeaDestinationPortFlow("TP0011", snapshot, now)
    ).toMatchObject({
      status: "resolved",
      dynamicPageArrayGate: "electronic_sections_not_inserted",
      customsFlowHint: "manual_forms",
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

  test("selects the PH-only manual/electronic presentation from code metadata but keeps page drift gates", () => {
    const manual = createPhEtravelSeaPortOrderedPageContract({
      destinationPortCode: "TP0011",
      snapshot,
      now,
    });
    const electronicNo = createPhEtravelSeaPortOrderedPageContract({
      destinationPortCode: "TP0103",
      customsDeclaration: "no",
      snapshot,
      now,
    });
    const electronicYes = createPhEtravelSeaPortOrderedPageContract({
      destinationPortCode: "TP0103",
      customsDeclaration: "yes",
      snapshot,
      now,
    });
    const electronicPending = createPhEtravelSeaPortOrderedPageContract({
      destinationPortCode: "TP0103",
      snapshot,
      now,
    });

    expect(manual.contract?.path).toBe("sea_manual");
    expect(electronicNo.contract?.path).toBe("sea_electronic_no");
    expect(electronicYes.contract?.path).toBe(
      "sea_electronic_yes_through_signature"
    );
    expect(electronicPending.contract).toBeNull();
    expect(electronicPending.actionOnlyGates[0]).toMatchObject({
      key: "sea.electronic_customs_choice_required",
      evidence: "verified_public",
    });
    expect(manual.actionOnlyGates[0].reason).toContain("rendered official");
    expect(electronicNo.actionOnlyGates[0].reason).toContain(
      "Rendered official"
    );
  });

  test("keeps duplicate Port of Legazpi labels code-addressable", () => {
    const byCode = new Map(snapshot.ports.map((port) => [port.code, port]));
    expect(byCode.get("TP120")).toMatchObject({
      label: "Port of Legazpi",
      withCustomDeclaration: 1,
    });
    expect(byCode.get("LEGAZPI")).toMatchObject({
      label: "Port of Legazpi",
      withCustomDeclaration: 1,
    });
    expect(
      resolvePhEtravelSeaDestinationPortFlow("TP120", snapshot, now).port
    ).toMatchObject({ code: "TP120" });
    expect(
      resolvePhEtravelSeaDestinationPortFlow("LEGAZPI", snapshot, now).port
    ).toMatchObject({ code: "LEGAZPI" });
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
