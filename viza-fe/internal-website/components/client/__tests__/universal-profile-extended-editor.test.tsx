import { render, screen, waitFor, within } from "@testing-library/react";
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

function field(fieldName: string, label: string, category: "identity" | "family") {
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
    sourceVisaTypes: ["EU_SCHENGEN_C_SHORT_STAY"],
  };
}

describe("UniversalProfileExtendedEditor", () => {
  beforeEach(() => {
    loadWorkspace.mockResolvedValue({
      fields: [
        field("civil_status", "Civil status", "identity"),
        field("father_surname", "Father surname", "family"),
      ],
      answers: [{ canonicalKey: "civil_status", value: "Married", valueEn: "Married", category: "identity" }],
      schemaAvailable: true,
    });
    saveAnswers.mockResolvedValue({ savedCount: 1, deletedCount: 0 });
  });

  it("uses review rows for saved facts and normal inputs for missing facts", async () => {
    render(<UniversalProfileExtendedEditor />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Identity and nationality" })).toBeInTheDocument());
    expect(within(screen.getByRole("table")).getByRole("cell")).toHaveTextContent("Married");
    expect(screen.queryByDisplayValue("Married")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter or select")).toHaveValue("");
    expect(screen.queryByText("1/2 saved")).not.toBeInTheDocument();
  });
});
