import { createAdminClient } from "@/lib/supabase/admin";
import { getTravelUserSession } from "@/lib/travel/auth";
import {
  applyTravelStateOperations,
  coerceTravelState,
  TRAVEL_STATE_PATHS,
  type TravelStateOperation,
} from "@/lib/travel/conversation-state";
import {
  resolveLocalDestinationText,
  toTravelDestinationChatCard,
} from "@/lib/travel/destination-resolver";
import type {
  TravelDestinationCard,
  TravelQuickReply,
} from "@/lib/travel/chat-types";
import type { Json } from "@/types/database";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const TRAVEL_AGENT_MODEL = "gpt-5.6-sol";
const TRAVEL_AGENT_FALLBACK_MODEL = "gpt-5.5";
const MAX_USER_TEXT_LENGTH = 8_000;
let activeTravelAgentModel = TRAVEL_AGENT_MODEL;

type InterfaceLocale = "zh" | "en";
type TravelAgentIntent =
  | "answer_question"
  | "recommend_destinations"
  | "record_facts"
  | "select_destination"
  | "remove_destination"
  | "confirm_action"
  | "reject_action"
  | "modify_itinerary"
  | "clarify";

type TravelAgentModelResult = {
  intent: TravelAgentIntent;
  reply: string;
  operations: TravelStateOperation[];
  recommendations: string[];
  quickReplies: TravelQuickReply[];
  memorySummary: string;
  preferenceUpdates: Array<{
    key:
      | "interests"
      | "pace"
      | "dietary"
      | "accommodation"
      | "transport"
      | "avoid";
    value: string;
    explicit: boolean;
    evidence: string;
  }>;
};

type TravelAgentSessionRow = {
  id: string;
  state_json: Json;
  state_version: number;
  memory_summary: string;
  openai_previous_response_id: string | null;
  pending_actions_json: Json;
};

type TravelChatRequest = {
  sessionId: string;
  messageId: string;
  text: string;
  locale: InterfaceLocale;
  expectedStateVersion: number;
  applicationId: string | null;
};

