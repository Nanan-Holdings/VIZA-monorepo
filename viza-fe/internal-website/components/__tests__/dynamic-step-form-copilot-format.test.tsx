import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "../dynamic-step-form";
import { buildUniversalProfileAnswerPatch } from "@/lib/universal-profile-prefill";
import { getChineseLabel, getChineseOptionText, getEnglishPlaceholder } from "@/lib/ds160-translations";
import enMessages from "@/messages/en.json";
import zhMessages from "@/messages/zh.json";
import { type WizardStep } from "@/types/visa-form-fields";
import { auConfig } from "@/components/client/wizards/au/config";
import { egConfig } from "@/components/client/wizards/eg/config";
import { idConfig } from "@/components/client/wizards/id/config";
import { schengenConfig } from "@/components/client/wizards/schengen/config";
import { ukConfig } from "@/components/client/wizards/uk/config";
import { usConfig } from "@/components/client/wizards/us/config";
import { vnConfig } from "@/components/client/wizards/vn/config";
import type { WizardConfig } from "@/components/client/wizards/shell/types";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const requiredTextStep: WizardStep = {
  stepNumber: 1,
  stepName: "Personal Information",
  fields: [
    {
      id: "field-surname",
      visaType: "DS160",
      fieldName: "surname",
      label: "Surname",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Personal Information",
      displayOrder: 1,
      placeholder: "e.g. LI",
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
  ],
};

const shortcutStep: WizardStep = {
  stepNumber: 1,
  stepName: "Shortcuts",
  fields: [
    {
      id: "field-travel-plan",
      visaType: "DS160",
      fieldName: "has_travel_plan",
      label: "Do you have a specific travel plan?",
      fieldType: "radio",
      required: false,
      stepNumber: 1,
      stepName: "Shortcuts",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: [
        { value: "YES", text: "Yes" },
        { value: "NO", text: "No" },
      ],
      conditionalLogic: null,
    },
  ],
};

const conditionalPanelStep: WizardStep = {
  stepNumber: 6,
  stepName: "Inviter in Japan",
  fields: [
    {
      id: "field-has-inviter",
      visaType: "JP_TOURIST",
      fieldName: "has_inviter_in_japan",
      label: "Do you have an inviter in Japan?",
      fieldType: "radio",
      required: true,
      stepNumber: 6,
      stepName: "Inviter in Japan",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
      conditionalLogic: null,
    },
    {
      id: "field-inviter-name",
      visaType: "JP_TOURIST",
      fieldName: "inviter_full_name",
      label: "Inviter full name",
      fieldType: "text",
      required: true,
      stepNumber: 6,
      stepName: "Inviter in Japan",
      displayOrder: 2,
      placeholder: null,
      validationRules: { block_group: "inviter" },
      options: null,
      conditionalLogic: { showIf: "has_inviter_in_japan === yes" },
    },
    {
      id: "field-inviter-address",
      visaType: "JP_TOURIST",
      fieldName: "inviter_address",
      label: "Inviter address",
      fieldType: "text",
      required: true,
      stepNumber: 6,
      stepName: "Inviter in Japan",
      displayOrder: 3,
      placeholder: null,
      validationRules: { block_group: "inviter" },
      options: null,
      conditionalLogic: { showIf: "has_inviter_in_japan === yes" },
    },
    {
      id: "field-has-special-request",
      visaType: "JP_TOURIST",
      fieldName: "has_special_request",
      label: "Do you have a special request?",
      fieldType: "radio",
      required: true,
      stepNumber: 6,
      stepName: "Inviter in Japan",
      displayOrder: 4,
      placeholder: null,
      validationRules: null,
      options: [{ value: "yes", text: "Yes" }, { value: "no", text: "No" }],
      conditionalLogic: null,
    },
    {
      id: "field-special-request",
      visaType: "JP_TOURIST",
      fieldName: "special_request_details",
      label: "Special request details",
      fieldType: "textarea",
      required: true,
      stepNumber: 6,
      stepName: "Inviter in Japan",
      displayOrder: 5,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: { showIf: "has_special_request === yes" },
    },
    {
      id: "field-reference-note",
      visaType: "JP_TOURIST",
      fieldName: "reference_note",
      label: "Reference note",
      fieldType: "text",
      required: false,
      stepNumber: 6,
      stepName: "Inviter in Japan",
      displayOrder: 6,
      placeholder: null,
      validationRules: { block_group: "reference" },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const purposeOfTripStep: WizardStep = {
  stepNumber: 3,
  stepName: "Travel Information",
  fields: [
    {
      id: "field-purpose-of-trip",
      visaType: "DS160",
      fieldName: "purpose_of_trip",
      label: "Purpose of Trip to the U.S.",
      fieldType: "select",
      required: true,
      stepNumber: 3,
      stepName: "Travel Information",
      displayOrder: 1,
      placeholder: "Select...",
      validationRules: { repeatable: true, repeat_group: "trip_purpose" },
      options: [
        { value: "A", text: "FOREIGN GOVERNMENT OFFICIAL (A)" },
        { value: "B", text: "TEMP. BUSINESS OR PLEASURE VISITOR (B)" },
        { value: "C", text: "ALIEN IN TRANSIT (C)" },
      ],
      conditionalLogic: null,
    },
  ],
};

const occupationStep: WizardStep = {
  stepNumber: 4,
  stepName: "Occupation",
  fields: [
    {
      id: "field-current-profession",
      visaType: "JP_TOURIST",
      fieldName: "current_profession",
      label: "Current profession or occupation",
      fieldType: "select",
      required: true,
      stepNumber: 4,
      stepName: "Occupation",
      displayOrder: 1,
      placeholder: "Select...",
      validationRules: null,
      options: [
        { value: "employed", text: "Employed" },
        { value: "self_employed", text: "Self-employed" },
        { value: "student", text: "Student" },
      ],
      conditionalLogic: null,
    },
  ],
};

const placeOfBirthStep: WizardStep = {
  stepNumber: 1,
  stepName: "Personal Information",
  fields: [
    {
      id: "field-place-of-birth",
      visaType: "SCHENGEN_C",
      fieldName: "place_of_birth",
      label: "Place of birth (city or town)",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Personal Information",
      displayOrder: 1,
      placeholder: "City and country of birth",
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
  ],
};

const cityOfBirthStep: WizardStep = {
  stepNumber: 1,
  stepName: "Personal Information",
  fields: [
    {
      id: "field-city-of-birth",
      visaType: "DS160",
      fieldName: "city_of_birth",
      label: "City of Birth",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Personal Information",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
  ],
};

const sgacFullNameStep: WizardStep = {
  stepNumber: 1,
  stepName: "Traveller Information",
  fields: [
    {
      id: "field-sgac-full-name",
      visaType: "SG_ARRIVAL_CARD",
      fieldName: "full_name",
      label: "Full Name (In Passport)",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Traveller Information",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
  ],
};

const sgacTravellerPersistenceStep: WizardStep = {
  stepNumber: 1,
  stepName: "Traveller Information",
  fields: [
    {
      id: "field-sgac-persistence-full-name",
      visaType: "SG_ARRIVAL_CARD",
      fieldName: "full_name",
      label: "Full Name (In Passport)",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Traveller Information",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-sgac-persistence-passport-number",
      visaType: "SG_ARRIVAL_CARD",
      fieldName: "passport_number",
      label: "Passport Number",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Traveller Information",
      displayOrder: 2,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-sgac-persistence-passport-expiry",
      visaType: "SG_ARRIVAL_CARD",
      fieldName: "passport_expiry_date",
      label: "Passport Expiry Date",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Traveller Information",
      displayOrder: 3,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
  ],
};

const optionalPostcodeStep: WizardStep = {
  stepNumber: 3,
  stepName: "Accommodation Information",
  fields: [
    {
      id: "field-postcode",
      visaType: "TH_TDAC_ARRIVAL_CARD",
      fieldName: "postcode",
      label: "Post Code",
      fieldType: "text",
      required: false,
      stepNumber: 3,
      stepName: "Accommodation Information",
      displayOrder: 1,
      placeholder: "Enter post code",
      validationRules: { pattern: "^[0-9]{5}$" },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const vnPrearrivalEvisaNumberStep: WizardStep = {
  stepNumber: 1,
  stepName: "Passenger Information",
  fields: [
    {
      id: "field-visa-type",
      visaType: "VN_PREARRIVAL_DECLARATION",
      fieldName: "visa_type",
      label: "Visa Type / Purpose",
      fieldType: "select",
      required: true,
      stepNumber: 1,
      stepName: "Passenger Information",
      displayOrder: 1,
      placeholder: "Select...",
      validationRules: null,
      options: [
        { value: "EV", text: "Electronic Visa (E-Visa)" },
        { value: "VR", text: "Visa exemption" },
      ],
      conditionalLogic: null,
    },
    {
      id: "field-visa-number",
      visaType: "VN_PREARRIVAL_DECLARATION",
      fieldName: "visa_number",
      label: "Number",
      fieldType: "text",
      required: true,
      stepNumber: 1,
      stepName: "Passenger Information",
      displayOrder: 2,
      placeholder: "Enter the 9-digit E-Visa number",
      validationRules: { pattern: "^[0-9]{9}$" },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const vnPrearrivalHotelHierarchyStep: WizardStep = {
  stepNumber: 2,
  stepName: "Trip Information",
  fields: [
    {
      id: "field-flight-number",
      visaType: "VN_PREARRIVAL_DECLARATION",
      fieldName: "flight_number",
      label: "Flight Number",
      fieldType: "select",
      required: true,
      stepNumber: 2,
      stepName: "Trip Information",
      displayOrder: 1,
      placeholder: "Select...",
      validationRules: { official_source: "prearrival_category:flight" },
      options: [{ value: "VJ5439_CXR", text: "VJ5439 - CXR" }],
      conditionalLogic: null,
    },
    {
      id: "field-accommodation-type",
      visaType: "VN_PREARRIVAL_DECLARATION",
      fieldName: "accommodation_type",
      label: "Type of Accommodation in Vietnam",
      fieldType: "radio",
      required: true,
      stepNumber: 2,
      stepName: "Trip Information",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: [{ value: "hotel", text: "Hotel" }],
      conditionalLogic: null,
    },
    {
      id: "field-province-city",
      visaType: "VN_PREARRIVAL_DECLARATION",
      fieldName: "province_city_of_hotel",
      label: "Province / City of Hotel",
      fieldType: "select",
      required: true,
      stepNumber: 2,
      stepName: "Trip Information",
      displayOrder: 2,
      placeholder: "Select...",
      validationRules: { official_source: "prearrival_category:administrative_unit_level1" },
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-ward-commune",
      visaType: "VN_PREARRIVAL_DECLARATION",
      fieldName: "ward_commune_of_hotel",
      label: "Ward / Commune of Hotel",
      fieldType: "select",
      required: true,
      stepNumber: 2,
      stepName: "Trip Information",
      displayOrder: 3,
      placeholder: "Select...",
      validationRules: {
        official_source: "prearrival_category:administrative_unit_level2",
        depends_on: "province_city_of_hotel",
      },
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-hotel-address",
      visaType: "VN_PREARRIVAL_DECLARATION",
      fieldName: "hotel_accommodation_address",
      label: "Accommodation Address",
      fieldType: "select",
      required: true,
      stepNumber: 2,
      stepName: "Trip Information",
      displayOrder: 4,
      placeholder: "Select...",
      validationRules: {
        official_source: "prearrival_category:hotel",
        depends_on: "ward_commune_of_hotel",
      },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const tdacResidenceStep: WizardStep = {
  stepNumber: 1,
  stepName: "Traveller Information",
  fields: [
    {
      id: "field-residence-country",
      visaType: "TH_TDAC_ARRIVAL_CARD",
      fieldName: "country_territory_of_residence",
      label: "Country/Territory of Residence",
      fieldType: "select",
      required: true,
      stepNumber: 1,
      stepName: "Traveller Information",
      displayOrder: 1,
      placeholder: "Select...",
      validationRules: null,
      options: [{ value: "CHN", text: "China", label_en: "China", label_zh: "中国" }],
      conditionalLogic: null,
    },
    {
      id: "field-residence-city-state",
      visaType: "TH_TDAC_ARRIVAL_CARD",
      fieldName: "city_state_of_residence",
      label: "City/State of Residence",
      fieldType: "select",
      required: true,
      stepNumber: 1,
      stepName: "Traveller Information",
      displayOrder: 2,
      placeholder: "Select...",
      validationRules: {
        dependent_on: "country_territory_of_residence",
        dependent_options: {
          CHN: [{ value: "HUNAN", text: "HUNAN", label_en: "HUNAN", label_zh: "湖南" }],
        },
      },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const tdacAccommodationStep: WizardStep = {
  stepNumber: 3,
  stepName: "Accommodation Information",
  fields: [
    {
      id: "field-transit-traveler",
      visaType: "TH_TDAC_ARRIVAL_CARD",
      fieldName: "is_transit_traveler",
      label: "I am a transit passenger, I don't stay in Thailand.",
      fieldType: "checkbox",
      required: false,
      stepNumber: 3,
      stepName: "Accommodation Information",
      displayOrder: 1,
      placeholder: null,
      validationRules: {
        label_zh: "我是过境旅客，不在泰国停留",
        auto_when_arrival_departure_same_day: true,
        locked_unless_arrival_departure_same_day: true,
      },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const documentDateConsistencyStep: WizardStep = {
  stepNumber: 3,
  stepName: "Travel Document & Identity",
  fields: [
    {
      id: "field-surname",
      visaType: "SCHENGEN_C",
      fieldName: "surname",
      label: "Surname (family name)",
      fieldType: "text",
      required: true,
      stepNumber: 3,
      stepName: "Travel Document & Identity",
      displayOrder: 1,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-date-of-birth",
      visaType: "SCHENGEN_C",
      fieldName: "date_of_birth",
      label: "Date of birth",
      fieldType: "date",
      required: true,
      stepNumber: 3,
      stepName: "Travel Document & Identity",
      displayOrder: 2,
      placeholder: null,
      validationRules: null,
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-document-issue-date",
      visaType: "SCHENGEN_C",
      fieldName: "travel_document_issue_date",
      label: "Date of issue",
      fieldType: "date",
      required: true,
      stepNumber: 3,
      stepName: "Travel Document & Identity",
      displayOrder: 3,
      placeholder: null,
      validationRules: { format: "DD/MM/YYYY", inline_group: "travel_document_dates" },
      options: null,
      conditionalLogic: null,
    },
    {
      id: "field-document-expiry-date",
      visaType: "SCHENGEN_C",
      fieldName: "travel_document_expiry_date",
      label: "Expiry date",
      fieldType: "date",
      required: true,
      stepNumber: 3,
      stepName: "Travel Document & Identity",
      displayOrder: 4,
      placeholder: null,
      validationRules: { format: "DD/MM/YYYY", inline_group: "travel_document_dates" },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const schengenPurposeStep: WizardStep = {
  stepNumber: 7,
  stepName: "Trip Details",
  fields: [
    {
      id: "field-purpose-of-journey",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      fieldName: "purpose_of_journey",
      label: "Main purpose of the journey",
      fieldType: "select",
      required: true,
      stepNumber: 7,
      stepName: "Trip Details",
      displayOrder: 1,
      placeholder: "请选择...",
      validationRules: null,
      options: [
        { value: "tourism", text: "Tourism" },
        { value: "business", text: "Business" },
        { value: "cultural", text: "Cultural" },
      ],
      conditionalLogic: null,
    },
  ],
};

const schengenDestinationStep: WizardStep = {
  stepNumber: 7,
  stepName: "Trip Details",
  fields: [
    {
      id: "field-main-destination-country",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      fieldName: "main_destination_country",
      label: "Member State of main destination",
      fieldType: "country",
      required: true,
      stepNumber: 7,
      stepName: "Trip Details",
      displayOrder: 1,
      placeholder: null,
      validationRules: { source: "ISO3166-1" },
      options: null,
      conditionalLogic: null,
    },
  ],
};

const wizardConfigs: Array<WizardConfig<unknown>> = [
  usConfig as WizardConfig<unknown>,
  ukConfig as WizardConfig<unknown>,
  schengenConfig as WizardConfig<unknown>,
  vnConfig as WizardConfig<unknown>,
  auConfig as WizardConfig<unknown>,
  egConfig as WizardConfig<unknown>,
  idConfig as WizardConfig<unknown>,
];

const messageSets = [
  { locale: "en", messages: enMessages },
  { locale: "zh", messages: zhMessages },
] as const;

const translationPropNames = new Set([
  "titleKey",
  "subtitleKey",
  "labelKey",
  "placeholderKey",
  "descriptionKey",
  "hintKey",
  "submitLabelKey",
  "yesKey",
  "noKey",
]);

function getPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, root);
}

function collectTranslationKeys(value: unknown, keys: Set<string>) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectTranslationKeys(item, keys));
    return;
  }

  if (isValidElement(value)) {
    collectTranslationKeys((value as { props?: unknown }).props, keys);
    return;
  }

  for (const [prop, nested] of Object.entries(value as Record<string, unknown>)) {
    if (translationPropNames.has(prop) && typeof nested === "string" && nested && !nested.startsWith("literal:")) {
      keys.add(nested);
      continue;
    }
    collectTranslationKeys(nested, keys);
  }
}

function renderWizardStep(config: WizardConfig<unknown>, index: number): ReactNode {
  const form = config.emptyForm();
  return config.steps[index].render({
    form,
    setForm: () => undefined,
    applicationId: null,
    onContinue: () => undefined,
    onBack: () => undefined,
    onSubmit: () => undefined,
    submitting: false,
    goToStep: () => undefined,
  });
}

describe("DynamicStepForm copilot format", () => {
  it("hides the repeated continue action in the continuous form layout", () => {
    render(
      <DynamicStepForm
        step={requiredTextStep}
        prefill={{}}
        onComplete={vi.fn()}
        showContinueButton={false}
        visaType="DS160"
      />,
    );

    expect(screen.queryByRole("button", { name: "continue" })).not.toBeInTheDocument();
  });

  it("marks a page-level missing field invalid only after the submit check", () => {
    const { container, rerender } = render(
      <DynamicStepForm
        step={requiredTextStep}
        prefill={{}}
        onComplete={vi.fn()}
        showContinueButton={false}
        visaType="DS160"
      />,
    );

    const field = container.querySelector<HTMLElement>('[data-application-field-name="surname"]');
    expect(field).toHaveAttribute("data-validation-invalid", "false");
    expect(screen.queryByText("必填项")).not.toBeInTheDocument();

    rerender(
      <DynamicStepForm
        step={requiredTextStep}
        prefill={{}}
        onComplete={vi.fn()}
        showContinueButton={false}
        visaType="DS160"
        invalidFieldNames={new Set(["surname"])}
      />,
    );

    expect(field).toHaveAttribute("data-validation-invalid", "true");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field?.className).toContain("[&_.application-form-control]:!border-red-500");
    expect(screen.queryByText("必填项")).not.toBeInTheDocument();
  });

  it("renders every visible conditional branch in the shared conditional fields panel", () => {
    const { container } = render(
      <DynamicStepForm
        step={conditionalPanelStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="JP_TOURIST"
      />,
    );

    expect(container.querySelectorAll(".application-conditional-fields-panel")).toHaveLength(0);
    expect(container.querySelector('[data-copilot-trigger="reference_note"]')?.closest(
      ".application-conditional-fields-panel",
    )).toBeNull();

    const inviterYes = container.querySelector<HTMLInputElement>(
      'input[name="has_inviter_in_japan-en"][value="yes"]',
    );
    expect(inviterYes).not.toBeNull();
    fireEvent.click(inviterYes!);

    const inviterPanels = container.querySelectorAll(".application-conditional-fields-panel");
    expect(inviterPanels).toHaveLength(1);
    expect(inviterPanels[0]).toContainElement(
      container.querySelector('[data-copilot-trigger="inviter_full_name"]'),
    );
    expect(inviterPanels[0]).toContainElement(
      container.querySelector('[data-copilot-trigger="inviter_address"]'),
    );

    const specialRequestYes = container.querySelector<HTMLInputElement>(
      'input[name="has_special_request-en"][value="yes"]',
    );
    expect(specialRequestYes).not.toBeNull();
    fireEvent.click(specialRequestYes!);

    const allPanels = container.querySelectorAll(".application-conditional-fields-panel");
    expect(allPanels).toHaveLength(2);
    expect(
      container.querySelector('[data-copilot-trigger="special_request_details"]')?.closest(
        ".application-conditional-fields-panel",
      ),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "addAnother" })).not.toBeInTheDocument();
  });

  it("uses the unified Chinese copilot trigger format", () => {
    render(
      <DynamicStepForm
        step={requiredTextStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    expect(screen.queryByText("必填项")).not.toBeInTheDocument();
    expect(screen.queryByText("Required field")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask AI" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review tip" })).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "问 AI" });
    expect(trigger).toHaveAttribute("data-copilot-trigger", "surname");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("field-guidance-panel")).toBeInTheDocument();
  });

  it("supports Windows and Mac undo/redo shortcuts for non-text controls", () => {
    const { container } = render(
      <DynamicStepForm
        step={shortcutStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    const getYesRadios = () =>
      Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"][value="YES"]'));
    const firstYesRadio = () => getYesRadios()[0];

    fireEvent.click(firstYesRadio()!);
    expect(getYesRadios().some((radio) => radio.checked)).toBe(true);

    fireEvent.keyDown(firstYesRadio()!, { key: "z", ctrlKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(false);

    fireEvent.keyDown(firstYesRadio()!, { key: "y", ctrlKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(true);

    fireEvent.keyDown(firstYesRadio()!, { key: "z", metaKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(false);

    fireEvent.keyDown(firstYesRadio()!, { key: "Z", metaKey: true, shiftKey: true });
    expect(getYesRadios().some((radio) => radio.checked)).toBe(true);
  });

  it("keeps the B1/B2 purpose dropdown selectable after copilot opens and closes", () => {
    const { container } = render(
      <DynamicStepForm
        step={purposeOfTripStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    const comboboxes = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="combobox"]'));
    expect(comboboxes).toHaveLength(2);
    expect(comboboxes.every((combobox) => combobox.disabled)).toBe(false);
    expect(container).toHaveTextContent("临时商务或旅游访客 (B)");
    expect(container).toHaveTextContent("TEMP. BUSINESS OR PLEASURE VISITOR (B)");

    const trigger = screen.getByRole("button", { name: "问 AI" });
    fireEvent.click(trigger);
    expect(screen.getByTestId("field-guidance-panel")).toBeInTheDocument();
    expect(comboboxes.every((combobox) => combobox.disabled)).toBe(false);

    fireEvent.click(trigger);
    expect(screen.queryByTestId("field-guidance-panel")).not.toBeInTheDocument();
    expect(comboboxes.every((combobox) => combobox.disabled)).toBe(false);
  });

  it("canonicalizes a saved select label to its stored option value", async () => {
    const onDraftChange = vi.fn();
    const { container } = render(
      <DynamicStepForm
        step={occupationStep}
        prefill={{ current_profession: "Employed" }}
        onComplete={vi.fn()}
        onDraftChange={onDraftChange}
        visaType="JP_TOURIST"
      />,
    );

    const dropdowns = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="combobox"]'));
    expect(dropdowns).toHaveLength(2);
    expect(dropdowns.every((dropdown) => dropdown.dataset.filled === "true")).toBe(true);
    expect(dropdowns.some((dropdown) => dropdown.textContent?.includes("Employed"))).toBe(true);
    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ current_profession: "employed" }),
    ));
  });

  it("clears an invisible stale select value without showing an option error", async () => {
    const onDraftChange = vi.fn();
    const { container } = render(
      <DynamicStepForm
        step={occupationStep}
        prefill={{ current_profession: "Software engineer" }}
        onComplete={vi.fn()}
        onDraftChange={onDraftChange}
        visaType="JP_TOURIST"
      />,
    );

    const dropdowns = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="combobox"]'));
    expect(dropdowns).toHaveLength(2);
    expect(dropdowns.every((dropdown) => !dropdown.disabled)).toBe(true);
    expect(dropdowns.every((dropdown) => dropdown.dataset.filled === "false")).toBe(true);
    expect(screen.queryByText("Choose one of the provided options")).not.toBeInTheDocument();
    await waitFor(() => expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ current_profession: "" }),
    ));
  });

  it("keeps dropdowns and their AI trigger in the same active field scope", () => {
    const { container } = render(
      <DynamicStepForm
        step={purposeOfTripStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    const aiTrigger = container.querySelector<HTMLButtonElement>('[data-copilot-trigger="purpose_of_trip"]');
    const field = aiTrigger?.closest<HTMLElement>(".application-form-field");
    const dropdowns = field?.querySelectorAll<HTMLButtonElement>('[role="combobox"]');
    const bilingualField = aiTrigger?.closest<HTMLElement>('[data-application-field-name="purpose_of_trip"]');
    const bilingualDropdowns = bilingualField?.querySelectorAll<HTMLButtonElement>('[role="combobox"]');

    expect(aiTrigger).toHaveClass("application-form-ai-trigger");
    expect(aiTrigger).toHaveClass(
      "border-0",
      "bg-transparent",
      "text-brand-500",
      "hover:text-brand-700",
      "rounded-full",
    );
    expect(aiTrigger).not.toHaveClass("hover:bg-brand-50");
    expect(field).not.toBeNull();
    expect(dropdowns).toHaveLength(1);
    expect(Array.from(dropdowns ?? []).every((dropdown) => dropdown.classList.contains("application-form-control"))).toBe(true);
    expect(bilingualDropdowns).toHaveLength(2);
  });

  it("reserves label space for the AI trigger without narrowing the form control", () => {
    const { container } = render(
      <DynamicStepForm
        step={purposeOfTripStep}
        prefill={{}}
        onComplete={vi.fn()}
        visaType="DS160"
      />,
    );

    const aiTrigger = container.querySelector('[data-copilot-trigger="purpose_of_trip"]');
    const field = aiTrigger?.closest<HTMLElement>(".application-form-field");
    const englishSide = aiTrigger?.closest<HTMLElement>('[data-guidance-label-space="true"]');
    const label = englishSide?.querySelector(".application-form-question-label");
    const labelAction = aiTrigger?.parentElement;
    const control = englishSide?.querySelector(".application-form-control");

    expect(field).not.toBeNull();
    expect(englishSide).not.toBeNull();
    expect(label).not.toBeNull();
    expect(label).toHaveClass("pr-10");
    expect(labelAction).toHaveClass(
      "absolute",
      "right-0",
      "opacity-0",
      "group-hover/field:opacity-100",
      "group-focus-within/field:opacity-100",
    );
    expect(control).not.toBeNull();
    expect(control).not.toHaveClass("pr-10");
  });

  it("preserves bottom-page height after removing a repeat instance until scrolling safely upward", () => {
    let repeatGroupWasExpanded = false;
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.dataset.applicationScrollContainer === "true" ? 500 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(function (this: HTMLElement) {
      return this.dataset.applicationScrollContainer === "true" ? 900 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const isMeasuredContent = this.dataset.scrollHeightContent === "true";
      const repeatCount = isMeasuredContent
        ? this.querySelectorAll('[data-repeat-group-instance="true"]').length
        : 0;
      if (repeatCount === 2) repeatGroupWasExpanded = true;
      if (isMeasuredContent && repeatGroupWasExpanded && repeatCount === 1) {
        const scrollContainer = this.closest<HTMLElement>('[data-application-scroll-container="true"]');
        if (scrollContainer) scrollContainer.scrollTop = 300;
      }
      const height = isMeasuredContent ? 100 + repeatCount * 200 : 0;
      return {
        bottom: height,
        height,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });

    const { container } = render(
      <div data-application-scroll-container="true" style={{ overflowY: "auto" }}>
        <DynamicStepForm
          step={purposeOfTripStep}
          prefill={{}}
          onComplete={vi.fn()}
          visaType="DS160"
        />
      </div>,
    );

    const scrollContainer = container.firstElementChild as HTMLDivElement;
    scrollContainer.scrollTop = 500;
    fireEvent.click(screen.getByRole("button", { name: "addAnother" }));
    const removeButtons = screen.getAllByRole("button", { name: "remove" });
    fireEvent.click(removeButtons[1]);

    const form = container.querySelector("form");
    expect(form).toHaveStyle({ minHeight: "500px" });
    expect(scrollContainer.scrollTop).toBe(500);

    scrollContainer.scrollTop = 100;
    fireEvent.scroll(scrollContainer);
    expect(form).not.toHaveStyle({ minHeight: "500px" });
  });

  it("autofills bilingual values from universal profile and persists both display languages", () => {
    const onComplete = vi.fn();
    const prefill = buildUniversalProfileAnswerPatch({
      full_name: "LI XIAOMING",
      full_name_zh: "李晓明",
      full_name_en: "LI XIAOMING",
      birth_country: "China",
      birth_province_or_state: "湖南",
      birth_province_or_state_zh: "湖南",
      birth_province_or_state_en: "Hunan",
      birth_city: "长沙",
      birth_city_zh: "长沙",
      birth_city_en: "Changsha",
    });

    render(
      <DynamicStepForm
        step={placeOfBirthStep}
        prefill={prefill}
        onComplete={onComplete}
        visaType="SCHENGEN_C"
      />,
    );

    expect(screen.getByDisplayValue("长沙")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Changsha")).toBeInTheDocument();
    expect(prefill.full_name_zh).toBe("李晓明");
    expect(prefill.full_name_en).toBe("LI XIAOMING");
    expect(prefill.state_of_birth).toBe("Hunan");
    expect(prefill.country_of_birth).toBe("China");

    fireEvent.click(screen.getByRole("button", { name: "continue" }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      place_of_birth: "Changsha",
      place_of_birth_zh: "长沙",
      place_of_birth_en: "Changsha",
    }));
  });

  it("keeps the Chinese side unchanged when the English side is edited", () => {
    const onComplete = vi.fn();
    render(
      <DynamicStepForm
        step={placeOfBirthStep}
        prefill={{
          place_of_birth: "Changsha",
          place_of_birth_zh: "长沙",
          place_of_birth_en: "Changsha",
        }}
        onComplete={onComplete}
        visaType="SCHENGEN_C"
      />,
    );

    const [chineseInput, englishInput] = screen.getAllByRole("textbox");
    expect(chineseInput).toHaveValue("长沙");
    expect(englishInput).toHaveValue("Changsha");

    fireEvent.change(englishInput!, { target: { value: "Zhuzhou" } });

    expect(chineseInput).toHaveValue("长沙");
    expect(englishInput).toHaveValue("Zhuzhou");

    fireEvent.change(chineseInput!, { target: { value: "北京" } });

    expect(chineseInput).toHaveValue("北京");
    expect(englishInput).toHaveValue("Beijing");

    fireEvent.click(screen.getByRole("button", { name: "continue" }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ place_of_birth: "Beijing" }));
  });

  it("normalizes TDAC residence prefill into official dependent option values", () => {
    const onComplete = vi.fn();
    render(
      <DynamicStepForm
        step={tdacResidenceStep}
        prefill={{
          nationality: "China",
          city_state_of_residence: "Hunan",
          city_state_of_residence_zh: "湖南",
          city_state_of_residence_en: "Hunan",
        }}
        onComplete={onComplete}
        visaType="TH_TDAC_ARRIVAL_CARD"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "continue" }));

    expect(onComplete).toHaveBeenCalledWith({
      country_territory_of_residence: "CHN",
      city_state_of_residence: "HUNAN",
    });
  });

  it("recalculates TDAC transit status when saved cross-step dates arrive after mount", async () => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    const onDraftChange = vi.fn();
    const { rerender } = render(
      <DynamicStepForm
        step={tdacAccommodationStep}
        prefill={{}}
        onDraftChange={onDraftChange}
        onComplete={vi.fn()}
        visaType="TH_TDAC_ARRIVAL_CARD"
      />,
    );

    const transitCheckbox = screen.getAllByRole("checkbox")[0]!;
    expect(transitCheckbox).not.toBeChecked();

    rerender(
      <DynamicStepForm
        step={tdacAccommodationStep}
        prefill={{ arrival_date: "2026-08-08", departure_date: "2026-08-08" }}
        onDraftChange={onDraftChange}
        onComplete={vi.fn()}
        visaType="TH_TDAC_ARRIVAL_CARD"
      />,
    );

    await waitFor(() => expect(transitCheckbox).toBeChecked());
    expect(onDraftChange).toHaveBeenLastCalledWith({ is_transit_traveler: "yes" });

    rerender(
      <DynamicStepForm
        step={tdacAccommodationStep}
        prefill={{ arrival_date: "2026-08-08", departure_date: "2026-08-09" }}
        onDraftChange={onDraftChange}
        onComplete={vi.fn()}
        visaType="TH_TDAC_ARRIVAL_CARD"
      />,
    );

    await waitFor(() => expect(transitCheckbox).not.toBeChecked());
    expect(onDraftChange).toHaveBeenLastCalledWith({ is_transit_traveler: "" });
  });

  it("uses the server translation fallback when local sync leaves Chinese in the English field", async () => {
    const onComplete = vi.fn();
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, translatedText: "Hengqin, Zhuhai" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <DynamicStepForm
        step={cityOfBirthStep}
        prefill={{}}
        onComplete={onComplete}
        visaType="DS160"
      />,
    );

    const textboxes = screen.getAllByRole("textbox");
    expect(textboxes).toHaveLength(2);

    fireEvent.change(textboxes[0]!, { target: { value: "珠海横琴" } });
    expect(screen.getAllByDisplayValue("珠海横琴")).toHaveLength(2);
    expect(screen.getByText("正在翻译...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Hengqin, Zhuhai")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/translate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          text: "珠海横琴",
          source: "zh",
          target: "en",
          fieldId: "city_of_birth",
          context: "visa_form:DS160",
          fieldType: "text",
        }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ city_of_birth: "Hengqin, Zhuhai" }));
  });

  it("repairs a Chinese value accidentally saved in the SGAC English full-name field", () => {
    const onComplete = vi.fn();

    render(
      <DynamicStepForm
        step={sgacFullNameStep}
        prefill={{
          full_name: "黄小敏",
          full_name_zh: "黄小敏",
          full_name_en: "黄小敏",
        }}
        onComplete={onComplete}
        visaType="SG_ARRIVAL_CARD"
      />,
    );

    expect(screen.getAllByDisplayValue("黄小敏")).toHaveLength(1);
    expect(screen.getByDisplayValue("HUANGXIAOMIN")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "continue" }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      full_name: "HUANGXIAOMIN",
      full_name_zh: "黄小敏",
      full_name_en: "HUANGXIAOMIN",
    }));
  });

  it("submits the latest SGAC traveller values when the user edits and immediately continues", () => {
    const onComplete = vi.fn();
    const onDraftChange = vi.fn();

    render(
      <DynamicStepForm
        step={sgacTravellerPersistenceStep}
        prefill={{
          full_name: "OLD NAME",
          passport_number: "OLD123",
          passport_expiry_date: "2030-01-01",
        }}
        onDraftChange={onDraftChange}
        onComplete={onComplete}
        visaType="SG_ARRIVAL_CARD"
      />,
    );

    fireEvent.change(screen.getAllByDisplayValue("OLD NAME")[1]!, {
      target: { value: "LATEST NAME" },
    });
    fireEvent.change(screen.getAllByDisplayValue("OLD123")[1]!, {
      target: { value: "LATEST987" },
    });
    fireEvent.change(screen.getAllByDisplayValue("2030-01-01")[1]!, {
      target: { value: "2035-12-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "continue" }));

    const expected = expect.objectContaining({
      full_name: "LATEST NAME",
      full_name_en: "LATEST NAME",
      passport_number: "LATEST987",
      passport_number_en: "LATEST987",
      passport_expiry_date: "2035-12-31",
      passport_expiry_date_en: "2035-12-31",
    });
    expect(onDraftChange).toHaveBeenLastCalledWith(expected);
    expect(onComplete).toHaveBeenCalledWith(expected);
  });

  it("allows an optional formatted text field to pass after the user clears the old value", () => {
    const onComplete = vi.fn();
    render(
      <DynamicStepForm
        step={optionalPostcodeStep}
        prefill={{ postcode: "ABCDE", postcode_zh: "ABCDE", postcode_en: "ABCDE" }}
        onComplete={onComplete}
        visaType="TH_TDAC_ARRIVAL_CARD"
      />,
    );

    expect(screen.getByText("格式不符合要求")).toBeInTheDocument();

    const textboxes = screen.getAllByRole("textbox");
    expect(textboxes).toHaveLength(2);
    fireEvent.change(textboxes[0]!, { target: { value: "" } });
    fireEvent.change(textboxes[1]!, { target: { value: "" } });

    expect(screen.queryByText("格式不符合要求")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "continue" }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ postcode: "" }));
  });

  it("shows the official E-Visa number location guidance only for E-Visa applicants", () => {
    const { unmount } = render(
      <DynamicStepForm
        step={vnPrearrivalEvisaNumberStep}
        prefill={{ visa_type: "EV", visa_number: "" }}
        onComplete={vi.fn()}
        visaType="VN_PREARRIVAL_DECLARATION"
      />,
    );

    const helpTrigger = screen.getByRole("button", { name: "在哪里查看电子签证号码？" });
    fireEvent.click(helpTrigger);

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "查看电子签证上的“Số / No.”一行，并输入该行显示的准确号码。电子签证号码必须是 9 位纯数字。",
    );
    expect(screen.getByRole("img", { name: "越南电子签证号码位于 Số / No. 一行的官网示例" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).not.toHaveTextContent("Enter only");
    expect(screen.getByRole("dialog")).not.toHaveTextContent("本表只填写");

    unmount();

    render(
      <DynamicStepForm
        step={vnPrearrivalEvisaNumberStep}
        prefill={{ visa_type: "VR", visa_number: "" }}
        onComplete={vi.fn()}
        visaType="VN_PREARRIVAL_DECLARATION"
      />,
    );

    expect(screen.queryByRole("button", { name: "在哪里查看电子签证号码？" })).not.toBeInTheDocument();
  });

  it("repairs a saved Vietnam hotel selection by restoring its official hierarchy", async () => {
    const onComplete = vi.fn();
    const onDraftChange = vi.fn();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ options: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )));

    render(
      <DynamicStepForm
        step={vnPrearrivalHotelHierarchyStep}
        prefill={{
          flight_number: "MH0746_DAD",
          accommodation_type: "hotel",
          hotel_accommodation_address: "KSDN_01",
        }}
        onComplete={onComplete}
        onDraftChange={onDraftChange}
        visaType="VN_PREARRIVAL_DECLARATION"
      />,
    );

    await waitFor(() => expect(onDraftChange).toHaveBeenLastCalledWith({
      flight_number: "MH0746_DAD",
      accommodation_type: "hotel",
      province_city_of_hotel: "48",
      ward_commune_of_hotel: "20194",
      hotel_accommodation_address: "KSDN_01",
    }));
    const continueButton = screen.getByRole("button", { name: "continue" });
    await waitFor(() => expect(continueButton).toBeEnabled());
    fireEvent.click(continueButton);

    expect(onComplete).toHaveBeenCalledWith({
      flight_number: "MH0746_DAD",
      accommodation_type: "hotel",
      province_city_of_hotel: "48",
      ward_commune_of_hotel: "20194",
      hotel_accommodation_address: "KSDN_01",
    });
  });

  it("shows document date-order errors only on the expiry field", () => {
    const { container } = render(
      <DynamicStepForm
        step={documentDateConsistencyStep}
        prefill={{
          surname: "CHEN",
          date_of_birth: "2006-07-27",
          travel_document_issue_date: "2030-01-01",
          travel_document_expiry_date: "2029-01-01",
        }}
        onComplete={vi.fn()}
        visaType="SCHENGEN_C"
      />,
    );

    expect(screen.getAllByText("到期日必须晚于签发日")).toHaveLength(1);

    const surnameTrigger = container.querySelector('[data-copilot-trigger="surname"]');
    const birthDateTrigger = container.querySelector('[data-copilot-trigger="date_of_birth"]');
    const issueDateTrigger = container.querySelector('[data-copilot-trigger="travel_document_issue_date"]');
    const expiryDateTrigger = container.querySelector('[data-copilot-trigger="travel_document_expiry_date"]');

    expect(surnameTrigger?.closest('[data-application-field-name="surname"]')).not.toHaveTextContent("到期日必须晚于签发日");
    expect(birthDateTrigger?.closest('[data-application-field-name="date_of_birth"]')).not.toHaveTextContent("到期日必须晚于签发日");
    expect(issueDateTrigger?.closest('[data-application-field-name="travel_document_issue_date"]')).not.toHaveTextContent("到期日必须晚于签发日");
    expect(expiryDateTrigger?.closest('[data-application-field-name="travel_document_expiry_date"]')).toHaveTextContent("到期日必须晚于签发日");
  });

  it("keeps Schengen option and placeholder language scoped to each side", () => {
    const { container } = render(
      <DynamicStepForm
        step={schengenPurposeStep}
        prefill={{}}
        onComplete={vi.fn()}
        country="france"
        visaType="EU_SCHENGEN_C_SHORT_STAY"
      />,
    );

    expect(getChineseOptionText("Tourism")).toBe("旅游");
    expect(getChineseOptionText("Business")).toBe("商务");
    expect(getChineseOptionText("Cultural")).toBe("文化");
    expect(getEnglishPlaceholder("请选择...")).toBe("Select...");

    expect(container).toHaveTextContent("旅游");
    expect(container).toHaveTextContent("商务");
    expect(container).toHaveTextContent("文化");
    expect(container).toHaveTextContent("Tourism");
    expect(container).toHaveTextContent("Business");
    expect(container).toHaveTextContent("Cultural");
    expect(container).toHaveTextContent("Select...");
  });

  it("uses exact Chinese copy for Schengen declaration labels", () => {
    const visConsentLabel =
      "I am aware of and consent to the following: the collection of the data required by this application form and the taking of my photograph and, if applicable, the taking of fingerprints, are mandatory for the examination of the application; and any personal data concerning me which appear on the application form, as well as my fingerprints and my photograph, will be supplied to the relevant authorities of the Member States and processed by those authorities, for the purposes of a decision on my application. Such data will be entered into and stored in the Visa Information System (VIS) for a maximum period of five years.";

    expect(getChineseLabel(
      "Is the application being filled in by someone other than the applicant?",
      "has_different_filler",
    )).toBe("本申请表是否由申请人以外的其他人填写？");
    expect(getChineseLabel("Place of application", "place_of_application")).toBe("申请提交地点");
    expect(getChineseLabel(visConsentLabel, "declaration_vis_consent")).toContain("我知悉并同意");
    expect(getChineseLabel(visConsentLabel, "declaration_vis_consent")).not.toBe("声明");
  });

  it("defaults France Schengen main destination and localizes country names per side", async () => {
    const { container } = render(
      <DynamicStepForm
        step={schengenDestinationStep}
        prefill={{}}
        onComplete={vi.fn()}
        country="france"
        visaType="EU_SCHENGEN_C_SHORT_STAY"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("法国")).toBeInTheDocument();
    });
    expect(screen.getByText("France")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("法国 (France)");
  });

  it("keeps registered wizard prompts aligned with localized country copy", () => {
    for (const config of wizardConfigs) {
      for (const { locale, messages } of messageSets) {
        const namespace = getPath(messages, config.i18nNamespace);
        expect.soft(namespace, `${locale} ${config.visaType} is missing ${config.i18nNamespace}`).toBeTruthy();

        const keys = new Set<string>();
        config.steps.forEach((step, index) => {
          keys.add(step.titleKey);
          collectTranslationKeys(renderWizardStep(config, index), keys);
        });

        config.reviewSections(config.emptyForm()).forEach((section) => {
          keys.add(section.titleKey);
        });

        for (const key of keys) {
          expect.soft(
            getPath(namespace, key),
            `${locale} ${config.visaType} missing translation key ${config.i18nNamespace}.${key}`,
          ).toBeTruthy();
        }
      }
    }
  });
});
