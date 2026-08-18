import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { WizardStep } from "@/types/visa-form-fields";
import {
  DynamicReviewStep,
  getBilingualReviewValue,
  getLocalizedReviewSectionTitle,
  getLocalizedOptionText,
  getReviewOptionText,
  getReviewOfficialLabel,
  getReviewSourceLabel,
} from "../dynamic-review-step";
import { BilingualReviewPanel } from "../bilingual-review-panel";
import { ReviewStep } from "../review-step";

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => {
    const translate = (key: string) => ({
      "review.missingInformation": "缺失信息",
      "review.notProvided": "未填写",
    })[key] ?? key;
    translate.has = () => false;
    return translate;
  },
}));

function baseField(overrides: Partial<WizardStep["fields"][number]>): WizardStep["fields"][number] {
  return {
    id: overrides.fieldName ?? "field",
    visaType: "VN_E_VISA",
    fieldName: overrides.fieldName ?? "field",
    label: overrides.label ?? "Field",
    fieldType: overrides.fieldType ?? "text",
    required: true,
    stepNumber: 1,
    stepName: "Vietnam",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

describe("dynamic review localization", () => {
  test("renders a compact field-and-answer table instead of input-like controls", () => {
    const { container } = render(
      <BilingualReviewPanel
        onEditSection={vi.fn()}
        rows={[{
          section: "个人信息 / Personal Information",
          fieldName: "surname",
          label: "姓 / Surname",
          sourceLabel: "姓",
          officialLabel: "Surname",
          sourceValue: "李",
          officialValue: "LI",
          badges: [],
          warnings: [],
          editable: true,
          editStepIndex: 0,
        }]}
      />,
    );

    const table = screen.getByRole("table");
    const row = within(table).getByRole("row");

    expect(within(row).getByRole("rowheader")).toHaveTextContent("姓Surname");
    expect(within(row).getByRole("rowheader")).toHaveClass("w-[56%]", "px-0", "text-left");
    expect(within(row).getByRole("cell")).toHaveTextContent("李LI");
    expect(within(row).getByRole("cell")).toHaveClass("px-0", "text-right");
    expect(screen.getByRole("button", { name: "修改个人信息 / Personal Information" }))
      .toHaveClass("justify-end", "p-0");
    expect(screen.getByRole("heading", { name: "个人信息 / Personal Information" }))
      .toHaveClass("text-sm");
    expect(screen.getByText("姓")).toHaveClass("text-sm");
    expect(screen.getByText("Surname")).toHaveClass("text-sm");
    expect(screen.getByText("李")).toHaveClass("text-sm");
    expect(screen.getByText("LI")).toHaveClass("text-sm");
    expect(screen.getByRole("heading", { name: "个人信息 / Personal Information" }).parentElement)
      .not.toHaveClass("px-3", "pl-3");
    expect(container.firstElementChild).toHaveClass("gap-0");
    expect(screen.queryByText("修改")).not.toBeInTheDocument();
    expect(container.querySelector("section")).not.toHaveClass("border", "bg-card");
    expect(container.querySelector("input")).not.toBeInTheDocument();
    expect(container.querySelector("textarea")).not.toBeInTheDocument();
  });

  test("renders section headings in the active language only", () => {
    expect(getLocalizedReviewSectionTitle("Personal Information / 个人信息", "en"))
      .toBe("Personal Information");
    expect(getLocalizedReviewSectionTitle("Personal Information / 个人信息", "zh"))
      .toBe("个人信息");
    expect(getLocalizedReviewSectionTitle("Passport Details", "en"))
      .toBe("Passport Details");
  });

  test("highlights both the question and answer for a final-review issue", () => {
    const { container } = render(
      <BilingualReviewPanel
        rows={[{
          section: "住宿 / Accommodation",
          fieldName: "hotel_name",
          label: "酒店名称 / Hotel name",
          sourceLabel: "酒店名称",
          officialLabel: "Hotel name",
          sourceValue: "示例酒店",
          officialValue: "Example Hotel",
          badges: [],
          warnings: [],
          editable: false,
          issueSeverity: "error",
          issueMessage: "酒店名称需要修改。",
        }]}
      />,
    );

    const issueRow = container.querySelector("[data-review-issue='error']");
    expect(issueRow).toHaveClass("bg-red-50");
    expect(screen.getByText("酒店名称")).toHaveClass("text-red-800");
    expect(screen.getByText("示例酒店")).toHaveClass("text-red-700");
    expect(screen.getByText("酒店名称需要修改。")).toBeInTheDocument();
  });

  test("maps assistant issues onto the matching dynamic review answer", () => {
    const hotelField = baseField({
      fieldName: "hotel_name",
      label: "Hotel name",
    });
    const { container } = render(
      <DynamicReviewStep
        applicationId="application-1"
        dynamicAnswers={{ hotel_name: "Holiday Inn" }}
        dbSteps={[{ stepNumber: 1, stepName: "Stay", fields: [hotelField] }]}
        photoPath={null}
        onEdit={vi.fn()}
        onPhotoEdit={vi.fn()}
        onComplete={vi.fn()}
        showAction={false}
        reviewIssues={new Map([
          ["hotel_name", {
            fieldName: "hotel_name",
            message: "Please verify the official hotel name.",
            severity: "warning" as const,
            nextFieldName: null,
          }],
        ])}
      />,
    );

    expect(container.querySelector("[data-review-issue='warning']")).toHaveClass("bg-amber-50");
    expect(screen.getByText("Please verify the official hotel name.")).toBeInTheDocument();
  });

  test("keeps identical section labels tied to their own edit destinations", () => {
    const onEditSection = vi.fn();
    const sharedRow = {
      section: "行程信息",
      label: "字段 / Field",
      sourceLabel: "字段",
      officialLabel: "Field",
      sourceValue: "值",
      officialValue: "Value",
      badges: [],
      warnings: [],
      editable: true,
    };

    render(
      <BilingualReviewPanel
        onEditSection={onEditSection}
        rows={[
          { ...sharedRow, fieldName: "arrival", editStepIndex: 2 },
          { ...sharedRow, fieldName: "insurance", editStepIndex: 7 },
        ]}
      />,
    );

    const editButtons = screen.getAllByRole("button", { name: "修改行程信息" });
    expect(editButtons).toHaveLength(2);

    fireEvent.click(editButtons[0]);
    fireEvent.click(editButtons[1]);
    expect(onEditSection.mock.calls).toEqual([
      [2, "arrival"],
      [7, "insurance"],
    ]);
  });

  test("keeps empty fields at the end of the merged review", () => {
    const step: WizardStep = {
      stepNumber: 1,
      stepName: "Personal Information",
      fields: [
        baseField({
          fieldName: "surname",
          label: "Surname (Family name)",
          validationRules: { label_zh: "姓", label_en: "Surname (Family name)" },
        }),
        baseField({
          fieldName: "given_names",
          label: "Given name(s)",
          validationRules: { label_zh: "名", label_en: "Given name(s)" },
        }),
      ],
    };

    render(
      <DynamicReviewStep
        applicationId="application-id"
        dynamicAnswers={{ surname: "Edward" }}
        dbSteps={[step]}
        photoPath={null}
        onEdit={vi.fn()}
        onPhotoEdit={vi.fn()}
        onComplete={vi.fn()}
        mode="continue"
        showAction={false}
      />,
    );

    const headings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings).toEqual([
      "个人信息",
      "个人信息 · 缺失信息",
    ]);
    expect(screen.getAllByText("Edward").length).toBeGreaterThan(0);
    expect(screen.getAllByText("未填写").length).toBeGreaterThan(0);
    expect(screen.getByText("未填写")).toHaveClass("text-red-600");
    expect(screen.getByText("Not provided")).toHaveClass("text-red-600");
    expect(screen.queryByRole("button", { name: "review.continueToTeam" }))
      .not.toBeInTheDocument();
  });

  test("routes completed and missing sections from the same step to their own first field", () => {
    const onEdit = vi.fn();
    const step: WizardStep = {
      stepNumber: 1,
      stepName: "Personal Information",
      fields: [
        baseField({
          fieldName: "surname",
          label: "Surname",
          validationRules: { label_zh: "姓", label_en: "Surname" },
        }),
        baseField({
          fieldName: "given_names",
          label: "Given names",
          validationRules: { label_zh: "名", label_en: "Given names" },
        }),
      ],
    };

    render(
      <DynamicReviewStep
        applicationId="application-id"
        dynamicAnswers={{ surname: "Li" }}
        dbSteps={[step]}
        photoPath={null}
        onEdit={onEdit}
        onPhotoEdit={vi.fn()}
        onComplete={vi.fn()}
        showAction={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "修改个人信息" }));
    fireEvent.click(screen.getByRole("button", { name: "修改个人信息 · 缺失信息" }));

    expect(onEdit.mock.calls).toEqual([
      [0, "surname"],
      [0, "given_names"],
    ]);
  });

  test("routes legacy completed and missing sections to distinct field anchors", () => {
    const onEdit = vi.fn();
    render(
      <ReviewStep
        applicationId="application-id"
        data={{ personal: { surname: "Li" } }}
        onEdit={onEdit}
        onComplete={vi.fn()}
        showAction={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", {
      name: "修改review.personalInformation / Edit review.personalInformation",
    }));
    fireEvent.click(screen.getByRole("button", {
      name: "修改review.personalInformation · 缺失信息 / Edit review.personalInformation · 缺失信息",
    }));

    expect(onEdit.mock.calls).toEqual([
      ["personal", "surname"],
      ["personal", "given_names"],
    ]);
  });

  test("uses Vietnam schema metadata for Chinese and official review labels", () => {
    const field = baseField({
      fieldName: "has_violated_vietnam_laws",
      label: "Have you violated Vietnamese laws/regulations?",
      fieldType: "radio",
      validationRules: {
        label_zh: "是否曾违反越南法律或法规？",
        label_en: "Have you violated Vietnamese laws/regulations?",
        official_label_en: "Have you violated Vietnamese laws/regulations?",
      },
    });

    expect(getReviewSourceLabel(field)).toBe("是否曾违反越南法律或法规？");
    expect(getReviewOfficialLabel(field)).toBe("Have you violated Vietnamese laws/regulations?");
  });

  test("localizes enum values without changing the stored official value", () => {
    const options = [
      {
        value: "single",
        text: "Single-entry",
        label_zh: "单次入境",
        label_en: "Single-entry",
        official_label: "Single-entry",
      },
    ];

    expect(getLocalizedOptionText("single", options, "zh")).toBe("单次入境");
    expect(getLocalizedOptionText("single", options, "en")).toBe("Single-entry");
    expect(getLocalizedOptionText("official", [{ value: "official", text: "Official" }], "zh")).toBe("公务人员");
  });

  test("prefers explicit Chinese companion values on the review left side", () => {
    const field = baseField({
      fieldName: "purpose_of_entry",
      label: "Purpose of entry",
      fieldType: "text",
    });
    const answers = {
      purpose_of_entry: "Tourism",
      purpose_of_entry_zh: "旅游",
    };

    expect(getBilingualReviewValue(answers, "purpose_of_entry", "Tourism", field, "zh")).toBe("旅游");
    expect(getBilingualReviewValue(answers, "purpose_of_entry", "Tourism", field, "en")).toBe("Tourism");
  });

  test("resolves the selected Vietnam visa issue-place code on both review sides", () => {
    const field = baseField({
      fieldName: "visa_issued_place",
      label: "Issued Place",
      fieldType: "select",
      validationRules: {
        official_source: "prearrival_category:visa_issue_place",
        depends_on: "visa_type",
      },
    });
    const answers = {
      visa_type: "EV",
      visa_issued_place: "18A-131",
    };

    expect(getReviewOptionText(answers, "18A-131", field, "zh"))
      .toBe("越南出入境管理局 - 公安部");
    expect(getReviewOptionText(answers, "18A-131", field, "en"))
      .toBe("Vietnam Immigration Department - Ministry of Public Security");
  });

  test("resolves persisted Vietnam province and ward codes on both review sides", () => {
    const provinceField = baseField({
      fieldName: "province_city_of_hotel",
      label: "Province / City of Hotel",
      fieldType: "select",
      validationRules: {
        official_source: "prearrival_category:administrative_unit_level1",
      },
    });
    const wardField = baseField({
      fieldName: "ward_commune_of_hotel",
      label: "Ward / Commune of Hotel",
      fieldType: "select",
      validationRules: {
        official_source: "prearrival_category:administrative_unit_level2",
        depends_on: "province_city_of_hotel",
      },
    });
    const answers = {
      province_city_of_hotel: "48",
      ward_commune_of_hotel: "20285",
    };

    expect(getReviewOptionText(answers, "48", provinceField, "zh")).toBe("岘港市");
    expect(getReviewOptionText(answers, "48", provinceField, "en")).toBe("Da Nang City");
    expect(getReviewOptionText(answers, "20285", wardField, "zh")).toBe("五行山坊");
    expect(getReviewOptionText(answers, "20285", wardField, "en")).toBe("Ngu Hanh Son Ward");
  });

  test("resolves Vietnam administrative codes when an older schema lacks source metadata", () => {
    const provinceField = baseField({
      fieldName: "province_city_of_hotel",
      label: "Province / City of Hotel",
      fieldType: "select",
    });
    const wardField = baseField({
      fieldName: "ward_commune_of_hotel",
      label: "Ward / Commune of Hotel",
      fieldType: "select",
    });
    const answers = {
      province_city_of_hotel: "48",
      ward_commune_of_hotel: "20285",
    };

    expect(getReviewOptionText(answers, "48", provinceField, "zh")).toBe("岘港市");
    expect(getReviewOptionText(answers, "20285", wardField, "zh")).toBe("五行山坊");
  });
});
