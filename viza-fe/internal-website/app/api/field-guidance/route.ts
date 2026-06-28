import {
  type FieldGuidanceOptionExplanation,
  type FieldGuidanceRequest,
  type FieldGuidanceResponse,
  type FieldGuidanceSource,
} from "@/types/field-guidance";
import {
  isEnglishOnlyText,
  normalizeBilingualFormField,
  resolveLocalizedFieldLabel,
  resolveLocalizedOptions,
} from "@/lib/bilingual-schema-contract";

const AGENT_BACKEND_URL =
  process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:3002";
const FIELD_GUIDANCE_TIMEOUT_MS = 12000;
const DIRECT_OPENAI_TIMEOUT_MS = 16000;
const DIRECT_OPENAI_MODEL =
  process.env.OPENAI_FIELD_GUIDANCE_MODEL ??
  process.env.OPENAI_CHAT_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-4o-mini";

type FieldOption = {
  value?: string;
  text?: string;
  label_zh?: string;
  label_en?: string;
  official_label?: string;
} | string;
type OpenAiResponsePayload = {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      text?: unknown;
      type?: unknown;
    }>;
  }>;
};

function getLocale(request: FieldGuidanceRequest): "zh" | "en" {
  return request.locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function normalizeGuidanceRequest(request: FieldGuidanceRequest): FieldGuidanceRequest {
  const side = getLocale(request);
  const normalizedField = normalizeBilingualFormField(request.field);
  return {
    ...request,
    field: {
      ...normalizedField,
      label: resolveLocalizedFieldLabel(normalizedField, side),
      placeholder: resolveLocalizedPlaceholderForGuidance(normalizedField, side),
      options: resolveLocalizedOptions(normalizedField.options, side),
    },
  };
}

function resolveLocalizedPlaceholderForGuidance(
  field: FieldGuidanceRequest["field"],
  side: "zh" | "en",
): string | null {
  const rules = field.validationRules;
  const key = side === "zh" ? "placeholder_zh" : "placeholder_en";
  const value = rules?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : field.placeholder;
}

function normalizeOptions(
  options: FieldGuidanceRequest["field"]["options"],
  locale: "zh" | "en",
): Array<{ value: string; text: string }> {
  if (!Array.isArray(options)) return [];
  return (options as FieldOption[])
    .map((option) => {
      if (typeof option === "string") {
        return { value: option, text: option };
      }
      const localizedText = locale === "zh"
        ? option.label_zh?.trim() || option.text?.trim() || option.label_en?.trim() || option.official_label?.trim()
        : option.label_en?.trim() || option.official_label?.trim() || option.text?.trim() || option.label_zh?.trim();
      return {
        value: option.value?.trim() ?? "",
        text: localizedText || option.value?.trim() || "",
      };
    })
    .filter((option) => option.value || option.text);
}

function normalizedOptionText(option: { value: string; text: string }): string {
  return `${option.value} ${option.text}`.toLowerCase().replace(/[_-]+/g, " ");
}

function explainKnownOption(
  request: FieldGuidanceRequest,
  option: { value: string; text: string },
): string | null {
  const locale = getLocale(request);
  const fieldName = request.field.fieldName.toLowerCase();
  const fieldLabel = request.field.label.toLowerCase();
  const optionText = normalizedOptionText(option);
  const isPassportType =
    (fieldName.includes("passport") || fieldLabel.includes("passport") || fieldLabel.includes("护照")) &&
    (fieldName.includes("type") ||
      fieldName.includes("document") ||
      fieldLabel.includes("类型") ||
      fieldLabel.includes("种类"));

  if (isPassportType) {
    if (/\b(regular|ordinary|normal)\b|普通/.test(optionText)) {
      return locale === "zh"
        ? "大多数个人旅游、探亲、商务或学习出行使用的普通个人护照。"
        : "The standard personal passport used for most tourism, family visits, business, or study travel.";
    }
    if (/diplomatic|外交/.test(optionText)) {
      return locale === "zh"
        ? "通常由外交人员或代表政府执行外交公务的人员持有。"
        : "Usually held by diplomats or people traveling on diplomatic government duties.";
    }
    if (/official|service|公务|公務/.test(optionText)) {
      return locale === "zh"
        ? "通常用于政府人员或公职人员执行公务出行，不是普通个人护照。"
        : "Usually used by government or public officials traveling on official duty, not ordinary personal travel.";
    }
    if (/other|其他|其它/.test(optionText)) {
      return locale === "zh"
        ? "仅在你的旅行证件不属于普通、外交或公务护照时选择，并准备按官方要求补充说明。"
        : "Use only when your travel document is not regular, diplomatic, or official; be ready to explain it if required.";
    }
  }

  if (/^y(es)?$|是|有|true/.test(optionText)) {
    return locale === "zh"
      ? "表示你的情况符合这个问题描述；选择前请确认后续字段也能支持这个答案。"
      : "Means the statement applies to you; confirm later fields also support this answer.";
  }
  if (/^no?$|否|没有|false/.test(optionText)) {
    return locale === "zh"
      ? "表示你的情况不符合这个问题描述；如不确定，请先核对证件或官方材料。"
      : "Means the statement does not apply to you; check your documents or official materials if unsure.";
  }
  if (/\bfemale\b|女/.test(optionText)) {
    return locale === "zh"
      ? "选择证件或官方表单上显示为女性的情况。"
      : "Use when the document or official form shows female.";
  }
  if (/\bmale\b|男/.test(optionText)) {
    return locale === "zh"
      ? "选择证件或官方表单上显示为男性的情况。"
      : "Use when the document or official form shows male.";
  }

  return null;
}

function explainGenericOption(
  request: FieldGuidanceRequest,
  option: { value: string; text: string },
): string {
  const locale = getLocale(request);
  const label = option.text || option.value;
  if (request.field.fieldType === "multi_select" || request.field.fieldType === "checkbox") {
    return locale === "zh"
      ? `如果“${label}”符合你的实际情况或材料内容，就勾选；不符合则不要选择。`
      : `Select "${label}" only if it matches your situation or supporting documents.`;
  }
  return locale === "zh"
    ? `选择“${label}”表示该字段答案就是这一项；具体含义以当前题目和官方表单语境为准。`
    : `Choose "${label}" when this is the correct answer for the field; interpret it in the current official-form context.`;
}

function buildOptionExplanations(request: FieldGuidanceRequest): FieldGuidanceOptionExplanation[] {
  if (!["select", "radio", "multi_select", "checkbox"].includes(request.field.fieldType)) return [];
  const options = normalizeOptions(request.field.options, getLocale(request));
  if (options.length === 0) return [];

  return options.map((option) => ({
    value: option.value || option.text,
    label: option.text || option.value,
    description: explainKnownOption(request, option) ?? explainGenericOption(request, option),
  }));
}

function withOptionExplanations(
  request: FieldGuidanceRequest,
  response: FieldGuidanceResponse,
): FieldGuidanceResponse {
  const existing = response.guidance.optionExplanations?.filter(
    (item) => item.label.trim() && item.description.trim(),
  );
  if (existing && existing.length > 0) return response;

  const optionExplanations = buildOptionExplanations(request);
  if (optionExplanations.length === 0) return response;

  return {
    ...response,
    guidance: {
      ...response.guidance,
      optionExplanations,
    },
  };
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
  const normalized = normalizeBilingualFormField(request.field);
  const contractLabel = resolveLocalizedFieldLabel(normalized, "zh").trim();
  if (contractLabel && !isEnglishOnlyText(contractLabel)) return contractLabel;

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

function getDirectOpenAiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || key === "your_openai_api_key_here") return null;
  return key;
}

