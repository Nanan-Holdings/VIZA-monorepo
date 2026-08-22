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
import {
  buildFieldClarificationFallback,
  buildFieldExplanation,
  fieldClarificationInstruction,
  getFieldDateFormat,
  isFieldChoiceControl,
  isFieldClarificationRequest,
  isFieldMetadataUnverified,
  isUsefulFieldClarificationReply,
} from "@/lib/form-assistant/constants";

const AGENT_BACKEND_URL =
  process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_BACKEND_URL ?? "http://localhost:3002";
const FIELD_GUIDANCE_TIMEOUT_MS = 12000;
const DIRECT_OPENAI_TIMEOUT_MS = 16000;
const MAX_OPTION_EXPLANATIONS = 2;
// Any OpenAI-compatible provider (DeepSeek, a gateway, a local proxy) can serve
// this path; leave OPENAI_BASE_URL unset for api.openai.com.
const DIRECT_OPENAI_BASE_URL = (
  process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"
).replace(/\/+$/, "");
const DIRECT_OPENAI_MODEL =
  process.env.OPENAI_FIELD_GUIDANCE_MODEL ??
  process.env.OPENAI_CHAT_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-5.5";
const MAX_GUIDANCE_OPTION_CONTEXT = 120;
const DEFAULT_GUIDANCE_OPTION_CONTEXT = 30;
const MAX_GUIDANCE_OPTION_CONTEXT_BYTES = 320_000;
const OPTION_MATCH_STOP_WORDS = new Set([
  "and", "the", "city", "country", "district", "province", "state", "ward", "commune",
  "airport", "port", "select", "option", "with", "from", "地区", "国家", "城市", "省", "区",
  "坊", "社", "机场", "港口", "选择", "选项",
]);

const STANDARD_IDENTITY_FIELD_CONTEXT = [
  "Standard identity-field RAG for visa form copilot:",
  "Passport number, name, date of birth, sex, nationality, passport issue date, passport expiry date, issuing country, issuing authority, place of issue, and passport type are standard-answer fields.",
  "For these fields, the answer must come from the passport biodata page, MRZ, official document, or the official dropdown options. Do not infer a value from the application country, pickup city, residence city, travel plan, or translation memory.",
  "Treat issuing country, place of issue, and issuing authority as distinct fields and never substitute one for another.",
  "For place of issue / 签发地点, copy the location printed for that field on the passport or use the official form's required location option. Enter a country only when the field explicitly asks for Country of issue / Issuing country or provides a country-only selector.",
  "For passport issuing authority / issuing authority / 签发机关, copy the exact Authority or Issuing authority text printed on the passport. National Immigration Administration, PRC / 中华人民共和国国家移民管理局 and MPS Exit & Entry Administration / 公安部出入境管理局 are issuing-authority examples only and must never be suggested as place-of-issue answers.",
  "For passport type / document type, ordinary personal tourist passports are usually Ordinary / Regular / Normal passport. Diplomatic, official, service, special, travel document, refugee, or other should be selected only when the passport or travel document explicitly says so.",
].join("\n");

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

function normalizeOptionSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function optionSearchText(option: FieldOption): string {
  if (typeof option === "string") return normalizeOptionSearchText(option);
  return normalizeOptionSearchText([
    option.value,
    option.text,
    option.label_zh,
    option.label_en,
    option.official_label,
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(" "));
}

function compactGuidanceRules(
  rules: FieldGuidanceRequest["field"]["validationRules"],
): Record<string, unknown> | null {
  if (!rules) return null;
  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rules)) {
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      compact[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.length <= 40 && value.every((item) =>
      ["string", "number", "boolean"].includes(typeof item) || item === null)) {
      compact[key] = value;
    }
  }
  return compact;
}

