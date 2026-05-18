/**
 * Field-level AI guidance for dynamic visa forms.
 *
 * POST /api/field-guidance
 */

import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import {
  retrieveVisaKnowledge,
  type VisaKnowledgeChunk,
} from "../services/visa-knowledge.service.js";
import { Logger } from "../utils/logger.js";

const router = Router();
const logger = new Logger({ serviceName: "FieldGuidance" });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GUIDANCE_CACHE = new Map<string, CachedGuidance>();

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
  confidence: Confidence;
  aiUsed: boolean;
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

function getLocale(locale?: string | null): "zh" | "en" {
  return locale?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function cacheKey(
  visaType: string | null | undefined,
  fieldName: string,
  locale: string | null | undefined
): string {
  return `${visaType ?? "unknown"}:${fieldName}:${getLocale(locale)}`;
}

function makeTitle(field: FieldGuidanceField, locale: "zh" | "en"): string {
  return locale === "zh"
    ? `${field.label} 填写帮助`
    : `${field.label} guidance`;
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

function deterministicExamples(field: FieldGuidanceField): string[] {
  const name = field.fieldName.toLowerCase();
  const label = field.label.toLowerCase();
  const options = normalizeOptions(field.options);

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

  if (includesAny(combined, ["surname", "given", "full name", "passport"])) {
    warnings.push(
      locale === "zh"
        ? "姓名和护照号码必须与护照机读区或资料页一致。"
        : "Names and passport numbers must match the passport bio page or MRZ."
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

  return hints;
}

function buildDeterministicGuidance(
  field: FieldGuidanceField,
  locale: "zh" | "en"
): GuidanceBody {
  return {
    title: makeTitle(field, locale),
    summary:
      locale === "zh"
        ? "按官方表格含义填写，并确保答案和证件、行程、其他表格答案保持一致。"
        : "Answer this according to the official form meaning and keep it consistent with documents, travel plans, and related answers.",
    examples: deterministicExamples(field),
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

function extractTextContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
      return block.text;
    }
  }
  return "";
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

function parseDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "DO_NOT_KNOW" || trimmed === "DOES_NOT_APPLY") return null;

  const iso = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  const official = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  const chinese = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);

  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  if (official) {
    return new Date(Number(official[3]), Number(official[2]) - 1, Number(official[1]));
  }
  if (chinese) {
    return new Date(Number(chinese[1]), Number(chinese[2]) - 1, Number(chinese[3]));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function findAnswer(
  allAnswers: Record<string, string>,
  candidates: string[]
): string | null {
  for (const candidate of candidates) {
    const direct = allAnswers[candidate];
    if (typeof direct === "string" && direct.trim()) return direct;
  }

  const entries = Object.entries(allAnswers);
  for (const candidate of candidates) {
    const found = entries.find(([key, value]) =>
      key.toLowerCase().includes(candidate.toLowerCase()) && value.trim()
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
  if ((field.fieldType === "select" || field.fieldType === "radio") && trimmed && options.length > 0) {
    const matches = options.some(
      (option) =>
        option.value.toLowerCase() === trimmed.toLowerCase() ||
        option.text.toLowerCase() === trimmed.toLowerCase()
    );
    if (!matches) {
      error("此答案不是该题目的可选项。", "This answer is not one of the available options.");
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
    findAnswer(allAnswers, [
      "passport_issuance_date",
      "passport_issue_date",
      "travel_document_issue_date",
      "issue_date",
    ])
  );
  const expiry = parseDate(
    findAnswer(allAnswers, [
      "passport_expiration_date",
      "passport_expiry_date",
      "travel_document_expiry_date",
      "expiry_date",
      "valid_until",
    ])
  );
  if (issue && expiry && expiry <= issue) {
    error("证件到期日必须晚于签发日。", "The document expiry date must be after the issue date.");
  }

  const arrival = parseDate(findAnswer(allAnswers, ["arrival_date", "intended_arrival_date", "entry_date"]));
  const departure = parseDate(findAnswer(allAnswers, ["departure_date", "intended_departure_date", "exit_date"]));
  if (arrival && departure && departure <= arrival) {
    error("离境日期必须晚于入境日期。", "Departure date must be after arrival date.");
  }
  if (arrival && expiry && expiry < arrival) {
    error("护照/旅行证件在入境前已过期。", "The passport or travel document expires before arrival.");
  } else if (arrival && expiry && expiry < addMonths(arrival, 6)) {
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
    currentNationality.toLowerCase() !== nationalityAtBirth.toLowerCase()
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
  field: FieldGuidanceField,
  locale: "zh" | "en",
  chunks: VisaKnowledgeChunk[]
): Promise<AiGuidanceJson | null> {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your_anthropic_api_key_here") {
    return null;
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const context = chunks
    .slice(0, 5)
    .map((chunk, index) => `Source ${index + 1}: ${chunk.content.slice(0, 1200)}`)
    .join("\n\n");

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      system: `You are a visa form field copilot. Return only JSON with keys summary, examples, hints, officialWarnings, formatHints, confidence. Use ${locale === "zh" ? "Simplified Chinese" : "English"}. Plain text only inside JSON values: do not use Markdown headings, bold, bullets, code formatting, or tables. Do not invent legal requirements not supported by the field metadata or context.`,
      messages: [
        {
          role: "user",
          content: `Field metadata:\n${JSON.stringify(field, null, 2)}\n\nRelevant source context:\n${context || "No source context found."}`,
        },
      ],
    });

    const parsed = parseJsonObject(extractTextContent(message.content));
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
  field: FieldGuidanceField,
  guidance: GuidanceBody,
  validation: ValidationBody,
  locale: "zh" | "en",
  chunks: VisaKnowledgeChunk[]
): Promise<{ reply: string; aiUsed: boolean }> {
  const fallback =
    locale === "zh"
      ? `关于“${field.label}”：${guidance.summary} 可以参考示例：${guidance.examples.slice(0, 2).join("；")}。${validation.messages[0] ?? ""}`
      : `For "${field.label}": ${guidance.summary} Examples: ${guidance.examples.slice(0, 2).join("; ")}. ${validation.messages[0] ?? ""}`;

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your_anthropic_api_key_here") {
    return { reply: fallback, aiUsed: false };
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const context = chunks
    .slice(0, 3)
    .map((chunk, index) => `Source ${index + 1}: ${chunk.content.slice(0, 900)}`)
    .join("\n\n");

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 350,
      system: `You answer user questions about one visa form field. Use ${locale === "zh" ? "Simplified Chinese" : "English"}. Be concise, practical, and cite uncertainty when the source context is thin. Use plain chat text only: no Markdown headings, bold, bullets, numbered lists, code formatting, or tables.`,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\n\nField: ${JSON.stringify(field)}\n\nCurrent guidance: ${JSON.stringify(guidance)}\n\nValidation: ${JSON.stringify(validation)}\n\nRelevant context:\n${context || "No source context found."}`,
        },
      ],
    });

    const reply = stripMarkdown(extractTextContent(message.content).trim());
    return { reply: reply || fallback, aiUsed: Boolean(reply) };
  } catch (error) {
    logger.warn("AI field question reply failed", error as Error, {
      fieldName: field.fieldName,
    });
    return { reply: fallback, aiUsed: false };
  }
}

async function getStaticGuidance(
  reqBody: FieldGuidanceRequest,
  field: FieldGuidanceField,
  locale: "zh" | "en"
): Promise<CachedGuidance & { cached: boolean; chunks: VisaKnowledgeChunk[] }> {
  const key = cacheKey(reqBody.visaType, field.fieldName, reqBody.locale);
  const cached = GUIDANCE_CACHE.get(key);
  if (cached) {
    return { ...cached, cached: true, chunks: [] };
  }

  const query = [
    field.stepName,
    field.label,
    field.fieldName,
    field.placeholder,
    "visa application form field requirements examples warnings",
  ]
    .filter(Boolean)
    .join(" ");

  const knowledge = await retrieveVisaKnowledge({
    query,
    country: reqBody.country,
    visaType: reqBody.visaType,
    intent: "form_intake",
    matchCount: 5,
  });

  const base = buildDeterministicGuidance(field, locale);
  const ai = await generateAiGuidance(field, locale, knowledge.chunks);
  const merged = ai ? mergeGuidance(base, ai, field, locale) : base;
  const guidance = {
    ...merged,
    examples: merged.examples.length > 0 ? merged.examples : base.examples,
    hints: merged.hints.length > 0 ? merged.hints : base.hints,
    officialWarnings:
      merged.officialWarnings.length > 0 ? merged.officialWarnings : base.officialWarnings,
    formatHints: merged.formatHints.length > 0 ? merged.formatHints : base.formatHints,
  };
  const sources = mapSources(knowledge.chunks);
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
    const trimmedQuestion = body.question?.trim();
    const replyResult = trimmedQuestion
      ? await generateQuestionReply(
          trimmedQuestion,
          field,
          staticGuidance.guidance,
          validation,
          locale,
          staticGuidance.chunks
        )
      : null;

    res.status(200).json({
      guidance: staticGuidance.guidance,
      validation,
      reply: replyResult?.reply,
      sources: staticGuidance.sources,
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