function makeFallbackGuidance(request: FieldGuidanceRequest, reason: string): FieldGuidanceResponse {
  const locale = getLocale(request);
  const field = request.field;
  const normalized = normalizeBilingualFormField(field);
  const label = resolveLocalizedFieldLabel(normalized, locale) || field.fieldName || (locale === "zh" ? "当前字段" : "this field");
  const fieldName = field.fieldName.toLowerCase();
  const fieldType = field.fieldType;
  const options = normalizeOptions(field.options, locale);
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
          ? "AI 暂时不可用，以下是本地填写规则。请先按当前字段、官方选项和证件信息填写。"
          : "AI guidance is temporarily unavailable, so VIZA is showing local rule-based guidance for this field.",
      examples,
      optionExplanations: buildOptionExplanations(request),
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

function parseJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function extractOpenAiOutputText(payload: OpenAiResponsePayload): string {
  if (typeof payload.output_text === "string") return payload.output_text;

  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((text): text is string => typeof text === "string")
    .join("\n")
    ?? "";
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? stripMarkdown(value).trim() : null;
}

function asStringArray(value: unknown, fallback: string[], limit: number): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, limit);
  return items.length > 0 ? items : fallback;
}

function parseOptionExplanations(
  value: unknown,
  fallback: FieldGuidanceOptionExplanation[],
): FieldGuidanceOptionExplanation[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const option = item as Record<string, unknown>;
      const label = asString(option.label);
      const description = asString(option.description);
      if (!label || !description) return null;
      return {
        value: asString(option.value) ?? label,
        label,
        description,
      };
    })
    .filter((item): item is FieldGuidanceOptionExplanation => Boolean(item));
  return items.length > 0 ? items : fallback;
}

