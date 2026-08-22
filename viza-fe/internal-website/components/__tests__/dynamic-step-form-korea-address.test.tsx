import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { DynamicStepForm } from "@/components/dynamic-step-form";
import type { WizardStep } from "@/types/visa-form-fields";

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

vi.mock("next-intl", () => ({
  useLocale: () => "zh",
  useTranslations: () => Object.assign((key: string) => key, { has: () => false }),
}));

vi.mock("@/components/field-guidance-panel", () => ({
  FieldGuidancePanel: () => <div data-testid="field-guidance-panel" />,
}));

const step: WizardStep = {
  stepNumber: 3,
  stepName: "Stay in Korea",
  fields: [
    {
      id: "address-search",
      visaType: "KR_E_ARRIVAL_CARD",
      fieldName: "stay_address_search",
      label: "Search and Select Address in Korea",
      fieldType: "address_lookup",
      required: true,
      stepNumber: 3,
      stepName: "Stay in Korea",
      displayOrder: 1,
      placeholder: "Search address",
      validationRules: {
        label_zh: "搜索并选择韩国住宿地址",
        source: "korea_e_arrival_card_address_search",
        remote_search: true,
      },
      options: null,
      conditionalLogic: null,
    },
    ...[
      ["stay_address_ko", "韩国住宿地址（韩文，自动填写）"],
      ["stay_address_en", "韩国住宿地址（英文，自动填写）"],
      ["stay_postal_code", "韩国邮政编码（自动填写，5 位数字）"],
    ].map(([fieldName, label], index) => ({
      id: fieldName,
      visaType: "KR_E_ARRIVAL_CARD",
      fieldName,
      label,
      fieldType: "text" as const,
      required: true,
      stepNumber: 3,
      stepName: "Stay in Korea",
      displayOrder: index + 2,
      placeholder: null,
      validationRules: { label_zh: label, read_only: true, derived_from: "stay_address_search" },
      options: null,
      conditionalLogic: null,
    })),
  ],
};

describe("DynamicStepForm Korea official address lookup", () => {
  it("stores the Korean address, English address, and ZIP from one selected result", async () => {
    const onDraftChange = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        options: [{
          value: "1 Sejong-daero, Jung-gu, Seoul",
          text: "1 Sejong-daero, Jung-gu, Seoul (04524)",
          label_zh: "首尔特别市 中区 世宗大路 1 (04524)",
          official_label: "서울특별시 중구 세종대로 1",
          koreanAddress: "서울특별시 중구 세종대로 1",
          englishAddress: "1 Sejong-daero, Jung-gu, Seoul",
          postalCode: "04524",
        }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(
      <DynamicStepForm
        step={step}
        prefill={{}}
        onComplete={vi.fn()}
        onDraftChange={onDraftChange}
        country="south_korea"
        visaType="KR_E_ARRIVAL_CARD"
      />,
    );

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-field-name="stay_address_search"] button.application-form-control',
    );
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger!);
    fireEvent.change(screen.getByPlaceholderText("搜索中文、英文或官方选项..."), {
      target: { value: "Sejong-daero" },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByText("首尔特别市 中区 世宗大路 1 (04524)"));

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        stay_address_search: "1 Sejong-daero, Jung-gu, Seoul",
        stay_address_search_zh: "首尔特别市 中区 世宗大路 1 (04524)",
        stay_address_search_en: "1 Sejong-daero, Jung-gu, Seoul",
        stay_address_ko: "서울특별시 중구 세종대로 1",
        stay_address_en: "1 Sejong-daero, Jung-gu, Seoul",
        stay_postal_code: "04524",
      }));
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("서울특별시 중구 세종대로 1")).toBeDisabled();
      expect(screen.getByDisplayValue("1 Sejong-daero, Jung-gu, Seoul")).toBeDisabled();
      expect(screen.getByDisplayValue("04524")).toBeDisabled();
    });
  });
});
