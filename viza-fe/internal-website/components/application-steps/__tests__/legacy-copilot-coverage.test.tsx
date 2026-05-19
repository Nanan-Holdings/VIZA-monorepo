import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PassportStep } from "../passport-step";
import { PersonalInfoStep } from "../personal-info-step";
import { PhotoUploadStep } from "../photo-upload-step";
import { TravelInfoStep } from "../travel-info-step";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: vi.fn() },
    storage: { from: vi.fn() },
  }),
}));

function getCopilotFields(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-copilot-trigger]"))
    .map((element) => element.dataset.copilotTrigger)
    .filter(Boolean);
}

function expectCopilotCoverage(container: HTMLElement, expectedFields: string[]) {
  const fields = getCopilotFields(container);

  expect(fields).toHaveLength(expectedFields.length);
  expect(new Set(fields)).toEqual(new Set(expectedFields));
}

describe("legacy application step copilot coverage", () => {
  it("renders one copilot trigger for every travel details field", () => {
    const { container } = render(<TravelInfoStep onComplete={vi.fn()} />);

    expectCopilotCoverage(container, [
      "purpose_of_trip",
      "arrival_date",
      "departure_date",
      "arrival_city",
      "accommodation_name",
      "us_address_street1",
      "us_address_city",
      "us_address_state",
      "us_address_zip",
    ]);
    expect(screen.getAllByText("必填项").length).toBeGreaterThan(0);
    expect(screen.queryByText("Required field")).not.toBeInTheDocument();
  });

  it("renders one copilot trigger for every passport field", () => {
    const { container } = render(<PassportStep onComplete={vi.fn()} />);

    expectCopilotCoverage(container, [
      "passport_document_type",
      "passport_number",
      "passport_book_number",
      "passport_issuing_country",
      "passport_issuance_city",
      "passport_issuance_date",
      "passport_expiration_date",
    ]);
  });

  it("renders one copilot trigger for every personal information field", () => {
    const { container } = render(<PersonalInfoStep onComplete={vi.fn()} />);

    expectCopilotCoverage(container, [
      "surname",
      "given_names",
      "full_name_native_alphabet",
      "date_of_birth",
      "marital_status",
      "sex",
      "nationality",
      "country_of_birth",
      "state_of_birth",
      "city_of_birth",
    ]);
    expect(container.querySelector('[data-copilot-panel-frame="surname"]')).toHaveClass(
      "md:col-span-2",
    );
  });

  it("opens legacy field guidance only from the copilot trigger", () => {
    const { container } = render(<TravelInfoStep onComplete={vi.fn()} />);
    const arrivalCityFrame = container.querySelector<HTMLElement>(
      '[data-copilot-panel-frame="arrival_city"]',
    );

    fireEvent.focus(screen.getByPlaceholderText("e.g. John F. Kennedy International Airport"));
    expect(screen.queryByTestId("field-guidance-panel")).not.toBeInTheDocument();
    expect(arrivalCityFrame).toHaveClass("md:col-span-2");

    const arrivalCityTrigger = container.querySelector<HTMLElement>(
      '[data-copilot-trigger="arrival_city"]',
    );
    expect(arrivalCityTrigger).toBeInTheDocument();

    fireEvent.click(arrivalCityTrigger as HTMLElement);
    expect(screen.getByTestId("field-guidance-panel")).toBeInTheDocument();
  });

  it("renders a consistent copilot trigger for the photo upload field", () => {
    const { container } = render(
      <PhotoUploadStep
        applicationId={null}
        country="united_states"
        visaType="DS160"
        onComplete={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    const trigger = container.querySelector<HTMLElement>(
      '[data-copilot-trigger="photo_upload"]',
    );
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("问 AI");
    expect(screen.getByText("必填项")).toBeInTheDocument();
    expect(screen.queryByTestId("field-guidance-panel")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("browse"));
    expect(screen.queryByTestId("field-guidance-panel")).not.toBeInTheDocument();

    fireEvent.click(trigger as HTMLElement);
    expect(screen.getByTestId("field-guidance-panel")).toBeInTheDocument();
    expect(container.querySelector('[data-copilot-panel-frame="photo_upload"]')).toHaveClass(
      "w-full",
    );
    expect(screen.queryByText("Required field")).not.toBeInTheDocument();
  });
});
