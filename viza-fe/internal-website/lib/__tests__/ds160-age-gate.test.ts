import { describe, expect, it } from "vitest";
import {
  DS160_WORK_EDUCATION_MINIMUM_AGE,
  getDs160Age,
  getDs160AgeVisibleStep,
  isDs160FieldVisibleForAge,
  isDs160FieldVisibleForRuntime,
  isDs160NationalityGateVisible,
  isDs160UsContactVisible,
  isDs160WorkEducationVisible,
} from "@/lib/ds160-age-gate";
import type { WizardStep } from "@/types/visa-form-fields";

const today = new Date("2026-09-21T12:00:00.000Z");

function step(): WizardStep {
  return {
    stepNumber: 10,
    stepName: "Work/Education/Training: Present",
    fields: [
      {
        id: "occupation",
        visaType: "DS160",
        fieldName: "primary_occupation",
        label: "Primary Occupation",
        fieldType: "select",
        required: true,
        stepNumber: 10,
        stepName: "Work/Education/Training: Present",
        displayOrder: 1,
        placeholder: null,
        validationRules: null,
        options: null,
        conditionalLogic: null,
      },
      {
        id: "unrelated",
        visaType: "DS160",
        fieldName: "unrelated_field",
        label: "Unrelated",
        fieldType: "text",
        required: false,
        stepNumber: 10,
        stepName: "Work/Education/Training: Present",
        displayOrder: 2,
        placeholder: null,
        validationRules: { minimum_age: 14 },
        options: null,
        conditionalLogic: null,
      },
    ],
  };
}

function estaField(): WizardStep["fields"][number] {
  return {
    id: "vwp-denial",
    visaType: "DS160",
    fieldName: "vwp_denial",
    label: "ESTA denial",
    fieldType: "radio",
    required: true,
    stepNumber: 5,
    stepName: "Previous U.S. Travel",
    displayOrder: 90,
    placeholder: null,
    validationRules: { nationality_gate: "CEAC_ESTA" },
    options: ["yes", "no"],
    conditionalLogic: null,
  };
}

describe("DS-160 age-gated work/education form behavior", () => {
  it("matches the live fourteen-year boundary", () => {
    expect(DS160_WORK_EDUCATION_MINIMUM_AGE).toBe(14);
    expect(getDs160Age("2012-09-21", today)).toBe(14);
    expect(getDs160Age("2012-09-22", today)).toBe(13);
    expect(isDs160WorkEducationVisible({ date_of_birth: "2012-09-22" }, today)).toBe(false);
    expect(isDs160WorkEducationVisible({ date_of_birth: "" }, today)).toBe(true);
    expect(isDs160UsContactVisible({ has_specific_plans: "no", intended_length_of_stay_unit: "H" })).toBe(false);
    expect(isDs160UsContactVisible({ has_specific_plans: "no", intended_length_of_stay_unit: "LESS_THAN_24_HOURS" })).toBe(false);
    expect(isDs160UsContactVisible({ has_specific_plans: "no", intended_length_of_stay_unit: "D" })).toBe(true);
  });

  it("filters only age-gated fields and preserves the original step for adults/unknown DOB", () => {
    const workStep = step();
    expect(getDs160AgeVisibleStep(workStep, "DS160", { date_of_birth: "2012-09-22" }, today).fields).toEqual([]);
    expect(getDs160AgeVisibleStep(workStep, "DS160", { date_of_birth: "2012-09-21" }, today)).toBe(workStep);
    expect(getDs160AgeVisibleStep(workStep, "DS160", { date_of_birth: "" }, today)).toBe(workStep);
    expect(isDs160FieldVisibleForAge(workStep.fields[0], workStep, "ID_C1_TOURIST", { date_of_birth: "2012-09-22" }, today)).toBe(true);
  });

  it("does not require an omitted U.S. contact step in the H-stay branch", () => {
    const contactStep: WizardStep = {
      ...step(),
      stepName: "US Point of Contact",
    };
    const answers = { has_specific_plans: "no", intended_length_of_stay_unit: "H" };
    expect(getDs160AgeVisibleStep(contactStep, "DS160", answers, today).fields).toEqual([]);
  });

  it("uses the official 37-code ESTA gate and legacy nationality aliases", () => {
    const field = estaField();
    const previousTravelStep: WizardStep = {
      stepNumber: 5,
      stepName: "Previous U.S. Travel",
      fields: [field],
    };

    expect(isDs160NationalityGateVisible(field, { nationality_country: "JPN" })).toBe(true);
    expect(isDs160NationalityGateVisible(field, { nationality_country: "JP" })).toBe(true);
    expect(isDs160NationalityGateVisible(field, { nationality_country: "CHIN" })).toBe(false);
    expect(isDs160NationalityGateVisible(field, { nationality_country: "中国" })).toBe(false);
    expect(isDs160FieldVisibleForRuntime(field, previousTravelStep, "DS160", {
      nationality_country: "CHIN",
      other_nationality: "yes",
      other_nationality_country__1: "JPN",
      other_nationality_has_passport__1: "no",
    }, today)).toBe(true);
    expect(getDs160AgeVisibleStep(previousTravelStep, "DS160", {
      nationality_country: "CHIN",
      other_nationality: "no",
    }, today).fields).toEqual([]);
  });

  it("does not treat permanent residency as an ESTA nationality gate", () => {
    const field = estaField();
    expect(isDs160NationalityGateVisible(field, {
      nationality_country: "CHIN",
      other_nationality: "no",
      other_permanent_resident_country: "JPN",
    })).toBe(false);
    expect(isDs160NationalityGateVisible(field, {
      nationality_country: "CHIN",
      other_nationality: "yes",
      other_nationality_country__1: "CAN",
      other_permanent_resident_country: "JPN",
    })).toBe(false);
  });
});
