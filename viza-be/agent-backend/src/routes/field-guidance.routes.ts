/**
 * Field-level AI guidance for dynamic visa forms.
 *
 * POST /api/field-guidance
 */

import { Router, Request, Response } from "express";
import OpenAI from "openai";
import {
  retrieveVisaKnowledge,
  type VisaKnowledgeChunk,
} from "../services/visa-knowledge.service.js";
import { Logger } from "../utils/logger.js";

const router = Router();
const logger = new Logger({ serviceName: "FieldGuidance" });

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_FIELD_GUIDANCE_MODEL =
  process.env.OPENAI_FIELD_GUIDANCE_MODEL ||
  process.env.OPENAI_CHAT_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-5.5";
const DISABLE_RETRIEVAL = process.env.FIELD_GUIDANCE_EVAL_DISABLE_RETRIEVAL === "1";
const GUIDANCE_CACHE = new Map<string, CachedGuidance>();
const MAX_HISTORY_MESSAGES = 8;
const OPTION_CONTEXT_VALUE_LIMIT = 12;

const STANDARD_IDENTITY_FIELD_SOURCE: SourceBody = {
  title: "Standard passport identity-field guidance",
  url: "https://www.nia.gov.cn/n741440/n741547/c1295795/content.html",
  excerpt:
    "Use the exact wording printed on the passport biodata page for passport identity fields. For Chinese ordinary passports, the issuing authority shown on the passport is the source of truth; newer passports may show the National Immigration Administration, PRC, while older valid passports may show MPS Exit & Entry Administration. Do not infer the issuing authority from the pickup city.",
};

const STANDARD_IDENTITY_FIELD_CONTEXT = [
  "Standard identity-field RAG for visa form copilot:",
  "Passport number, name, date of birth, sex, nationality, passport issue date, passport expiry date, issuing country, issuing authority, place of issue, and passport type are standard-answer fields.",
  "For these fields, the answer must come from the passport biodata page, MRZ, official document, or the official dropdown options. Do not infer a value from the application country, pickup city, residence city, travel plan, or translation memory.",
  "For passport issuing authority / issuing authority / 签发机关 / 签发地点字段: first ask the user to check the exact 'Authority' or 'Issuing authority' text printed on the passport. If the user has a Chinese ordinary passport, newer passports may show 'National Immigration Administration, PRC' / '中华人民共和国国家移民管理局'; older valid passports may show 'MPS Exit & Entry Administration' / '公安部出入境管理局'. If the passport prints a different authority, copy that printed text exactly.",
  "If the user says they obtained the passport in a city such as Chongqing, do not answer that the issuing authority is Chongqing Public Security Bureau unless the passport itself prints that wording. A pickup or application city may be relevant only to a separate place-of-issue field, and even then the passport text controls.",
  "For passport type / document type, ordinary personal tourist passports are usually Ordinary / Regular / Normal passport. Diplomatic, official, service, special, travel document, refugee, or other should be selected only when the passport or travel document explicitly says so.",
  "For country and nationality fields, use the official country/region option offered by the form. For dates, use the date printed on the passport and the format required by the form.",
].join("\n");

type FieldType =
  | "text"
  | "select"
  | "date"
  | "file"
  | "radio"
  | "checkbox"
  | "textarea"
  | "country";

type Severity = "ok" | "warning" | "error";
type Confidence = "high" | "medium" | "low";
type ChatRole = "user" | "assistant";

interface FieldOption {
  value: string;
  text: string;
}

interface FieldGuidanceField {
  fieldName: string;
  label: string;
  fieldType: FieldType;
  required: boolean;
  stepName?: string | null;
  placeholder?: string | null;
  options?: Array<FieldOption | string> | null;
  validationRules?: Record<string, unknown> | null;
  conditionalLogic?: Record<string, unknown> | null;
}

interface FieldGuidanceRequest {
  visaType?: string | null;
  country?: string | null;
  locale?: string | null;
  field?: FieldGuidanceField;
  answer?: string | null;
  allAnswers?: Record<string, string>;
  question?: string | null;
  history?: ChatMessage[];
}

interface GuidanceBody {
  title: string;
  summary: string;
  examples: string[];
  hints: string[];
  officialWarnings: string[];
  formatHints: string[];
}

interface ValidationBody {
  severity: Severity;
  messages: string[];
}

interface SourceBody {
  title: string;
  url: string | null;
  excerpt: string;
}

interface CachedGuidance {
  guidance: GuidanceBody;
  sources: SourceBody[];
  chunks: VisaKnowledgeChunk[];
  confidence: Confidence;
  aiUsed: boolean;
}

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface AiGuidanceJson {
  summary?: unknown;
  examples?: unknown;
  hints?: unknown;
  officialWarnings?: unknown;
  formatHints?: unknown;
  confidence?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, (block) => {
      const code = block.slice(3, -3);
      const firstNewline = code.indexOf("\n");
      return firstNewline > 0 ? code.slice(firstNewline + 1).trim() : code.trim();
    })
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/(^|[^\w])\*([^*\n]+)\*([^\w]|$)/g, "$1$2$3")
    .replace(/(^|[^\w])_([^_\n]+)_([^\w]|$)/g, "$1$2$3")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeHistory(history?: ChatMessage[] | null): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  const sanitized: ChatMessage[] = [];

  for (const item of history) {
    if (!isRecord(item)) continue;
    const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
    const content = asString(item.content);
    if (!role || !content) continue;
    sanitized.push({
      role,
      content: stripMarkdown(content).slice(0, 800),
    });
  }

  return sanitized.slice(-MAX_HISTORY_MESSAGES);
}

function cleanAiStringArray(value: unknown, limit: number): string[] {
  return asStringArray(value)
    .map((item) => stripMarkdown(item))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeOptions(
  options?: Array<FieldOption | string> | null
): FieldOption[] {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      if (typeof option === "string") {
        return { value: option, text: option };
      }
      return {
        value: option.value ?? "",
        text: option.text ?? option.value ?? "",
      };
    })
    .filter((option) => option.value.trim() || option.text.trim());
}

