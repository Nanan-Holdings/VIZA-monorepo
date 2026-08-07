import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UniversalProfileExtendedEditor } from "../universal-profile-extended-editor";

const loadWorkspace = vi.fn();
const saveAnswers = vi.fn();

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/app/actions/visa-application-answers", () => ({
  loadUniversalProfileWorkspace: () => loadWorkspace(),
  saveUniversalProfileAnswerValues: (input: unknown) => saveAnswers(input),
}));

function field(fieldName: string, label: string, category: "identity" | "family", common = true) {
  return {
    id: fieldName,
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    fieldName,
    canonicalKey: fieldName,
    label,
    fieldType: "text" as const,
    required: false,
    stepNumber: 1,
    stepName: category,
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    category,
    sourceVisaTypes: common ? ["EU_SCHENGEN_C_SHORT_STAY", "UK_STANDARD_VISITOR"] : ["EU_SCHENGEN_C_SHORT_STAY"],
  };
}

describe("UniversalProfileExtendedEditor", () => {
  beforeEach(() => {
    loadWorkspace.mockResolvedValue({
      fields: [
        field("civil_status", "Civil status", "identity"),
        field("other_names_used", "Other names used", "identity"),
        field("country_specific_detail", "Country-specific detail", "identity", false),
        field("father_surname", "Father surname", "family"),
      ],
      answers: [{ canonicalKey: "civil_status", value: "Married", valueEn: "Married", category: "identity" }],
      schemaAvailable: true,
    });
    saveAnswers.mockResolvedValue({ savedCount: 1, deletedCount: 0 });
  });

  it("uses review rows for saved facts and normal inputs for missing facts", async () => {
    render(<UniversalProfileExtendedEditor category="identity" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Identity and nationality" })).toBeInTheDocument());
    expect(within(screen.getByRole("table")).getByRole("cell")).toHaveTextContent("Married");
    expect(screen.queryByDisplayValue("Married")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter or select")).toHaveValue("");
    expect(screen.queryByText("Country-specific detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all optional fields (1 more)" }));
    expect(screen.getByText("Country-specific detail")).toBeInTheDocument();
    expect(screen.queryByText("1/2 saved")).not.toBeInTheDocument();
  });

  it("renders only the selected category", async () => {
    render(<UniversalProfileExtendedEditor category="family" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Family" })).toBeInTheDocument());
    expect(screen.getByPlaceholderText("Enter or select")).toBeInTheDocument();
    expect(screen.queryByText("Civil status")).not.toBeInTheDocument();
  });
});
