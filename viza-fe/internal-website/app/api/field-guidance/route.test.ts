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
    expect(payload.reply).toContain("格式示例：15 Rue de Rivoli, Appartement 3B");
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

    expect(payload.guidance.summary).toContain("location");
    expect(renderedGuidance).not.toContain("National Immigration Administration, PRC");
    expect(renderedGuidance).not.toContain("MPS Exit & Entry Administration");
  });
});
