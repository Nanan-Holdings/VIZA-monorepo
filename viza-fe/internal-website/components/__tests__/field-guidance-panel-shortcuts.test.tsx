import { useState } from "react";
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

const dropdownField: VisaFormFieldRow = {
  ...field,
  id: "field-passport-country",
  fieldName: "passport_country",
  label: "护照所属国家/地区",
  fieldType: "country",
  placeholder: "Select a country",
  options: [
    { value: "CN", text: "中国" },
    { value: "SG", text: "新加坡" },
  ],
};

const baseResponse: FieldGuidanceResponse = {
  guidance: {
    title: "Passport number",
    summary: "Enter the passport number exactly as shown on the passport.",
    examples: ["PA1234567"],
    optionExplanations: [],
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
  return screen.findByPlaceholderText("比如：这个必须和护照完全一样吗？");
}

function PersistedPanelHarness() {
  const [open, setOpen] = useState(true);
  const [conversation, setConversation] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开帮助</button>
      {open && (
        <FieldGuidancePanel
          country="US"
          visaType="DS160"
          locale="zh"
          field={field}
          answer="PA1234567"
          allAnswers={{ passport_number: "PA1234567" }}
          initialConversation={conversation}
          onConversationChange={setConversation}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
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

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText("AI 正在读取题目要求...")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "这个号码要不要空格？" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(request.question).toBe("这个号码要不要空格？");
  });

  it("shows the requirement-reading state only after the user asks", async () => {
    let resolveRequest: ((value: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }));
    renderPanel();
    const input = await setupQuestionInput();

    expect(screen.queryByText("AI 正在读取题目要求...")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "请解释这个字段" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("AI 正在读取题目要求...")).toBeInTheDocument();
    resolveRequest?.(new Response(JSON.stringify({
      ...baseResponse,
      reply: "这是字段解释。",
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    expect(await screen.findByText("这是字段解释。")).toBeInTheDocument();
    expect(screen.queryByText("AI 正在读取题目要求...")).not.toBeInTheDocument();
  });

  it("keeps Shift+Enter for multiline input", async () => {
    renderPanel();
    const input = await setupQuestionInput();

    fireEvent.change(input, { target: { value: "第一行" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not send while IME composition is active", async () => {
    renderPanel();
    const input = await setupQuestionInput();

    fireEvent.change(input, { target: { value: "中文输入中" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });

    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the field question with Ctrl or Cmd plus Enter", async () => {
    renderPanel();
    const input = await setupQuestionInput();

    fireEvent.change(input, { target: { value: "Need this exact?" } });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const ctrlRequest = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(ctrlRequest.question).toBe("Need this exact?");
  });

  it("shows deterministic source guidance immediately without inventing a passport number", async () => {
    renderPanel();

    expect(await screen.findByText(/护照或旅行证件上的唯一号码/)).toBeInTheDocument();
    expect(screen.queryByText("示例")).not.toBeInTheDocument();
    expect(screen.queryByText("E12345678")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the shared explanation policy in the initial field card", () => {
    const addressField: VisaFormFieldRow = {
      ...field,
      id: "field-accommodation-address-line-1",
      visaType: "EU_SCHENGEN_C_SHORT_STAY",
      fieldName: "accommodation_address_line_1",
      label: "住宿地址——第1行",
      placeholder: "Street and number",
    };

    render(
      <FieldGuidancePanel
        country="france"
        visaType="EU_SCHENGEN_C_SHORT_STAY"
        locale="zh"
        field={addressField}
        answer=""
        allAnswers={{}}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/门牌号、街道名/)).toBeInTheDocument();
    expect(screen.getByText(/酒店预订单/)).toBeInTheDocument();
    expect(screen.queryByText("15 Rue de Rivoli, Appartement 3B")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not show examples for dropdown fields", () => {
    render(
      <FieldGuidancePanel
        country="US"
        visaType="DS160"
        locale="zh"
        field={dropdownField}
        answer="CN"
        allAnswers={{ passport_country: "CN" }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText("示例")).not.toBeInTheDocument();
    expect(screen.queryByText("中国")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("treats the Vietnam information acknowledgement as a checkbox, not a passport text field", () => {
    const acknowledgementField: VisaFormFieldRow = {
      ...field,
      id: "field-vn-visa-information-acknowledgement",
      visaType: "VN_PREARRIVAL_DECLARATION",
      fieldName: "visa_information_acknowledgement",
      label: "我已阅读并理解此信息",
      fieldType: "checkbox",
      placeholder: null,
      options: null,
      validationRules: {
        helper_zh: "请提供越南签证信息（如适用）。所选签证类型决定允许入境的期限；请填写签证编号，以便在机场使用该服务。",
      },
    };

    render(
      <FieldGuidancePanel
        country="vietnam"
        visaType="VN_PREARRIVAL_DECLARATION"
        locale="zh"
        field={acknowledgementField}
        answer=""
        allAnswers={{}}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/请先读完相关说明，仅在确实理解后勾选/)).toBeInTheDocument();
    expect(screen.getByText(/请提供越南签证信息（如适用）/)).toBeInTheDocument();
    expect(screen.queryByText("示例")).not.toBeInTheDocument();
    expect(screen.queryByText(/请按护照、身份证明或官方文件上的原文填写/)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not render source material in the compact guidance card", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...baseResponse,
        sources: [
          {
            title: "Indonesia Application Form and Document Intake Requirements",
            url: "https://evisa.imigrasi.go.id/web/home",
            excerpt:
              "# Indonesia fields to collect before filling the form Country: indonesia Visa type: tourist_b211a Document type: form_requirements Source: Indonesia Application Form and Document Intake Requirements Source URL: https://evisa.imigrasi.go.id/web/home",
          },
        ],
      }),
    } as Response);

    renderPanel();

    await screen.findByText("Passport number");
    expect(screen.queryByText("印度尼西亚申请表与材料要求")).not.toBeInTheDocument();
    expect(screen.queryByText(/Source URL/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Document type/i)).not.toBeInTheDocument();
  });

  it("renders option explanations for select fields", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...baseResponse,
        guidance: {
          ...baseResponse.guidance,
          title: "护照类型填写帮助",
          optionExplanations: [
            {
              value: "ordinary",
              label: "普通护照",
              description: "大多数个人旅游、探亲、商务出行使用的普通个人护照。",
            },
            {
              value: "diplomatic",
              label: "外交护照",
              description: "通常由外交人员或执行外交公务的人员持有。",
            },
          ],
        },
      }),
    } as Response);

    renderPanel();
    const input = await setupQuestionInput();
    fireEvent.change(input, { target: { value: "普通护照是什么意思？" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("选项说明")).toBeInTheDocument();
    expect(screen.getByText("普通护照")).toBeInTheDocument();
    expect(screen.getByText("大多数个人旅游、探亲、商务出行使用的普通个人护照。")).toBeInTheDocument();
    expect(screen.getByText("外交护照")).toBeInTheDocument();
  });

  it("shows at most two option explanations", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ...baseResponse,
        guidance: {
          ...baseResponse.guidance,
          optionExplanations: ["一", "二", "三", "四"].map((label) => ({
            value: label,
            label,
            description: `${label}的说明`,
          })),
        },
      }),
    } as Response);

    renderPanel();
    const input = await setupQuestionInput();
    fireEvent.change(input, { target: { value: "这些选项有什么区别？" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("一")).toBeInTheDocument();
    expect(screen.getByText("二")).toBeInTheDocument();
    expect(screen.queryByText("三")).not.toBeInTheDocument();
    expect(screen.queryByText("四")).not.toBeInTheDocument();
  });

  it("sends prior user and assistant turns with follow-up questions", async () => {
    renderPanel();
    const input = await setupQuestionInput();

    fireEvent.change(input, { target: { value: "第一问" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("Reply to 第一问");

    fireEvent.change(input, { target: { value: "继续问" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
    expect(request.history).toEqual([
      { role: "user", content: "第一问" },
      { role: "assistant", content: "Reply to 第一问" },
    ]);
  });

  it("restores the conversation after the panel closes and reopens", async () => {
    render(<PersistedPanelHarness />);
    const input = await setupQuestionInput();

    fireEvent.change(input, { target: { value: "请记住这一问" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("Reply to 请记住这一问");

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByText("请记住这一问")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开帮助" }));

    expect(screen.getByText("请记住这一问")).toBeInTheDocument();
    expect(screen.getByText("Reply to 请记住这一问")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
