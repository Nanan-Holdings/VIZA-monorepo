import { forwardJsonToTravelBackend } from "@/lib/travel/backend";
import {
  buildTravelCandidatePayload,
  resolveLocalDestinationText,
  toTravelDestinationChatCard,
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

function enrichTravelChatResponse(
  payload: unknown,
  response: TravelAgentChatResponse
): TravelAgentChatResponse {
  const userText = latestUserText(payload);
  if (!userText) return response;

  const resolution = resolveLocalDestinationText(userText);
  if (resolution.status === "ambiguous") {
    return {
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
    };
  }

  if (resolution.status === "resolved") {
    const candidatePayload = buildTravelCandidatePayload(
      resolution.destinations,
      userText
    );
    const hasMatchingBackendCard = response.cards?.some((card) =>
      resolution.destinations.some((destination) =>
        cardMatchesDestination(card, destination)
      )
    );
    const resolvedNames = resolution.destinations
      .map((destination) => destination.displayName)
      .join("、");
    return {
      ...response,
      reply: hasMatchingBackendCard
        ? response.reply
        : `我已经识别到目的地：${resolvedNames}。我会先用已解析的目的地、天数和偏好继续规划；如果坐标或资料缺失，会用临时卡片和后续补全流程兜底。`,
      mode: response.mode === "welcome" ? "destination_detail" : response.mode,
      quick_replies: hasMatchingBackendCard
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
    };
  }

  if (resolution.status === "temporary") {
    const card = toTravelDestinationChatCard(resolution.destination, userText);
    return {
      reply:
        response.reply ||
        "我先把这个目的地作为临时未验证地点继续规划；后续会补充坐标和目的地资料。",
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
    };
  }

  return response;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
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