type OpenAIResponseEnvelope = {
  id?: unknown;
  output_text?: unknown;
  output?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function parseRequest(value: unknown): TravelChatRequest | null {
  if (!isRecord(value)) return null;
  const sessionId =
    typeof value.sessionId === "string" ? value.sessionId.trim() : "";
  const messageId =
    typeof value.messageId === "string" ? value.messageId.trim() : "";
  const text = typeof value.text === "string" ? value.text.trim() : "";
  const expectedStateVersion =
    typeof value.expectedStateVersion === "number" &&
    Number.isInteger(value.expectedStateVersion) &&
    value.expectedStateVersion >= 0
      ? value.expectedStateVersion
      : null;

  if (
    !sessionId ||
    sessionId.length > 160 ||
    !messageId ||
    messageId.length > 160 ||
    !text ||
    text.length > MAX_USER_TEXT_LENGTH ||
    expectedStateVersion === null
  ) {
    return null;
  }

  return {
    sessionId,
    messageId,
    text,
    locale: value.locale === "en" ? "en" : "zh",
    expectedStateVersion,
    applicationId:
      typeof value.applicationId === "string" && value.applicationId.trim()
        ? value.applicationId.trim()
        : null,
  };
}

function extractOpenAIText(payload: OpenAIResponseEnvelope): string {
  if (typeof payload.output_text === "string") return payload.output_text;
  if (!Array.isArray(payload.output)) return "";
  return payload.output
    .flatMap((item) => {
      if (!isRecord(item) || !Array.isArray(item.content)) return [];
      return item.content.flatMap((content) => {
        if (!isRecord(content)) return [];
        return typeof content.text === "string" ? [content.text] : [];
      });
    })
    .join("")
    .trim();
}

function parseOperation(value: unknown): TravelStateOperation | null {
  if (!isRecord(value)) return null;
  const validOps = new Set(["set", "add", "remove", "unset", "reset"]);
  const validPaths = new Set<string>([...TRAVEL_STATE_PATHS, "trip"]);
  if (
    typeof value.op !== "string" ||
    !validOps.has(value.op) ||
    typeof value.path !== "string" ||
    !validPaths.has(value.path) ||
    typeof value.explicit !== "boolean" ||
    typeof value.evidence !== "string"
  ) {
    return null;
  }
  return {
    op: value.op as TravelStateOperation["op"],
    path: value.path as TravelStateOperation["path"],
    valueText:
      typeof value.value_text === "string" ? value.value_text.trim() : null,
    valueNumber:
      typeof value.value_number === "number" &&
      Number.isFinite(value.value_number)
        ? value.value_number
        : null,
    valueBoolean:
      typeof value.value_boolean === "boolean" ? value.value_boolean : null,
    explicit: value.explicit,
    evidence: value.evidence.trim(),
  };
}

function parseModelResult(value: unknown): TravelAgentModelResult | null {
  if (!isRecord(value)) return null;
  const intents = new Set<TravelAgentIntent>([
    "answer_question",
    "recommend_destinations",
    "record_facts",
    "select_destination",
    "remove_destination",
    "confirm_action",
    "reject_action",
    "modify_itinerary",
    "clarify",
  ]);
  if (
    typeof value.intent !== "string" ||
    !intents.has(value.intent as TravelAgentIntent) ||
    typeof value.reply !== "string" ||
    !value.reply.trim() ||
    typeof value.memory_summary !== "string" ||
    !Array.isArray(value.operations) ||
    !Array.isArray(value.recommendations) ||
    !Array.isArray(value.quick_replies) ||
    !Array.isArray(value.preference_updates)
  ) {
    return null;
  }

  const operations = value.operations.map(parseOperation);
  if (operations.some((operation) => operation === null)) return null;
  const recommendations = value.recommendations.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim())
  );
  const quickReplies = value.quick_replies.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.label !== "string" ||
      typeof item.value !== "string" ||
      !item.label.trim() ||
      !item.value.trim()
    ) {
      return [];
    }
    return [{ label: item.label.trim(), value: item.value.trim() }];
  });

  return {
    intent: value.intent as TravelAgentIntent,
    reply: value.reply.trim(),
    operations: operations as TravelStateOperation[],
    recommendations: recommendations.slice(0, 4),
    quickReplies: quickReplies.slice(0, 4),
    memorySummary: value.memory_summary.trim().slice(0, 4_000),
    preferenceUpdates: value.preference_updates.flatMap((item) => {
      const keys = [
        "interests",
        "pace",
        "dietary",
        "accommodation",
        "transport",
        "avoid",
      ];
      if (
        !isRecord(item) ||
        typeof item.key !== "string" ||
        !keys.includes(item.key) ||
        typeof item.value !== "string" ||
        !item.value.trim() ||
        typeof item.explicit !== "boolean" ||
        typeof item.evidence !== "string"
      ) {
        return [];
      }
      return [
        {
          key: item.key as TravelAgentModelResult["preferenceUpdates"][number]["key"],
          value: item.value.trim().slice(0, 500),
          explicit: item.explicit,
          evidence: item.evidence.trim(),
        },
      ];
    }),
  };
}

function outputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "intent",
      "reply",
      "operations",
      "recommendations",
      "quick_replies",
      "memory_summary",
      "preference_updates",
    ],
    properties: {
      intent: {
        type: "string",
        enum: [
          "answer_question",
          "recommend_destinations",
          "record_facts",
          "select_destination",
          "remove_destination",
          "confirm_action",
          "reject_action",
          "modify_itinerary",
          "clarify",
        ],
      },
      reply: { type: "string" },
      operations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "op",
            "path",
            "value_text",
            "value_number",
            "value_boolean",
            "explicit",
            "evidence",
          ],
          properties: {
            op: {
              type: "string",
              enum: ["set", "add", "remove", "unset", "reset"],
            },
            path: {
              type: "string",
              enum: [...TRAVEL_STATE_PATHS, "trip"],
            },
            value_text: { type: ["string", "null"] },
            value_number: { type: ["number", "null"] },
            value_boolean: { type: ["boolean", "null"] },
            explicit: { type: "boolean" },
            evidence: { type: "string" },
          },
        },
      },
      recommendations: {
        type: "array",
        maxItems: 4,
        items: { type: "string" },
      },
      quick_replies: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "value"],
          properties: {
            label: { type: "string" },
            value: { type: "string" },
          },
        },
      },
      memory_summary: { type: "string" },
      preference_updates: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "value", "explicit", "evidence"],
          properties: {
            key: {
              type: "string",
              enum: [
                "interests",
                "pace",
                "dietary",
                "accommodation",
                "transport",
                "avoid",
              ],
            },
            value: { type: "string" },
            explicit: { type: "boolean" },
            evidence: { type: "string" },
          },
        },
      },
    },
  };
}

