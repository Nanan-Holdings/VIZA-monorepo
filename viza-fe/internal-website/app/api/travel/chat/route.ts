import { forwardJsonToTravelBackend } from "@/lib/travel/backend";
import {
  buildTravelCandidatePayload,
  resolveLocalDestinationText,
  toTravelDestinationChatCard,
  type DestinationResolution,
  type TravelDestinationPipelineDebug,
  type TravelDestinationSearchResult,
} from "@/lib/travel/destination-resolver";
import type { TravelDestinationCard } from "@/lib/travel/chat-types";

type TravelAgentChatResponse = {
  reply?: string;
  mode?: string;
  quick_replies?: Array<{ label: string; value: string }>;
  cards?: TravelDestinationCard[];
  candidate_payload?: Record<string, unknown>;
  sources?: Array<{ id?: string; title?: string; type?: string }>;
  debug?: {
    travel_pipeline?: TravelDestinationPipelineDebug;
  };
};

type TravelSlotParseResult = {
  action: "update_fields" | "choose_destination" | "ask_clarification" | "ignore";
  confidence: number;
  should_create_destination_card: boolean;
  destination_query: string | null;
  fields: {
    travel_days?: number | null;
    travelers?: number | null;
    budget?: number | null;
    departure_date?: string | null;
    date_flexibility?: string | null;
    origin_country?: string | null;
    origin_city?: string | null;
    return_country?: string | null;
    return_city?: string | null;
  };
  reply_zh?: string | null;
  reply_en?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function latestUserText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) return "";

  for (let index = payload.messages.length - 1; index >= 0; index -= 1) {
    const message = payload.messages[index] as unknown;
    if (!isRecord(message) || message.role !== "user") continue;
    if (typeof message.content === "string" && message.content.trim()) {
      return message.content.trim();
    }

    if (Array.isArray(message.parts)) {
      const text = message.parts
        .map((part): string => {
          if (!isRecord(part) || part.type !== "text") return "";
          return typeof part.text === "string" ? part.text : "";
        })
        .join("\n")
        .trim();
      if (text) return text;
    }
  }

  return "";
}

function latestTravelState(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload) || !isRecord(payload.state)) return {};
  return payload.state;
}

function payloadLocale(payload: unknown): "zh" | "en" {
  if (!isRecord(payload)) return "zh";
  return payload.locale === "en" ? "en" : "zh";
}

function hasExistingTripContext(state: Record<string, unknown>): boolean {
  return (
    (Array.isArray(state.cities) && state.cities.length > 0) ||
    (Array.isArray(state.countries) && state.countries.length > 0) ||
    typeof state.country === "string" ||
    typeof state.city === "string"
  );
}

function extractOpenAIText(payload: unknown): string {
  if (!isRecord(payload)) return "";
  if (typeof payload.output_text === "string") return payload.output_text;
  if (!Array.isArray(payload.output)) return "";

  return payload.output
    .flatMap((item) => {
      if (!isRecord(item) || !Array.isArray(item.content)) return [];
      return item.content.map((content) => {
        if (!isRecord(content)) return "";
        if (typeof content.text === "string") return content.text;
        if (typeof content.output_text === "string") return content.output_text;
        return "";
      });
    })
    .join("")
    .trim();
}

function parseChineseSmallNumber(value: string): number | null {
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const numbers: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  return numbers[normalized] ?? null;
}

function extractTravelersFromText(text: string): number | null {
  const match = text.match(
    /(?:一共|总共|共|合计)?\s*([0-9]{1,3}|[一二两三四五六七八九十])\s*(?:个)?(?:人|位|名|travellers?|travelers?|people|adults?)/i
  );
  if (!match?.[1]) return null;
  const value = parseChineseSmallNumber(match[1]);
  if (!value || value < 1 || value > 99) return null;
  return value;
}