function normalizeConfidence(value: unknown): FieldGuidanceResponse["confidence"] {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function isUnavailableText(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized.includes("ai 暂时不可用") || normalized.includes("ai unavailable");
}

function buildDirectOpenAiPrompt(request: FieldGuidanceRequest, base: FieldGuidanceResponse): string {
  const locale = getLocale(request);
  const options = normalizeOptions(request.field.options, locale)
    .slice(0, 20)
    .map((option) => `${option.value}: ${option.text}`)
    .join("\n");
  const currentValue = request.answer?.trim() || "(empty)";
  const question = request.question?.trim();
  const localRules = {
    examples: base.guidance.examples,
    optionExplanations: base.guidance.optionExplanations ?? [],
    hints: base.guidance.hints,
    officialWarnings: base.guidance.officialWarnings,
    formatHints: base.guidance.formatHints,
  };

  return [
    `Locale: ${locale}`,
    `Country: ${request.country ?? "unknown"}`,
    `Visa type: ${request.visaType ?? "unknown"}`,
    `Field: ${request.field.label} (${request.field.fieldName})`,
    `Field type: ${request.field.fieldType}`,
    `Required: ${request.field.required ? "yes" : "no"}`,
    `Current value: ${currentValue}`,
    options ? `Official options:\n${options}` : "Official options: none",
    `Local rules to consider:\n${JSON.stringify(localRules)}`,
    question ? `User follow-up question: ${question}` : "No follow-up question yet.",
  ].join("\n\n");
}

async function generateDirectOpenAiGuidance(request: FieldGuidanceRequest): Promise<FieldGuidanceResponse | null> {
  const apiKey = getDirectOpenAiKey();
  if (!apiKey) return null;

  const locale = getLocale(request);
  const base = makeFallbackGuidance(request, "direct OpenAI baseline");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DIRECT_OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DIRECT_OPENAI_MODEL,
        max_output_tokens: 900,
        instructions:
          locale === "zh"
            ? "你是 VIZA 表单字段 Copilot。只根据当前字段元数据、当前选项和用户当前答案提供填写帮助。必须使用简体中文；官方选项、代码、姓名、日期可以保留英文原文。不要编造官方要求；不确定时说明请以官方表单和证件为准。不要说 AI 不可用，因为你正在生成 AI 帮助。返回严格 JSON，不要 Markdown。"
            : "You are the VIZA form field copilot. Use only the current field metadata, official options, and current answer. Do not invent official requirements; when unsure, say to follow the official form and documents. Do not say AI is unavailable because you are generating AI guidance now. Return strict JSON, no Markdown.",
        input: buildDirectOpenAiPrompt(request, base),
        text: {
          format: {
            type: "json_schema",
            name: "field_guidance",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                examples: { type: "array", items: { type: "string" } },
                optionExplanations: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      value: { type: "string" },
                      label: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["value", "label", "description"],
                  },
                },
                hints: { type: "array", items: { type: "string" } },
                officialWarnings: { type: "array", items: { type: "string" } },
                formatHints: { type: "array", items: { type: "string" } },
                reply: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: [
                "summary",
                "examples",
                "optionExplanations",
                "hints",
                "officialWarnings",
                "formatHints",
                "reply",
                "confidence",
              ],
            },
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return null;
    const payload = (await response.json()) as OpenAiResponsePayload;
    const outputText = extractOpenAiOutputText(payload);
    const parsed = parseJsonObject(outputText);
    if (!parsed) return null;
    const summary = asString(parsed.summary);
    const reply = asString(parsed.reply);

    const guidance: FieldGuidanceResponse = {
      guidance: {
        title: base.guidance.title,
        summary: !isUnavailableText(summary)
          ? summary ?? (locale === "zh"
            ? "请根据当前字段、官方选项和证件信息核对填写。"
            : "Check this field against the current options and your official documents.")
          : locale === "zh"
            ? "请根据当前字段、官方选项和证件信息核对填写。"
            : "Check this field against the current options and your official documents.",
        examples: asStringArray(parsed.examples, base.guidance.examples, 4),
        optionExplanations: parseOptionExplanations(
          parsed.optionExplanations,
          base.guidance.optionExplanations ?? [],
        ),
        hints: asStringArray(parsed.hints, base.guidance.hints, 5),
        officialWarnings: asStringArray(parsed.officialWarnings, base.guidance.officialWarnings, 4),
        formatHints: asStringArray(parsed.formatHints, base.guidance.formatHints, 4),
      },
      validation: base.validation,
      reply: request.question && !isUnavailableText(reply) ? (reply ?? base.reply) : undefined,
      sources: [],
      confidence: normalizeConfidence(parsed.confidence),
      aiUsed: true,
      cached: false,
    };

    return sanitizeChineseResponse(request, withOptionExplanations(request, guidance));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
      optionExplanations: withOptionExplanations(request, payload).guidance.optionExplanations?.map((item) => ({
        ...item,
        description: isLikelyNonChineseSentence(item.description)
          ? buildOptionExplanations(request).find((fallbackItem) => fallbackItem.value === item.value)?.description ??
            item.description
          : item.description,
      })),
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
    return sanitizeChineseResponse(requestBody, withOptionExplanations(requestBody, payload));
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

  requestBody = normalizeGuidanceRequest(requestBody);

  try {
    const guidance = await forwardToBackend(requestBody);
    if (guidance.aiUsed) {
      return Response.json(withOptionExplanations(requestBody, guidance));
    }

    const directGuidance = await generateDirectOpenAiGuidance(requestBody);
    if (directGuidance) {
      return Response.json(directGuidance);
    }

    return Response.json(withOptionExplanations(requestBody, guidance));
  } catch (error) {
    const directGuidance = await generateDirectOpenAiGuidance(requestBody);
    if (directGuidance) {
      return Response.json(directGuidance);
    }

    const reason = error instanceof Error ? error.message : "AI guidance service unavailable.";
    return Response.json(withOptionExplanations(requestBody, makeFallbackGuidance(requestBody, reason)));
  }
}
