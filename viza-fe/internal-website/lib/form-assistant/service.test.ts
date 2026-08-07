import { describe, expect, it, vi } from "vitest";
import type { VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";

vi.mock("server-only", () => ({}));

import { buildAssistantState, parseDirectYesNoAnswer } from "./service";

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
