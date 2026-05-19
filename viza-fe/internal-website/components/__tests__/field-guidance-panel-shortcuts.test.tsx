import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FieldGuidancePanel } from "../field-guidance-panel";
import { type FieldGuidanceResponse } from "@/types/field-guidance";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";

const field: VisaFormFieldRow = {
  id: "field-passport-number",
  visaType: "DS160",
  fieldName: "passport_number",
  label: "Passport number",
  fieldType: "text",
  required: true,
  stepNumber: 1,
  stepName: "Passport",
  displayOrder: 1,
  placeholder: "PA1234567",
  validationRules: null,
  options: null,
  conditionalLogic: null,
};

const baseResponse: FieldGuidanceResponse = {
  guidance: {
    title: "Passport number",
    summary: "Enter the passport number exactly as shown on the passport.",
    examples: ["PA1234567"],
    hints: ["Use the official document value."],
    officialWarnings: [],
    formatHints: [],
  },
  validation: {
    severity: "ok",
    messages: ["Looks valid."],
  },
  sources: [],
  confidence: "medium",
  aiUsed: false,
  cached: false,
};

function renderPanel() {
  return render(
    <FieldGuidancePanel
      country="US"
      visaType="DS160"
      locale="zh"
      field={field}
      answer="PA1234567"
      allAnswers={{ passport_number: "PA1234567" }}
      onClose={vi.fn()}
    />,
  );
}

async function setupQuestionInput() {
  const input = await screen.findByPlaceholderText("比如：这个必须和护照完全一样吗？");
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  return input;
}

describe("FieldGuidancePanel shortcuts", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { question?: string };
        return {
          ok: true,
          json: async () => ({
            ...baseResponse,
            reply: body.question ? `Reply to ${body.question}` : undefined,
          }),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends the field question when Enter is pressed", async () => {
    renderPanel();
    const input = await setupQuestionInput();

    fireEvent.change(input, { target: { value: "这个号码要不要空格？" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
    expect(request.question).toBe("这个号码要不要空格？");
  });

  it("keeps Shift+Enter for multiline input", async () => {
    renderPanel();
    const input = await setupQuestionInput();

    fireEvent.change(input, { target: { value: "第一行" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not send while IME composition is active", async () => {
    renderPanel();
    const input = await setupQuestionInput();

    fireEvent.change(input, { target: { value: "中文输入中" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("sends the field question with Ctrl or Cmd plus Enter", async () => {
    renderPanel();
    const input = await setupQuestionInput();

    fireEvent.change(input, { target: { value: "Need this exact?" } });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const ctrlRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
    expect(ctrlRequest.question).toBe("Need this exact?");
  });
});
