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
};

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
  const items = fields.map((field, index) => `${index + 1}. ${localizedLabel(field, locale)}`).join("\n");
  return locale.startsWith("zh")
    ? `我检查了当前表单。请回答下面这些尚缺的信息（可一次回复）：\n${items}`
    : `I checked the current form. Please answer these missing items in one message if convenient:\n${items}`;
}

function buildCompletionQuestion(
  optionalFields: VisaFormFieldRow[],
  locale: string,
): string {
  if (optionalFields.length === 0) return buildQuestion([], locale);
  const items = optionalFields.map((field) => localizedLabel(field, locale)).join(locale.startsWith("zh") ? "、" : ", ");
  return locale.startsWith("zh")
    ? `必填信息已经齐全。以下可选项仍为空：${items}。你可以补充，或确认保持空白后运行最终检查。`
    : `All required information is complete. These optional items are still blank: ${items}. Add any you want, or leave them blank and run the final check.`;
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
  const nextFields = missingFields.slice(0, 5).map((item) => fieldByName.get(item.fieldName)).filter(Boolean) as VisaFormFieldRow[];
  const optionalFields = params.steps.flatMap((step) => step.fields.filter((field) =>
    !field.required && !values[field.fieldName]?.trim() && evaluateShowIf(field, values, step.fields),
  ));
  const assistantMessage = params.messages.at(-1)?.role === "assistant"
    ? params.messages.at(-1)!.content
    : missingFields.length > 0
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
  answers: Record<string, string>;
  knowledgeContext: string;
}): Promise<{ reply: string; patches: ProposedPatch[] }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const fallback = buildQuestion(params.candidates.slice(0, 5), params.locale);
  if (!apiKey || apiKey === "your_openai_api_key_here" || params.candidates.length === 0) {
    return { reply: fallback, patches: [] };
  }

  const candidateManifest = params.candidates.map((field) => ({
    fieldName: field.fieldName,
    label: localizedLabel(field, params.locale),
    type: field.fieldType,
    exactOptions: field.options?.slice(0, 250).map(optionValue) ?? [],
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
          ? "你是表单填写助手。专业、温和、简洁。SG Arrival Card 不是签证，不要冒充签证官。只从用户本条消息明确提供的信息提取答案，不猜测。只能输出 manifest 中的字段；下拉值必须等于 exactOptions 中的 value。姓名、日期、证件号如有任何歧义，标为 medium/low。每轮接着询问 3–5 个缺失项。返回严格 JSON。"
          : "You are a professional, warm and concise form-filling assistant. The SG Arrival Card is not a visa; never impersonate an officer. Extract only facts explicitly provided in this user message and never guess. Return only manifest fields. Dropdown values must exactly equal an exactOptions value. Mark ambiguous names, dates, and document numbers medium/low. Ask the next 3-5 missing items. Return strict JSON.",
        input: JSON.stringify({
          userMessage: params.text,
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
  const visibleCandidates = allFields.filter((field) => {
    const stepFields = params.steps.find((step) => step.fields.includes(field))?.fields ?? allFields;
    if (!evaluateShowIf(field, existingValues, stepFields)) return false;
    // The model sees only currently missing fields plus fields that the
    // assistant previously filled and the user may now explicitly correct.
    return missingNames.has(field.fieldName) || params.answers[field.fieldName]?.source === "form_assistant";
  });

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
  const proposed = await proposeTurn({
    text: message,
    locale: params.locale,
    candidates: visibleCandidates,
    answers: existingValues,
    knowledgeContext: knowledge.context,
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
      model: FORM_ASSISTANT_MODEL,
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
  const nextFields = nextMissing.slice(0, 5).map((item) => fieldByName.get(item.fieldName)).filter(Boolean) as VisaFormFieldRow[];
  const optionalFields = params.steps.flatMap((step) => step.fields.filter((field) =>
    !field.required && !nextValues[field.fieldName]?.trim() && evaluateShowIf(field, nextValues, step.fields),
  ));
  const assistantMessage = nextMissing.length > 0
    ? [proposed.reply.trim(), buildQuestion(nextFields, params.locale)].filter(Boolean).join("\n\n")
    : buildCompletionQuestion(optionalFields, params.locale);
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
