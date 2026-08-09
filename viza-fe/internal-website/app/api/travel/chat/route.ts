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
import { findDropdownDestinationContract } from "@/lib/travel/destination-contracts";
import type {
  TravelDestinationCard,
  TravelQuickReply,
} from "@/lib/travel/chat-types";
import { nextMissingField, type TravelField } from "@/lib/travel/planner";
import type { Json } from "@/types/database";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const TRAVEL_AGENT_MODEL = "gpt-5.6-luna";
const TRAVEL_AGENT_FALLBACK_MODEL = "gpt-5.5";
const TRAVEL_AGENT_OPENAI_TIMEOUT_MS = 60_000;
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
  | "generate_itinerary"
  | "modify_itinerary"
  | "clarify";

type TravelAgentUiAction =
  | "none"
  | "collect_field"
  | "generate_itinerary"
  | "revise_itinerary";

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
    "generate_itinerary",
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
    recommendations: recommendations.slice(0, 2),
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
          "generate_itinerary",
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
        maxItems: 2,
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
    locale === "zh"
      ? "Every user-facing sentence, question, recommendation, quick reply, country name, and city name must be Chinese. Use established Chinese place names (for example 洛杉矶, not Los Angeles); retain foreign text only when it is an official proper name with no normal Chinese translation."
      : "Keep every user-facing field in English unless an official proper name has no English form.",
    "Sound warm, calm, concise, and human. Answer the user's real question first. Ask at most one essential follow-up question.",
    "Never mention schemas, state machines, payloads, enrichment, model calls, databases, or internal tools.",
    "Use the full conversation context. Resolve short replies such as '没有' and '推荐一下' against the immediately preceding question.",
    "Recommendations are display-only. If the user says they do not know where to go, recommend options but emit NO destination operation.",
    "When recommending destinations, return exactly two distinct options.",
    "Only emit an explicit=true operation when the user directly stated that fact or command in this turn.",
    "A direct command such as '我想去东京' selects Tokyo. A direct command such as '我不要去东京' removes Tokyo.",
    "Questions such as '多少预算合适' and requests such as '推荐一下预算' are advice requests: answer them and emit NO budget operation.",
    "When the user explicitly asks you to create, arrange, generate, or show an itinerary, use intent generate_itinerary. Do not recommend a new destination when the current state already has one.",
    "The UI will collect the next required field after your answer. Do not append a second unrelated follow-up question when you are recording facts or requesting an itinerary.",
    "If you infer a potentially useful change, emit it with explicit=false so it can wait for confirmation. Never claim it was applied.",
    "Use add/remove for cities and countries; set for scalar facts; unset to clear one fact; reset only when the user explicitly asks to restart everything.",
    "For travel_order, use set with value_text containing every selected city in order, separated by Chinese commas. Set final_note to an empty string when the user explicitly says there are no extra notes.",
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
      signal: AbortSignal.timeout(
        Number.parseInt(
          process.env.TRAVEL_AGENT_OPENAI_TIMEOUT_MS ?? "",
          10
        ) || TRAVEL_AGENT_OPENAI_TIMEOUT_MS
      ),
    });

  let response = await requestModel(activeTravelAgentModel);
  if (!response.ok && activeTravelAgentModel === TRAVEL_AGENT_MODEL) {
    const primaryDetail = await response.text();
    if (
      (response.status === 403 || response.status === 404) &&
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
  if (!value || !textMentionsDestination(text, value)) {
    return false;
  }
  if (operation.op === "add") {
    if (EXPLICIT_DESTINATION_REMOVAL_PATTERN.test(text)) return false;
    return /(我想去|我要去|想去|加入|添加|选择|选|就去|改去|换成|回到|还是|决定去|目的地|\d+\s*(?:个)?人[^。！？]*去)/u.test(text);
  }
  if (operation.op === "remove") {
    return textExplicitlyRemovesDestination(
      text,
      value,
      operation.path === "cities",
    );
  }
  return false;
}

const EXPLICIT_DESTINATION_REMOVAL_PATTERN =
  /(?:不想去|不去|不要去|不要|别去|删除|删掉|移除|取消|撤销|去掉|换掉|\b(?:do not|don't|dont)\s+(?:want\b|go\s+to\b|visit\b)|\b(?:remove|delete|drop|cancel)\b)/iu;
const DESTINATION_REMOVAL_DOUBLE_NEGATIVE_PATTERN =
  /(?:不是不想去|并非不想去|不是不去|\bnot\s+that\s+i\s+(?:do not|don't|dont)\s+want\b)/iu;

function destinationMentionLabels(
  value: string,
  includeCountryLabels = false,
): string[] {
  const labels = new Set([value]);
  const contract = findDropdownDestinationContract(value);
  if (contract) {
    [
      contract.canonicalName,
      contract.nameEn,
      contract.nameZh,
      contract.city,
      ...contract.aliases,
      ...(includeCountryLabels
        ? [contract.countryNameEn, contract.countryNameZh]
        : []),
    ].forEach((label) => {
      if (label?.trim()) labels.add(label.trim());
    });
  }
  const resolution = resolveLocalDestinationText(value);
  if (resolution.status !== "resolved") return [...labels];

  for (const destination of resolution.destinations) {
    [
      destination.canonicalName,
      destination.displayName,
      destination.nameEn,
      destination.nameZh,
      destination.city,
      ...(destination.aliases ?? []),
      ...(includeCountryLabels
        ? [
            destination.countryName,
            destination.countryNameEn,
            destination.countryNameZh,
          ]
        : []),
    ].forEach((label) => {
      if (label?.trim()) labels.add(label.trim());
    });
  }
  return [...labels];
}

function textMentionsDestination(
  text: string,
  value: string,
  includeCountryLabels = false,
): boolean {
  const normalizedText = text.normalize("NFKC").toLocaleLowerCase();
  return destinationMentionLabels(value, includeCountryLabels).some((label) => {
    const normalizedLabel = label.normalize("NFKC").trim().toLocaleLowerCase();
    if (!normalizedLabel) return false;
    if (/^[a-z0-9]{1,3}$/u.test(normalizedLabel)) {
      const escaped = normalizedLabel.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
      return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "u").test(
        normalizedText,
      );
    }
    return normalizedText.includes(normalizedLabel);
  });
}

function textExplicitlyRemovesDestination(
  text: string,
  value: string,
  includeCountryLabels = false,
): boolean {
  return text
    .split(
      /(?:[，,；;。.!！？?\n]+|(?:但是|但|不过|然而)|\b(?:but|however|while)\b)/iu,
    )
    .map((clause) => clause.trim())
    .filter(Boolean)
    .some(
      (clause) =>
        EXPLICIT_DESTINATION_REMOVAL_PATTERN.test(clause) &&
        !DESTINATION_REMOVAL_DOUBLE_NEGATIVE_PATTERN.test(clause) &&
        textMentionsDestination(clause, value, includeCountryLabels),
    );
}

function reconcileExplicitDestinationRemovals(
  text: string,
  currentState: unknown,
  operations: TravelStateOperation[],
): TravelStateOperation[] {
  if (
    !EXPLICIT_DESTINATION_REMOVAL_PATTERN.test(text) ||
    DESTINATION_REMOVAL_DOUBLE_NEGATIVE_PATTERN.test(text)
  ) {
    return operations;
  }

  const state = coerceTravelState(currentState);
  const selectedDestinations: Array<{
    path: "cities" | "countries";
    value: string;
  }> = [
    ...state.cities.map((value) => ({ path: "cities" as const, value })),
    ...state.countries.map((value) => ({ path: "countries" as const, value })),
  ];
  const additions = selectedDestinations.flatMap(({ path, value }) => {
    if (!textExplicitlyRemovesDestination(text, value, path === "cities")) {
      return [];
    }
    const alreadyRemoved = operations.some(
      (operation) =>
        operation.explicit &&
        operation.op === "remove" &&
        operation.path === path &&
        operation.valueText?.toLocaleLowerCase() === value.toLocaleLowerCase(),
    );
    if (alreadyRemoved) return [];
    return [
      {
        op: "remove" as const,
        path,
        valueText: value,
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence: text,
      },
    ];
  });

  return additions.length ? [...operations, ...additions] : operations;
}

function extractExplicitDepartureDate(text: string): string | null {
  const trimmed = text.trim();
  const shortDate = trimmed.match(
    /^(?:(?:今天|明天|后天|大后天)|(?:(?:本|这|下|下下)周[一二三四五六日天末]?)|(?:(?:本|这|下|下下)个月)|(?:\d{1,2}月\d{1,2}(?:日|号))|(?:\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日)?))(?:出发)?$/u,
  )?.[0];
  if (shortDate) return shortDate.replace(/出发$/u, "").trim();

  const explicitChinese = trimmed.match(
    /(?:出发|启程)(?:时间|日期)?(?:就)?(?:定在|定为|安排在|是|为|[:：])?\s*([^，,；;。.!！？?]{2,30})/u,
  )?.[1];
  if (explicitChinese) return explicitChinese.trim();

  const explicitEnglish = trimmed.match(
    /\b(?:departure(?:\s+date)?|depart|leave|leaving)\s*(?:is|on|will\s+be|:)?\s*([^,.!?]{2,40})/iu,
  )?.[1];
  return explicitEnglish?.trim() || null;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveExplicitDepartureDate(
  value: string,
  now = new Date(),
): string | null {
  const normalized = value.trim();
  const isoMatch = normalized.match(
    /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})(?:日)?$/u,
  );
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    );
    return Number.isNaN(date.getTime()) ? null : toIsoDate(date);
  }

  const monthDayMatch = normalized.match(/^(\d{1,2})月(\d{1,2})(?:日|号)$/u);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    let year = now.getUTCFullYear();
    let date = new Date(Date.UTC(year, Number(month) - 1, Number(day)));
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    if (date < today) {
      year += 1;
      date = new Date(Date.UTC(year, Number(month) - 1, Number(day)));
    }
    return Number.isNaN(date.getTime()) ? null : toIsoDate(date);
  }

  const relativeDayOffsets: Record<string, number> = {
    今天: 0,
    明天: 1,
    后天: 2,
    大后天: 3,
  };
  if (normalized in relativeDayOffsets) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    date.setUTCDate(date.getUTCDate() + relativeDayOffsets[normalized]);
    return toIsoDate(date);
  }

  const weekMatch = normalized.match(
    /^(本|这|下|下下)周([一二三四五六日天末])?$/u,
  );
  if (weekMatch) {
    const [, weekPrefix, weekdayText] = weekMatch;
    const currentDay = now.getUTCDay() || 7;
    const monday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    monday.setUTCDate(monday.getUTCDate() - currentDay + 1);
    const weekOffset =
      weekPrefix === "下下" ? 2 : weekPrefix === "下" ? 1 : 0;
    const weekdayOffsets: Record<string, number> = {
      一: 0,
      二: 1,
      三: 2,
      四: 3,
      五: 4,
      六: 5,
      日: 6,
      天: 6,
      末: 5,
    };
    monday.setUTCDate(
      monday.getUTCDate() +
        weekOffset * 7 +
        (weekdayText ? weekdayOffsets[weekdayText] : 0),
    );
    return toIsoDate(monday);
  }

  return null;
}

