import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { type FieldGuidanceResponse } from "@/types/field-guidance";

const passportTypeField = {
  id: "field-passport-type",
  visaType: "DS160",
  fieldName: "passport_document_type",
  label: "护照类型",
  fieldType: "select",
  required: true,
  stepNumber: 1,
  stepName: "Passport",
  displayOrder: 1,
  placeholder: null,
  validationRules: null,
  options: [
    { value: "ordinary", label_zh: "普通护照", label_en: "Regular" },
    { value: "diplomatic", label_zh: "外交护照", label_en: "Diplomatic" },
    { value: "official", label_zh: "公务护照", label_en: "Official" },
    { value: "other", label_zh: "其他", label_en: "Other" },
  ],
  conditionalLogic: null,
};

const passportPlaceOfIssueField = {
  ...passportTypeField,
  id: "field-passport-place-of-issue",
  visaType: "JP_TOURIST",
  fieldName: "passport_place_of_issue",
  label: "Place of issue",
  fieldType: "text",
  options: null,
};

const accommodationAddressField = {
  ...passportTypeField,
  id: "field-accommodation-address-line-1",
  visaType: "EU_SCHENGEN_C_SHORT_STAY",
  fieldName: "accommodation_address_line_1",
  label: "住宿地址——第1行",
  fieldType: "text",
  placeholder: "Street and number",
  options: null,
};

const vietnamInformationAcknowledgementField = {
  ...passportTypeField,
  id: "field-vn-visa-information-acknowledgement",
  visaType: "VN_PREARRIVAL_DECLARATION",
  fieldName: "visa_information_acknowledgement",
  label: "我已阅读并理解此信息",
  fieldType: "checkbox",
  options: null,
  validationRules: {
    helper_zh: "请提供越南签证信息（如适用）。所选签证类型决定允许入境的期限；签证编号应与官方签证文件一致。",
  },
};

