import { describe, expect, it, vi } from "vitest";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

vi.mock("server-only", () => ({}));

import {
  buildAssistantState,
  parseDirectCurrentFieldAnswer,
  parseDirectYesNoAnswer,
} from "./service";

function field(fieldName: string, label: string, labelZh: string, required = true): VisaFormFieldRow {
  return {
    id: fieldName,
    visaType: "SG_ARRIVAL_CARD",
    fieldName,
    label,
    fieldType: "text",
    required,
    stepNumber: 1,
    stepName: "Trip details",
    displayOrder: 1,
    placeholder: null,
    validationRules: { label_zh: labelZh },
    options: null,
    conditionalLogic: null,
  };
}

function yesNoField(fieldName: string, label: string, labelZh: string): VisaFormFieldRow {
  return {
    ...field(fieldName, label, labelZh),
    fieldType: "radio",
    options: [
      { value: "yes", text: "Yes" },
      { value: "no", text: "No" },
    ],
  };
}

describe("buildAssistantState", () => {
  const steps: WizardStep[] = [{
    stepNumber: 1,
    stepName: "Trip details",
    fields: [
      field("arrival_date", "Arrival date", "抵达日期"),
      field("departure_date", "Departure date", "离开新加坡日期"),
    ],
  }];

  it("asks exactly one current question", () => {
    const state = buildAssistantState({
      sessionId: "session-id",
      steps,
      answers: {},
      messages: [],
      locale: "zh",
    });

    expect(state.assistantMessage).toContain("抵达日期");
    expect(state.assistantMessage).not.toContain("离开新加坡日期");
    expect(state.missingFields).toHaveLength(2);
  });

  it("replaces a legacy multi-question prompt with the current single question", () => {
    const state = buildAssistantState({
      sessionId: "session-id",
      steps,
      answers: {},
      messages: [{
        id: "legacy-message",
        role: "assistant",
        content: "1. Arrival date\n2. Departure date",
        createdAt: "2026-08-07T00:00:00.000Z",
      }],
      locale: "en",
    });

    expect(state.assistantMessage).toContain("Arrival date");
    expect(state.assistantMessage).not.toContain("Departure date");
  });
});

describe("parseDirectYesNoAnswer", () => {
  const yellowFeverField = yesNoField(
    "recent_country_visit_history",
    "Visited a Yellow Fever risk area?",
    "抵达前六天内是否到访黄热病风险国家或地区？",
  );

  it.each(["没有", "都没有", "否", "no", "Never"])(
    "maps the short contextual answer %s to no",
    (answer) => {
      expect(parseDirectYesNoAnswer(answer, yellowFeverField)).toEqual({
        fieldName: "recent_country_visit_history",
        value: "no",
        confidence: "high",
      });
    },
  );

  it.each(["有", "是", "yes", "Yeah"])(
    "maps the short contextual answer %s to yes",
    (answer) => {
      expect(parseDirectYesNoAnswer(answer, yellowFeverField)).toEqual({
        fieldName: "recent_country_visit_history",
        value: "yes",
        confidence: "high",
      });
    },
  );

  it("does not guess when a response is not a direct yes-or-no answer", () => {
    expect(parseDirectYesNoAnswer("我需要确认一下行程", yellowFeverField)).toBeNull();
    expect(parseDirectYesNoAnswer("没有发热，但是有咳嗽", yellowFeverField)).toBeNull();
  });
});

describe("parseDirectCurrentFieldAnswer", () => {
  const arrivalDateField: VisaFormFieldRow = {
    ...field("arrival_date", "Arrival date", "抵达日期"),
    fieldType: "date",
  };
  const modeOfTravelField: VisaFormFieldRow = {
    ...field("mode_of_travel", "Mode of travel", "交通方式"),
    fieldType: "select",
    options: [
      { value: "air", text: "Air", label_zh: "航空", label_en: "Air" },
      { value: "land", text: "Land", label_zh: "陆路", label_en: "Land" },
      { value: "sea", text: "Sea", label_zh: "海路", label_en: "Sea" },
    ],
  };

  it.each([
    ["明天", "2026-08-08"],
    ["我明天抵达", "2026-08-08"],
    ["tomorrow", "2026-08-08"],
    ["后天", "2026-08-09"],
    ["3天后", "2026-08-10"],
    ["8月7号", "2026-08-07"],
    ["我是8月7日抵达", "2026-08-07"],
    ["2026年8月12日", "2026-08-12"],
  ])("normalizes the natural-language date %s", (answer, expected) => {
    expect(parseDirectCurrentFieldAnswer(answer, arrivalDateField, {
      now: new Date("2026-08-07T10:30:00.000Z"),
      timeZone: "Asia/Singapore",
    })).toEqual({
      fieldName: "arrival_date",
      value: expected,
      confidence: "high",
      modelSource: "deterministic",
    });
  });

  it("does not guess when relative dates conflict", () => {
    expect(parseDirectCurrentFieldAnswer("明天或者后天", arrivalDateField, {
      now: new Date("2026-08-07T00:00:00.000Z"),
      timeZone: "Asia/Singapore",
    })).toBeNull();
  });

  it.each([
    ["航空", "air"],
    ["Air", "air"],
    ["海路", "sea"],
  ])("maps the localized option %s to its official value", (answer, expected) => {
    expect(parseDirectCurrentFieldAnswer(answer, modeOfTravelField)).toEqual({
      fieldName: "mode_of_travel",
      value: expected,
      confidence: "high",
      modelSource: "deterministic",
    });
  });
});