function reconcileExplicitDepartureDate(
  text: string,
  operations: TravelStateOperation[],
): TravelStateOperation[] {
  const departureDateText = extractExplicitDepartureDate(text);
  if (!departureDateText) return operations;
  const departureDate =
    resolveExplicitDepartureDate(departureDateText) ?? departureDateText;
  const normalizedOperations = operations.map((operation) => {
    if (
      operation.explicit &&
      operation.op === "set" &&
      operation.path === "departure_date"
    ) {
      return { ...operation, valueText: departureDate };
    }
    if (
      operation.explicit &&
      operation.op === "set" &&
      operation.path === "date_flexibility"
    ) {
      return { ...operation, valueText: "fixed" };
    }
    return operation;
  });
  const alreadyRecorded = normalizedOperations.some(
    (operation) =>
      operation.explicit &&
      operation.op === "set" &&
      operation.path === "departure_date",
  );
  const withDepartureDate = alreadyRecorded
    ? normalizedOperations
    : [
        ...normalizedOperations,
        {
          op: "set" as const,
          path: "departure_date" as const,
          valueText: departureDate,
          valueNumber: null,
          valueBoolean: null,
          explicit: true,
          evidence: text,
        },
      ];
  const alreadyFixed = withDepartureDate.some(
    (operation) =>
      operation.explicit &&
      operation.op === "set" &&
      operation.path === "date_flexibility",
  );
  if (alreadyFixed) return withDepartureDate;
  return [
    ...withDepartureDate,
    {
      op: "set",
      path: "date_flexibility",
      valueText: "fixed",
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: text,
    },
  ];
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
        explicit: /\d+\s*(?:个\s*)?(人|位|traveler|people|person)/iu.test(text),
      };
    }
    if (operation.path === "travel_order") {
      const mentioned = (operation.valueText ?? "")
        .split(/\s*(?:、|,|，|->|→|再到|然后到|再|然后)\s*/u)
        .filter(Boolean);
      return {
        ...operation,
        explicit:
          mentioned.length > 0 &&
          mentioned.every((city) => text.includes(city)),
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

function parseExplicitDepartureDate(text: string): string | null {
  const match = text.match(
    /(?:^|\D)(\d{4})\s*(?:-|\/|\.|年)\s*(\d{1,2})\s*(?:-|\/|\.|月)\s*(\d{1,2})(?:\s*日)?(?:\D|$)/u
  );
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

/**
 * Planner cards submit visible natural-language user messages through the same
 * OpenAI coordinator as free text. Date values in those messages are also
 * normalized deterministically after the model call so harmless formatting
 * differences in model evidence (2026-10-05 vs 2026年10月5日) cannot turn an
 * explicit card confirmation into an uncommitted pending action.
 */
function stabilizeExplicitDateOperations(
  text: string,
  operations: TravelStateOperation[]
): TravelStateOperation[] {
  const explicitlySetsDate =
    /(?:出行|出发|启程)日期\s*(?:先按|是|为|设为|定在)|灵活出行|(?:departure|travel|start)\s+date\s*(?:is|to|as)|(?:depart|leave)\s+on/iu.test(
      text
    );
  const departureDate = explicitlySetsDate
    ? parseExplicitDepartureDate(text)
    : null;
  if (!departureDate) return operations;

  const flexibility = /灵活出行|日期[^。！？]{0,16}灵活|flexible/iu.test(text)
    ? "flexible"
    : /指定日期|固定日期|date\s*(?:is|to|as)|depart|leave/iu.test(text)
      ? "fixed"
      : null;
  const next = operations.filter(
    (operation) =>
      operation.path !== "departure_date" &&
      (flexibility === null || operation.path !== "date_flexibility")
  );
  next.push({
    op: "set",
    path: "departure_date",
    valueText: departureDate,
    valueNumber: null,
    valueBoolean: null,
    explicit: true,
    evidence: departureDate,
  });
  if (flexibility) {
    next.push({
      op: "set",
      path: "date_flexibility",
      valueText: flexibility,
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: flexibility === "flexible" ? "灵活出行" : departureDate,
    });
  }
  return next;
}

function stabilizeExplicitEndpointOperations(
  text: string,
  operations: TravelStateOperation[]
): TravelStateOperation[] {
  const explicitPair = text.match(
    /出发地(?:设为|：)\s*([^｜；。]+)｜([^；。]+)；\s*返程地(?:设为|：)\s*([^｜；。]+)｜([^；。]+)[。.]?/u
  );
  const legacySameEndpoint = text.match(
    /出发和返程城市都设为\s+(\S+)\s+(.+?)[。.]?$/u
  );
  const values = explicitPair
    ? {
        originCountry: explicitPair[1].trim(),
        originCity: explicitPair[2].trim(),
        returnCountry: explicitPair[3].trim(),
        returnCity: explicitPair[4].trim(),
      }
    : legacySameEndpoint
      ? {
          originCountry: legacySameEndpoint[1].trim(),
          originCity: legacySameEndpoint[2].trim(),
          returnCountry: legacySameEndpoint[1].trim(),
          returnCity: legacySameEndpoint[2].trim(),
        }
      : null;
  if (!values) return operations;

  const endpointPaths = new Set([
    "origin_country",
    "origin_city",
    "return_country",
    "return_city",
  ]);
  const next = operations.filter(
    (operation) => !endpointPaths.has(operation.path)
  );
  for (const [path, valueText] of [
    ["origin_country", values.originCountry],
    ["origin_city", values.originCity],
    ["return_country", values.returnCountry],
    ["return_city", values.returnCity],
  ] as const) {
    next.push({
      op: "set",
      path,
      valueText,
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: valueText,
    });
  }
  return next;
}

function replaceExplicitOperation(
  operations: TravelStateOperation[],
  operation: TravelStateOperation
): TravelStateOperation[] {
  return [
    ...operations.filter((item) => item.path !== operation.path),
    operation,
  ];
}

function stabilizeExplicitPlannerOperations(
  text: string,
  operations: TravelStateOperation[]
): TravelStateOperation[] {
  let next = operations;
  const setNumber = (
    path: "travel_days" | "travelers" | "budget",
    value: string,
    evidence: string
  ) => {
    const valueNumber = Number.parseInt(value, 10);
    if (!Number.isInteger(valueNumber) || valueNumber <= 0) return;
    next = replaceExplicitOperation(next, {
      op: "set",
      path,
      valueText: null,
      valueNumber,
      valueBoolean: null,
      explicit: true,
      evidence,
    });
  };

  const days = text.match(
    /(?:出行天数是|天数先灵活，?\s*暂按)\s*(\d+)\s*天/u
  );
  if (days) setNumber("travel_days", days[1], days[0]);
  const travelers = text.match(
    /(?:出行人数是|人数先灵活，?\s*暂按)\s*(\d+)\s*(?:个)?人/u
  );
  if (travelers) setNumber("travelers", travelers[1], travelers[0]);
  const budget = text.match(
    /(?:预算是|预算先灵活，?\s*暂按)\s*(\d+)\s*(?:RMB|人民币|元)/iu
  );
  if (budget) setNumber("budget", budget[1], budget[0]);

  if (/^目的地就这些，继续规划后面的行程信息。?$/u.test(text)) {
    next = replaceExplicitOperation(next, {
      op: "set",
      path: "destination_confirmed",
      valueText: null,
      valueNumber: null,
      valueBoolean: true,
      explicit: true,
      evidence: "目的地就这些",
    });
  }

  const travelOrder = text.match(/^游玩顺序：(.+?)[。.]?$/u);
  if (travelOrder) {
    next = replaceExplicitOperation(next, {
      op: "set",
      path: "travel_order",
      valueText: travelOrder[1].replace(/\s*→\s*/gu, "、"),
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: travelOrder[0],
    });
  }

  if (/^我没有额外备注，直接生成行程。?$/u.test(text)) {
    next = replaceExplicitOperation(next, {
      op: "set",
      path: "final_note",
      valueText: "",
      valueNumber: null,
      valueBoolean: null,
      explicit: true,
      evidence: "没有额外备注",
    });
  } else {
    const finalNote = text.match(/^备注：(.+)$/u);
    if (finalNote) {
      next = replaceExplicitOperation(next, {
        op: "set",
        path: "final_note",
        valueText: finalNote[1].trim(),
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence: finalNote[0],
      });
    }
  }

  return next;
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
  userText: string,
  locale: InterfaceLocale
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
          ...toTravelDestinationChatCard(destination, userText, locale),
          selection_state: "recommendation" as const,
        },
      ];
    });
  }).slice(0, 2);
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

