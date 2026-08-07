import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateShowIf } from "@/lib/form-utils";
import { getMissingDynamicFormFields } from "@/lib/application-tab-completion";
import type { MissingApplicationField } from "@/lib/application-tab-completion";
import type { VisaFormFieldOption, VisaFormFieldRow, WizardStep } from "@/types/visa-form-fields";
import type {
  FormAssistantAppliedPatch,
  FormAssistantMessage,
  FormAssistantSource,
  FormAssistantState,
  FormAssistantTurnResponse,
} from "@/types/form-assistant";
import { SGAC_ICA_SOURCES } from "./constants";
import { getAssistantProgress } from "./validator";

const FORM_ASSISTANT_MODEL =
  process.env.OPENAI_FORM_ASSISTANT_MODEL ??
  process.env.OPENAI_CHAT_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-5.5";
const MAX_MESSAGE_LENGTH = 4_000;

type SessionRow = {
  id: string;
  schema_fingerprint: string;
  knowledge_release_key: string | null;
  state_json: Record<string, unknown> | null;
};

type ProposedPatch = {
  fieldName: string;
  value: string;
  confidence: "high" | "medium" | "low";
  modelSource?: string;
};

const PRODUCT_TIME_ZONES: Record<string, string> = {
  SG_ARRIVAL_CARD: "Asia/Singapore",
};

export function parseDirectYesNoAnswer(
  text: string,
  field: VisaFormFieldRow | undefined,
): ProposedPatch | null {
  if (!field?.options?.length) return null;
  const optionByNormalizedValue = new Map(
    field.options.map((option) => [optionValue(option).trim().toLowerCase(), optionValue(option)]),
  );
  const yesValue = optionByNormalizedValue.get("yes");
  const noValue = optionByNormalizedValue.get("no");
  if (!yesValue || !noValue) return null;

  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[。！？!?，,；;：:\s]/g, "");
  const negativeAnswers = new Set([
    "没有",
    "都没有",
    "没",
    "无",
    "否",
    "不是",
    "不",
    "没有去过",
    "未去过",
    "从未",
    "no",
    "nope",
    "none",
    "never",
    "not",
  ]);
  const positiveAnswers = new Set([
    "有",
    "是",
    "有的",
    "去过",
    "到访过",
    "yes",
    "yep",
    "yeah",
  ]);
  const value = negativeAnswers.has(normalized)
    ? noValue
    : positiveAnswers.has(normalized)
      ? yesValue
      : null;
  return value
    ? { fieldName: field.fieldName, value, confidence: "high" }
    : null;
}

async function loadApplicationKnowledge(params: {
  admin: SupabaseClient;
  releaseKey: string | null;
  country: string;
  visaType: string;
}): Promise<{ context: string; sources: FormAssistantSource[] }> {
  if (!params.releaseKey) return { context: "", sources: SGAC_ICA_SOURCES };
  const { data: release } = await params.admin
    .from("visa_knowledge_releases")
    .select("id")
    .eq("release_key", params.releaseKey)
    .eq("status", "active")
    .maybeSingle();
  if (!release) return { context: "", sources: SGAC_ICA_SOURCES };
  const { data: documents } = await params.admin
    .from("visa_documents")
    .select("id, title, source_url")
    .eq("release_id", release.id)
    .ilike("country", params.country)
    .ilike("visa_type", params.visaType)
    .limit(5);
  const documentIds = (documents ?? []).map((document) => document.id);
  if (documentIds.length === 0) return { context: "", sources: SGAC_ICA_SOURCES };
  const { data: chunks } = await params.admin
    .from("visa_chunks")
    .select("content, document_type")
    .in("document_id", documentIds)
    .in("document_type", ["form_requirements", "requirements", "process", "faq"])
    .limit(8);
  const sources = (documents ?? [])
    .map((document) => ({ title: document.title || "Official source", url: document.source_url ?? null }))
    .filter((source, index, list) => list.findIndex((item) => item.url === source.url && item.title === source.title) === index);
  return {
    context: (chunks ?? []).map((chunk) => chunk.content.slice(0, 900)).join("\n\n"),
    sources: sources.length > 0 ? sources : SGAC_ICA_SOURCES,
  };
}

