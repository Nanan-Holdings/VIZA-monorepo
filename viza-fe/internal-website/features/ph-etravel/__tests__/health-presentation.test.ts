import { describe, expect, test } from "vitest";

import { createPhEtravelHealthPresentation } from "../health-presentation";

const keys = (input: ReturnType<typeof createPhEtravelHealthPresentation>) =>
  input.fields.map((field) => field.key);

describe("Philippines eTravel E23 Health presentation", () => {
  test("shows antigen only for the known client vaccine/age condition", () => {
    const eligible = createPhEtravelHealthPresentation({
      isFullyVaccinated: false,
      ageYears: 15,
    });
    const vaccinated = createPhEtravelHealthPresentation({
      isFullyVaccinated: true,
      ageYears: 30,
    });
    const underAge = createPhEtravelHealthPresentation({
      isFullyVaccinated: false,
      ageYears: 14,
    });

    expect(keys(eligible)).toContain("health.with_negative_antigen");
    expect(keys(vaccinated)).not.toContain("health.with_negative_antigen");
    expect(keys(underAge)).not.toContain("health.with_negative_antigen");
    expect(eligible.inheritedStateNotQuestions).toContain(
      "is_fully_vaccinated"
    );
  });

  test("keeps countries and symptoms in isolated positive branches with client clear hints", () => {
    const positive = createPhEtravelHealthPresentation({
      hasRecentTravelHistory: true,
      hasBeenSick: true,
    });
    const negative = createPhEtravelHealthPresentation({
      hasRecentTravelHistory: false,
      hasBeenSick: false,
    });

    expect(keys(positive)).toEqual(
      expect.arrayContaining([
        "health.visited_countries_30d",
        "health.sickness_symptoms",
      ])
    );
    expect(keys(negative)).not.toContain("health.visited_countries_30d");
    expect(keys(negative)).not.toContain("health.sickness_symptoms");
    expect(
      positive.clearOnChange["health.has_recent_travel_history_30d=false"]
    ).toEqual(["health.visited_countries_30d"]);
    expect(positive.clearOnChange["health.has_been_sick_30d"]).toEqual([
      "health.sickness_symptoms",
    ]);
  });

  test("does not turn bats/animals translation text or inherited state into a confirmed question", () => {
    const presentation = createPhEtravelHealthPresentation({});

    expect(presentation.translationOnly).toEqual([
      "health.exposed_to_bats_or_sick_animals",
    ]);
    expect(keys(presentation)).not.toContain(
      "health.exposed_to_bats_or_sick_animals"
    );
    expect(keys(presentation)).not.toEqual(
      expect.arrayContaining(["is_fully_vaccinated", "birth_date"])
    );
  });

  test("keeps AIR/SEA and passport-holder context unknown to the component-local contract", () => {
    const airFilipino = createPhEtravelHealthPresentation({
      transportType: "AIR",
      passportHolderType: "FILIPINO",
      hasRecentTravelHistory: true,
    });
    const seaForeigner = createPhEtravelHealthPresentation({
      transportType: "SEA",
      passportHolderType: "FOREIGNER",
      hasRecentTravelHistory: true,
    });

    expect(airFilipino.contextBoundary).toBe(
      "no_component_local_air_sea_or_passport_holder_split"
    );
    expect(keys(airFilipino)).toEqual(keys(seaForeigner));
  });

  test("keeps all client-known Health controls review-gated and non-launching", () => {
    const presentation = createPhEtravelHealthPresentation({
      isFullyVaccinated: false,
      ageYears: 30,
      hasRecentTravelHistory: true,
      hasBeenSick: true,
    });

    expect(
      presentation.fields.every(
        (field) =>
          field.mode === "review_gate" &&
          field.clientContract === "verified_public_bundle"
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