function extractBudgetFromText(text: string): number | null {
  const normalized = text.replace(/[,，]/g, "");
  const budgetMatch = normalized.match(
    /(?:预算|budget|花费|费用|大概|一共|总共)?\s*(?:是|为|:|：)?\s*(?:人民币|rmb|cny|¥)?\s*([0-9]{2,9})(?:\s*(万))?\s*(?:人民币|rmb|cny|元|块|¥)?/i
  );
  if (!budgetMatch?.[1]) return null;
  const hasBudgetCue = /(预算|budget|花费|费用|人民币|rmb|cny|元|块|¥)/i.test(
    normalized
  );
  if (!hasBudgetCue) return null;
  const value = Number(budgetMatch[1]) * (budgetMatch[2] ? 10000 : 1);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function extractTravelDaysFromText(text: string): number | null {
  const match = text.match(/([0-9]{1,2}|[一二两三四五六七八九十])\s*(?:天|日|days?)/i);
  if (!match?.[1]) return null;
  const value = parseChineseSmallNumber(match[1]);
  if (!value || value < 1 || value > 60) return null;
  return value;
}

function extractDepartureDateFromText(text: string): string | null {
  const isoMatch = text.match(/\b(20\d{2}-\d{1,2}-\d{1,2})\b/);
  if (isoMatch?.[1]) return isoMatch[1];
  const monthDayMatch = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/);
  if (!monthDayMatch) return null;
  const month = monthDayMatch[1].padStart(2, "0");
  const day = monthDayMatch[2].padStart(2, "0");
  return `2026-${month}-${day}`;
}

function hasParsedFields(result: TravelSlotParseResult): boolean {
  return Object.values(result.fields).some(
    (value) => value !== null && value !== undefined && value !== ""
  );
}

function parseTravelSlotsFallback(
  userText: string,
  state: Record<string, unknown>
): TravelSlotParseResult | null {
  const travelers = extractTravelersFromText(userText);
  const budget = extractBudgetFromText(userText);
  const travelDays = extractTravelDaysFromText(userText);
  const departureDate = extractDepartureDateFromText(userText);
  const fields: TravelSlotParseResult["fields"] = {
    travelers,
    budget,
    travel_days: travelDays,
    departure_date: departureDate,
  };
  const result: TravelSlotParseResult = {
    action: "update_fields",
    confidence: 0.74,
    should_create_destination_card: false,
    destination_query: null,
    fields,
  };
  if (!hasParsedFields(result)) return null;

  const hasFieldCue = /(预算|budget|人民币|rmb|cny|元|块|人|位|名|出发|返回|日期|时间|天)/i.test(
    userText
  );
  const hasDestinationCue = /(想去|我要去|计划去|目的地|城市|国家|travel to|go to|visit)/i.test(
    userText
  );
  if (hasFieldCue && (!hasDestinationCue || hasExistingTripContext(state))) {
    return result;
  }

  return null;
}

function sanitizeOpenAISlotResult(value: unknown): TravelSlotParseResult | null {
  if (!isRecord(value) || !isRecord(value.fields)) return null;
  const action = value.action;
  if (
    action !== "update_fields" &&
    action !== "choose_destination" &&
    action !== "ask_clarification" &&
    action !== "ignore"
  ) {
    return null;
  }

  const fields: TravelSlotParseResult["fields"] = {};
  for (const key of [
    "travel_days",
    "travelers",
    "budget",
  ] as const) {
    const fieldValue = value.fields[key];
    if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
      fields[key] = fieldValue;
    }
  }
  for (const key of [
    "departure_date",
    "date_flexibility",
    "origin_country",
    "origin_city",
    "return_country",
    "return_city",
  ] as const) {
    const fieldValue = value.fields[key];
    if (typeof fieldValue === "string" || fieldValue === null) {
      fields[key] = fieldValue;
    }
  }

  return {
    action,
    confidence:
      typeof value.confidence === "number" && Number.isFinite(value.confidence)
        ? value.confidence
        : 0,
    should_create_destination_card: value.should_create_destination_card === true,
    destination_query:
      typeof value.destination_query === "string"
        ? value.destination_query
        : null,
    fields,
    reply_zh: typeof value.reply_zh === "string" ? value.reply_zh : null,
    reply_en: typeof value.reply_en === "string" ? value.reply_en : null,
  };
}