describe("POST /api/field-guidance", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("adds local option explanations for passport type choices after the user asks", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("backend unavailable");
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/field-guidance", {
        method: "POST",
        body: JSON.stringify({
          visaType: "DS160",
          country: "US",
          locale: "zh",
          field: passportTypeField,
          answer: "",
          allAnswers: {},
          question: "普通护照、外交护照和公务护照有什么区别？",
        }),
      }),
    );
    const payload = (await response.json()) as FieldGuidanceResponse;

    expect(payload.guidance.optionExplanations).toHaveLength(2);
    expect(payload.guidance.optionExplanations).toEqual([
      expect.objectContaining({
        value: "ordinary",
        label: "普通护照",
        description: expect.stringContaining("个人"),
      }),
      expect.objectContaining({
        value: "diplomatic",
        label: "外交护照",
        description: expect.stringContaining("外交"),
      }),
    ]);
  });

  it("does not replace an AI decision with generic option templates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          guidance: {
            title: "护照类型填写帮助",
            summary: "请按护照资料页上的证件类型选择。",
            examples: [],
            optionExplanations: [],
            hints: [],
            officialWarnings: [],
            formatHints: [],
          },
          validation: { severity: "ok", messages: ["目前没有发现明显问题。"] },
          sources: [],
          confidence: "medium",
          aiUsed: true,
          cached: false,
        }),
      })),
    );

    const response = await POST(
      new Request("http://localhost/api/field-guidance", {
        method: "POST",
        body: JSON.stringify({
          visaType: "DS160",
          country: "US",
          locale: "zh",
          field: passportTypeField,
          answer: "",
          allAnswers: {},
          question: "我应该选哪一种护照？",
        }),
      }),
    );
    const payload = (await response.json()) as FieldGuidanceResponse;

    expect(payload.aiUsed).toBe(true);
    expect(payload.guidance.optionExplanations).toEqual([]);
  });

  it("returns local dropdown guidance without calling AI when there is no question", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/field-guidance", {
        method: "POST",
        body: JSON.stringify({
          visaType: "DS160",
          country: "US",
          locale: "zh",
          field: passportTypeField,
          answer: "ordinary",
          allAnswers: {},
        }),
      }),
    );
    const payload = (await response.json()) as FieldGuidanceResponse;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.aiUsed).toBe(false);
    expect(payload.guidance.examples).toEqual([]);
    expect(payload.guidance.optionExplanations).toEqual([]);
    expect(payload.guidance.summary).toContain("官方选项");
  });

  it("replaces a repeated clarification question with the shared field explanation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          guidance: {
            title: "住宿地址——第1行填写帮助",
            summary: "请填写当前字段。",
            examples: [],
            optionExplanations: [],
            hints: [],
            officialWarnings: [],
            formatHints: [],
          },
          validation: { severity: "warning", messages: ["这是必填项。"] },
          reply: "请告诉我住宿地址——第1行。",
          sources: [],
          confidence: "low",
          aiUsed: true,
          cached: false,
        }),
      })),
    );

    const response = await POST(
      new Request("http://localhost/api/field-guidance", {
        method: "POST",
        body: JSON.stringify({
          visaType: "EU_SCHENGEN_C_SHORT_STAY",
          country: "france",
          locale: "zh",
          field: accommodationAddressField,
          answer: "",
          allAnswers: {},
          question: "什么意思",
        }),
      }),
    );
    const payload = (await response.json()) as FieldGuidanceResponse;

    expect(payload.reply).toContain("门牌号、街道名");
    expect(payload.reply).toContain("酒店预订单");
    expect(payload.reply).not.toContain("格式示例");
    expect(payload.reply).not.toBe("请告诉我住宿地址——第1行。");
  });

  it("keeps place of issue separate from issuing authority in local guidance", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("backend unavailable");
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/field-guidance", {
        method: "POST",
        body: JSON.stringify({
          visaType: "JP_TOURIST",
          country: "japan",
          locale: "en",
          field: passportPlaceOfIssueField,
          answer: "",
          allAnswers: {},
        }),
      }),
    );
    const payload = (await response.json()) as FieldGuidanceResponse;
    const renderedGuidance = JSON.stringify(payload.guidance);

    expect(payload.guidance.summary).toContain("place where the document was issued");
    expect(renderedGuidance).not.toContain("National Immigration Administration, PRC");
    expect(renderedGuidance).not.toContain("MPS Exit & Entry Administration");
  });

  it("returns acknowledgement-specific local guidance without a text-entry example", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/field-guidance", {
        method: "POST",
        body: JSON.stringify({
          visaType: "VN_PREARRIVAL_DECLARATION",
          country: "vietnam",
          locale: "zh",
          field: vietnamInformationAcknowledgementField,
          answer: "",
          allAnswers: {},
        }),
      }),
    );
    const payload = (await response.json()) as FieldGuidanceResponse;
    const guidanceText = JSON.stringify(payload.guidance);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(payload.guidance.summary).toContain("理解后勾选");
    expect(payload.guidance.hints).toContainEqual(expect.stringContaining("越南签证信息"));
    expect(payload.guidance.examples).toEqual([]);
    expect(guidanceText).not.toContain("请按护照、身份证明或官方文件上的原文填写");
  });

  it("replaces downstream country-specific examples with metadata-backed examples", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          guidance: {
            title: "Arrival date guidance",
            summary: "Use the travel date shown on your itinerary.",
            examples: ["15/09/2026", "+86 138 0000 0000"],
            optionExplanations: [],
            hints: [],
            officialWarnings: [],
            formatHints: [],
          },
          validation: { severity: "ok", messages: [] },
          sources: [],
          confidence: "medium",
          aiUsed: true,
          cached: false,
        }),
      })),
    );

    const response = await POST(
      new Request("http://localhost/api/field-guidance", {
        method: "POST",
        body: JSON.stringify({
          visaType: "KR_C39_SHORT_TERM_VISIT",
          country: "korea",
          locale: "en",
          field: {
            ...passportTypeField,
            fieldName: "arrival_date",
            label: "Arrival Date",
            fieldType: "date",
            options: null,
            validationRules: { format: "YYYY/MM/DD" },
          },
          answer: "",
          allAnswers: {},
          question: "What format should I use?",
        }),
      }),
    );
    const payload = (await response.json()) as FieldGuidanceResponse;

    expect(payload.guidance.examples).toEqual(["2026/09/15"]);
    expect(JSON.stringify(payload.guidance)).not.toContain("+86");
  });

  it("forwards a bounded relevance-ranked context for very large official option lists", async () => {
    const options = Array.from({ length: 4_500 }, (_, index) => ({
      value: `DISTRICT_${index}`,
      text: `District ${index}`,
    }));
    options[4_321] = {
      value: "NGU_HANH_SON_WARD",
      text: "NGU HANH SON WARD",
    };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        guidance: {
          title: "坊/社填写帮助",
          summary: "请根据住宿地址选择匹配的官方行政区选项。",
          examples: [],
          optionExplanations: [],
          hints: [],
          officialWarnings: [],
          formatHints: [],
        },
        validation: { severity: "ok", messages: ["可继续核对。"] },
        sources: [],
        confidence: "high",
        aiUsed: true,
        cached: false,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    await POST(
      new Request("http://localhost/api/field-guidance", {
        method: "POST",
        body: JSON.stringify({
          visaType: "TH_TDAC_ARRIVAL_CARD",
          country: "thailand",
          locale: "zh",
          field: {
            ...passportTypeField,
            fieldName: "sub_district",
            label: "分区/乡",
            fieldType: "select",
            options,
          },
          answer: "",
          allAnswers: { accommodation_address: "19 Truong Sa, Ngu Hanh Son" },
          question: "这个地址应该选择 Ngu Hanh Son 的哪一个选项？",
        }),
      }),
    );

    const forwarded = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      field: {
        options: Array<{ value: string }>;
        validationRules: Record<string, unknown>;
      };
    };
    expect(forwarded.field.options.length).toBeLessThanOrEqual(120);
    expect(forwarded.field.options).toContainEqual(expect.objectContaining({ value: "NGU_HANH_SON_WARD" }));
    expect(forwarded.field.validationRules.guidance_option_count).toBe(4_500);
    expect(JSON.stringify(forwarded).length).toBeLessThan(1_000_000);
  });
});
