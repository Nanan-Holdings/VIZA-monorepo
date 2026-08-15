import { describe, expect, test } from "vitest";

import {
  createPhEtravelHealthPresentation,
  getPhEtravelHealthMissingItems,
  PH_ETRAVEL_HEALTH_STATIC_NOTICE,
  PH_ETRAVEL_HEALTH_SYMPTOM_OPTIONS,
} from "../health-presentation";

const keys = (input: ReturnType<typeof createPhEtravelHealthPresentation>) =>
  input.fields.map((field) => field.key);

describe("Philippines eTravel Health Declaration presentation", () => {
  test("records the static notice and three required Yes/No questions", () => {
    const presentation = createPhEtravelHealthPresentation({});

    expect(presentation.staticNotices).toEqual([
      {
        key: "health.notice_no_covid_requirement",
        copy: PH_ETRAVEL_HEALTH_STATIC_NOTICE,
        isApplicantAnswer: false,
      },
    ]);
    expect(presentation.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "health.has_recent_travel_history_30d",
          control: "yes_no",
          required: true,
        }),
        expect.objectContaining({
          key: "health.has_exposure_to_sick_person_30d",
          control: "yes_no",
          required: true,
        }),
        expect.objectContaining({
          key: "health.has_been_sick_30d",
          control: "yes_no",
          required: true,
        }),
      ])
    );
    expect(presentation.transportScope).toBe(
      "air_and_sea_same_health_declaration"
    );
  });

  test("shows the repeatable all-country branch only for recent-travel Yes", () => {
    const positive = createPhEtravelHealthPresentation({
      hasRecentTravelHistory: true,
    });
    const negative = createPhEtravelHealthPresentation({
      hasRecentTravelHistory: false,
    });
    const countries = positive.fields.find(
      (field) => field.key === "health.visited_countries_30d"
    );

    expect(countries).toMatchObject({
      control: "repeatable_country_select",
      required: true,
      repeatable: {
        addControl: true,
        deleteControl: true,
        minimumRows: 1,
        eachRowRequired: true,
        optionSource: "all_official_countries",
        includesPhilippines: true,
      },
    });
    expect(keys(negative)).not.toContain("health.visited_countries_30d");
    expect(
      positive.clearOnChange["health.has_recent_travel_history_30d=false"]
    ).toEqual(["health.visited_countries_30d"]);
  });

  test("shows exactly the confirmed 15 symptom checkboxes only for sick Yes", () => {
    const positive = createPhEtravelHealthPresentation({ hasBeenSick: true });
    const negative = createPhEtravelHealthPresentation({ hasBeenSick: false });
    const symptoms = positive.fields.find(
      (field) => field.key === "health.sickness_symptoms"
    );

    expect(symptoms).toMatchObject({
      control: "multi_checkbox",
      required: true,
      multiSelect: { minimumSelections: 1 },
    });
    expect(symptoms?.multiSelect?.options).toEqual(
      PH_ETRAVEL_HEALTH_SYMPTOM_OPTIONS
    );
    expect(PH_ETRAVEL_HEALTH_SYMPTOM_OPTIONS).toHaveLength(15);
    expect(PH_ETRAVEL_HEALTH_SYMPTOM_OPTIONS.map((option) => option.label)).toEqual([
      "Altered Mental Status",
      "Colds",
      "Cough",
      "Diarrhea",
      "Difficulty of Breathing",
      "Dizziness",
      "Fever",
      "Headache",
      "Loss of appetite",
      "Loss of smell",
      "Loss of taste",
      "Muscle Pain",
      "Nausea",
      "Rashes, vesicles or blisters",
      "Sore throat",
    ]);
    expect(keys(negative)).not.toContain("health.sickness_symptoms");
    expect(positive.clearOnChange["health.has_been_sick_30d=false"]).toEqual([
      "health.sickness_symptoms",
    ]);
  });

  test("requires only base answers plus each shown conditional minimum", () => {
    expect(getPhEtravelHealthMissingItems({})).toEqual([
      { fieldName: "has_recent_travel_history_30d", reason: "required" },
      {
        fieldName: "has_exposure_to_sick_person_30d",
        reason: "required",
      },
      { fieldName: "has_been_sick_30d", reason: "required" },
    ]);
    expect(
      getPhEtravelHealthMissingItems({
        hasRecentTravelHistory: true,
        hasExposureToSickPerson: false,
        hasBeenSick: true,
        visitedCountryCodes: [""],
        sicknessSymptomCodes: [],
      })
    ).toEqual([
      { fieldName: "visited_country_30d", reason: "minimum_one_selection" },
      { fieldName: "sickness_symptom", reason: "minimum_one_selection" },
    ]);
    expect(
      getPhEtravelHealthMissingItems({
        hasRecentTravelHistory: false,
        hasExposureToSickPerson: true,
        hasBeenSick: false,
      })
    ).toEqual([]);
  });

  test("does not invent an exposure child or promote translation-only text", () => {
    const presentation = createPhEtravelHealthPresentation({});

    expect(presentation.translationOnly).toEqual([
      "health.exposed_to_bats_or_sick_animals",
    ]);
    expect(keys(presentation)).not.toContain(
      "health.exposed_to_bats_or_sick_animals"
    );
    expect(
      presentation.fields.find(
        (field) => field.key === "health.has_exposure_to_sick_person_30d"
      )?.liveServerUnknown
    ).toMatch(/No child question is confirmed/i);
  });
});
