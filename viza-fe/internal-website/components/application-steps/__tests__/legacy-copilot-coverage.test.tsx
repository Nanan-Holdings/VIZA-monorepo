import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PassportStep } from "../passport-step";
import { PersonalInfoStep } from "../personal-info-step";
import { PhotoUploadStep } from "../photo-upload-step";
import { TravelInfoStep } from "../travel-info-step";
import { toOfficialEnglishValue } from "@/lib/ds160-translations";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: ({
    country,
    allAnswers,
    field,
    visaType,
  }: {
    allAnswers: Record<string, string>;
    country?: string | null;
    field: { fieldName: string };
    visaType: string;
  }) => (
    <div
      data-answer-country={allAnswers.destination_country ?? ""}
      data-answer-visa-type={allAnswers.visa_type ?? ""}
      data-country={country ?? ""}
      data-field-name={field.fieldName}
      data-testid="field-guidance-panel"
      data-visa-type={visaType}
    />
  ),
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
    const { container } = render(
      <TravelInfoStep country="indonesia" visaType="ID_C1_TOURIST" onComplete={vi.fn()} />,
    );

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

  it("transliterates Chinese given names instead of showing confirm text", () => {
    render(<PersonalInfoStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("如：小明"), {
      target: { value: "小明" },
    });

    expect(screen.getByPlaceholderText("e.g. XIAOMING")).toHaveValue("XIAOMING");
    expect(screen.queryByDisplayValue(/Please confirm/i)).not.toBeInTheDocument();
  });

  it("transliterates common Chinese names in dynamic bilingual fields", () => {
    expect(toOfficialEnglishValue("李小明")).toBe("LI XIAOMING");
    expect(toOfficialEnglishValue("软件工程师")).toBe("Software engineer");
    expect(toOfficialEnglishValue("硬件工程师")).toBe("Hardware engineer");
    expect(toOfficialEnglishValue("长沙")).toBe("Changsha");
    expect(toOfficialEnglishValue("北京市")).toBe("Beijing");
    expect(toOfficialEnglishValue("北京市朝阳区示例路1号")).toBe("1 Example Road, Chaoyang District, Beijing");
  });

  it("opens legacy field guidance only from the copilot trigger", () => {
    const { container } = render(
      <TravelInfoStep country="indonesia" visaType="ID_C1_TOURIST" onComplete={vi.fn()} />,
    );
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
    const panel = container.querySelector<HTMLElement>('[data-testid="field-guidance-panel"]');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("data-answer-country", "indonesia");
    expect(panel).toHaveAttribute("data-answer-visa-type", "ID_C1_TOURIST");
    expect(panel).toHaveAttribute("data-country", "indonesia");
    expect(panel).toHaveAttribute("data-visa-type", "ID_C1_TOURIST");
    expect(panel).toHaveAttribute("data-field-name", "arrival_city");
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
