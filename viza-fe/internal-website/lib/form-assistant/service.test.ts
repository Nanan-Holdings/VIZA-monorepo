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

    expect(state.assistantMessage).toContain("计划哪一天抵达新加坡");
    expect(state.assistantMessage).not.toContain("离开新加坡");
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

    expect(state.assistantMessage).toContain("arrive in Singapore");
    expect(state.assistantMessage).not.toContain("leave Singapore");
  });

  it("asks select questions in warm, conversational language", () => {
    const modeField: VisaFormFieldRow = {
      ...field("mode_of_travel", "Mode of travel", "交通方式"),
      fieldType: "select",
      options: [
        { value: "air", text: "Air", label_zh: "航空" },
        { value: "land", text: "Land", label_zh: "陆路" },
        { value: "sea", text: "Sea", label_zh: "海路" },
      ],
    };
    const state = buildAssistantState({
      sessionId: "session-id",
      steps: [{ stepNumber: 1, stepName: "Trip details", fields: [modeField] }],
      answers: {},
      messages: [],
      locale: "zh",
    });

    expect(state.assistantMessage).toBe("你准备通过什么交通方式前往新加坡？是航空、陆路还是海路？");
    expect(state.assistantMessage).not.toContain("我们一次填写一项");
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

  it.each(["有", "是", "是的", "对", "对的", "yes", "Yeah", "Correct"])(
    "maps the short contextual answer %s to yes",
    (answer) => {
      expect(parseDirectYesNoAnswer(answer, yellowFeverField)).toEqual({
        fieldName: "recent_country_visit_history",
        value: "yes",
        confidence: "high",
      });
    },
  );
  const healthField = yesNoField(
    "has_health_symptoms",
    "Do you have any listed health symptoms?",
    "目前是否有发热、咳嗽或其他所列症状？",
  );

  it.each([
    "没有，我最近六天没有去过这些地区",
    "我从未到访过黄热病风险地区",
    "No, I haven't visited any of those places",
    "I have never been to a yellow fever risk area",
    "I have not visited a yellow fever risk area",
  ])("understands the natural negative answer %s", (answer) => {
    expect(parseDirectYesNoAnswer(answer, yellowFeverField)).toEqual({
      fieldName: "recent_country_visit_history",
      value: "no",
      confidence: "high",
    });
  });

  it.each([
    "去过，我昨天刚从那里回来",
    "有的，我最近去过巴西",
    "Yes, I have visited one of those places",
    "I did visit a yellow fever risk area",
  ])("understands the natural affirmative answer %s", (answer) => {
    expect(parseDirectYesNoAnswer(answer, yellowFeverField)).toEqual({
      fieldName: "recent_country_visit_history",
      value: "yes",
      confidence: "high",
    });
  });

  it.each([
    ["I do not have any symptoms", "no"],
    ["I have a cough", "yes"],
    ["我有一点咳嗽", "yes"],
  ])("understands the health-specific answer %s", (answer, value) => {
    expect(parseDirectYesNoAnswer(answer, healthField)).toEqual({
      fieldName: "has_health_symptoms",
      value,
      confidence: "high",
    });
  });

  it("does not guess when a response is not a direct yes-or-no answer", () => {
    expect(parseDirectYesNoAnswer("我需要确认一下行程", yellowFeverField)).toBeNull();
    expect(parseDirectYesNoAnswer("没有发热，但是有咳嗽", yellowFeverField)).toBeNull();
    expect(parseDirectYesNoAnswer("没有发热，但是有咳嗽", healthField)).toBeNull();
    expect(parseDirectYesNoAnswer("我不确定有没有去过", yellowFeverField)).toBeNull();
    expect(parseDirectYesNoAnswer("不是没有去过", yellowFeverField)).toBeNull();
    expect(parseDirectYesNoAnswer("I am flying tomorrow", yellowFeverField)).toBeNull();
    expect(parseDirectYesNoAnswer("我有一张机票", yellowFeverField)).toBeNull();
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
  const airTransportTypeField: VisaFormFieldRow = {
    ...field("air_transport_type", "Mode of Transport", "航空交通方式"),
    fieldType: "select",
    options: [
      { value: "commercial", text: "Commercial Flight", label_zh: "商业航班" },
      { value: "private", text: "Private/Cargo Airline/Others", label_zh: "私人 / 货运航空 / 其他" },
    ],
  };
  const accommodationTypeField: VisaFormFieldRow = {
    ...field("accommodation_type", "Type of Accommodation", "在新加坡的住宿类型"),
    fieldType: "select",
    options: [
      { value: "hotel", text: "Hotel", label_zh: "酒店" },
      { value: "residential", text: "Residential", label_zh: "住宅" },
      { value: "others", text: "Others", label_zh: "其他" },
    ],
  };
  const landTransportTypeField: VisaFormFieldRow = {
    ...field("land_transport_type", "Mode of Transport", "陆路交通方式"),
    fieldType: "select",
    options: [
      { value: "bus", text: "Bus", label_zh: "巴士" },
      { value: "car", text: "Car", label_zh: "汽车" },
      { value: "lorry", text: "Lorry", label_zh: "货车" },
      { value: "motorcycle", text: "Motorcycle", label_zh: "摩托车" },
      { value: "rail", text: "Rail", label_zh: "铁路" },
      { value: "van", text: "Van", label_zh: "厢式车" },
    ],
  };
  const seaTransportTypeField: VisaFormFieldRow = {
    ...field("sea_transport_type", "Mode of Transport", "海路交通方式"),
    fieldType: "select",
    options: [
      { value: "cruise", text: "Cruise", label_zh: "邮轮" },
      { value: "commercial_vessel", text: "Commercial Vessel", label_zh: "商业船舶" },
      { value: "ferry", text: "Ferry", label_zh: "渡轮" },
      { value: "private_craft", text: "Private Craft", label_zh: "私人船只" },
    ],
  };
  const purposeField: VisaFormFieldRow = {
    ...field("purpose_of_travel", "Purpose of Travel", "旅行目的"),
    fieldType: "select",
    options: [
      { value: "Business/Meeting/Conference/Convention/Exhibition", text: "Business/Meeting/Conference/Convention/Exhibition", label_zh: "商务 / 会议 / 大会 / 会展" },
      { value: "Holiday/Sightseeing/Leisure", text: "Holiday/Sightseeing/Leisure", label_zh: "度假 / 观光 / 休闲" },
      { value: "Visiting Friends/Relatives", text: "Visiting Friends/Relatives", label_zh: "探亲访友" },
    ],
  };
  const lastCityField: VisaFormFieldRow = {
    ...field(
      "last_city_or_port_before_singapore",
      "Last city or port before Singapore",
      "抵达新加坡前最后登程城市 / 港口",
    ),
    fieldType: "select",
    options: [
      ...Array.from({ length: 299 }, (_, index) => ({
        value: `PLACE_${index}`,
        text: `PLACE ${index}`,
        label_zh: `地点 ${index}`,
        label_en: `PLACE ${index}`,
      })),
      {
        value: "CHINA, HUNAN, CHANGSHA",
        text: "CHINA, HUNAN, CHANGSHA",
        label_zh: "中国，湖南，长沙",
        label_en: "CHINA, HUNAN, CHANGSHA",
      },
      {
        value: "CHINA, HUNAN, OTHERS IN HUNAN PROVINCE",
        text: "CHINA, HUNAN, OTHERS IN HUNAN PROVINCE",
        label_zh: "中国，湖南，湖南省其他地区",
        label_en: "CHINA, HUNAN, OTHERS IN HUNAN PROVINCE",
      },
      {
        value: "HONG KONG SAR, HONG KONG SAR, HONG KONG SAR",
        text: "HONG KONG SAR, HONG KONG SAR, HONG KONG SAR",
        label_zh: "中国香港特别行政区，中国香港特别行政区，中国香港特别行政区",
        label_en: "HONG KONG SAR, HONG KONG SAR, HONG KONG SAR",
      },
      {
        value: "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR",
        text: "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR",
        label_zh: "马来西亚，吉隆坡，吉隆坡",
        label_en: "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR",
      },
      {
        value: "MALAYSIA, JOHOR, JOHOR BAHRU",
        text: "MALAYSIA, JOHOR, JOHOR BAHRU",
        label_zh: "马来西亚，柔佛州，新山",
        label_en: "MALAYSIA, JOHOR, JOHOR BAHRU",
      },
      {
        value: "UNITED STATES, NEW YORK, NANUET",
        text: "UNITED STATES, NEW YORK, NANUET",
        label_zh: "美国，纽约，纳努埃特",
        label_en: "UNITED STATES, NEW YORK, NANUET",
      },
      {
        value: "UNITED STATES, NEW YORK, NEW YORK",
        text: "UNITED STATES, NEW YORK, NEW YORK",
        label_zh: "美国，纽约州，纽约市",
        label_en: "UNITED STATES, NEW YORK, NEW YORK",
      },
    ],
  };

  it.each([
    ["明天", "2026-08-08"],
    ["我明天抵达", "2026-08-08"],
    ["tomorrow", "2026-08-08"],
    ["tomorrow morning", "2026-08-08"],
    ["后天", "2026-08-09"],
    ["day after tomorrow", "2026-08-09"],
    ["3天后", "2026-08-10"],
    ["再过5天出发", "2026-08-12"],
    ["in 5 days", "2026-08-12"],
    ["8月7号", "2026-08-07"],
    ["我是8月7日抵达", "2026-08-07"],
    ["2026年8月12日", "2026-08-12"],
    ["2026/8/12", "2026-08-12"],
    ["2026-08-12", "2026-08-12"],
    ["Aug 12, 2026", "2026-08-12"],
    ["12th August 2026", "2026-08-12"],
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
    expect(parseDirectCurrentFieldAnswer("不是明天", arrivalDateField, {
      now: new Date("2026-08-07T00:00:00.000Z"),
      timeZone: "Asia/Singapore",
    })).toBeNull();
    expect(parseDirectCurrentFieldAnswer("2月30日", arrivalDateField, {
      now: new Date("2026-08-07T00:00:00.000Z"),
      timeZone: "Asia/Singapore",
    })).toBeNull();
    for (const answer of ["tomorrow, not", "不明天", "tomorrow-ish", "2026-01-01abc"]) {
      expect(parseDirectCurrentFieldAnswer(answer, arrivalDateField, {
        now: new Date("2026-08-07T00:00:00.000Z"),
        timeZone: "Asia/Singapore",
      })).toBeNull();
    }
  });

  it.each([
    ["航空", "air"],
    ["Air", "air"],
    ["海路", "sea"],
    ["我准备坐飞机去新加坡", "air"],
    ["I'll fly to Singapore", "air"],
    ["我会搭巴士从陆路入境", "land"],
    ["I am driving across the border", "land"],
    ["我坐渡轮过去", "sea"],
    ["We'll take a ferry", "sea"],
  ])("maps the localized option %s to its official value", (answer, expected) => {
    expect(parseDirectCurrentFieldAnswer(answer, modeOfTravelField)).toEqual({
      fieldName: "mode_of_travel",
      value: expected,
      confidence: "high",
      modelSource: "deterministic",
    });
  });

  it.each([
    ["坐火车过境", "rail"],
    ["I will take the train", "rail"],
    ["我会开车过来", "car"],
    ["by coach", "bus"],
    ["骑摩托车", "motorcycle"],
    ["坐面包车", "van"],
  ])("maps the natural-language land transport answer %s", (answer, expected) => {
    expect(parseDirectCurrentFieldAnswer(answer, landTransportTypeField)).toEqual({
      fieldName: "land_transport_type",
      value: expected,
      confidence: "high",
      modelSource: "deterministic",
    });
  });

  it.each([
    ["我会乘坐游轮", "cruise"],
    ["乘渡轮入境", "ferry"],
    ["I am on a merchant ship", "commercial_vessel"],
    ["我坐私人游艇", "private_craft"],
  ])("maps the natural-language sea transport answer %s", (answer, expected) => {
    expect(parseDirectCurrentFieldAnswer(answer, seaTransportTypeField)).toEqual({
      fieldName: "sea_transport_type",
      value: expected,
      confidence: "high",
      modelSource: "deterministic",
    });
  });

  it.each([
    ["我来新加坡旅游", "Holiday/Sightseeing/Leisure"],
    ["I am going sightseeing", "Holiday/Sightseeing/Leisure"],
    ["For a holiday", "Holiday/Sightseeing/Leisure"],
    ["This is a business trip", "Business/Meeting/Conference/Convention/Exhibition"],
    ["我是来探亲的", "Visiting Friends/Relatives"],
    ["I am visiting family", "Visiting Friends/Relatives"],
  ])("maps the natural-language travel purpose %s", (answer, expected) => {
    expect(parseDirectCurrentFieldAnswer(answer, purposeField)).toEqual({
      fieldName: "purpose_of_travel",
      value: expected,
      confidence: "high",
      modelSource: "deterministic",
    });
  });

  it.each([
    ["我坐的是普通民航班机", "commercial"],
    ["I'm taking a regular airline flight", "commercial"],
    ["我乘私人飞机入境", "private"],
    ["It is a charter flight", "private"],
  ])("maps the natural-language air transport answer %s", (answer, expected) => {
    expect(parseDirectCurrentFieldAnswer(answer, airTransportTypeField)).toEqual({
      fieldName: "air_transport_type",
      value: expected,
      confidence: "high",
      modelSource: "deterministic",
    });
  });

  it.each([
    ["我住酒店", "hotel"],
    ["I'll stay at a hotel", "hotel"],
    ["住在朋友家", "residential"],
    ["I'm staying at my relative's home", "residential"],
  ])("maps the natural-language accommodation answer %s", (answer, expected) => {
    expect(parseDirectCurrentFieldAnswer(answer, accommodationTypeField)).toEqual({
      fieldName: "accommodation_type",
      value: expected,
      confidence: "high",
      modelSource: "deterministic",
    });
  });

  it.each(["长沙", "我从长沙搭飞机前往新加坡", "Changsha", "I will fly from Changsha"])(
    "maps the natural-language city answer %s beyond the model option slice",
    (answer) => {
      expect(parseDirectCurrentFieldAnswer(answer, lastCityField)).toEqual({
        fieldName: "last_city_or_port_before_singapore",
        value: "CHINA, HUNAN, CHANGSHA",
        confidence: "high",
        modelSource: "deterministic",
      });
    },
  );

  it("does not guess when a province matches multiple official city options", () => {
    expect(parseDirectCurrentFieldAnswer("湖南", lastCityField)).toBeNull();
    expect(parseDirectCurrentFieldAnswer("纽约", lastCityField)).toBeNull();
  });

  it.each([
    ["香港", "HONG KONG SAR, HONG KONG SAR, HONG KONG SAR"],
    ["Hong Kong", "HONG KONG SAR, HONG KONG SAR, HONG KONG SAR"],
    ["Malaysia, Kuala Lumpur", "MALAYSIA, KUALA LUMPUR, KUALA LUMPUR"],
  ])("resolves the safe hierarchical location %s", (answer, expected) => {
    expect(parseDirectCurrentFieldAnswer(answer, lastCityField)).toEqual({
      fieldName: "last_city_or_port_before_singapore",
      value: expected,
      confidence: "high",
      modelSource: "deterministic",
    });
  });
});