function systemPrompt(locale: InterfaceLocale): string {
  return [
    "You are VIZA's Travel Advisor and the only intent coordinator for every user utterance.",
    `Reply in ${locale === "zh" ? "natural Simplified Chinese" : "natural English"}.`,
    "Sound warm, calm, concise, and human. Answer the user's real question first. Ask at most one essential follow-up question.",
    "Never mention schemas, state machines, payloads, enrichment, model calls, databases, or internal tools.",
    "Use the full conversation context. Resolve short replies such as '没有' and '推荐一下' against the immediately preceding question.",
    "Recommendations are display-only. If the user says they do not know where to go, recommend options but emit NO destination operation.",
    "Only emit an explicit=true operation when the user directly stated that fact or command in this turn.",
    "A direct command such as '我想去东京' selects Tokyo. A direct command such as '我不要去东京' removes Tokyo.",
    "Questions such as '多少预算合适' and requests such as '推荐一下预算' are advice requests: answer them and emit NO budget operation.",
    "If you infer a potentially useful change, emit it with explicit=false so it can wait for confirmation. Never claim it was applied.",
    "Use add/remove for cities and countries; set for scalar facts; unset to clear one fact; reset only when the user explicitly asks to restart everything.",
    "Do not create a destination from a full sentence, a question, or a broad region. Put display suggestions in recommendations.",
    "Keep memory_summary to a compact factual summary of the conversation. Do not store secrets or speculative facts.",
    "Only put a stable preference in preference_updates when the user explicitly states it this turn. Supported preferences are interests, pace, dietary needs, accommodation, transport, and things to avoid.",
  ].join("\n");
}

async function callOpenAI(args: {
  text: string;
  locale: InterfaceLocale;
  state: unknown;
  memorySummary: string;
  preferences: unknown;
  pendingActions: TravelStateOperation[];
  previousResponseId: string | null;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{ id: string; result: TravelAgentModelResult }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenAI is not configured.");

  const context = JSON.stringify({
    current_travel_state: args.state,
    conversation_summary: args.memorySummary,
    saved_preferences: args.preferences,
    pending_confirmation_actions: args.pendingActions,
  });
  const input: Array<{ role: "developer" | "user" | "assistant"; content: string }> = [
    { role: "developer", content: systemPrompt(args.locale) },
    { role: "developer", content: `Current server context:\n${context}` },
  ];
  if (!args.previousResponseId) {
    input.push(...args.history.slice(-12));
  }
  input.push({ role: "user", content: args.text });

  const requestModel = (model: string) =>
    fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        previous_response_id: args.previousResponseId ?? undefined,
        reasoning: { effort: "medium" },
        input,
        text: {
          format: {
            type: "json_schema",
            name: "travel_agent_turn",
            strict: true,
            schema: outputSchema(),
          },
        },
      }),
    });

  let response = await requestModel(activeTravelAgentModel);
  if (!response.ok && activeTravelAgentModel === TRAVEL_AGENT_MODEL) {
    const primaryDetail = await response.text();
    if (
      response.status === 403 &&
      primaryDetail.includes("model_not_found")
    ) {
      activeTravelAgentModel =
        process.env.TRAVEL_AGENT_OPENAI_FALLBACK_MODEL?.trim() ||
        TRAVEL_AGENT_FALLBACK_MODEL;
      response = await requestModel(activeTravelAgentModel);
    } else {
      throw new Error(`OpenAI ${response.status}: ${primaryDetail.slice(0, 1_000)}`);
    }
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1_000);
    throw new Error(`OpenAI ${response.status}: ${detail}`);
  }
  const envelope = (await response.json()) as OpenAIResponseEnvelope;
  const id = typeof envelope.id === "string" ? envelope.id : "";
  const outputText = extractOpenAIText(envelope);
  if (!id || !outputText) {
    throw new Error("OpenAI returned no structured output.");
  }
  try {
    const result = parseModelResult(JSON.parse(outputText) as unknown);
    if (!result) throw new Error("OpenAI output did not match the protocol.");
    return { id, result };
  } catch {
    throw new Error("OpenAI returned invalid structured output.");
  }
}

