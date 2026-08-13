import { describe, expect, test } from "vitest";

import {
  auditPhEtravelCoverage,
  getPhEtravelCoverageCounts,
  getPhEtravelEnabledApplicantCoverage,
  PH_ETRAVEL_CANONICAL_COVERAGE,
  PH_ETRAVEL_DIVERTED_COVERAGE,
} from "../coverage-parity";

describe("Philippines eTravel coverage parity map", () => {
  test("contains each of the 111 canonical records once with E21 evidence counts", () => {
    expect(PH_ETRAVEL_CANONICAL_COVERAGE).toHaveLength(111);
    expect(
      new Set(PH_ETRAVEL_CANONICAL_COVERAGE.map((record) => record.semanticKey))
        .size
    ).toBe(111);
    expect(getPhEtravelCoverageCounts()).toEqual({
      confirmed_live: 56,
      verified_public_bundle: 19,
      needs_review: 36,
    });
    expect(PH_ETRAVEL_DIVERTED_COVERAGE).toHaveLength(8);
    expect(
      PH_ETRAVEL_DIVERTED_COVERAGE.every(
        (record) => record.category === "unsupported_diverted"
      )
    ).toBe(true);
  });

  test("keeps profile, residence, AIR, and unresolved Health branches out of enabled inputs", () => {
    const enabledAir = getPhEtravelEnabledApplicantCoverage("ordinary_air");

    expect(
      enabledAir.some((record) => record.semanticKey.startsWith("traveller."))
    ).toBe(false);
    expect(
      enabledAir.some((record) => record.semanticKey.startsWith("residence."))
    ).toBe(false);
    expect(
      enabledAir.some((record) => record.semanticKey.startsWith("air."))
    ).toBe(false);
    expect(
      enabledAir.some((record) => record.semanticKey.startsWith("health."))
    ).toBe(false);
    expect(
      PH_ETRAVEL_CANONICAL_COVERAGE.filter(
        (record) => record.evidenceTier === "needs_review"
      ).every((record) => record.uiDisposition !== "input_when_shared_ready")
    ).toBe(true);
  });

  test("retains E22 AIR and destination client wiring as review-gated bundle evidence", () => {
    const byKey = (semanticKey: string) =>
      PH_ETRAVEL_CANONICAL_COVERAGE.find(
        (record) => record.semanticKey === semanticKey
      );

    for (const key of [
      "air.airline_code",
      "air.flight_number",
      "air.is_special_flight",
      "air.special_flight_number",
      "destination.same_as_residence",
      "destination.transit_port_code",
      "destination.transit_destination_country_code",
    ]) {
      expect(byKey(key)).toMatchObject({
        evidenceTier: "needs_review",
        clientContractEvidence: "verified_public_bundle",
        uiDisposition: "review_gate",
      });
    }
  });

  test("keeps E23 Health controls bundle-marked without promoting translation-only text", () => {
    const byKey = (semanticKey: string) =>
      PH_ETRAVEL_CANONICAL_COVERAGE.find(
        (record) => record.semanticKey === semanticKey
      );

    for (const key of [
      "health.with_negative_antigen",
      "health.has_recent_travel_history_30d",
      "health.visited_countries_30d",
      "health.has_exposure_to_sick_person_30d",
      "health.has_been_sick_30d",
      "health.sickness_symptoms",
    ]) {
      expect(byKey(key)?.clientContractEvidence).toBe("verified_public_bundle");
    }
    expect(
      byKey("health.exposed_to_bats_or_sick_animals")?.clientContractEvidence
    ).toBeUndefined();
  });

  test("keeps E24 SEA static visibility as review-gated bundle evidence", () => {
    const byKey = (semanticKey: string) =>
      PH_ETRAVEL_CANONICAL_COVERAGE.find(
        (record) => record.semanticKey === semanticKey
      );

    for (const key of [
      "sea.is_disembarking",
      "destination.stay_location_type",
      "destination.disembarking_port_code",
      "sea.destination_port_code",
    ]) {
      expect(byKey(key)?.clientContractEvidence).toBe("verified_public_bundle");
    }
    expect(byKey("sea.is_disembarking")).toMatchObject({
      evidenceTier: "needs_review",
      uiDisposition: "review_gate",
    });
  });

  test("preserves manual/electronic path isolation", () => {
    const byKey = (semanticKey: string) =>
      PH_ETRAVEL_CANONICAL_COVERAGE.find(
        (record) => record.semanticKey === semanticKey
      );

    expect(byKey("sea.vessel_name")?.paths).not.toContain("ordinary_air");
    expect(byKey("air.airline_code")?.paths).toEqual(["ordinary_air"]);
    expect(byKey("baggage.checked_count")?.paths).not.toContain("sea_manual");
    expect(byKey("customs.checklist")?.paths).toEqual([
      "ordinary_air",
      "sea_electronic_yes",
    ]);
    expect(byKey("destination.disembarking_port_code")?.paths).toEqual([
      "sea_manual",
    ]);
  });

  test("keeps runtime and result records out of applicant UI and retains only the QR legacy alias", () => {
    const runtime = PH_ETRAVEL_CANONICAL_COVERAGE.filter(
      (record) => record.category === "runtime"
    );
    const result = PH_ETRAVEL_CANONICAL_COVERAGE.filter(
      (record) => record.category === "result_only"
    );
    const renderedQr = result.find(
      (record) => record.semanticKey === "result.reference_qr_render"
    );

    expect(runtime).toHaveLength(3);
    expect(
      [...runtime, ...result].every(
        (record) => record.uiDisposition === "not_an_applicant_input"
      )
    ).toBe(true);
    expect(result.map((record) => record.semanticKey)).toEqual([
      "result.official_reference",
      "result.reference_qr_render",
    ]);
    expect(renderedQr?.legacyAliases).toEqual(["result.qr_artifact"]);
    expect(
      PH_ETRAVEL_CANONICAL_COVERAGE.some(
        (record) => record.semanticKey === "result.qr_artifact"
      )
    ).toBe(false);
  });

  test("detects duplicate, owner, leakage, wrong-path, and review-gate violations", () => {
    expect(auditPhEtravelCoverage()).toEqual([]);

    const source = PH_ETRAVEL_CANONICAL_COVERAGE.find(
      (record) => record.semanticKey === "result.official_reference"
    );
    const air = PH_ETRAVEL_CANONICAL_COVERAGE.find(
      (record) => record.semanticKey === "air.airline_code"
    );
    const unresolved = PH_ETRAVEL_CANONICAL_COVERAGE.find(
      (record) => record.semanticKey === "health.sickness_symptoms"
    );
    expect(source).toBeDefined();
    expect(air).toBeDefined();
    expect(unresolved).toBeDefined();

    expect(
      auditPhEtravelCoverage([
        ...PH_ETRAVEL_CANONICAL_COVERAGE,
        { ...source!, uiDisposition: "input_when_shared_ready" },
        { ...air!, paths: ["sea_manual"] },
        {
          ...unresolved!,
          uiDisposition: "input_when_shared_ready",
          owners: [],
        },
      ])
    ).toEqual(
      expect.arrayContaining([
        "duplicate_semantic_key",
        "missing_coverage_owner",
        "result_leaks_to_ui",
        "wrong_path_scope",
        "needs_review_enabled_input",
      ])
    );
  });
});
