import {
  buildTravelCandidatePayload,
  countryScopeForText,
  normalizeDestinationText,
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
  action:
    | "update_fields"
    | "choose_destination"
    | "recommend_destinations"
    | "ask_clarification"
    | "ignore";
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

function conversationHistory(
  payload: unknown
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) return [];

  return payload.messages.flatMap((message) => {
    if (!isRecord(message)) return [];
    if (message.role !== "user" && message.role !== "assistant") return [];
    if (typeof message.content !== "string" || !message.content.trim()) return [];
    return [{ role: message.role, content: message.content.trim() }];
  });
}

function payloadLocale(payload: unknown): "zh" | "en" {
  if (!isRecord(payload)) return "zh";
  return payload.locale === "en" ? "en" : "zh";
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

function sanitizeOpenAISlotResult(value: unknown): TravelSlotParseResult | null {
  if (!isRecord(value) || !isRecord(value.fields)) return null;
  const action = value.action;
  if (
    action !== "update_fields" &&
    action !== "choose_destination" &&
    action !== "recommend_destinations" &&
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

  const replyZh =
    typeof value.reply_zh === "string" ? value.reply_zh.trim() : "";
  const replyEn =
    typeof value.reply_en === "string" ? value.reply_en.trim() : "";
  if (!replyZh || !replyEn) return null;

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
    reply_zh: replyZh,
    reply_en: replyEn,
  };
}

async function parseTravelSlotsWithOpenAI(
  userText: string,
  state: Record<string, unknown>,
  locale: "zh" | "en",
  history: Array<{ role: "user" | "assistant"; content: string }>
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
            "You are the mandatory intent and response engine for every VIZA Travel AI user utterance. Extract only explicitly stated facts. Use update_fields for supplied trip fields. Use choose_destination only when the user explicitly selects or confirms one specific destination; destination_query must contain only that place name and should_create_destination_card=true. If the user asks for ideas, alternatives, recommendations, nearby places, more cities, or asks a destination question without explicitly selecting one, use recommend_destinations, set should_create_destination_card=false and destination_query=null, and answer with concise useful suggestions in reply_zh/reply_en. Never turn the user's full sentence, a question, a region such as the Middle East, or a field phrase into a destination. Use ask_clarification when a safe answer needs more information. Always provide a natural-language reply in both reply_zh and reply_en. Never claim that a destination card was created.",
        },
        {
          role: "user",
          content: JSON.stringify({
            locale,
            current_state: state,
            conversation_history: history,
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
                  "recommend_destinations",
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
              reply_zh: { type: "string" },
              reply_en: { type: "string" },
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

function parsedFieldPayload(
  parsed: TravelSlotParseResult
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(parsed.fields).filter(
      ([, value]) => value !== null && value !== undefined && value !== ""
    )
  );
}

function parsedReply(
  parsed: TravelSlotParseResult,
  locale: "zh" | "en"
): string {
  return locale === "zh" ? parsed.reply_zh ?? "" : parsed.reply_en ?? "";
}

function explicitlySelectsDestination(
  userText: string,
  destinationQuery: string
): boolean {
  const normalizedUserText = normalizeDestinationText(userText);
  const normalizedQuery = normalizeDestinationText(destinationQuery);
  if (!normalizedQuery) return false;
  if (normalizedUserText === normalizedQuery) return true;
  if (
    /(推荐|建议|哪些|哪个|还有|其他|附近|周边|吗|么|呢|\?|？)/u.test(
      userText
    )
  ) {
    return false;
  }

  return (
    /(加入计划|我想去|我想要去|我要去|决定去|选择|选了|就去|目的地是|目的地为)/u.test(
      userText
    ) ||
    /\b(?:add to plan|i want to (?:go to|visit)|i choose|i chose|let'?s go to|my destination is)\b/i.test(
      userText
    )
  );
}

function buildOpenAIFirstResponse(
  payload: unknown,
  parsed: TravelSlotParseResult
): TravelAgentChatResponse {
  const locale = payloadLocale(payload);
  const userText = latestUserText(payload);
  const fieldPayload = parsedFieldPayload(parsed);
  const baseResponse: TravelAgentChatResponse = {
    reply: parsedReply(parsed, locale),
    mode: "collect_slots",
    quick_replies: [],
    cards: [],
    candidate_payload: fieldPayload,
    sources: [
      {
        id: "openai_travel_intent",
        title: "OpenAI travel intent and response",
        type: "openai",
      },
    ],
  };

  if (
    parsed.action !== "choose_destination" ||
    parsed.should_create_destination_card !== true ||
    !parsed.destination_query ||
    !explicitlySelectsDestination(userText, parsed.destination_query)
  ) {
    return baseResponse;
  }

  const destinationPrompt =
    locale === "zh"
      ? `我想去${parsed.destination_query}`
      : `I want to go to ${parsed.destination_query}`;
  const countryScope = countryScopeForText(destinationPrompt);
  if (countryScope) {
    return {
      ...baseResponse,
      quick_replies: countryScope.suggestedCities.slice(0, 4).map((city) => ({
        label: city.displayName,
        value:
          locale === "zh"
            ? `我想去${city.displayName}`
            : `I want to go to ${city.displayName}`,
      })),
      candidate_payload: {
        ...fieldPayload,
        countries: [countryScope.countryName],
        destination_confirmed: false,
      },
    };
  }

  const resolution = resolveLocalDestinationText(destinationPrompt);
  if (resolution.status === "ambiguous") {
    return withTravelPipelineDebug(
      {
        ...baseResponse,
        quick_replies: resolution.options.slice(0, 4).map((option) => ({
          label: option.displayName,
          value:
            locale === "zh"
              ? `我选择${option.displayName}`
              : `I choose ${option.displayName}`,
        })),
      },
      resolution
    );
  }

  if (resolution.status !== "resolved") {
    return withTravelPipelineDebug(baseResponse, resolution);
  }

  const candidatePayload = buildTravelCandidatePayload(
    resolution.destinations,
    userText
  );
  const mergedCandidatePayload = {
    ...candidatePayload,
    ...fieldPayload,
  };
  return withTravelPipelineDebug(
    {
      ...baseResponse,
      mode: "destination_detail",
      quick_replies: hasSpecificTripSlots(mergedCandidatePayload)
        ? []
        : resolution.destinations.slice(0, 3).map((destination) => ({
            label:
              locale === "zh"
                ? `加入计划：${destination.displayName}`
                : `Add to plan: ${destination.displayName}`,
            value:
              locale === "zh"
                ? `加入计划：${destination.displayName}`
                : `Add to plan: ${destination.displayName}`,
          })),
      cards: buildResolvedDestinationCards(
        undefined,
        resolution.destinations,
        userText
      ),
      candidate_payload: mergedCandidatePayload,
    },
    resolution
  );
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

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const userText = latestUserText(payload);
    if (!userText) {
      return Response.json(
        { error: "A user message is required." },
        { status: 400 }
      );
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return Response.json(
        { error: "Travel AI is unavailable because OpenAI is not configured." },
        { status: 503 }
      );
    }

    const parsed = await parseTravelSlotsWithOpenAI(
      userText,
      latestTravelState(payload),
      payloadLocale(payload),
      conversationHistory(payload)
    ).catch(() => null);
    if (!parsed) {
      return Response.json(
        {
          error:
            "Travel AI could not understand the message because the OpenAI request failed.",
        },
        { status: 502 }
      );
    }

    return Response.json(buildOpenAIFirstResponse(payload, parsed), {
      status: 200,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate travel chat response.";
    return Response.json({ error: message }, { status: 500 });
  }
}