function normalizeComparableText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function optionCoreTokens(option: FieldOption): string[] {
  const normalized = normalizeComparableText(`${option.value} ${option.text}`);
  const stopWords = new Set([
    "ward",
    "commune",
    "district",
    "province",
    "city",
    "town",
    "option",
    "select",
    "phuong",
    "xa",
    "quan",
    "huyen",
    "tinh",
    "thanh",
    "pho",
  ]);
  return normalized
    .split(" ")
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function relevantAnswerEntries(allAnswers?: Record<string, string>): Array<[string, string]> {
  if (!allAnswers) return [];
  return Object.entries(allAnswers)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .slice(0, OPTION_CONTEXT_VALUE_LIMIT);
}

function fieldQuestionEvidence(reqBody: FieldGuidanceRequest): string {
  return [
    reqBody.question,
    reqBody.answer,
    ...relevantAnswerEntries(reqBody.allAnswers).flatMap(([key, value]) => [key, value]),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

function findQuestionMatchingOption(
  reqBody: FieldGuidanceRequest,
  field: FieldGuidanceField
): FieldOption | null {
  const options = normalizeOptions(field.options);
  if (options.length === 0) return null;

  const evidence = normalizeComparableText(fieldQuestionEvidence(reqBody));
  if (!evidence) return null;

  let best: { option: FieldOption; score: number } | null = null;
  for (const option of options) {
    const optionText = normalizeComparableText(`${option.value} ${option.text}`);
    if (optionText && evidence.includes(optionText)) {
      return option;
    }

    const tokens = optionCoreTokens(option);
    if (tokens.length === 0) continue;
    const matched = tokens.filter((token) => evidence.includes(token));
    const score = matched.length / tokens.length;
    if (matched.length >= 2 && score >= 0.6 && (!best || score > best.score)) {
      best = { option, score };
    }
  }

  return best?.option ?? null;
}

function questionOptionContext(
  reqBody: FieldGuidanceRequest,
  field: FieldGuidanceField
): string {
  const options = normalizeOptions(field.options);
  const optionLines = options
    .slice(0, 30)
    .map((option) => `${option.value}: ${option.text}`)
    .join("\n");
  const answerLines = relevantAnswerEntries(reqBody.allAnswers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  const matchedOption = findQuestionMatchingOption(reqBody, field);

  return [
    optionLines ? `Official options for this exact field:\n${optionLines}` : "Official options for this exact field: none",
    reqBody.answer?.trim() ? `Current saved answer: ${reqBody.answer.trim()}` : "Current saved answer: empty",
    answerLines ? `Other filled answers that may help resolve this field:\n${answerLines}` : "Other filled answers: none",
    matchedOption
      ? `Deterministic option match from the user's question/current answers: ${matchedOption.value}: ${matchedOption.text}`
      : "Deterministic option match from the user's question/current answers: none",
  ].join("\n\n");
}

function optionSelectionQuestionFallback(
  reqBody: FieldGuidanceRequest,
  field: FieldGuidanceField,
  locale: "zh" | "en"
): string | null {
  if (!["select", "radio", "checkbox", "country"].includes(field.fieldType)) return null;
  const questionText = `${reqBody.question ?? ""} ${reqBody.answer ?? ""}`;
  if (!/(选项|选择|which|option|select|choose|应该选|该选)/i.test(questionText)) return null;

  const matchedOption = findQuestionMatchingOption(reqBody, field);
  if (matchedOption) {
    return locale === "zh"
      ? `这个地址/答案最匹配当前题目的官方选项“${matchedOption.text || matchedOption.value}”（保存值：${matchedOption.value || matchedOption.text}）。建议优先选择这个选项；如果官方页面动态下拉里的文字与 VIZA 当前显示不一致，请以官方页面当前显示的 ward/commune 选项为准。`
      : `This address or answer best matches the current field option "${matchedOption.text || matchedOption.value}" (saved value: ${matchedOption.value || matchedOption.text}). Select that option first; if the official portal's live dropdown differs from VIZA, follow the live official ward/commune option.`;
  }

  return locale === "zh"
    ? "我现在不能从你提供的信息中可靠匹配到唯一选项。请先核对地址所属的省/市、区/县和 ward/commune，再从官方下拉选项中选择完全对应或最接近的一项；不要随便选默认值。"
    : "I cannot reliably match a single option from the information provided. Check the province/city, district, and ward/commune for the address, then choose the exact or closest official dropdown option; do not pick a default value blindly.";
}

function buildQuestionRetrievalQuery(
  reqBody: FieldGuidanceRequest,
  field: FieldGuidanceField
): string {
  return [
    field.stepName,
    field.label,
    field.fieldName,
    field.placeholder,
    reqBody.question,
    reqBody.answer,
    ...relevantAnswerEntries(reqBody.allAnswers).flatMap(([key, value]) => [key, value]),
    "visa application form field option official ward commune address dropdown field answer norms",
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
}

function getLocale(locale?: string | null): "zh" | "en" {
  return locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function cacheKey(
  country: string | null | undefined,
  visaType: string | null | undefined,
  fieldName: string,
  locale: string | null | undefined
): string {
  return `${country ?? "unknown"}:${visaType ?? "unknown"}:${fieldName}:${getLocale(locale)}`;
}

function isDs160Scope(country?: string | null, visaType?: string | null): boolean {
  const normalizedCountry = country?.trim().toLowerCase() ?? "";
  const normalizedVisaType = visaType?.trim().toUpperCase() ?? "";
  return (
    normalizedCountry === "us" ||
    normalizedCountry === "usa" ||
    normalizedCountry === "united_states" ||
    normalizedCountry === "united states" ||
    normalizedVisaType === "DS160" ||
    normalizedVisaType === "B1_B2" ||
    normalizedVisaType === "B1/B2" ||
    normalizedVisaType === "B1_B2_VISITOR"
  );
}

function activeScopeLabel(reqBody: FieldGuidanceRequest): string {
  return `country=${reqBody.country ?? "unknown"}, visaType=${reqBody.visaType ?? "unknown"}`;
}

function stripOutOfScopeFormReferences(
  content: string,
  reqBody: FieldGuidanceRequest
): string {
  if (isDs160Scope(reqBody.country, reqBody.visaType)) return content;
  return content
    .replace(/\bDS[-\s]?160\b\s*(?:表格|申请表|form|application)?\s*(?:中|里|中的|里的|要求的|要求)?/gi, "当前签证申请表")
    .replace(/\bCEAC\b/gi, "当前官方申请系统")
    .replace(/美国签证在线申请系统/g, "当前官方申请系统")
    .replace(/美国签证/g, "当前签证");
}

function sanitizeGuidanceScope(
  guidance: GuidanceBody,
  reqBody: FieldGuidanceRequest
): GuidanceBody {
  return {
    title: stripOutOfScopeFormReferences(guidance.title, reqBody),
    summary: stripOutOfScopeFormReferences(guidance.summary, reqBody),
    examples: guidance.examples.map((item) => stripOutOfScopeFormReferences(item, reqBody)),
    hints: guidance.hints.map((item) => stripOutOfScopeFormReferences(item, reqBody)),
    officialWarnings: guidance.officialWarnings.map((item) => stripOutOfScopeFormReferences(item, reqBody)),
    formatHints: guidance.formatHints.map((item) => stripOutOfScopeFormReferences(item, reqBody)),
  };
}

function makeTitle(field: FieldGuidanceField, locale: "zh" | "en"): string {
  return locale === "zh"
    ? `${field.label} 填写帮助`
    : `${field.label} guidance`;
}

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function isPhotoField(field: FieldGuidanceField): boolean {
  const combined = `${field.fieldName} ${field.label} ${field.stepName ?? ""}`.toLowerCase();
  return field.fieldType === "file" && includesAny(combined, [
    "photo",
    "photograph",
    "portrait",
    "visa picture",
    "passport size",
    "passport-style",
    "证件照",
    "照片",
  ]);
}

function deterministicExamples(field: FieldGuidanceField, locale: "zh" | "en"): string[] {
  const name = field.fieldName.toLowerCase();
  const label = field.label.toLowerCase();
  const options = normalizeOptions(field.options);

  if (isPhotoField(field)) {
    return locale === "zh"
      ? ["近期白色或浅色背景证件照", "清晰正面 JPG/JPEG 签证照片"]
      : ["Recent photo with a white or light background", "Clear front-facing JPG/JPEG visa photo"];
  }
  if (isPassportIssuingAuthorityField(field)) {
    return locale === "zh"
      ? [
          "National Immigration Administration, PRC",
          "MPS Exit & Entry Administration",
          "按护照资料页 Authority/签发机关原文填写",
        ]
      : [
          "National Immigration Administration, PRC",
          "MPS Exit & Entry Administration",
          "Use the exact Authority wording printed on the passport",
        ];
  }
  if (options.length > 0) {
    return options.slice(0, 3).map((option) => option.text || option.value);
  }

  if (field.fieldType === "date" || name.includes("date")) {
    return ["15/03/1990", "04/11/2026"];
  }
  if (includesAny(`${name} ${label}`, ["surname", "family name"])) {
    return ["ZHANG", "GARCIA"];
  }
  if (includesAny(`${name} ${label}`, ["given", "first name"])) {
    return ["XIAOMING", "MARIA ELENA"];
  }
  if (includesAny(`${name} ${label}`, ["passport", "document number"])) {
    return ["E12345678", "PA9876543"];
  }
  if (includesAny(`${name} ${label}`, ["email", "e-mail"])) {
    return ["name@example.com"];
  }
  if (includesAny(`${name} ${label}`, ["phone", "telephone"])) {
    return ["+86 138 0000 0000"];
  }
  if (includesAny(`${name} ${label}`, ["address", "street"])) {
    return ["12 Example Road, Beijing, China"];
  }
  if (field.fieldType === "textarea") {
    return ["Briefly explain the situation with dates, places, and names that match your documents."];
  }
  return ["Use the exact wording from your official document where possible."];
}

function deterministicHints(field: FieldGuidanceField, locale: "zh" | "en"): string[] {
  const rules = field.validationRules ?? {};
  const hints: string[] = [];
  const format = asString(rules.format);
  const maxLength = typeof rules.maxLength === "number" ? rules.maxLength : null;

  if (isPhotoField(field)) {
    hints.push(
      locale === "zh"
        ? "请按当前目的地官方签证照片规格准备，不同国家/签证中心的尺寸和文件大小可能不同。"
        : "Prepare the image according to the destination's official visa photo specification; size and file limits can vary by country or visa centre."
    );
    hints.push(
      locale === "zh"
        ? "优先使用近期、清晰、正面、背景纯净的证件照。"
        : "Use a recent, clear, front-facing passport-style photo with a plain background."
    );
  }
  if (field.required) {
    hints.push(locale === "zh" ? "此项为必填项。" : "This field is required.");
  }
  if (field.placeholder) {
    hints.push(
      locale === "zh"
        ? `参考占位示例：${field.placeholder}`
        : `Use the placeholder as a guide: ${field.placeholder}`
    );
  }
  if (isPassportIssuingAuthorityField(field)) {
    hints.push(
      locale === "zh"
        ? "请直接查看护照资料页的 Authority/签发机关，不要根据领取城市或户籍地推断。"
        : "Check the Authority or issuing authority printed on the passport biodata page; do not infer it from the pickup city or household-registration location."
    );
  } else if (isStandardIdentityField(field)) {
    hints.push(
      locale === "zh"
        ? "这是标准证件字段，请优先照抄护照资料页、机读区或官方下拉选项。"
        : "This is a standard identity-document field; copy the passport biodata page, MRZ, or official dropdown option where possible."
    );
  }
  if (format) {
    hints.push(
      locale === "zh"
        ? `请使用官方格式：${format}`
        : `Use the official format: ${format}`
    );
  }
  if (maxLength) {
    hints.push(
      locale === "zh"
        ? `最多 ${maxLength} 个字符。`
        : `Keep this within ${maxLength} characters.`
    );
  }

  if (hints.length === 0) {
    hints.push(
      locale === "zh"
        ? "保持答案简洁，并与护照、行程或证明文件一致。"
        : "Keep the answer concise and consistent with your passport, itinerary, or supporting documents."
    );
  }

  return hints;
}

function deterministicWarnings(field: FieldGuidanceField, locale: "zh" | "en"): string[] {
  const combined = `${field.fieldName} ${field.label}`.toLowerCase();
  const warnings: string[] = [];

  if (isPhotoField(field)) {
    warnings.push(
      locale === "zh"
        ? "不要上传自拍截图、证件扫描件、过度美颜或 AI 修改过的照片。"
        : "Do not upload selfies, document scans, heavily retouched images, or AI-altered photos."
    );
    warnings.push(
      locale === "zh"
        ? "如果官方流程改为签证中心现场采集照片，请以预约确认页和签证中心要求为准。"
        : "If the official process collects the photo at a visa application centre, follow the appointment confirmation and centre instructions."
    );
  }
  if (includesAny(combined, ["surname", "given", "full name", "passport"])) {
    warnings.push(
      locale === "zh"
        ? "姓名和护照号码必须与护照机读区或资料页一致。"
        : "Names and passport numbers must match the passport bio page or MRZ."
    );
  }
  if (isPassportIssuingAuthorityField(field)) {
    warnings.push(
      locale === "zh"
        ? "不要把“在重庆领取/办理”直接写成“重庆市公安局”或 Chongqing Public Security Bureau，除非护照签发机关栏就是这样印的。"
        : "Do not write Chongqing Public Security Bureau merely because the passport was collected or applied for in Chongqing, unless the passport authority field prints that wording."
    );
  }
  if (includesAny(combined, ["birth", "nationality", "country"])) {
    warnings.push(
      locale === "zh"
        ? "出生地、国籍等信息请按官方证件填写，不要按旅行计划猜测。"
        : "Use official identity-document information for birth and nationality fields; do not guess from travel plans."
    );
  }
  if (field.fieldType === "date") {
    warnings.push(
      locale === "zh"
        ? "日期要与相关上下文一致，例如护照签发日在到期日之前。"
        : "Dates must be consistent with related answers, such as passport issue date before expiry date."
    );
  }
  if (includesAny(combined, ["password", "secret", "token", "totp"])) {
    warnings.push(
      locale === "zh"
        ? "此字段可能包含敏感登录信息，请只在安全环境中填写，不要与他人分享。"
        : "This field may contain sensitive login information; enter it only in a secure environment and do not share it."
    );
  }
  if (warnings.length === 0) {
    warnings.push(
      locale === "zh"
        ? "提交前请核对该答案是否与官方文件、申请账户或行程信息一致。"
        : "Before submitting, check that this answer is consistent with official documents, application account details, or travel plans."
    );
  }

  return warnings;
}

function deterministicFormatHints(field: FieldGuidanceField, locale: "zh" | "en"): string[] {
  const rules = field.validationRules ?? {};
  const hints: string[] = [];
  const pattern = asString(rules.pattern);
  const format = asString(rules.format);
  const source = asString(rules.source);

  if (format) {
    hints.push(format);
  } else if (field.fieldType === "date") {
    hints.push("DD/MM/YYYY");
  }
  if (pattern) {
    hints.push(locale === "zh" ? "需要符合字段格式规则。" : "Must match the field format rule.");
  }
  if (source === "ISO3166-1") {
    hints.push(locale === "zh" ? "请选择官方国家/地区名称。" : "Choose the official country or region name.");
  }
  if (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "checkbox") {
    hints.push(locale === "zh" ? "请选择题目提供的一个选项。" : "Choose one of the options provided by the form.");
  }
  if (field.fieldType === "country") {
    hints.push(locale === "zh" ? "使用官方国家/地区名称。" : "Use the official country or region name.");
  }
  if (field.fieldType === "textarea") {
    hints.push(locale === "zh" ? "用简洁自然语言填写，避免无关信息。" : "Use concise plain language and avoid unrelated details.");
  }
  if (field.fieldType === "file") {
    hints.push(
      isPhotoField(field)
        ? locale === "zh"
          ? "上传 JPG/JPEG/PNG 等官方页面允许的照片文件；文件大小以当前目的地官方页面为准。"
          : "Upload a photo file type accepted by the official page, such as JPG/JPEG/PNG where allowed; follow the destination's file-size limit."
        : locale === "zh"
          ? "上传清晰、完整、与题目要求一致的文件。"
          : "Upload a clear, complete file that matches the field requirement."
    );
  }
  if (hints.length === 0) {
    hints.push(locale === "zh" ? "按官方文件上的写法填写。" : "Enter the value as it appears on the official document.");
  }

  return hints;
}

function buildDeterministicGuidance(
  field: FieldGuidanceField,
  locale: "zh" | "en"
): GuidanceBody {
  return {
    title: makeTitle(field, locale),
    summary:
      isPhotoField(field)
        ? locale === "zh"
          ? "上传的签证照片应符合当前目的地官方照片规格，并与本人当前外貌一致。"
          : "The uploaded visa photo should follow the destination's official photo rules and reflect your current appearance."
        : locale === "zh"
          ? "按官方表格含义填写，并确保答案和证件、行程、其他表格答案保持一致。"
          : "Answer this according to the official form meaning and keep it consistent with documents, travel plans, and related answers.",
    examples: deterministicExamples(field, locale),
    hints: deterministicHints(field, locale),
    officialWarnings: deterministicWarnings(field, locale),
    formatHints: deterministicFormatHints(field, locale),
  };
}

function mergeGuidance(
  base: GuidanceBody,
  ai: AiGuidanceJson,
  field: FieldGuidanceField,
  locale: "zh" | "en"
): GuidanceBody {
  return {
    title: makeTitle(field, locale),
    summary: asString(ai.summary) ? stripMarkdown(asString(ai.summary) ?? "") : base.summary,
    examples: cleanAiStringArray(ai.examples, 4),
    hints: cleanAiStringArray(ai.hints, 5),
    officialWarnings: cleanAiStringArray(ai.officialWarnings, 4),
    formatHints: cleanAiStringArray(ai.formatHints, 4),
  };
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

function keepChineseItems(items: string[], fallback: string[]): string[] {
  const kept = items.filter((item) => !isLikelyNonChineseSentence(item));
  return kept.length > 0 ? kept : fallback;
}

function enforceGuidanceLanguage(
  guidance: GuidanceBody,
  base: GuidanceBody,
  locale: "zh" | "en"
): GuidanceBody {
  if (locale !== "zh") return guidance;
  return {
    ...guidance,
    summary: isLikelyNonChineseSentence(guidance.summary) ? base.summary : guidance.summary,
    hints: keepChineseItems(guidance.hints, base.hints),
    officialWarnings: keepChineseItems(guidance.officialWarnings, base.officialWarnings),
    formatHints: keepChineseItems(guidance.formatHints, base.formatHints),
  };
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function mapSources(chunks: VisaKnowledgeChunk[]): SourceBody[] {
  return chunks.slice(0, 3).map((chunk) => ({
    title: chunk.title ?? "Visa knowledge",
    url: chunk.sourceUrl,
    excerpt: chunk.content.replace(/\s+/g, " ").slice(0, 220),
  }));
}

function addMessage(messages: string[], message: string): void {
  if (!messages.includes(message)) messages.push(message);
}

function buildStrictDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function parseDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "DO_NOT_KNOW" || trimmed === "DOES_NOT_APPLY") return null;

  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const official = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const chinese = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);

  if (iso) {
    return buildStrictDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  if (official) {
    return buildStrictDate(Number(official[3]), Number(official[2]), Number(official[1]));
  }
  if (chinese) {
    return buildStrictDate(Number(chinese[1]), Number(chinese[2]), Number(chinese[3]));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

const DOCUMENT_ISSUE_DATE_CANDIDATES = [
  "passport_issuance_date",
  "passport_issue_date",
  "passport_date_of_issue",
  "travel_document_issue_date",
  "date_of_issue",
  "issue_date",
] as const;

const DOCUMENT_EXPIRY_DATE_CANDIDATES = [
  "passport_expiration_date",
  "passport_expiry_date",
  "passport_date_of_expiry",
  "travel_document_expiry_date",
  "date_of_expiry",
  "expiration_date",
  "expiry_date",
  "valid_until",
] as const;

const ARRIVAL_DATE_CANDIDATES = [
  "arrival_date",
  "intended_arrival_date",
  "entry_date",
] as const;

const DEPARTURE_DATE_CANDIDATES = [
  "departure_date",
  "intended_departure_date",
  "date_of_departure",
  "exit_date",
] as const;

const NATIONALITY_CONSISTENCY_CANDIDATES = [
  "current_nationality",
  "nationality_country",
  "nationality",
  "nationality_at_birth",
  "nationality_at_birth_different",
] as const;

function stripRepeatInstanceSuffix(key: string): string {
  return key.replace(/__\d+$/, "");
}

function normaliseFieldKey(key: string): string {
  return stripRepeatInstanceSuffix(key)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function fieldKeyMatchesCandidate(key: string, candidate: string): boolean {
  const normalisedKey = normaliseFieldKey(key);
  const normalisedCandidate = normaliseFieldKey(candidate);
  return (
    normalisedKey === normalisedCandidate ||
    normalisedKey.endsWith(`_${normalisedCandidate}`) ||
    normalisedKey.includes(`_${normalisedCandidate}_`)
  );
}

function fieldKeyMatchesAny(key: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => fieldKeyMatchesCandidate(key, candidate));
}

function fieldSearchText(field: FieldGuidanceField): string {
  return `${field.fieldName} ${field.label} ${field.stepName ?? ""}`.toLowerCase();
}

function isStandardIdentityField(field: FieldGuidanceField): boolean {
  const searchText = fieldSearchText(field);
  return includesAny(searchText, [
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
    "姓",
    "名",
  ]);
}

function isPassportIssuingAuthorityField(field: FieldGuidanceField): boolean {
  const searchText = fieldSearchText(field);
  return includesAny(searchText, [
    "passport_issuing_authority",
    "issuing authority",
    "authority",
    "签发机关",
    "签发地点",
  ]);
}

function standardIdentityContextFor(field: FieldGuidanceField): string {
  return isStandardIdentityField(field) ? STANDARD_IDENTITY_FIELD_CONTEXT : "";
}

function standardIdentitySourceFor(field: FieldGuidanceField): SourceBody[] {
  return isStandardIdentityField(field) ? [STANDARD_IDENTITY_FIELD_SOURCE] : [];
}

function standardIdentityQuestionFallback(
  reqBody: FieldGuidanceRequest,
  field: FieldGuidanceField,
  locale: "zh" | "en"
): string | null {
  if (!isPassportIssuingAuthorityField(field)) return null;

  const questionText = `${reqBody.question ?? ""} ${reqBody.answer ?? ""}`;
  const mentionsChinaPassport = /中国|china|chinese|重庆|chongqing/i.test(questionText);

  if (locale === "zh") {
    return mentionsChinaPassport
      ? "这个字段不要按办理城市推断。请看护照资料页上的“签发机关/Authority”原文：如果写的是“中华人民共和国国家移民管理局”或 “National Immigration Administration, PRC”，就照这个填写；如果旧护照写的是“公安部出入境管理局”或 “MPS Exit & Entry Administration”，也照护照原文填写。只有单独问“签发地点/Place of issue”且护照上对应位置写重庆时，才填重庆或 CHONGQING。"
      : "请按护照资料页上的“签发机关/Authority”原文填写，不要根据办理城市、居住地或翻译猜测。若证件上已有英文或罗马拼写，以证件原文为准。";
  }

  return mentionsChinaPassport
    ? "Do not infer this from the city where the passport was collected. Check the passport biodata page and copy the printed Authority or Issuing authority wording. For a Chinese ordinary passport, use the printed wording such as National Immigration Administration, PRC or, on some older valid passports, MPS Exit & Entry Administration. Use Chongqing only for a separate place-of-issue field if the passport itself shows that place."
    : "Copy the Authority or Issuing authority exactly as printed on the passport biodata page. Do not infer it from the pickup city, residence city, or travel destination.";
}

function isDocumentExpiryField(field: FieldGuidanceField): boolean {
  if (!fieldKeyMatchesAny(field.fieldName, DOCUMENT_EXPIRY_DATE_CANDIDATES)) return false;

  const searchText = fieldSearchText(field);
  if (
    searchText.includes("entry permit") ||
    searchText.includes("prior schengen") ||
    searchText.includes("last schengen visa")
  ) {
    return false;
  }

  return (
    searchText.includes("passport") ||
    searchText.includes("travel_document") ||
    searchText.includes("travel document") ||
    searchText.includes("expiry date") ||
    searchText.includes("expiration date") ||
    fieldKeyMatchesAny(field.fieldName, ["date_of_expiry", "expiration_date", "expiry_date"])
  );
}

function isDepartureDateField(field: FieldGuidanceField): boolean {
  return fieldKeyMatchesAny(field.fieldName, DEPARTURE_DATE_CANDIDATES);
}

function isNationalityConsistencyField(field: FieldGuidanceField): boolean {
  return fieldKeyMatchesAny(field.fieldName, NATIONALITY_CONSISTENCY_CANDIDATES);
}

function findAnswer(
  allAnswers: Record<string, string>,
  candidates: readonly string[]
): string | null {
  for (const candidate of candidates) {
    const direct = allAnswers[candidate];
    if (typeof direct === "string" && direct.trim()) return direct;
  }

  const entries = Object.entries(allAnswers);
  for (const candidate of candidates) {
    const found = entries.find(([key, value]) =>
      fieldKeyMatchesCandidate(key, candidate) && value.trim()
    );
    if (found) return found[1];
  }

  return null;
}

function validateAnswer(
  field: FieldGuidanceField,
  answer: string,
  allAnswers: Record<string, string>,
  locale: "zh" | "en"
): ValidationBody {
  const messages: string[] = [];
  let severity: Severity = "ok";
  const trimmed = answer.trim();
  const rules = field.validationRules ?? {};

  const warn = (zh: string, en: string) => {
    severity = severity === "error" ? "error" : "warning";
    addMessage(messages, locale === "zh" ? zh : en);
  };
  const error = (zh: string, en: string) => {
    severity = "error";
    addMessage(messages, locale === "zh" ? zh : en);
  };

  if (field.required && !trimmed) {
    warn("此必填项还没有填写。", "This required field has not been filled yet.");
  }

  const maxLength = typeof rules.maxLength === "number" ? rules.maxLength : null;
  if (maxLength && trimmed.length > maxLength) {
    error(
      `此答案超过 ${maxLength} 个字符限制。`,
      `This answer exceeds the ${maxLength}-character limit.`
    );
  }

  const pattern = asString(rules.pattern);
  if (pattern && trimmed) {
    try {
      const regex = new RegExp(pattern);
      if (!regex.test(trimmed)) {
        error("此答案不符合该字段要求的格式。", "This answer does not match the required field format.");
      }
    } catch {
      logger.warn("Invalid validation regex in field guidance", undefined, {
        fieldName: field.fieldName,
      });
    }
  }

  const options = normalizeOptions(field.options);
  if (
    (field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "checkbox") &&
    trimmed &&
    options.length > 0
  ) {
    const matches = options.some(
      (option) =>
        option.value.toLowerCase() === trimmed.toLowerCase() ||
        option.text.toLowerCase() === trimmed.toLowerCase()
    );
    if (!matches) {
      error("此答案不是该题目的可选项。", "This answer is not one of the available options.");
    }
  }

  if (isPhotoField(field) && trimmed) {
    const normalizedPhotoAnswer = trimmed.toLowerCase();
    const looksLikeFileName = /\.[a-z0-9]{2,5}($|\?)/i.test(normalizedPhotoAnswer);
    const acceptedPhotoFile =
      normalizedPhotoAnswer.endsWith(".jpg") ||
      normalizedPhotoAnswer.endsWith(".jpeg") ||
      normalizedPhotoAnswer.endsWith(".png") ||
      normalizedPhotoAnswer.endsWith(".heic") ||
      normalizedPhotoAnswer.endsWith(".heif");
    if (looksLikeFileName && !acceptedPhotoFile) {
      error(
        "照片文件格式看起来不符合常见签证照片上传要求，请使用官方页面允许的图片格式。",
        "The photo file type does not look like a common accepted visa-photo upload format; use an image type allowed by the official page."
      );
    }
  }

  if (field.fieldType === "date" && trimmed) {
    const date = parseDate(trimmed);
    if (!date) {
      error("日期格式无法识别。", "The date format could not be recognized.");
    }
    if (date && includesAny(field.fieldName.toLowerCase(), ["birth", "dob"]) && date > new Date()) {
      error("出生日期不能是未来日期。", "Date of birth cannot be in the future.");
    }
  }

  const issue = parseDate(
    findAnswer(allAnswers, DOCUMENT_ISSUE_DATE_CANDIDATES)
  );
  const expiry = parseDate(
    findAnswer(allAnswers, DOCUMENT_EXPIRY_DATE_CANDIDATES)
  );
  if (isDocumentExpiryField(field) && issue && expiry && expiry <= issue) {
    error("证件到期日必须晚于签发日。", "The document expiry date must be after the issue date.");
  }

  const arrival = parseDate(findAnswer(allAnswers, ARRIVAL_DATE_CANDIDATES));
  const departure = parseDate(findAnswer(allAnswers, DEPARTURE_DATE_CANDIDATES));
  if (isDepartureDateField(field) && arrival && departure && departure < arrival) {
    error("离境日期不能早于入境日期。", "Departure date cannot be earlier than arrival date.");
  }
  if (isDocumentExpiryField(field) && arrival && expiry && expiry < arrival) {
    error("护照/旅行证件在入境前已过期。", "The passport or travel document expires before arrival.");
  } else if (isDocumentExpiryField(field) && arrival && expiry && expiry < addMonths(arrival, 6)) {
    warn(
      "护照/旅行证件在计划入境后 6 个月内到期，请确认目的地是否接受。",
      "The passport or travel document expires within 6 months after planned arrival; confirm the destination accepts this."
    );
  }

  const currentNationality = findAnswer(allAnswers, ["current_nationality", "nationality_country", "nationality"]);
  const nationalityAtBirth = findAnswer(allAnswers, ["nationality_at_birth"]);
  const differentFlag = findAnswer(allAnswers, ["nationality_at_birth_different"]);
  if (
    currentNationality &&
    nationalityAtBirth &&
    differentFlag &&
    differentFlag.toLowerCase() === "no" &&
    currentNationality.toLowerCase() !== nationalityAtBirth.toLowerCase() &&
    isNationalityConsistencyField(field)
  ) {
    warn(
      "您选择了出生国籍未变化，但当前国籍和出生国籍不一致。",
      "You indicated nationality at birth has not changed, but current nationality and nationality at birth differ."
    );
  }

  if (messages.length === 0) {
    messages.push(locale === "zh" ? "目前没有发现明显问题。" : "No obvious issue detected for this field.");
  }

  return { severity, messages };
}

async function generateAiGuidance(
  reqBody: FieldGuidanceRequest,
  field: FieldGuidanceField,
  locale: "zh" | "en",
  chunks: VisaKnowledgeChunk[]
): Promise<AiGuidanceJson | null> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_openai_api_key_here") {
    return null;
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const standardContext = standardIdentityContextFor(field);
  const context = chunks
    .slice(0, 5)
    .map((chunk, index) => `Source ${index + 1}: ${chunk.content.slice(0, 1200)}`)
    .join("\n\n");
  const relevantContext = [standardContext ? `Standard field source:\n${standardContext}` : null, context]
    .filter(Boolean)
    .join("\n\n");

  try {
    const message = await client.responses.create({
      model: OPENAI_FIELD_GUIDANCE_MODEL,
      max_output_tokens: 700,
      instructions: `You are a visa form field copilot. Active application scope: ${activeScopeLabel(reqBody)}. Stay strictly within this country and visa type. Do not mention DS-160, CEAC, U.S. consular forms, or U.S. visa requirements unless the active scope is U.S. DS-160/B1_B2. If the source context is thin, say the field should follow the current destination's official form and documents instead of borrowing rules from another country. For standard identity/passport fields, treat the Standard field source as binding: copy what is printed on the passport or official document, and never infer an issuing authority from a pickup city. Use ${locale === "zh" ? "Simplified Chinese for every descriptive value. Examples may remain as official values, names, codes, dates, or options, but summary, hints, officialWarnings, and explanatory formatHints must be Chinese even when the source context is English, Indonesian, or another language" : "English"}. Plain text only inside JSON values: do not use Markdown headings, bold, bullets, code formatting, or tables. Do not invent legal requirements not supported by the field metadata or context.`,
      input: `Active application scope: ${activeScopeLabel(reqBody)}\n\nField metadata:\n${JSON.stringify(field, null, 2)}\n\nRelevant source context:\n${relevantContext || "No source context found."}`,
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
              hints: { type: "array", items: { type: "string" } },
              officialWarnings: { type: "array", items: { type: "string" } },
              formatHints: { type: "array", items: { type: "string" } },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: [
              "summary",
              "examples",
              "hints",
              "officialWarnings",
              "formatHints",
              "confidence",
            ],
          },
        },
      },
    });

    const parsed = parseJsonObject(message.output_text);
    return parsed;
  } catch (error) {
    logger.warn("AI field guidance generation failed", error as Error, {
      fieldName: field.fieldName,
    });
    return null;
  }
}

async function generateQuestionReply(
  question: string,
  reqBody: FieldGuidanceRequest,
  field: FieldGuidanceField,
  guidance: GuidanceBody,
  validation: ValidationBody,
  history: ChatMessage[],
  locale: "zh" | "en",
  chunks: VisaKnowledgeChunk[]
): Promise<{ reply: string; aiUsed: boolean }> {
  const fallback =
    standardIdentityQuestionFallback(reqBody, field, locale) ??
    optionSelectionQuestionFallback(reqBody, field, locale) ??
    (locale === "zh"
      ? `关于“${field.label}”：${guidance.summary} 可以参考示例：${guidance.examples.slice(0, 2).join("；")}。${validation.messages[0] ?? ""}`
      : `For "${field.label}": ${guidance.summary} Examples: ${guidance.examples.slice(0, 2).join("; ")}. ${validation.messages[0] ?? ""}`);
  const scopedFallback = stripOutOfScopeFormReferences(fallback, reqBody);

  if (!OPENAI_API_KEY || OPENAI_API_KEY === "your_openai_api_key_here") {
    return { reply: scopedFallback, aiUsed: false };
  }

  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const standardContext = standardIdentityContextFor(field);
  const context = chunks
    .slice(0, 3)
    .map((chunk, index) => `Source ${index + 1}: ${chunk.content.slice(0, 900)}`)
    .join("\n\n");
  const relevantContext = [standardContext ? `Standard field source:\n${standardContext}` : null, context]
    .filter(Boolean)
    .join("\n\n");
  const optionContext = questionOptionContext(reqBody, field);
  const conversation = history.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  try {
    const message = await client.chat.completions.create({
      model: OPENAI_FIELD_GUIDANCE_MODEL,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content: `You answer user questions about one visa form field. Active application scope: ${activeScopeLabel(reqBody)}. Stay strictly within this country and visa type. Do not mention DS-160, CEAC, U.S. consular forms, or U.S. visa requirements unless the active scope is U.S. DS-160/B1_B2. If the user asks which option to choose and the field has official options, compare the user's question, current answer, and other filled answers against those exact options first. If one option clearly matches, state that option directly before explaining uncertainty. Do not answer only with generic field meaning when the user asked for an option. If the source context is thin, explain the field meaning and tell the user to follow the current destination's official form and documents. For standard identity/passport fields, the passport or official document text is the answer; never infer a passport issuing authority from the pickup city, residence city, or application country. Use ${locale === "zh" ? "Simplified Chinese only, even when the source context is English, Indonesian, or another language" : "English"}. Be concise, practical, and cite uncertainty when the source context is thin. Use plain chat text only: no Markdown headings, bold, bullets, numbered lists, code formatting, or tables.`,
        },
        ...conversation,
        {
          role: "user",
          content: `Active application scope: ${activeScopeLabel(reqBody)}\n\nQuestion: ${question}\n\nField: ${JSON.stringify(field)}\n\nQuestion-specific field context:\n${optionContext}\n\nCurrent guidance: ${JSON.stringify(guidance)}\n\nValidation: ${JSON.stringify(validation)}\n\nRelevant RAG context:\n${relevantContext || "No source context found."}`,
        },
      ],
    });

    const reply = stripOutOfScopeFormReferences(
      stripMarkdown(message.choices[0]?.message?.content?.trim() ?? ""),
      reqBody
    );
    if (locale === "zh" && isLikelyNonChineseSentence(reply)) {
      return { reply: scopedFallback, aiUsed: false };
    }
    return { reply: reply || scopedFallback, aiUsed: Boolean(reply) };
  } catch (error) {
    logger.warn("AI field question reply failed", error as Error, {
      fieldName: field.fieldName,
    });
    return { reply: scopedFallback, aiUsed: false };
  }
}

async function getStaticGuidance(
  reqBody: FieldGuidanceRequest,
  field: FieldGuidanceField,
  locale: "zh" | "en"
): Promise<CachedGuidance & { cached: boolean; chunks: VisaKnowledgeChunk[] }> {
  const key = cacheKey(reqBody.country, reqBody.visaType, field.fieldName, reqBody.locale);
  const cached = GUIDANCE_CACHE.get(key);
  if (cached) {
    return { ...cached, cached: true };
  }

  const query = [
    field.stepName,
    field.label,
    field.fieldName,
    field.placeholder,
    isPhotoField(field)
      ? "visa photo photograph passport photo digital image upload requirements size background file format"
      : null,
    isStandardIdentityField(field)
      ? "standard passport identity field authority issuing authority place of issue passport type document type nationality exact wording biodata page MRZ"
      : null,
    "visa application form field requirements examples warnings",
  ]
    .filter(Boolean)
    .join(" ");

  const knowledge = DISABLE_RETRIEVAL
    ? { chunks: [] as VisaKnowledgeChunk[] }
    : await retrieveVisaKnowledge({
        query,
        country: reqBody.country,
        visaType: reqBody.visaType,
        intent: "form_intake",
        matchCount: 5,
      });

  const base = buildDeterministicGuidance(field, locale);
  const ai = await generateAiGuidance(reqBody, field, locale, knowledge.chunks);
  const merged = enforceGuidanceLanguage(
    ai ? mergeGuidance(base, ai, field, locale) : base,
    base,
    locale
  );
  const guidance = sanitizeGuidanceScope({
    ...merged,
    examples: merged.examples.length > 0 ? merged.examples : base.examples,
    hints: merged.hints.length > 0 ? merged.hints : base.hints,
    officialWarnings:
      merged.officialWarnings.length > 0 ? merged.officialWarnings : base.officialWarnings,
    formatHints: merged.formatHints.length > 0 ? merged.formatHints : base.formatHints,
  }, reqBody);
  const sources = [...standardIdentitySourceFor(field), ...mapSources(knowledge.chunks)];
  const confidence = ai
    ? (asString(ai.confidence) === "high" || asString(ai.confidence) === "medium"
        ? (asString(ai.confidence) as Confidence)
        : "medium")
    : sources.length > 0
      ? "medium"
      : "low";

  const staticGuidance: CachedGuidance = {
    guidance,
    sources,
    chunks: knowledge.chunks,
    confidence,
    aiUsed: Boolean(ai),
  };
  GUIDANCE_CACHE.set(key, staticGuidance);

  return { ...staticGuidance, cached: false, chunks: knowledge.chunks };
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as FieldGuidanceRequest;
  const field = body.field;

  if (!field?.fieldName || !field.label || !field.fieldType) {
    res.status(400).json({ error: "field.fieldName, field.label, and field.fieldType are required" });
    return;
  }

  try {
    const locale = getLocale(body.locale);
    const staticGuidance = await getStaticGuidance(body, field, locale);
    const validation = validateAnswer(
      field,
      body.answer ?? "",
      body.allAnswers ?? {},
      locale
    );
    const history = sanitizeHistory(body.history);
    const trimmedQuestion = body.question?.trim();
    const questionKnowledge = trimmedQuestion && !DISABLE_RETRIEVAL
      ? await retrieveVisaKnowledge({
          query: buildQuestionRetrievalQuery(body, field),
          country: body.country,
          visaType: body.visaType,
          intent: "form_intake",
          matchCount: 5,
        })
      : null;
    const questionChunks = questionKnowledge
      ? [...questionKnowledge.chunks, ...staticGuidance.chunks]
      : staticGuidance.chunks;
    const replyResult = trimmedQuestion
      ? await generateQuestionReply(
          trimmedQuestion,
          body,
          field,
          staticGuidance.guidance,
          validation,
          history,
          locale,
          questionChunks
        )
      : null;
    const sources = questionKnowledge
      ? [...staticGuidance.sources, ...mapSources(questionKnowledge.chunks)]
      : staticGuidance.sources;

    res.status(200).json({
      guidance: staticGuidance.guidance,
      validation,
      reply: replyResult?.reply,
      sources,
      confidence: staticGuidance.confidence,
      aiUsed: staticGuidance.aiUsed || Boolean(replyResult?.aiUsed),
      cached: staticGuidance.cached,
    });
  } catch (error) {
    logger.error("Field guidance request failed", error as Error, {
      fieldName: field.fieldName,
    });
    res.status(500).json({ error: "Failed to generate field guidance" });
  }
});

export default router;
