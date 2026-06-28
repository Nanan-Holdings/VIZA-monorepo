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

describe("POST /api/field-guidance", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("adds local option explanations for passport type choices when services are unavailable", async () => {
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
        }),
      }),
    );
    const payload = (await response.json()) as FieldGuidanceResponse;

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
      expect.objectContaining({
        value: "official",
        label: "公务护照",
        description: expect.stringContaining("公务"),
      }),
      expect.objectContaining({
        value: "other",
        label: "其他",
        description: expect.stringContaining("不属于"),
      }),
    ]);
  });
});