async function readSession(
  userId: string,
  sessionId: string
): Promise<TravelAgentSessionRow | null> {
  const { data, error } = await createAdminClient()
    .from("travel_agent_sessions")
    .select(
      "id, state_json, state_version, memory_summary, openai_previous_response_id, pending_actions_json"
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TravelAgentSessionRow | null;
}

function getUiAction(
  intent: TravelAgentIntent,
  nextField: TravelField | null
): TravelAgentUiAction {
  if (nextField) return "collect_field";
  if (intent === "generate_itinerary") return "generate_itinerary";
  if (intent === "modify_itinerary") return "revise_itinerary";
  return "none";
}

function incompleteItineraryReply(
  locale: InterfaceLocale,
  nextField: TravelField
): string {
  if (locale === "en") {
    return "Absolutely. I need one more detail before I can generate the itinerary.";
  }

  const prompts: Record<TravelField, string> = {
    country: "先告诉我想去哪个国家或地区",
    cities: "先告诉我想去哪些城市",
    destination_confirmation: "先确认一下目的地是否就这些",
    departure_date: "先确认出发日期",
    travel_days: "先确认这次旅行一共几天",
    travelers: "先确认一共有几位旅行者",
    budget: "先确认这次旅行的总预算",
    origin: "先确认出发和返程城市",
    travel_order: "先确认城市游览顺序",
    flight_selection: "先确认航班安排",
    hotel_selection: "先确认酒店安排",
    final_note: "最后确认一下补充要求",
  };
  return `可以。${prompts[nextField]}，补齐后我就为你生成完整行程。`;
}

function resolveExplicitItineraryIntent(
  text: string,
  modelIntent: TravelAgentIntent
): TravelAgentIntent {
  const asksToRevise =
    /(?:修改|调整|改(?:一下|一版)?|优化|重排).{0,18}(?:行程|路线|itinerary)|(?:revise|modify|change|adjust|rework).{0,24}(?:itinerary|trip|route)/iu.test(
      text
    );
  if (asksToRevise) return "modify_itinerary";

  const asksToGenerate =
    /(?:生成|安排|规划|制定|做|给我|来).{0,24}(?:行程|路线|itinerary)|(?:generate|create|make|build|plan|show).{0,24}(?:itinerary|trip itinerary|travel plan)/iu.test(
      text
    );
  return asksToGenerate ? "generate_itinerary" : modelIntent;
}

export async function GET(request: Request) {
  const auth = await getTravelUserSession();
  if (!auth) {
    return Response.json({ error: "Unauthorized", code: "session_expired" }, { status: 401 });
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();
  if (!sessionId || sessionId.length > 160) {
    return Response.json({ error: "sessionId is required." }, { status: 400 });
  }

  try {
    const session = await readSession(auth.userId, sessionId);
    const state = coerceTravelState(session?.state_json ?? null);
    return Response.json(
      {
        exists: Boolean(session),
        state,
        state_version: session?.state_version ?? 0,
        next_missing_field: nextMissingField(state),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[travel-chat] canonical state read failure", error);
    return Response.json(
      {
        error: "Travel session state is temporarily unavailable.",
        code: "travel_session_unavailable",
      },
      { status: 503 }
    );
  }
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
    const currentState = coerceTravelState(session.state_json);
    const [history, preferences] = await Promise.all([
      loadRecentHistory(auth.userId, input.sessionId),
      loadPreferences(auth.userId),
    ]);
    let openAI: Awaited<ReturnType<typeof callOpenAI>>;
    try {
      openAI = await callOpenAI({
        text: input.text,
        locale: input.locale,
        state: currentState,
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

    const validated = stabilizeExplicitPlannerOperations(
      input.text,
      stabilizeExplicitEndpointOperations(
        input.text,
        stabilizeExplicitDateOperations(
          input.text,
          validateExplicitOperations(
            input.text,
            openAI.result.intent,
            openAI.result.operations,
            pendingActions
          )
        )
      )
    );
    const resolved = validated.flatMap((operation) => {
      const item = resolveDestinationOperation(operation, input.locale);
      return item ? [item] : [];
    });
    for (const operation of [...resolved]) {
      if (
        operation.op !== "add" ||
        operation.path !== "cities" ||
        !operation.explicit ||
        !operation.valueText
      ) {
        continue;
      }
      const destination = resolveLocalDestinationText(operation.valueText);
      const country =
        destination.status === "resolved"
          ? (input.locale === "zh"
              ? destination.destinations[0]?.countryNameZh ??
                destination.destinations[0]?.countryName
              : destination.destinations[0]?.countryNameEn ??
                destination.destinations[0]?.countryName
            )?.trim()
          : "";
      if (
        country &&
        !resolved.some(
          (item) =>
            item.op === "add" &&
            item.path === "countries" &&
            item.valueText?.toLocaleLowerCase() === country.toLocaleLowerCase()
        )
      ) {
        resolved.push({
          ...operation,
          path: "countries",
          valueText: country,
        });
      }
    }
    for (const pair of [
      { cityPath: "origin_city", countryPath: "origin_country" },
      { cityPath: "return_city", countryPath: "return_country" },
    ] as const) {
      const cityOperation = [...resolved]
        .reverse()
        .find(
          (item) =>
            item.op === "set" &&
            item.path === pair.cityPath &&
            item.explicit &&
            item.valueText
        );
      const city = cityOperation?.valueText?.trim() || currentState[pair.cityPath];
      const alreadyHasCountry = Boolean(
        resolved.some(
          (item) =>
            item.op === "set" &&
            item.path === pair.countryPath &&
            item.explicit &&
            item.valueText
        ) || currentState[pair.countryPath]
      );
      if (!city || alreadyHasCountry) continue;

      const destination = resolveLocalDestinationText(city);
      const country =
        destination.status === "resolved"
          ? (input.locale === "zh"
              ? destination.destinations[0]?.countryNameZh ??
                destination.destinations[0]?.countryName
              : destination.destinations[0]?.countryNameEn ??
                destination.destinations[0]?.countryName
            )?.trim()
          : "";
      if (!country) continue;
      resolved.push({
        op: "set",
        path: pair.countryPath,
        valueText: country,
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence: cityOperation?.evidence || city,
      });
    }
    const explicitOperations = reconcileExplicitDepartureDate(
      input.text,
      reconcileExplicitDestinationRemovals(
        input.text,
        currentState,
        resolved.filter((operation) => operation.explicit),
      ),
    );
    const nextPendingActions =
      openAI.result.intent === "reject_action" ||
      openAI.result.intent === "confirm_action"
        ? []
        : resolved.filter((operation) => !operation.explicit);
    const mutation = applyTravelStateOperations(
      session.state_json,
      explicitOperations
    );
    const effectiveIntent = resolveExplicitItineraryIntent(
      input.text,
      openAI.result.intent
    );
    const nextField = nextMissingField(mutation.state);
    const uiAction = getUiAction(effectiveIntent, nextField);
    const explicitlyRequestedRecommendations =
      /(推荐|建议|还有|其他|别的|替代|换一个|recommend|suggest|alternative|other)/iu.test(
        input.text
      );
    const allowRecommendationCards =
      effectiveIntent === "recommend_destinations" &&
      (mutation.state.cities.length === 0 || explicitlyRequestedRecommendations);
    const coordinatedReply =
      effectiveIntent === "generate_itinerary" && nextField
        ? incompleteItineraryReply(input.locale, nextField)
        : openAI.result.reply;
    const nextVersion = session.state_version + 1;
    const responseBody = {
      reply: coordinatedReply,
      mode: effectiveIntent,
      cards: allowRecommendationCards
        ? recommendationCards(openAI.result.recommendations, input.text, input.locale)
        : [],
      quick_replies: openAI.result.quickReplies,
      state: mutation.state,
      state_version: nextVersion,
      next_missing_field: nextField,
      ui_action: uiAction,
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
        p_assistant_content: coordinatedReply,
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
