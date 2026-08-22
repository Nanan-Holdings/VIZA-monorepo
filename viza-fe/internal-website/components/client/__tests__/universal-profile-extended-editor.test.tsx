import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UniversalProfileExtendedEditor } from "../universal-profile-extended-editor";

const loadWorkspace = vi.fn();
const saveAnswers = vi.fn();
const saveStatusChange = vi.fn();
let locale = "en";

vi.mock("next-intl", () => ({
  useLocale: () => locale,
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
    vi.clearAllMocks();
    locale = "en";
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

  it("shows only Chinese fields and options while editing in Chinese", async () => {
    locale = "zh";
    loadWorkspace.mockResolvedValue({
      fields: [{
        ...field("civil_status", "Civil status", "identity"),
        fieldType: "select",
        options: [
          { value: "single", label_zh: "未婚", label_en: "Single" },
          { value: "married", label_zh: "已婚", label_en: "Married" },
        ],
      }],
      answers: [],
      schemaAvailable: true,
    });

    render(<UniversalProfileExtendedEditor category="identity" onSaveStatusChange={saveStatusChange} />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "身份与国籍" })).toBeInTheDocument());
    expect(screen.getByText("婚姻状况")).toBeInTheDocument();
    expect(screen.queryByText("Civil status")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "请输入或选择" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "请输入或选择" }));
    expect(await screen.findByText("未婚")).toBeInTheDocument();
    expect(screen.queryByText("Single")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("未婚"));
    expect(screen.queryByRole("button", { name: "保存此部分" })).not.toBeInTheDocument();
    expect(saveStatusChange).toHaveBeenCalledWith("saving");
    await waitFor(() => expect(saveAnswers).toHaveBeenCalledWith({
      answers: [{ canonicalKey: "civil_status", value: "single", valueZh: "single", valueEn: "single" }],
    }), { timeout: 2_000 });
    await waitFor(() => expect(saveStatusChange).toHaveBeenCalledWith("saved"));
  });
});