function explicitDestinationCommand(
  text: string,
  operation: TravelStateOperation,
  intent: TravelAgentIntent,
  pendingActions: TravelStateOperation[]
): boolean {
  if (intent === "confirm_action") {
    return pendingActions.some(
      (pending) =>
        pending.op === operation.op &&
        pending.path === operation.path &&
        pending.valueText?.toLocaleLowerCase() ===
          operation.valueText?.toLocaleLowerCase()
    );
  }
  const value = operation.valueText?.trim();
  if (!value || !text.toLocaleLowerCase().includes(value.toLocaleLowerCase())) {
    return false;
  }
  if (operation.op === "add") {
    return /(我想去|我要去|想去|加入|添加|选择|选|就去|目的地)/u.test(text);
  }
  if (operation.op === "remove") {
    return /(不要|不去|删除|移除|取消|撤销|去掉)/u.test(text);
  }
  return false;
}

function validateExplicitOperations(
  text: string,
  intent: TravelAgentIntent,
  operations: TravelStateOperation[],
  pendingActions: TravelStateOperation[]
): TravelStateOperation[] {
  return operations.map((operation) => {
    if (!operation.explicit) return operation;
    if (operation.path === "cities" || operation.path === "countries") {
      return {
        ...operation,
        explicit: explicitDestinationCommand(
          text,
          operation,
          intent,
          pendingActions
        ),
      };
    }
    if (operation.path === "budget") {
      return {
        ...operation,
        explicit:
          /\d/u.test(text) &&
          /(预算|花费|费用|rmb|人民币|元|budget|cost)/iu.test(text),
      };
    }
    if (operation.path === "travel_days") {
      return {
        ...operation,
        explicit: /\d+\s*(天|日|day)/iu.test(text),
      };
    }
    if (operation.path === "travelers") {
      return {
        ...operation,
        explicit: /\d+\s*(人|位|traveler|people|person)/iu.test(text),
      };
    }
    return {
      ...operation,
      explicit:
        intent === "confirm_action" ||
        (Boolean(operation.evidence) && text.includes(operation.evidence)),
    };
  });
}

function resolveDestinationOperation(
  operation: TravelStateOperation,
  locale: InterfaceLocale
): TravelStateOperation | null {
  if (
    (operation.path !== "cities" && operation.path !== "countries") ||
    !operation.valueText
  ) {
    return operation;
  }
  const resolution = resolveLocalDestinationText(operation.valueText);
  if (resolution.status !== "resolved" || !resolution.destinations.length) {
    return null;
  }
  const destination = resolution.destinations[0];
  const value =
    operation.path === "countries"
      ? destination.countryName
      : destination.city || destination.displayName;
  if (!value) return null;
  return {
    ...operation,
    valueText: locale === "zh" ? operation.valueText : value,
  };
}

function recommendationCards(
  recommendations: string[],
  userText: string
): TravelDestinationCard[] {
  const seen = new Set<string>();
  return recommendations.flatMap((recommendation) => {
    const resolution = resolveLocalDestinationText(recommendation);
    if (resolution.status !== "resolved") return [];
    return resolution.destinations.slice(0, 1).flatMap((destination) => {
      const key = destination.canonicalName.toLocaleLowerCase();
      if (seen.has(key)) return [];
      seen.add(key);
      return [
        {
          ...toTravelDestinationChatCard(destination, userText),
          selection_state: "recommendation" as const,
        },
      ];
    });
  });
}

function parsePendingActions(value: unknown): TravelStateOperation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = parseOperation(
      isRecord(item)
        ? {
            ...item,
            value_text: item.valueText,
            value_number: item.valueNumber,
            value_boolean: item.valueBoolean,
          }
        : item
    );
    return parsed ? [parsed] : [];
  });
}

