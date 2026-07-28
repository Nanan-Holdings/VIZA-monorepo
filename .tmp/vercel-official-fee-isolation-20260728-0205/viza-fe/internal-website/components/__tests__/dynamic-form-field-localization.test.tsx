import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DynamicFormField } from "../dynamic-form-field";
import type { VisaFormFieldRow } from "@/types/visa-form-fields";

let mockLocale = "zh";

vi.mock("next-intl", () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => key,
}));

function field(overrides: Partial<VisaFormFieldRow>): VisaFormFieldRow {
  return {
    id: "purpose",
    visaType: "TEST",
    fieldName: "purpose_of_journey",
    label: "Purpose of journey",
    fieldType: "radio",
    required: true,
    stepNumber: 1,
    stepName: "Travel",
    displayOrder: 1,
    placeholder: null,
    validationRules: null,
    options: null,
    conditionalLogic: null,
    ...overrides,
  };
}

describe("DynamicFormField localization", () => {
  it("renders localized radio labels while preserving official stored values", () => {
    const onChange = vi.fn();
    const purposeField = field({
      options: [
        { value: "tourism", text: "Tourism" },
        { value: "business", text: "Business" },
      ],
    });

    mockLocale = "zh";
    const { rerender } = render(
      <DynamicFormField
        field={purposeField}
        value=""
        onChange={onChange}
        displayLocale="zh"
      />,
    );

    expect(screen.getByText("旅游")).toBeInTheDocument();
    expect(screen.getByText("商务")).toBeInTheDocument();
    expect(screen.queryByText("Tourism")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("旅游"));
    expect(onChange).toHaveBeenCalledWith("tourism");

    mockLocale = "en";
    rerender(
      <DynamicFormField
        field={purposeField}
        value=""
        onChange={onChange}
        displayLocale="en"
      />,
    );

    expect(screen.getByText("Tourism")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
  });

  it("does not let empty dependent selects fall back to a free-text input", () => {
    const onChange = vi.fn();
    const wardField = field({
      id: "ward",
      fieldName: "intended_ward_commune",
      label: "Intended ward/commune in Viet Nam",
      fieldType: "select",
      placeholder: "Choose ward/commune in Viet Nam",
      options: [],
      validationRules: {
        dependent_on: "intended_province_city",
      },
    });

    render(
      <DynamicFormField
        field={wardField}
        value=""
        onChange={onChange}
        displayLocale="zh"
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("请先选择上级选项，或联系 VIZA 检查官方下拉列表。")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps an empty remote dropdown searchable across parent rerenders", () => {
    vi.useFakeTimers();
    try {
      const onChange = vi.fn();
      const firstSearch = vi.fn();
      const latestSearch = vi.fn();
      const flightField = field({
        id: "flight",
        fieldName: "flight_number",
        label: "Flight Number",
        fieldType: "select",
        placeholder: "Select flight",
        options: [],
        validationRules: {
          dependent_on: "expected_arrival_date",
          remote_search: true,
        },
      });

      const { rerender } = render(
        <DynamicFormField
          field={flightField}
          value=""
          onChange={onChange}
          displayLocale="zh"
          onSearchQuery={firstSearch}
          loadingText="正在加载官方航班列表..."
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /请选择/ }));
      fireEvent.change(screen.getByPlaceholderText("搜索中文、英文或官方选项..."), {
        target: { value: "UO566" },
      });
      expect(screen.getByText("正在加载官方航班列表...")).toBeInTheDocument();

      rerender(
        <DynamicFormField
          field={flightField}
          value=""
          onChange={onChange}
          displayLocale="zh"
          onSearchQuery={latestSearch}
          loadingText="正在加载官方航班列表..."
        />,
      );
      act(() => vi.advanceTimersByTime(250));

      expect(firstSearch).not.toHaveBeenCalledWith("UO566");
      expect(latestSearch).toHaveBeenCalledWith("UO566");
      expect(screen.queryByText("请先选择上级选项，或联系 VIZA 检查官方下拉列表。")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps page scrolling available while a searchable dropdown is open", () => {
    const onChange = vi.fn();

    const searchableField = field({
      id: "residence",
      fieldName: "place_of_residence",
      label: "Place of Residence",
      fieldType: "select",
      placeholder: "Select residence",
      options: Array.from({ length: 16 }, (_, index) => ({
        value: `OPTION_${index}`,
        label_zh: `选项 ${index}`,
        label_en: `Option ${index}`,
      })),
    });

    render(
      <DynamicFormField
        field={searchableField}
        value=""
        onChange={onChange}
        displayLocale="zh"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /请选择/ }));

    expect(document.documentElement.style.overflow).not.toBe("hidden");
    expect(document.body.style.position).not.toBe("fixed");

    const outsideWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 1600,
    });
    document.body.dispatchEvent(outsideWheel);
    expect(outsideWheel.defaultPrevented).toBe(false);
  });

  it("renders every official option instead of truncating long dropdowns", () => {
    const onChange = vi.fn();
    const hotelField = field({
      id: "hotel",
      fieldName: "accommodation_name",
      label: "Hotel Name",
      fieldType: "select",
      placeholder: "Select hotel",
      options: Array.from({ length: 469 }, (_, index) => ({
        value: `HOTEL_${index}`,
        label_zh: `酒店 ${index}`,
        label_en: `Hotel ${index}`,
      })),
    });

    render(
      <DynamicFormField
        field={hotelField}
        value=""
        onChange={onChange}
        displayLocale="zh"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /请选择/ }));

    expect(screen.getByText("酒店 468")).toBeInTheDocument();
  });

  it("shows optional fields and enforces maxLength hints in Chinese", () => {
    const onChange = vi.fn();
    const addressField = field({
      id: "address",
      fieldName: "address_in_thailand",
      label: "泰国地址 / Address",
      fieldType: "textarea",
      required: false,
      validationRules: { maxLength: 215 },
    });

    render(
      <DynamicFormField
        field={addressField}
        value="ABC"
        onChange={onChange}
        displayLocale="zh"
      />,
    );

    expect(screen.getByText("选填")).toBeInTheDocument();
    expect(screen.getByText("最多 215 个字符，当前 3/215")).toBeInTheDocument();

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("maxLength", "215");

    fireEvent.change(textarea, { target: { value: "A".repeat(240) } });
    expect(onChange).toHaveBeenCalledWith("A".repeat(215));
  });
});
