import {
  type FieldGuidanceRequest,
  type FieldGuidanceResponse,
  type FieldGuidanceSource,
} from "@/types/field-guidance";

const AGENT_BACKEND_URL =
  process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:3002";
const FIELD_GUIDANCE_TIMEOUT_MS = 12000;

type FieldOption = { value?: string; text?: string } | string;

function getLocale(request: FieldGuidanceRequest): "zh" | "en" {
  return request.locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function normalizeOptions(options: FieldGuidanceRequest["field"]["options"]): Array<{ value: string; text: string }> {
  if (!Array.isArray(options)) return [];
  return (options as FieldOption[])
    .map((option) => {
      if (typeof option === "string") {
        return { value: option, text: option };
      }
      return {
        value: option.value?.trim() ?? "",
        text: option.text?.trim() || option.value?.trim() || "",
      };
    })
    .filter((option) => option.value || option.text);
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasCjk(content: string): boolean {
  return /[\u3400-\u9fff]/.test(content);
}

function isLikelyNonChineseSentence(content: string): boolean {
  const text = stripMarkdown(content).trim();
  if (!text || hasCjk(text)) return false;
  const latinLetters = text.match(/[A-Za-z]/g)?.length ?? 0;
  return latinLetters >= 12;
}

function localizedFieldLabel(request: FieldGuidanceRequest): string {
  const name = request.field.fieldName.toLowerCase();
  const label = request.field.label.trim();
  if (name.includes("surname") || name.includes("family_name")) return "姓氏";
  if (name.includes("given") || name.includes("first_name")) return "名字";
  if (name.includes("full_name")) return "姓名";
  if (name.includes("birth") && name.includes("date")) return "出生日期";
  if (name.includes("passport") && name.includes("number")) return "护照号码";
  if (name.includes("passport")) return "护照信息";
  if (name.includes("photo")) return "签证照片";
  if (name.includes("nationality")) return "国籍";
  if (name.includes("country")) return "国家/地区";
  if (name.includes("city")) return "城市";
  if (name.includes("date")) return "日期";
  return /[\u3400-\u9fff]/.test(label) ? label : "当前字段";
}

function keepChineseItems(items: string[], fallback: string[]): string[] {
  const kept = items.filter((item) => !isLikelyNonChineseSentence(item));
  return kept.length > 0 ? kept : fallback;
}

function localSource(reason: string): FieldGuidanceSource {
  return {
    title: "VIZA 本地字段提示",
    url: null,
    excerpt: reason,
  };
}

function makeFallbackGuidance(request: FieldGuidanceRequest, reason: string): FieldGuidanceResponse {
  const locale = getLocale(request);
  const field = request.field;
  const label = field.label || field.fieldName || (locale === "zh" ? "当前字段" : "this field");
  const fieldName = field.fieldName.toLowerCase();
  const fieldType = field.fieldType;
  const options = normalizeOptions(field.options);
  const selectedExamples = options.slice(0, 3).map((option) => option.text || option.value);
  const answer = request.answer?.trim() ?? "";
  const isMissingRequired = Boolean(field.required && !answer);

  const examples =
    selectedExamples.length > 0
      ? selectedExamples
      : fieldType === "date" || fieldName.includes("date")
        ? locale === "zh"
          ? ["按页面日期选择器填写，例如 09/03/1996。"]
          : ["Use the date picker, for example 09/03/1996."]
        : locale === "zh"
          ? ["请按护照、身份证明或官方文件上的原文填写。"]
          : ["Use the wording exactly as shown on your passport or official document."];

  const formatHints =
    fieldType === "select" || fieldType === "radio" || fieldType === "country"
      ? [
          locale === "zh"
            ? "请优先从官方下拉选项中选择，不要自由改写选项名称。"
            : "Choose from the official options instead of rewriting the option label.",
        ]
      : fieldType === "date" || fieldName.includes("date")
        ? [
            locale === "zh"
              ? "日期请核对日、月、年顺序，最终英文侧会按官方格式显示。"
              : "Check the day, month, and year order. The English side shows the official format.",
          ]
        : [
            locale === "zh"
              ? "如果证件上已有英文或罗马化拼写，请以证件为准。"
              : "If your document already has English or romanized spelling, use that version.",
          ];

  const warnings = [
    locale === "zh"
      ? "本地提示只用于辅助填写；最终请以官方表单和证件信息为准。"
      : "This local hint is only a filling aid. Final answers should match the official form and your documents.",
  ];

  return {
    guidance: {
      title: locale === "zh" ? `${label} 填写帮助` : `${label} guidance`,
      summary:
        locale === "zh"
          ? "AI 服务暂时不可用，已切换为本地规则提示。请先按当前字段、选项和证件信息填写。"
          : "AI guidance is temporarily unavailable, so VIZA is showing local rule-based guidance for this field.",
      examples,
      hints: [
        locale === "zh"
          ? "中文侧和英文侧会互相同步；如自动生成结果不符合证件，请直接修改另一侧。"
          : "The Chinese and English sides sync with each other. Edit the other side if the generated value does not match your document.",
      ],
      officialWarnings: warnings,
      formatHints,
    },
    validation: {
      severity: isMissingRequired ? "warning" : "ok",
      messages: isMissingRequired
        ? [locale === "zh" ? "这是必填项，请填写后再继续。" : "This required field still needs an answer."]
        : [locale === "zh" ? "当前字段格式可继续核对。" : "This field can be reviewed before continuing."],
    },
    reply: request.question
      ? locale === "zh"
        ? `关于“${label}”：请优先匹配你的护照或官方文件。若该字段是下拉题，选择最接近的官方选项；如果没有合适选项，再使用页面提供的自定义或其他选项。`
        : `For ${label}, match your passport or official document first. If this is a dropdown, choose the closest official option; use the custom or other option only when no option fits.`
      : undefined,
    sources: [localSource(reason)],
    confidence: "low",
    aiUsed: false,
    cached: false,
  };
}

function sanitizeChineseResponse(
  request: FieldGuidanceRequest,
  payload: FieldGuidanceResponse,
): FieldGuidanceResponse {
  if (getLocale(request) !== "zh") return payload;

  const fallback = makeFallbackGuidance(request, "language fallback");
  const fieldLabel = localizedFieldLabel(request);
  const fallbackSummary = `${fieldLabel}用于当前签证申请表。请按护照、官方证件、题目选项或支持材料上的信息填写，并与其他答案保持一致。`;

  return {
    ...payload,
    guidance: {
      ...payload.guidance,
      title: `${fieldLabel}填写帮助`,
      summary: isLikelyNonChineseSentence(payload.guidance.summary)
        ? fallbackSummary
        : payload.guidance.summary,
      hints: keepChineseItems(payload.guidance.hints, fallback.guidance.hints),
      officialWarnings: keepChineseItems(payload.guidance.officialWarnings, fallback.guidance.officialWarnings),
      formatHints: keepChineseItems(payload.guidance.formatHints, fallback.guidance.formatHints),
    },
    validation: {
      ...payload.validation,
      messages: keepChineseItems(payload.validation.messages, fallback.validation.messages),
    },
    reply: payload.reply && isLikelyNonChineseSentence(payload.reply)
      ? fallback.reply
      : payload.reply,
  };
}

async function forwardToBackend(requestBody: FieldGuidanceRequest): Promise<FieldGuidanceResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FIELD_GUIDANCE_TIMEOUT_MS);

  try {
    const response = await fetch(`${AGENT_BACKEND_URL}/api/field-guidance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Guidance service returned ${response.status}`);
    }

    const payload = (await response.json()) as FieldGuidanceResponse;
    if (payload.reply) payload.reply = stripMarkdown(payload.reply);
    return sanitizeChineseResponse(requestBody, payload);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  let requestBody: FieldGuidanceRequest;

  try {
    requestBody = (await request.json()) as FieldGuidanceRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (!requestBody.field?.fieldName) {
    return Response.json({ error: "field.fieldName is required." }, { status: 400 });
  }

  try {
    const guidance = await forwardToBackend(requestBody);
    return Response.json(guidance);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "AI guidance service unavailable.";
    return Response.json(makeFallbackGuidance(requestBody, reason));
  }
}