async function ensureSession(
  userId: string,
  request: TravelChatRequest
): Promise<TravelAgentSessionRow> {
  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("travel_agent_sessions")
    .select(
      "id, state_json, state_version, memory_summary, openai_previous_response_id, pending_actions_json"
    )
    .eq("id", request.sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing) return existing as TravelAgentSessionRow;

  const initial = {
    id: request.sessionId,
    user_id: userId,
    application_id: request.applicationId,
    state_json: toJson(coerceTravelState(null)),
    state_version: 0,
  };
  const { data, error } = await admin
    .from("travel_agent_sessions")
    .insert(initial)
    .select(
      "id, state_json, state_version, memory_summary, openai_previous_response_id, pending_actions_json"
    )
    .single();
  if (error) {
    if (error.code === "23505") return ensureSession(userId, request);
    throw new Error(error.message);
  }
  return data as TravelAgentSessionRow;
}

async function loadRecentHistory(
  userId: string,
  sessionId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const { data, error } = await createAdminClient()
    .from("travel_agent_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .reverse()
    .flatMap((item) =>
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
        ? [{ role: item.role, content: item.content }]
        : []
    );
}

async function loadStoredResponse(
  userId: string,
  sessionId: string,
  messageId: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await createAdminClient()
    .from("travel_agent_messages")
    .select("response_json")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("external_message_id", messageId)
    .eq("role", "user")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return isRecord(data?.response_json) ? data.response_json : null;
}

async function loadPreferences(userId: string): Promise<unknown> {
  const { data, error } = await createAdminClient()
    .from("travel_user_preferences")
    .select("preferences_json")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.preferences_json ?? {};
}

async function saveExplicitPreferences(
  userId: string,
  current: unknown,
  userText: string,
  updates: TravelAgentModelResult["preferenceUpdates"]
): Promise<void> {
  const accepted = updates.filter(
    (item) =>
      item.explicit &&
      item.evidence &&
      userText.includes(item.evidence)
  );
  if (!accepted.length) return;

  const currentItems =
    isRecord(current) && Array.isArray(current.items)
      ? current.items.filter(isRecord)
      : [];
  const timestamp = new Date().toISOString();
  const byIdentity = new Map<string, Record<string, unknown>>();
  for (const item of currentItems) {
    if (typeof item.key !== "string" || typeof item.value !== "string") continue;
    byIdentity.set(
      `${item.key}:${item.value.toLocaleLowerCase()}`,
      item
    );
  }
  for (const item of accepted) {
    byIdentity.set(`${item.key}:${item.value.toLocaleLowerCase()}`, {
      id: crypto.randomUUID(),
      key: item.key,
      value: item.value,
      source: "explicit_travel_chat",
      created_at: timestamp,
    });
  }

  const { error } = await createAdminClient()
    .from("travel_user_preferences")
    .upsert(
      {
        user_id: userId,
        preferences_json: toJson({ items: Array.from(byIdentity.values()) }),
        updated_at: timestamp,
      },
      { onConflict: "user_id" }
    );
  if (error) {
    console.warn("[travel-chat] preference save skipped", error.message);
  }
}

export async function POST(request: Request) {
  const input = parseRequest(await request.json().catch(() => null));
  if (!input) {
    return Response.json(
      { error: "Invalid Travel Agent request." },
      { status: 400 }
    );
  }

  const auth = await getTravelUserSession();
  if (!auth) {
    return Response.json(
      {
        error:
          input.locale === "zh"
            ? "登录状态已过期，请重新登录后继续。你的旅行计划没有发生变化。"
            : "Your session has expired. Sign in again to continue. Your trip was not changed.",
        code: "session_expired",
      },
      { status: 401 }
    );
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return Response.json(
      {
        error:
          input.locale === "zh"
            ? "旅行顾问暂时无法回复。你的旅行计划没有发生变化。"
            : "The Travel Advisor cannot reply right now. Your trip was not changed.",
        code: "openai_not_configured",
      },
      { status: 503 }
    );
  }

  try {
    const session = await ensureSession(auth.userId, input);
    const storedResponse = await loadStoredResponse(
      auth.userId,
      input.sessionId,
      input.messageId
    );
    if (storedResponse) {
      return Response.json(storedResponse, { status: 200 });
    }
    if (session.state_version !== input.expectedStateVersion) {
      return Response.json(
        {
          error:
            input.locale === "zh"
              ? "这份旅行计划已在其他页面更新，请刷新后继续。"
              : "This trip was updated elsewhere. Refresh before continuing.",
          code: "state_version_conflict",
          state: coerceTravelState(session.state_json),
          state_version: session.state_version,
        },
        { status: 409 }
      );
    }

    const pendingActions = parsePendingActions(session.pending_actions_json);
    const [history, preferences] = await Promise.all([
      loadRecentHistory(auth.userId, input.sessionId),
      loadPreferences(auth.userId),
    ]);
    let openAI: Awaited<ReturnType<typeof callOpenAI>>;
    try {
      openAI = await callOpenAI({
        text: input.text,
        locale: input.locale,
        state: coerceTravelState(session.state_json),
        memorySummary: session.memory_summary,
        preferences,
        pendingActions,
        previousResponseId: session.openai_previous_response_id,
        history,
      });
    } catch (error) {
      console.error("[travel-chat] OpenAI failure", error);
      return Response.json(
        {
          error:
            input.locale === "zh"
              ? "旅行顾问这次没有成功回复。你的旅行计划没有发生变化。"
              : "The Travel Advisor could not complete that reply. Your trip was not changed.",
          code: "openai_request_failed",
          ...(process.env.NODE_ENV !== "production" && error instanceof Error
            ? { debug: error.message }
            : {}),
        },
        { status: 502 }
      );
    }

    const validated = validateExplicitOperations(
      input.text,
      openAI.result.intent,
      openAI.result.operations,
      pendingActions
    );
    const resolved = validated.flatMap((operation) => {
      const item = resolveDestinationOperation(operation, input.locale);
      return item ? [item] : [];
    });
    const explicitOperations = resolved.filter((operation) => operation.explicit);
    const nextPendingActions =
      openAI.result.intent === "reject_action" ||
      openAI.result.intent === "confirm_action"
        ? []
        : resolved.filter((operation) => !operation.explicit);
    const mutation = applyTravelStateOperations(
      session.state_json,
      explicitOperations
    );
    const nextVersion = session.state_version + 1;
    const responseBody = {
      reply: openAI.result.reply,
      mode: openAI.result.intent,
      cards: recommendationCards(openAI.result.recommendations, input.text),
      quick_replies: openAI.result.quickReplies,
      state: mutation.state,
      state_version: nextVersion,
      applied_operations: mutation.applied,
      pending_confirmation: nextPendingActions.length > 0,
    };

    const { data: commitData, error: commitError } = await createAdminClient().rpc(
      "commit_travel_agent_turn",
      {
        p_session_id: input.sessionId,
        p_user_id: auth.userId,
        p_external_message_id: input.messageId,
        p_expected_state_version: input.expectedStateVersion,
        p_user_content: input.text,
        p_assistant_content: openAI.result.reply,
        p_state_json: toJson(mutation.state),
        p_memory_summary: openAI.result.memorySummary,
        p_openai_response_id: openAI.id,
        p_pending_actions_json: toJson(nextPendingActions),
        p_response_json: toJson(responseBody),
      }
    );
    if (commitError) throw new Error(commitError.message);
    if (!isRecord(commitData)) throw new Error("Invalid conversation commit.");
    if (commitData.status === "conflict") {
      return Response.json(
        {
          error:
            input.locale === "zh"
              ? "这份旅行计划刚刚被更新，请重试。"
              : "This trip was just updated. Please retry.",
          code: "state_version_conflict",
          state: coerceTravelState(commitData.state),
          state_version: commitData.state_version,
        },
        { status: 409 }
      );
    }
    if (
      (commitData.status === "ok" || commitData.status === "replayed") &&
      isRecord(commitData.response)
    ) {
      if (commitData.status === "ok") {
        await saveExplicitPreferences(
          auth.userId,
          preferences,
          input.text,
          openAI.result.preferenceUpdates
        );
      }
      return Response.json(commitData.response, { status: 200 });
    }
    throw new Error("Travel conversation session is unavailable.");
  } catch (error) {
    console.error("[travel-chat] coordinator failure", error);
    return Response.json(
      {
        error:
          input.locale === "zh"
            ? "旅行会话暂时无法保存。你的旅行计划没有发生变化。"
            : "The travel conversation could not be saved. Your trip was not changed.",
        code: "travel_session_unavailable",
        ...(process.env.NODE_ENV !== "production" && error instanceof Error
          ? { debug: error.message }
          : {}),
      },
      { status: 503 }
    );
  }
}