async function parseTravelSlotsWithOpenAI(
  userText: string,
  state: Record<string, unknown>,
  locale: "zh" | "en"
): Promise<TravelSlotParseResult | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model:
        process.env.TRAVEL_SLOT_OPENAI_MODEL?.trim() ||
        process.env.OPENAI_MODEL?.trim() ||
        "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You parse every travel-chat user utterance into structured trip fields and decide the next routing action. Extract only explicitly stated facts. If the utterance only supplies missing fields such as travelers, budget, dates, origin, or return city, set action=update_fields and should_create_destination_card=false. Never turn a field phrase like '一共2个人' or '预算60000rmb' into a destination. If the utterance requests a destination lookup, set action=choose_destination and include destination_query. If uncertain, ask_clarification.",
        },
        {
          role: "user",
          content: JSON.stringify({
            locale,
            current_state: state,
            latest_user_message: userText,
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "travel_slot_parse",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "action",
              "confidence",
              "should_create_destination_card",
              "destination_query",
              "fields",
              "reply_zh",
              "reply_en",
            ],
            properties: {
              action: {
                type: "string",
                enum: [
                  "update_fields",
                  "choose_destination",
                  "ask_clarification",
                  "ignore",
                ],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              should_create_destination_card: { type: "boolean" },
              destination_query: { type: ["string", "null"] },
              fields: {
                type: "object",
                additionalProperties: false,
                required: [
                  "travel_days",
                  "travelers",
                  "budget",
                  "departure_date",
                  "date_flexibility",
                  "origin_country",
                  "origin_city",
                  "return_country",
                  "return_city",
                ],
                properties: {
                  travel_days: { type: ["number", "null"] },
                  travelers: { type: ["number", "null"] },
                  budget: { type: ["number", "null"] },
                  departure_date: { type: ["string", "null"] },
                  date_flexibility: { type: ["string", "null"] },
                  origin_country: { type: ["string", "null"] },
                  origin_city: { type: ["string", "null"] },
                  return_country: { type: ["string", "null"] },
                  return_city: { type: ["string", "null"] },
                },
              },
              reply_zh: { type: ["string", "null"] },
              reply_en: { type: ["string", "null"] },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) return null;
  const raw = await response.json();
  const text = extractOpenAIText(raw);
  if (!text) return null;
  try {
    return sanitizeOpenAISlotResult(JSON.parse(text));
  } catch {
    return null;
  }
}

function fieldSummary(
  fields: TravelSlotParseResult["fields"],
  locale: "zh" | "en"
): string {
  const parts: string[] = [];
  if (typeof fields.travel_days === "number") {
    parts.push(locale === "zh" ? `${fields.travel_days} 天` : `${fields.travel_days} days`);
  }
  if (typeof fields.travelers === "number") {
    parts.push(locale === "zh" ? `${fields.travelers} 人` : `${fields.travelers} people`);
  }
  if (typeof fields.budget === "number") {
    parts.push(locale === "zh" ? `预算 ${fields.budget} RMB` : `budget RMB ${fields.budget}`);
  }
  if (fields.departure_date) {
    parts.push(locale === "zh" ? `出发日期 ${fields.departure_date}` : `departure ${fields.departure_date}`);
  }
  if (fields.origin_city) {
    parts.push(locale === "zh" ? `从 ${fields.origin_city} 出发` : `from ${fields.origin_city}`);
  }
  return parts.join(locale === "zh" ? "，" : ", ");
}

function buildSlotUpdateResponse(
  parsed: TravelSlotParseResult,
  locale: "zh" | "en"
): TravelAgentChatResponse | null {
  if (!hasParsedFields(parsed)) return null;
  if (parsed.action === "choose_destination" && parsed.should_create_destination_card) {
    return null;
  }
  if (parsed.action !== "update_fields" && parsed.action !== "ask_clarification") {
    return null;
  }

  const summary = fieldSummary(parsed.fields, locale);
  return {
    reply:
      parsed.action === "ask_clarification"
        ? locale === "zh"
          ? parsed.reply_zh || "我需要再确认一下这些旅行信息。"
          : parsed.reply_en || "I need to confirm these trip details."
        : locale === "zh"
        ? `已记录：${summary}。`
        : `Got it: ${summary}.`,
    mode: "collect_slots",
    quick_replies: [],
    cards: [],
    candidate_payload: Object.fromEntries(
      Object.entries(parsed.fields).filter(
        ([, value]) => value !== null && value !== undefined && value !== ""
      )
    ),
    sources: [
      {
        id: "travel_slot_parser",
        title: "Structured travel slot parser",
        type: "parser",
      },
    ],
  };
}

async function buildImmediateSlotParserResponse(
  payload: unknown
): Promise<TravelAgentChatResponse | null> {
  const userText = latestUserText(payload);
  if (!userText || /加入计划|add to plan/i.test(userText)) return null;

  const state = latestTravelState(payload);
  const locale = payloadLocale(payload);
  const parsed =
    (await parseTravelSlotsWithOpenAI(userText, state, locale).catch(
      () => null
    )) ?? parseTravelSlotsFallback(userText, state);
  if (!parsed) return null;
  if (
    parsed.action === "update_fields" &&
    looksLikeDestinationDraftText(userText)
  ) {
    const destinationResolution = resolveLocalDestinationText(userText);
    if (
      destinationResolution.status === "resolved" ||
      destinationResolution.status === "ambiguous"
    ) {
      return null;
    }
  }

  return buildSlotUpdateResponse(parsed, locale);
}

function destinationKey(card: TravelDestinationCard): string {
  return `${card.country}|${card.city ?? ""}|${card.title}`.toLowerCase();
}

function mergeDestinationCards(
  existingCards: TravelDestinationCard[] | undefined,
  fallbackCards: TravelDestinationCard[]
): TravelDestinationCard[] {
  const byKey = new Map<string, TravelDestinationCard>();
  [...fallbackCards, ...(existingCards ?? [])].forEach((card) => {
    byKey.set(destinationKey(card), card);
  });
  return Array.from(byKey.values()).slice(0, 4);
}

function cardMatchesDestination(
  card: TravelDestinationCard,
  destination: TravelDestinationSearchResult
): boolean {
  const cardValues = [
    card.country,
    card.city ?? "",
    card.title,
  ].map((value) => value.toLowerCase());
  const destinationValues = [
    destination.countryName ?? "",
    destination.city ?? "",
    destination.displayName,
    destination.canonicalName,
  ]
    .map((value) => value.toLowerCase())
    .filter(Boolean);

  return destinationValues.some((value) => cardValues.includes(value));
}

function buildResolvedDestinationCards(
  existingCards: TravelDestinationCard[] | undefined,
  destinations: TravelDestinationSearchResult[],
  userText: string
): TravelDestinationCard[] {
  return destinations.slice(0, 4).map((destination) => {
    const fallbackCard = toTravelDestinationChatCard(destination, userText);
    const existingCard = existingCards?.find((card) =>
      cardMatchesDestination(card, destination)
    );
    if (!existingCard) return fallbackCard;

    return {
      ...existingCard,
      suggested_days: fallbackCard.suggested_days ?? existingCard.suggested_days,
      payload: {
        ...existingCard.payload,
        ...fallbackCard.payload,
      },
    };
  });
}

function hasSpecificTripSlots(candidatePayload: Record<string, unknown>): boolean {
  return (
    typeof candidatePayload.travel_days === "number" ||
    typeof candidatePayload.travelers === "number" ||
    typeof candidatePayload.budget === "number" ||
    typeof candidatePayload.origin_city === "string" ||
    typeof candidatePayload.origin_country === "string"
  );
}

function withTravelPipelineDebug(
  response: TravelAgentChatResponse,
  resolution: DestinationResolution
): TravelAgentChatResponse {
  if (process.env.NODE_ENV === "production" || !resolution.debugTrace) {
    return response;
  }

  console.debug("Travel destination pipeline", resolution.debugTrace);
  return {
    ...response,
    debug: {
      ...(response.debug ?? {}),
      travel_pipeline: resolution.debugTrace,
    },
  };
}

function commandReplyForIntent(intent: string, userText: string): string {
  if (intent === "remove_item") {
    if (/(岳麓山|橘子洲|博物馆|museum|mountain|isle|card|卡片|景点)/i.test(userText)) {
      return "我识别到你想删除某个景点或卡片。请先点选要删除的卡片，或明确告诉我要删掉哪一个。";
    }
    return "你想删除哪一个景点或卡片？请点选卡片，或直接告诉我景点名称。";
  }

  if (intent === "replace_item") {
    return "你想替换哪一个景点？请告诉我要换掉的名称，以及想换成什么类型的地方。";
  }

  if (intent === "modify_itinerary" || intent === "edit_itinerary") {
    return "我识别到这是行程修改指令。请先生成或选择一份行程，然后告诉我要调整哪一天或哪一个项目。";
  }

  return "我还需要一点上下文：你想修改、删除或替换哪一个行程项目？";
}

function isCommandIntent(intent: string | undefined): boolean {
  return (
    intent === "remove_item" ||
    intent === "replace_item" ||
    intent === "modify_itinerary" ||
    intent === "edit_itinerary" ||
    intent === "clarify_needed"
  );
}

function isInvalidOrUnrelatedIntent(intent: string | undefined): boolean {
  return intent === "invalid_or_unrelated";
}

function invalidOrUnrelatedResponse(
  resolution: DestinationResolution
): TravelAgentChatResponse {
  return withTravelPipelineDebug(
    {
      reply: "可以告诉我你的目的地、天数、预算或想调整的行程项目，我会再继续规划。",
      mode: "collect_slots",
      quick_replies: [],
      cards: [],
      candidate_payload: {},
      sources: [
        {
          id: "travel_intent_parser",
          title: "Invalid or unrelated travel input",
          type: "parser",
        },
      ],
    },
    resolution
  );
}

function enrichTravelChatResponse(
  payload: unknown,
  response: TravelAgentChatResponse
): TravelAgentChatResponse {
  const userText = latestUserText(payload);
  if (!userText) return response;

  const resolution = resolveLocalDestinationText(userText);
  if (
    resolution.status === "unresolved" &&
    isCommandIntent(resolution.debugTrace?.detectedIntent)
  ) {
    return withTravelPipelineDebug(
      {
        ...response,
        reply: commandReplyForIntent(
          resolution.debugTrace?.detectedIntent ?? "clarify_needed",
          userText
        ),
        mode: "collect_slots",
        quick_replies: [],
        cards: [],
        candidate_payload: {},
        sources: [
          ...(response.sources ?? []),
          {
            id: "travel_command_classifier",
            title: "Travel command classification",
            type: "parser",
          },
        ],
      },
      resolution
    );
  }

  if (
    resolution.status === "unresolved" &&
    isInvalidOrUnrelatedIntent(resolution.debugTrace?.detectedIntent)
  ) {
    return invalidOrUnrelatedResponse(resolution);
  }

  if (resolution.status === "ambiguous") {
    return withTravelPipelineDebug(
      {
        reply: resolution.clarificationQuestion,
        mode: "collect_slots",
        quick_replies: resolution.options.slice(0, 4).map((option) => ({
          label: option.displayName,
          value: `我说的是 ${option.displayName}`,
        })),
        cards: [],
        candidate_payload: {},
        sources: [
          {
            id: "destination_resolver",
            title: "Destination resolver clarification",
            type: "resolver",
          },
        ],
      },
      resolution
    );
  }

  if (resolution.status === "resolved") {
    const candidatePayload = buildTravelCandidatePayload(
      resolution.destinations,
      userText
    );
    const shouldSuppressJoinReplies = hasSpecificTripSlots(candidatePayload);
    const hasMatchingBackendCard = response.cards?.some((card) =>
      resolution.destinations.some((destination) =>
        cardMatchesDestination(card, destination)
      )
    );
    const resolvedNames = resolution.destinations
      .map((destination) => destination.displayName)
      .join("、");
    return withTravelPipelineDebug(
      {
        ...response,
        reply: hasMatchingBackendCard
          ? response.reply
          : `我已经识别到目的地：${resolvedNames}。我会先用已解析的目的地、天数和偏好继续规划；如果坐标或资料缺失，会用占位图和后续补全流程兜底。`,
        mode: response.mode === "welcome" ? "destination_detail" : response.mode,
        quick_replies: shouldSuppressJoinReplies
          ? []
          : hasMatchingBackendCard
          ? response.quick_replies
          : resolution.destinations.slice(0, 3).map((destination) => ({
              label: `加入计划：${destination.displayName}`,
              value: `加入计划：${destination.displayName}`,
            })),
        cards: buildResolvedDestinationCards(
          response.cards,
          resolution.destinations,
          userText
        ),
        candidate_payload: {
          ...(response.candidate_payload ?? {}),
          ...candidatePayload,
        },
        sources: [
          ...(response.sources ?? []),
          {
            id: "destination_resolver",
            title: "Destination resolver exact/alias/fuzzy match",
            type: "resolver",
          },
        ],
      },
      resolution
    );
  }

  if (resolution.status === "temporary") {
    const card = toTravelDestinationChatCard(resolution.destination, userText);
    return withTravelPipelineDebug(
      {
        reply:
          response.reply ||
          "我识别到一个待验证旅行地点。正在补充地点资料；在确认前不会把它作为最终行程依据。",
        mode: "destination_detail",
        quick_replies: response.quick_replies ?? [],
        cards: mergeDestinationCards(response.cards, [card]),
        candidate_payload: buildTravelCandidatePayload(
          [resolution.destination],
          userText
        ),
        sources: [
          ...(response.sources ?? []),
          {
            id: "destination_resolver",
            title: "Temporary unverified destination",
            type: "resolver",
          },
        ],
      },
      resolution
    );
  }

  return withTravelPipelineDebug(response, resolution);
}

function buildImmediateLocalFirstResponse(
  payload: unknown
): TravelAgentChatResponse | null {
  const userText = latestUserText(payload);
  if (!userText || /加入计划|add to plan/i.test(userText)) return null;

  const resolution = resolveLocalDestinationText(userText);
  if (
    resolution.status === "unresolved" &&
    isCommandIntent(resolution.debugTrace?.detectedIntent)
  ) {
    return withTravelPipelineDebug(
      {
        reply: commandReplyForIntent(
          resolution.debugTrace?.detectedIntent ?? "clarify_needed",
          userText
        ),
        mode: "collect_slots",
        quick_replies: [],
        cards: [],
        candidate_payload: {},
        sources: [
          {
            id: "travel_command_classifier",
            title: "Travel command classification",
            type: "parser",
          },
        ],
      },
      resolution
    );
  }

  if (
    resolution.status === "unresolved" &&
    isInvalidOrUnrelatedIntent(resolution.debugTrace?.detectedIntent)
  ) {
    return invalidOrUnrelatedResponse(resolution);
  }

  if (resolution.status === "ambiguous") {
    return withTravelPipelineDebug(
      {
        reply: resolution.clarificationQuestion,
        mode: "collect_slots",
        quick_replies: resolution.options.slice(0, 4).map((option) => ({
          label: option.displayName,
          value: `我说的是 ${option.displayName}`,
        })),
        cards: [],
        candidate_payload: {},
        sources: [
          {
            id: "destination_resolver",
            title: "Local-first destination clarification",
            type: "resolver",
          },
        ],
      },
      resolution
    );
  }

  if (resolution.status === "resolved") {
    const candidatePayload = buildTravelCandidatePayload(
      resolution.destinations,
      userText
    );
    const shouldSuppressJoinReplies = hasSpecificTripSlots(candidatePayload);
    const resolvedNames = resolution.destinations
      .map((destination) => destination.displayName)
      .join("、");
    return withTravelPipelineDebug(
      {
        reply: `我已经从本地目的地库识别到：${resolvedNames}。先展示本地已验证资料；缺失图片或景点时会进入补全流程，未验证图片会保持占位图。`,
        mode: "destination_detail",
        quick_replies: shouldSuppressJoinReplies
          ? []
          : resolution.destinations.slice(0, 3).map((destination) => ({
              label: `加入计划：${destination.displayName}`,
              value: `加入计划：${destination.displayName}`,
            })),
        cards: buildResolvedDestinationCards(
          undefined,
          resolution.destinations,
          userText
        ),
        candidate_payload: candidatePayload,
        sources: [
          {
            id: "local_first_destination_contract",
            title: "Local-first destination contract",
            type: "resolver",
          },
        ],
      },
      resolution
    );
  }

  if (resolution.status === "temporary" && looksLikeDestinationDraftText(userText)) {
    const card = toTravelDestinationChatCard(resolution.destination, userText);
    return withTravelPipelineDebug(
      {
        reply:
          "正在补充地点资料；确认前不会把它作为最终行程依据。",
        mode: "destination_detail",
        quick_replies: [],
        cards: [card],
        candidate_payload: buildTravelCandidatePayload(
          [resolution.destination],
          userText
        ),
        sources: [
          {
            id: "local_first_generated_draft",
            title: "Generated text-only destination draft",
            type: "resolver",
          },
        ],
      },
      resolution
    );
  }

  if (
    resolution.status === "unresolved" &&
    resolution.debugTrace?.detectedIntent === "ask_question"
  ) {
    return withTravelPipelineDebug(
      {
        reply:
          "这个问题更像旅行准备或签证咨询，我不会为它创建目的地卡。签证和保险要求请以官方来源为准；如果要继续问签证材料，可以切换到 VIZA AI。",
        mode: "collect_slots",
        quick_replies: [],
        cards: [],
        candidate_payload: {},
        sources: [
          {
            id: "travel_intent_parser",
            title: "Non-destination travel question",
            type: "parser",
          },
        ],
      },
      resolution
    );
  }

  if (
    resolution.status === "unresolved" &&
    isCommandIntent(resolution.debugTrace?.detectedIntent)
  ) {
    return withTravelPipelineDebug(
      {
        reply: commandReplyForIntent(
          resolution.debugTrace?.detectedIntent ?? "clarify_needed",
          userText
        ),
        mode: "collect_slots",
        quick_replies: [],
        cards: [],
        candidate_payload: {},
        sources: [
          {
            id: "travel_intent_parser",
            title: "Itinerary edit intent",
            type: "parser",
          },
        ],
      },
      resolution
    );
  }

  return null;
}

function looksLikeDestinationDraftText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    /(delete|remove|reorder|refresh|change|edit|revise|删除|删掉|重排|调整|修改|刷新|重做)/i.test(
      trimmed
    )
  ) {
    return false;
  }

  if (
    /(想去|我要去|计划|旅行|路线|目的地|travel|trip|visit|go to|destination|city)/i.test(
      trimmed
    )
  ) {
    return true;
  }

  return trimmed.split(/\s+/).filter(Boolean).length <= 4;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const slotParserResponse = await buildImmediateSlotParserResponse(payload);
    if (slotParserResponse) {
      return Response.json(slotParserResponse, { status: 200 });
    }

    const immediateResponse = buildImmediateLocalFirstResponse(payload);
    if (immediateResponse) {
      return Response.json(immediateResponse, { status: 200 });
    }

    const candidatePaths = ["/chat", "/travel-chat", "/api/chat"];
    const tried: Array<{ path: string; status: number; detail: string }> = [];

    for (const path of candidatePaths) {
      const response = await forwardJsonToTravelBackend(path, payload);
      const text = await response.text();

      if (response.ok) {
        try {
          const parsed = JSON.parse(text) as TravelAgentChatResponse;
          return Response.json(enrichTravelChatResponse(payload, parsed), {
            status: 200,
          });
        } catch {
          return Response.json(
            enrichTravelChatResponse(payload, {
              reply: text || "",
              mode: "collect_slots",
              quick_replies: [],
              cards: [],
              candidate_payload: {},
              sources: [],
            }),
            { status: 200 }
          );
        }
      }

      tried.push({
        path,
        status: response.status,
        detail: text || "",
      });

      if (response.status !== 404) {
        return Response.json(
          {
            error: text || "Failed to generate travel chat response.",
            debug: { path, status: response.status },
          },
          { status: response.status }
        );
      }
    }

    return Response.json(
      {
        error:
          "No compatible travel chat endpoint found on backend. Please verify backend routes.",
        debug: tried,
      },
      { status: 502 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate travel chat response.";
    return Response.json({ error: message }, { status: 500 });
  }
}