function compactGuidanceOptionContext(request: FieldGuidanceRequest): FieldGuidanceRequest {
  const options = request.field.options;
  const compactRules = compactGuidanceRules(request.field.validationRules);
  if (!Array.isArray(options) || options.length <= MAX_GUIDANCE_OPTION_CONTEXT) {
    return {
      ...request,
      field: {
        ...request.field,
        validationRules: compactRules,
      },
    };
  }

  const evidence = normalizeOptionSearchText([
    request.question ?? "",
    request.answer ?? "",
    ...Object.values(request.allAnswers ?? {}),
  ].join(" "));
  const evidenceTokens = new Set(
    evidence.split(" ").filter((token) => token.length >= 3 && !OPTION_MATCH_STOP_WORDS.has(token)),
  );
  const ranked = (options as FieldOption[])
    .map((option, index) => {
      const searchText = optionSearchText(option);
      const tokens = [...new Set(
        searchText.split(" ").filter((token) => token.length >= 3 && !OPTION_MATCH_STOP_WORDS.has(token)),
      )];
      const overlap = tokens.filter((token) => evidenceTokens.has(token)).length;
      const exactPhrase = searchText.length >= 4 && evidence.includes(searchText);
      return { index, score: (exactPhrase ? 1000 : 0) + overlap };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selectedIndices: number[] = [];
  const selected = new Set<number>();
  const addIndex = (index: number) => {
    if (selected.size >= MAX_GUIDANCE_OPTION_CONTEXT || selected.has(index)) return;
    selected.add(index);
    selectedIndices.push(index);
  };
  ranked.forEach(({ index }) => addIndex(index));
  for (let index = 0; index < Math.min(DEFAULT_GUIDANCE_OPTION_CONTEXT, options.length); index += 1) {
    addIndex(index);
  }
  const boundedIndices: number[] = [];
  let optionBytes = 2;
  for (const index of selectedIndices) {
    const option = options[index];
    if (option === undefined) continue;
    const nextBytes = JSON.stringify(option).length + 1;
    if (boundedIndices.length > 0 && optionBytes + nextBytes > MAX_GUIDANCE_OPTION_CONTEXT_BYTES) break;
    boundedIndices.push(index);
    optionBytes += nextBytes;
  }

  return {
    ...request,
    field: {
      ...request.field,
      options: boundedIndices.map((index) => options[index]!).filter(Boolean),
      validationRules: {
        ...(compactRules ?? {}),
        guidance_option_count: options.length,
        guidance_option_context_truncated: true,
      },
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

function fieldSearchText(request: FieldGuidanceRequest): string {
  const field = request.field;
  return `${field.fieldName} ${field.label} ${field.stepName ?? ""}`.toLowerCase();
}

function isStandardIdentityField(request: FieldGuidanceRequest): boolean {
  const searchText = fieldSearchText(request);
  return [
    "passport",
    "travel document",
    "document type",
    "document number",
    "issuing authority",
    "place of issue",
    "authority",
    "nationality",
    "sex",
    "gender",
    "date of birth",
    "birth date",
    "surname",
    "given name",
    "family name",
    "签发",
    "签发机关",
    "签发地点",
    "护照",
    "旅行证件",
    "国籍",
    "性别",
    "出生日期",
  ].some((needle) => searchText.includes(needle));
}

function isPassportIssuingAuthorityField(request: FieldGuidanceRequest): boolean {
  const searchText = fieldSearchText(request);
  return [
    "passport_issuing_authority",
    "issuing authority",
    "authority",
    "签发机关",
  ].some((needle) => searchText.includes(needle));
}

function isPassportPlaceOfIssueField(request: FieldGuidanceRequest): boolean {
  const searchText = fieldSearchText(request);
  return ["passport_place_of_issue", "place of issue", "签发地点"].some((needle) => searchText.includes(needle)) &&
    !["passport_issuing_authority", "issuing authority", "签发机关", "authority"].some((needle) => searchText.includes(needle));
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
  if (!request.question?.trim()) return [];
  if (!["select", "radio", "multi_select", "checkbox"].includes(request.field.fieldType)) return [];
  const options = normalizeOptions(request.field.options, getLocale(request));
  if (options.length === 0) return [];

  return options.slice(0, MAX_OPTION_EXPLANATIONS).map((option) => ({
    value: option.value || option.text,
    label: option.text || option.value,
    description: explainKnownOption(request, option) ?? explainGenericOption(request, option),
  }));
}

function withoutChoiceControlExamples(
  request: FieldGuidanceRequest,
  response: FieldGuidanceResponse,
): FieldGuidanceResponse {
  if (!isFieldChoiceControl(request.field)) {
    return response;
  }

  return {
    ...response,
    guidance: {
      ...response.guidance,
      examples: [],
    },
  };
}

function finalizeGuidance(
  request: FieldGuidanceRequest,
  response: FieldGuidanceResponse,
): FieldGuidanceResponse {
  const localized = getLocale(request);
  const safeExample = buildFieldExplanation(request.field, localized).example;
  const withSafeExamples = {
    ...response,
    guidance: {
      ...response.guidance,
      // Examples are deterministic field-format aids. Do not allow an LLM or
      // downstream service to introduce a country, phone prefix, address, or
      // date format that is not supported by the current field metadata.
      examples: isFieldChoiceControl(request.field) || !safeExample ? [] : [safeExample],
    },
  };
  return withoutChoiceControlExamples(request, withOptionExplanations(request, withSafeExamples));
}

function withOptionExplanations(
  request: FieldGuidanceRequest,
  response: FieldGuidanceResponse,
): FieldGuidanceResponse {
  const existing = response.guidance.optionExplanations?.filter(
    (item) => item.label.trim() && item.description.trim(),
  ).slice(0, MAX_OPTION_EXPLANATIONS);
  if (existing && existing.length > 0) {
    return {
      ...response,
      guidance: {
        ...response.guidance,
        optionExplanations: existing,
      },
    };
  }

  // An AI response with no option explanations means the model did not have
  // enough evidence to recommend specific choices. Do not replace that with
  // arbitrary template descriptions from the start of a long dropdown.
  if (response.aiUsed) return response;

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
  const answer = request.answer?.trim() ?? "";
  const isMissingRequired = Boolean(field.required && !answer);
  const isChoice = isFieldChoiceControl(field);
  const explanation = buildFieldExplanation(field, locale);
  const dateFormat = getFieldDateFormat(field);
  const metadataNeedsReview = isFieldMetadataUnverified(field);

  const examples = isChoice || !explanation.example ? [] : [explanation.example];

  const formatHints =
    fieldType === "checkbox"
      ? [
          locale === "zh"
            ? "题目陈述符合实际时勾选；不符合时保持未勾选。"
            : "Select when the statement applies; otherwise leave it clear.",
        ]
      : fieldType === "multi_select"
        ? [
            locale === "zh"
              ? "请选择所有符合实际情况的选项。"
              : "Choose every option that applies.",
          ]
      : isChoice
      ? [
          locale === "zh"
            ? "请从页面提供的官方选项中选择，不要自由改写选项名称。"
            : "Choose from the official options instead of rewriting the option label.",
        ]
      : dateFormat || fieldType === "date" || fieldName.includes("date")
        ? [
            locale === "zh"
              ? dateFormat
                ? `请使用页面要求的日期格式：${dateFormat}。`
                : "请使用页面日期选择器；未明确格式时不要自行猜测日、月、年顺序。"
              : dateFormat
                ? `Use the date format required by the form: ${dateFormat}.`
                : "Use the page date picker; do not guess the day, month, and year order when no format is specified.",
          ]
        : [];

  const warnings = [
    metadataNeedsReview
      ? locale === "zh"
        ? "该字段元数据尚未标记为已核验官方内容，请以当前官方页面和证明材料为准，不要依赖示例推断。"
        : "This field metadata is not marked as officially verified; follow the current official page and supporting records instead of inferring from examples."
      : locale === "zh"
      ? "本地提示只用于辅助填写；最终请以官方表单和证件信息为准。"
      : "This local hint is only a filling aid. Final answers should match the official form and your documents.",
  ];

  return {
    guidance: {
      title: locale === "zh" ? `${label} 填写帮助` : `${label} guidance`,
      summary: explanation.summary,
      examples,
      optionExplanations: buildOptionExplanations(request),
      hints: [
        ...(isStandardIdentityField(request)
          ? [
              locale === "zh"
                ? "这是标准证件字段，请优先照抄护照资料页、机读区或官方下拉选项。"
                : "This is a standard identity-document field; copy the passport biodata page, MRZ, or official dropdown option where possible.",
            ]
          : []),
        explanation.sourceHint,
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
      ? isFieldClarificationRequest(request.question)
        ? buildFieldClarificationFallback(field, locale)
      : isPassportPlaceOfIssueField(request)
        ? locale === "zh"
          ? "请按护照资料页的 Place of issue/签发地点原文填写。这是地点字段，不要填写国家移民管理局或公安部出入境管理局；只有字段明确要求签发国家或提供国家下拉框时才填国家。"
          : "Copy the passport's exact Place of issue value. This is a location field, so do not enter National Immigration Administration or MPS Exit & Entry Administration; enter a country only when the form explicitly asks for Country of issue or provides a country-only selector."
      : isPassportIssuingAuthorityField(request)
        ? locale === "zh"
          ? "这个字段不要按办理城市推断。请看护照资料页上的“签发机关/Authority”原文：如果写的是“中华人民共和国国家移民管理局”或 “National Immigration Administration, PRC”，就照这个填写；如果旧护照写的是“公安部出入境管理局”或 “MPS Exit & Entry Administration”，也照护照原文填写。只有单独问“签发地点/Place of issue”且护照上对应位置写重庆时，才填重庆或 CHONGQING。"
          : "Do not infer this from the city where the passport was collected. Copy the printed Authority or Issuing authority from the passport biodata page. Use Chongqing only for a separate place-of-issue field if the passport itself shows that place."
      : locale === "zh"
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
  if (!Array.isArray(value)) return fallback.slice(0, MAX_OPTION_EXPLANATIONS);
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
    .filter((item): item is FieldGuidanceOptionExplanation => Boolean(item))
    .slice(0, MAX_OPTION_EXPLANATIONS);
  return items;
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
  const relatedAnswers = Object.entries(request.allAnswers ?? {})
    .filter(([, value]) => typeof value === "string" && value.trim())
    .slice(0, 12)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const conversationHistory = (request.history ?? [])
    .slice(-8)
    .map((message) => `${message.role}: ${message.content.slice(0, 800)}`)
    .join("\n");

  return [
    `Locale: ${locale}`,
    `Country: ${request.country ?? "unknown"}`,
    `Visa type: ${request.visaType ?? "unknown"}`,
    `Field: ${request.field.label} (${request.field.fieldName})`,
    `Field type: ${request.field.fieldType}`,
    `Required: ${request.field.required ? "yes" : "no"}`,
    `Current value: ${currentValue}`,
    relatedAnswers ? `Related filled answers:\n${relatedAnswers}` : "Related filled answers: none",
    conversationHistory ? `Conversation history:\n${conversationHistory}` : "Conversation history: none",
    options ? `Official options:\n${options}` : "Official options: none",
    `Local rules to consider:\n${JSON.stringify(localRules)}`,
    isStandardIdentityField(request)
      ? `Standard identity-field RAG:\n${STANDARD_IDENTITY_FIELD_CONTEXT}`
      : "Standard identity-field RAG: not applicable",
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
    const response = await fetch(`${DIRECT_OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DIRECT_OPENAI_MODEL,
        max_output_tokens: 500,
        instructions:
          locale === "zh"
            ? `你是 VIZA 表单字段 Copilot。只根据当前字段元数据、当前选项、用户当前答案、相关已填答案和 Standard identity-field RAG 提供填写帮助。必须使用简体中文；官方选项、代码、姓名、日期可以保留英文原文。不要编造官方要求；不确定时说明请以官方表单和证件为准。标准证件字段必须以护照资料页、机读区或官方证件原文为准。签发国家、签发地点和签发机关是不同字段；绝不能把签发机关名称作为签发地点示例。${fieldClarificationInstruction(locale)}输出是紧凑卡片：summary 只写一句可执行的话（不超过 60 个汉字）；examples 最多 2 个简短值；formatHints、hints、officialWarnings 各最多 1 条且每条不超过 30 个汉字；optionExplanations 最多 2 条、每条说明不超过 30 个汉字。没有必要内容时返回空数组。不要重复字段名称、来源、置信度或免责声明。不要说 AI 不可用，因为你正在生成 AI 帮助。返回严格 JSON，不要 Markdown。`
            : `You are the VIZA form field copilot. Use only the current field metadata, official options, current answer, related filled answers, and Standard identity-field RAG. Do not invent official requirements; when unsure, say to follow the official form and documents. Standard identity fields must come from the passport biodata page, MRZ, or official document. Treat issuing country, place of issue, and issuing authority as distinct fields; never suggest authority names as place-of-issue answers. ${fieldClarificationInstruction(locale)} Produce a compact card: summary is one actionable sentence (max 140 characters); examples has at most 2 short values; formatHints, hints, and officialWarnings have at most 1 item each, no more than 80 characters each; optionExplanations has at most 2 directly relevant items, with descriptions no more than 80 characters. Use empty arrays when a section adds no value. Do not repeat the field name, sources, confidence, or generic disclaimers. Do not say AI is unavailable because you are generating AI guidance now. Return strict JSON, no Markdown.`,
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
                  maxItems: MAX_OPTION_EXPLANATIONS,
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

    if (!response.ok) {
      // Silent failures here surface to the user as "AI guidance is temporarily
      // unavailable", which is indistinguishable from a bad key or a bad model id.
      const detail = (await response.text().catch(() => "")).slice(0, 200);
      console.warn(
        `[field-guidance] direct OpenAI call failed: ${response.status} (model ${DIRECT_OPENAI_MODEL}) ${detail}`,
      );
      return null;
    }
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
        examples: asStringArray(parsed.examples, base.guidance.examples, 2),
        optionExplanations: parseOptionExplanations(
          parsed.optionExplanations,
          base.guidance.optionExplanations ?? [],
        ),
        hints: asStringArray(parsed.hints, base.guidance.hints, 1),
        officialWarnings: asStringArray(parsed.officialWarnings, base.guidance.officialWarnings, 1),
        formatHints: asStringArray(parsed.formatHints, base.guidance.formatHints, 1),
      },
      validation: base.validation,
      reply: request.question && !isUnavailableText(reply) ? (reply ?? base.reply) : undefined,
      sources: [],
      confidence: normalizeConfidence(parsed.confidence),
      aiUsed: true,
      cached: false,
    };

    return sanitizeChineseResponse(request, finalizeGuidance(request, guidance));
  } catch (error) {
    console.warn(
      `[field-guidance] direct OpenAI call errored: ${error instanceof Error ? error.message : String(error)}`,
    );
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
    return sanitizeChineseResponse(requestBody, finalizeGuidance(requestBody, payload));
  } finally {
    clearTimeout(timeout);
  }
}

function enforceSharedClarificationPolicy(
  request: FieldGuidanceRequest,
  response: FieldGuidanceResponse,
): FieldGuidanceResponse {
  const question = request.question?.trim();
  if (!question || !isFieldClarificationRequest(question)) return response;
  if (isUsefulFieldClarificationReply(response.reply, question, request.field)) return response;
  return {
    ...response,
    reply: buildFieldClarificationFallback(request.field, getLocale(request)),
  };
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

  requestBody = compactGuidanceOptionContext(normalizeGuidanceRequest(requestBody));

  if (!requestBody.question?.trim()) {
    return Response.json(finalizeGuidance(
      requestBody,
      makeFallbackGuidance(requestBody, "local field guidance"),
    ));
  }

  try {
    const guidance = await forwardToBackend(requestBody);
    const clarificationQuestion = isFieldClarificationRequest(requestBody.question ?? "");
    const usefulBackendReply = !clarificationQuestion || isUsefulFieldClarificationReply(
      guidance.reply,
      requestBody.question ?? "",
      requestBody.field,
    );
    if (guidance.aiUsed && usefulBackendReply) {
      return Response.json(finalizeGuidance(requestBody, guidance));
    }

    const directGuidance = await generateDirectOpenAiGuidance(requestBody);
    if (directGuidance) {
      return Response.json(enforceSharedClarificationPolicy(requestBody, directGuidance));
    }

    return Response.json(enforceSharedClarificationPolicy(
      requestBody,
      finalizeGuidance(requestBody, guidance),
    ));
  } catch (error) {
    const directGuidance = await generateDirectOpenAiGuidance(requestBody);
    if (directGuidance) {
      return Response.json(enforceSharedClarificationPolicy(requestBody, directGuidance));
    }

    const reason = error instanceof Error ? error.message : "AI guidance service unavailable.";
    return Response.json(enforceSharedClarificationPolicy(
      requestBody,
      finalizeGuidance(requestBody, makeFallbackGuidance(requestBody, reason)),
    ));
  }
}