function optionValue(option: VisaFormFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function optionAliases(option: VisaFormFieldOption): string[] {
  if (typeof option === "string") return [option];
  return Array.from(new Set([
    option.value,
    option.text,
    option.label_zh,
    option.label_en,
    option.official_label,
    option.searchText,
    option.code,
    option.airport,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
}

function normalizedNaturalLanguageValue(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[。！？!?，,；;：:'"“”‘’()（）\s/_-]/g, "");
}

function isoDateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days));
  return shifted.toISOString().slice(0, 10);
}

function parseRelativeDateAnswer(text: string, now: Date, timeZone: string): string | null {
  const normalized = text.trim().toLocaleLowerCase();
  const offsets: number[] = [];
  const remaining = normalized
    .replace(/大后天/g, () => { offsets.push(3); return " "; })
    .replace(/后天|day\s+after\s+tomorrow/g, () => { offsets.push(2); return " "; })
    .replace(/明天|tomorrow/g, () => { offsets.push(1); return " "; })
    .replace(/今天|today/g, () => { offsets.push(0); return " "; })
    .replace(/(?:再|过)?\s*(\d{1,3})\s*天后|in\s+(\d{1,3})\s+days?/g, (_match, zhDays, enDays) => {
      offsets.push(Number(zhDays ?? enDays));
      return " ";
    });
  if (offsets.length > 0) {
    const uniqueOffsets = Array.from(new Set(offsets));
    if (uniqueOffsets.length !== 1 || /不是|不要|not\s+/.test(remaining)) return null;
    return addIsoDays(isoDateInTimeZone(now, timeZone), uniqueOffsets[0]!);
  }

  const referenceDate = isoDateInTimeZone(now, timeZone);
  const monthDay = normalized.match(/(?:^|\D)(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)(?:\D|$)/);
  if (monthDay) {
    const year = Number(referenceDate.slice(0, 4));
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }

  const explicit = normalized.match(/(?:^|\D)(\d{4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*(?:日|号)?(?:\D|$)/);
  if (!explicit) return null;
  const year = Number(explicit[1]);
  const month = Number(explicit[2]);
  const day = Number(explicit[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDirectCurrentFieldAnswer(
  text: string,
  field: VisaFormFieldRow | undefined,
  options: { now?: Date; timeZone?: string } = {},
): ProposedPatch | null {
  if (!field) return null;
  const yesNo = parseDirectYesNoAnswer(text, field);
  if (yesNo) return { ...yesNo, modelSource: "deterministic" };

  if (field.fieldType === "date") {
    const value = parseRelativeDateAnswer(
      text,
      options.now ?? new Date(),
      options.timeZone ?? "UTC",
    );
    return value
      ? { fieldName: field.fieldName, value, confidence: "high", modelSource: "deterministic" }
      : null;
  }

  if (field.options?.length) {
    const normalized = normalizedNaturalLanguageValue(text);
    const matches = field.options.filter((option) =>
      optionAliases(option).some((alias) => normalizedNaturalLanguageValue(alias) === normalized),
    );
    if (matches.length === 1) {
      return {
        fieldName: field.fieldName,
        value: optionValue(matches[0]!),
        confidence: "high",
        modelSource: "deterministic",
      };
    }
  }
  return null;
}

function localizedLabel(field: VisaFormFieldRow, locale: string): string {
  if (locale.startsWith("zh")) {
    const label = field.validationRules?.label_zh;
    if (typeof label === "string" && label.trim()) return label.trim();
  }
  return field.label;
}

function localizeMissingFields(
  missing: MissingApplicationField[],
  fields: Map<string, VisaFormFieldRow>,
  locale: string,
): MissingApplicationField[] {
  return missing.map((item) => ({
    ...item,
    label: fields.has(item.fieldName) ? localizedLabel(fields.get(item.fieldName)!, locale) : item.label,
  }));
}

export function fingerprintSchema(steps: WizardStep[]): string {
  const manifest = steps.flatMap((step) => step.fields.map((field) => ({
    fieldName: field.fieldName,
    type: field.fieldType,
    required: field.required,
    options: field.options?.map(optionValue) ?? [],
    conditionalLogic: field.conditionalLogic,
    rules: field.validationRules,
  })));
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

async function activeKnowledgeRelease(admin: SupabaseClient, country: string, visaType: string) {
  const { data } = await admin
    .from("visa_knowledge_releases")
    .select("id, release_key")
    .eq("status", "active")
    .order("activated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const release = data as { id: string; release_key: string } | null;
  if (!release) return null;
  const { data: matchingDocument } = await admin
    .from("visa_documents")
    .select("id")
    .eq("release_id", release.id)
    .ilike("country", country)
    .ilike("visa_type", visaType)
    .limit(1)
    .maybeSingle();
  return matchingDocument ? release : null;
}

export async function getOrCreateAssistantSession(params: {
  admin: SupabaseClient;
  applicationId: string;
  applicantId: string;
  authUserId: string;
  country: string;
  visaType: string;
  steps: WizardStep[];
}): Promise<SessionRow> {
  const { data: existing, error: readError } = await params.admin
    .from("form_assistant_sessions")
    .select("id, schema_fingerprint, knowledge_release_key, state_json")
    .eq("application_id", params.applicationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const schemaFingerprint = fingerprintSchema(params.steps);
  if (existing) {
    if (existing.schema_fingerprint !== schemaFingerprint) {
      await params.admin
        .from("form_assistant_sessions")
        .update({ schema_fingerprint: schemaFingerprint, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return { ...existing, schema_fingerprint: schemaFingerprint } as SessionRow;
  }

  const release = await activeKnowledgeRelease(params.admin, params.country, params.visaType);
  const { data: created, error } = await params.admin
    .from("form_assistant_sessions")
    .insert({
      application_id: params.applicationId,
      applicant_id: params.applicantId,
      auth_user_id: params.authUserId,
      schema_fingerprint: schemaFingerprint,
      knowledge_release_id: release?.id ?? null,
      knowledge_release_key: release?.release_key ?? null,
      state_json: { optionalFieldsAcknowledged: false },
    })
    .select("id, schema_fingerprint, knowledge_release_key, state_json")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Failed to create assistant session");
  return created as SessionRow;
}

export async function loadAssistantMessages(
  admin: SupabaseClient,
  sessionId: string,
): Promise<FormAssistantMessage[]> {
  const { data, error } = await admin
    .from("form_assistant_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.created_at,
  }));
}

function buildQuestion(fields: VisaFormFieldRow[], locale: string): string {
  if (fields.length === 0) {
    return locale.startsWith("zh")
      ? "必填信息已经齐全。你可以补充仍为空的可选项，或运行最终检查。"
      : "All required information is complete. You can add optional details or run the final check.";
  }
  const field = fields[0];
  if (!field) return buildQuestion([], locale);
  const label = localizedLabel(field, locale);
  return locale.startsWith("zh")
    ? `我们一次填写一项。${label}`
    : `Let's complete one item at a time. ${label}`;
}

function buildCompletionQuestion(
  optionalFields: VisaFormFieldRow[],
  locale: string,
): string {
  if (optionalFields.length === 0) return buildQuestion([], locale);
  const label = localizedLabel(optionalFields[0], locale);
  return locale.startsWith("zh")
    ? `必填信息已经齐全。还有一项选填内容：${label}。你可以直接回答，或运行最终检查并保持为空。`
    : `All required information is complete. One optional item remains: ${label}. Answer here, or run the final check and leave it blank.`;
}

function buildTurnAcknowledgement(appliedCount: number, locale: string): string {
  if (appliedCount === 0) return "";
  return locale.startsWith("zh")
    ? "好的，已记录你刚才确认的信息。"
    : "Got it. I recorded the information you just confirmed.";
}

export function buildAssistantState(params: {
  sessionId: string;
  steps: WizardStep[];
  answers: Record<string, { value: string; source: string | null }>;
  messages: FormAssistantMessage[];
  locale: string;
}): FormAssistantState {
  const values = Object.fromEntries(Object.entries(params.answers).map(([key, item]) => [key, item.value]));
  const rawMissingFields = getMissingDynamicFormFields(params.steps, values);
  const fieldByName = new Map(params.steps.flatMap((step) => step.fields).map((field) => [field.fieldName, field]));
  const missingFields = localizeMissingFields(rawMissingFields, fieldByName, params.locale);
  const nextFields = missingFields.slice(0, 1).map((item) => fieldByName.get(item.fieldName)).filter(Boolean) as VisaFormFieldRow[];
  const optionalFields = params.steps.flatMap((step) => step.fields.filter((field) =>
    !field.required && !values[field.fieldName]?.trim() && evaluateShowIf(field, values, step.fields),
  ));
  const assistantMessage = missingFields.length > 0
    ? buildQuestion(nextFields, params.locale)
    : buildCompletionQuestion(optionalFields, params.locale);
  return {
    enabled: true,
    sessionId: params.sessionId,
    assistantMessage,
    messages: params.messages,
    appliedPatches: [],
    skippedConflicts: [],
    missingFields,
    progress: getAssistantProgress(params.steps, values),
    sources: SGAC_ICA_SOURCES,
    canRunFinalCheck: missingFields.length === 0,
    aiFilledFieldNames: Object.entries(params.answers)
      .filter(([, item]) => item.source === "form_assistant")
      .map(([fieldName]) => fieldName),
  };
}

function parseOpenAiText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ text?: unknown }> }> };
  if (typeof response.output_text === "string") return response.output_text;
  return response.output?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .filter((value): value is string => typeof value === "string")
    .join("\n") ?? "";
}

async function proposeTurn(params: {
  text: string;
  locale: string;
  candidates: VisaFormFieldRow[];
  currentField: VisaFormFieldRow | undefined;
  answers: Record<string, string>;
  knowledgeContext: string;
  referenceDate: string;
  timeZone: string;
}): Promise<{ reply: string; patches: ProposedPatch[] }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const fallback = "";
  if (!apiKey || apiKey === "your_openai_api_key_here" || params.candidates.length === 0) {
    return { reply: fallback, patches: [] };
  }

  const candidateManifest = params.candidates.map((field) => ({
    fieldName: field.fieldName,
    label: localizedLabel(field, params.locale),
    type: field.fieldType,
    exactOptions: field.options?.slice(0, 250).map((option) => ({
      value: optionValue(option),
      aliases: optionAliases(option),
    })) ?? [],
    pattern: typeof field.validationRules?.pattern === "string" ? field.validationRules.pattern : null,
  }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: FORM_ASSISTANT_MODEL,
        max_output_tokens: 1_000,
        instructions: params.locale.startsWith("zh")
          ? "你是表单填写助手。专业、温和、简洁。SG Arrival Card 不是签证，不要冒充签证官。理解用户的自然语言并转换为表单的官方标准值，但不得猜测。相对日期必须以 referenceDate 和 timeZone 计算：例如“明天”是 referenceDate 加一天；这种唯一明确的相对日期应标为 high，并输出 YYYY-MM-DD。下拉值必须使用 exactOptions 中的 value，可用 aliases 理解中文、英文、简称或翻译。只能输出 manifest 中的字段。确有多种解释的姓名、日期、证件号或选项才标为 medium/low。reply 只简短确认本轮理解到的内容，不得询问后续字段；服务端会单独追加下一问题。返回严格 JSON。"
          : "You are a professional, warm and concise form-filling assistant. The SG Arrival Card is not a visa; never impersonate an officer. Understand natural-language answers and convert them to official form values without guessing. Resolve relative dates from referenceDate in timeZone: for example, tomorrow is referenceDate plus one day; an unambiguous relative date is high confidence and must be returned as YYYY-MM-DD. Dropdown values must use exactOptions[].value, matching Chinese, English, abbreviations, or translations through aliases. Return only manifest fields. Mark a name, date, document number, or option medium/low only when it genuinely has multiple interpretations. The reply only briefly acknowledges this turn and never asks later fields because the server appends the next question. Return strict JSON.",
        input: JSON.stringify({
          userMessage: params.text,
          referenceDate: params.referenceDate,
          timeZone: params.timeZone,
          currentQuestion: params.currentField
            ? {
                fieldName: params.currentField.fieldName,
                label: localizedLabel(params.currentField, params.locale),
              }
            : null,
          missingFieldManifest: candidateManifest,
          productKnowledge: params.knowledgeContext,
        }),
        text: {
          format: {
            type: "json_schema",
            name: "form_assistant_turn",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: { type: "string" },
                patches: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      fieldName: { type: "string" },
                      value: { type: "string" },
                      confidence: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["fieldName", "value", "confidence"],
                  },
                },
              },
              required: ["reply", "patches"],
            },
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { reply: fallback, patches: [] };
    const raw = parseOpenAiText(await response.json());
    const parsed = JSON.parse(raw) as { reply?: unknown; patches?: unknown };
    return {
      reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : fallback,
      patches: Array.isArray(parsed.patches) ? parsed.patches as ProposedPatch[] : [],
    };
  } catch {
    return { reply: fallback, patches: [] };
  } finally {
    clearTimeout(timeout);
  }
}

function validateProposal(field: VisaFormFieldRow, patch: ProposedPatch): boolean {
  if (patch.confidence !== "high" || !patch.value?.trim()) return false;
  if (field.fieldType === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(patch.value)) return false;
  if (field.options?.length && !field.options.map(optionValue).includes(patch.value)) return false;
  const pattern = field.validationRules?.pattern;
  if (typeof pattern === "string") {
    try {
      if (!new RegExp(pattern).test(patch.value)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

async function persistMessage(params: {
  admin: SupabaseClient;
  sessionId: string;
  applicationId: string;
  applicantId: string;
  authUserId: string;
  idempotencyKey: string;
  role: "user" | "assistant";
  content: string;
  inputMode: "text" | "voice" | "system";
  responseJson?: Record<string, unknown>;
}) {
  const { data, error } = await params.admin
    .from("form_assistant_messages")
    .upsert({
      session_id: params.sessionId,
      application_id: params.applicationId,
      applicant_id: params.applicantId,
      auth_user_id: params.authUserId,
      idempotency_key: params.idempotencyKey,
      role: params.role,
      content: params.content,
      input_mode: params.inputMode,
      response_json: params.responseJson ?? {},
    }, { onConflict: "session_id,idempotency_key,role", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

export async function runAssistantTurn(params: {
  admin: SupabaseClient;
  session: SessionRow;
  applicationId: string;
  applicantId: string;
  authUserId: string;
  steps: WizardStep[];
  answers: Record<string, { value: string; source: string | null }>;
  text: string;
  locale: string;
  inputMode: "text" | "voice";
  idempotencyKey: string;
  country: string;
  visaType: string;
}): Promise<FormAssistantTurnResponse> {
  const message = params.text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!message) throw new Error("Message is required");
  const { data: priorResponse } = await params.admin
    .from("form_assistant_messages")
    .select("response_json")
    .eq("session_id", params.session.id)
    .eq("idempotency_key", params.idempotencyKey)
    .eq("role", "assistant")
    .maybeSingle();
  if (priorResponse?.response_json) {
    return priorResponse.response_json as FormAssistantTurnResponse;
  }
  const existingValues = Object.fromEntries(Object.entries(params.answers).map(([key, item]) => [key, item.value]));
  const missing = getMissingDynamicFormFields(params.steps, existingValues);
  const allFields = params.steps.flatMap((step) => step.fields);
  const fieldByName = new Map(allFields.map((field) => [field.fieldName, field]));
  const missingNames = new Set(missing.map((item) => item.fieldName));
  const optionalNames = new Set(allFields.filter((field) => {
    const stepFields = params.steps.find((step) => step.fields.includes(field))?.fields ?? allFields;
    return !field.required && !existingValues[field.fieldName]?.trim() && evaluateShowIf(field, existingValues, stepFields);
  }).map((field) => field.fieldName));
  const currentField = missing.length > 0
    ? fieldByName.get(missing[0]?.fieldName ?? "")
    : allFields.find((field) => optionalNames.has(field.fieldName));
  const visibleCandidatePool = allFields.filter((field) => {
    const stepFields = params.steps.find((step) => step.fields.includes(field))?.fields ?? allFields;
    if (!evaluateShowIf(field, existingValues, stepFields)) return false;
    // The model sees only currently missing fields plus fields that the
    // assistant previously filled and the user may now explicitly correct.
    return missingNames.has(field.fieldName) ||
      (missingNames.size === 0 && optionalNames.has(field.fieldName)) ||
      params.answers[field.fieldName]?.source === "form_assistant";
  });
  const visibleCandidates = [
    ...(currentField && visibleCandidatePool.includes(currentField) ? [currentField] : []),
    ...visibleCandidatePool.filter((field) => field !== currentField),
  ].slice(0, 5);

  const userMessageId = await persistMessage({
    ...params,
    sessionId: params.session.id,
    role: "user",
    content: message,
  });
  if (!userMessageId) {
    const { data: completedTurn } = await params.admin
      .from("form_assistant_messages")
      .select("response_json")
      .eq("session_id", params.session.id)
      .eq("idempotency_key", params.idempotencyKey)
      .eq("role", "assistant")
      .maybeSingle();
    if (completedTurn?.response_json) {
      return completedTurn.response_json as FormAssistantTurnResponse;
    }
    throw new Error("FORM_ASSISTANT_TURN_IN_PROGRESS");
  }
  const knowledge = await loadApplicationKnowledge({
    admin: params.admin,
    releaseKey: params.session.knowledge_release_key,
    country: params.country,
    visaType: params.visaType,
  });
  const timeZone = PRODUCT_TIME_ZONES[params.visaType] ?? "UTC";
  const referenceDate = isoDateInTimeZone(new Date(), timeZone);
  const directChoice = parseDirectCurrentFieldAnswer(message, currentField, { timeZone });
  const proposed = directChoice
    ? { reply: "", patches: [directChoice] }
    : await proposeTurn({
        text: message,
        locale: params.locale,
        candidates: visibleCandidates,
        currentField,
        answers: existingValues,
        knowledgeContext: knowledge.context,
        referenceDate,
        timeZone,
      });

  const appliedPatches: FormAssistantAppliedPatch[] = [];
  const skippedConflicts: string[] = [];
  const assistantMessageId = randomUUID();
  for (const patch of proposed.patches) {
    const field = fieldByName.get(patch.fieldName);
    if (!field || !validateProposal(field, patch)) continue;
    const current = params.answers[patch.fieldName];
    if (current?.value && current.source !== "form_assistant") {
      skippedConflicts.push(patch.fieldName);
      continue;
    }
    const provenance = {
      assistantSessionId: params.session.id,
      assistantMessageId,
      sourceKind: "user_chat",
      confidence: "high",
      model: patch.modelSource ?? FORM_ASSISTANT_MODEL,
      previousValue: current?.source === "form_assistant" ? current.value : null,
    };
    if (current?.source === "form_assistant") {
      const { data, error } = await params.admin
        .from("visa_application_answers")
        .update({ value_text: patch.value, source_metadata: provenance, updated_at: new Date().toISOString() })
        .eq("application_id", params.applicationId)
        .eq("field_name", patch.fieldName)
        .eq("source", "form_assistant")
        .select("field_name")
        .maybeSingle();
      if (error || !data) {
        skippedConflicts.push(patch.fieldName);
        continue;
      }
    } else {
      const { error } = await params.admin.from("visa_application_answers").insert({
        application_id: params.applicationId,
        field_name: patch.fieldName,
        value_text: patch.value,
        source: "form_assistant",
        source_metadata: provenance,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        skippedConflicts.push(patch.fieldName);
        continue;
      }
    }
    params.answers[patch.fieldName] = { value: patch.value, source: "form_assistant" };
    appliedPatches.push({
      fieldName: patch.fieldName,
      value: patch.value,
      sourceKind: "user_chat",
      confidence: "high",
    });
  }

  const nextValues = Object.fromEntries(Object.entries(params.answers).map(([key, item]) => [key, item.value]));
  const nextMissing = localizeMissingFields(
    getMissingDynamicFormFields(params.steps, nextValues),
    fieldByName,
    params.locale,
  );
  const nextFields = nextMissing.slice(0, 1).map((item) => fieldByName.get(item.fieldName)).filter(Boolean) as VisaFormFieldRow[];
  const optionalFields = params.steps.flatMap((step) => step.fields.filter((field) =>
    !field.required && !nextValues[field.fieldName]?.trim() && evaluateShowIf(field, nextValues, step.fields),
  ));
  const nextQuestion = nextMissing.length > 0
    ? buildQuestion(nextFields, params.locale)
    : buildCompletionQuestion(optionalFields, params.locale);
  const assistantMessage = [
    buildTurnAcknowledgement(appliedPatches.length, params.locale),
    nextQuestion,
  ].filter(Boolean).join("\n\n");
  const response: FormAssistantTurnResponse = {
    sessionId: params.session.id,
    assistantMessage,
    appliedPatches,
    skippedConflicts,
    missingFields: nextMissing,
    progress: getAssistantProgress(params.steps, nextValues),
    sources: knowledge.sources,
    canRunFinalCheck: nextMissing.length === 0,
  };
  await persistMessage({
    ...params,
    sessionId: params.session.id,
    idempotencyKey: params.idempotencyKey,
    role: "assistant",
    content: assistantMessage,
    inputMode: "system",
    responseJson: response as unknown as Record<string, unknown>,
  });
  await params.admin
    .from("form_assistant_sessions")
    .update({
      state_json: { missingFields: nextMissing, progress: response.progress },
      state_version: Date.now(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.session.id);
  return response;
}
