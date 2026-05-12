import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from "ai";
import {
  buildTravelStateFromMessages,
  extractMessageText,
  FIELD_QUESTIONS,
  FORM_PAYLOAD_PREFIX,
  nextMissingField,
  parseItineraryText,
  toTravelPayload,
  type SelectedFlightOption,
  type SelectedHotelOption,
  type ChatLikeMessage,
  type ItineraryDay,
} from "@/lib/travel/planner";
import { getTravelBackendUrl } from "@/lib/travel/backend";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function extractIncomingMessages(body: PostRequestBody): ChatLikeMessage[] {
  if (body.messages?.length) {
    return body.messages as unknown as ChatLikeMessage[];
  }

  if (body.message) {
    return [body.message as unknown as ChatLikeMessage];
  }

  return [];
}

function coerceItinerary(raw: unknown): ItineraryDay[] {
  if (Array.isArray(raw)) {
    return parseItineraryText(JSON.stringify(raw));
  }

  if (typeof raw === "string") {
    return parseItineraryText(raw);
  }

  if (!raw || typeof raw !== "object") {
    return [];
  }

  const record = raw as Record<string, unknown>;

  if (Array.isArray(record.itinerary)) {
    return parseItineraryText(JSON.stringify(record.itinerary));
  }

  if (Array.isArray(record.reply)) {
    return parseItineraryText(JSON.stringify(record.reply));
  }

  if (typeof record.result === "string") {
    return parseItineraryText(record.result);
  }

  if (typeof record.reply === "string") {
    return parseItineraryText(record.reply);
  }

  if (typeof record.content === "string") {
    return parseItineraryText(record.content);
  }

  return [];
}

function formatSelectedFlights(flights: SelectedFlightOption[]): string {
  if (!flights.length) return "- 无";

  const lines: string[] = [];
  for (const flight of flights) {
    if (flight.skip) {
      lines.push(
        `- 航段 ${flight.leg_index}：${flight.from} → ${flight.to}（${flight.departure_date}）已跳过（其他交通）`
      );
      continue;
    }
    const option = flight.option;
    const airline = option?.airline ?? "未命名航司";
    const price = option?.price ? `${option.price} ${option.currency ?? "CNY"}` : "价格未知";
    const departure = option?.departure ?? flight.departure_date;
    lines.push(
      `- 航段 ${flight.leg_index}：${flight.from} → ${flight.to} | ${airline} | ${price} | 出发 ${departure}`
    );
  }

  return lines.join("\n");
}

function formatSelectedHotels(hotels: SelectedHotelOption[]): string {
  if (!hotels.length) return "- 无";

  const lines: string[] = [];
  for (const stay of hotels) {
    const option = stay.option;
    const hotelName = option?.name ?? "未命名酒店";
    const price = option?.price_per_night
      ? `${option.price_per_night} ${option.currency ?? "CNY"}/晚`
      : "价格未知";
    const rating =
      option?.rating !== undefined && option?.rating !== null
        ? `评分 ${option.rating}`
        : "暂无评分";
    lines.push(
      `- 城市 ${stay.stay_index}：${stay.city}（${stay.check_in} 到 ${stay.check_out}，${stay.nights} 晚）| ${hotelName} | ${price} | ${rating}`
    );
  }

  return lines.join("\n");
}

function getLastUserText(messages: ChatLikeMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const text = extractMessageText(message);
    if (text) return text;
  }
  return "";
}

async function generateItineraryFromBackend(messages: ChatLikeMessage[]) {
  const travelState = buildTravelStateFromMessages(messages);
  const payload = toTravelPayload(travelState);

  if (!payload) {
    const missingField = nextMissingField(travelState) ?? "country";
    const nextMissingQuestion = FIELD_QUESTIONS[missingField];
    const lastUserText = getLastUserText(messages);
    const shouldRejectInput =
      Boolean(lastUserText) && !lastUserText.includes(FORM_PAYLOAD_PREFIX);
    const validationPrefix = shouldRejectInput
      ? "输入不符合要求，请使用下方表单完成当前问题。\n\n"
      : "";
    return {
      content: `${validationPrefix}${nextMissingQuestion}`,
      itinerary: [] as ItineraryDay[],
    };
  }

  const response = await fetch(`${getTravelBackendUrl()}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Travel backend /generate failed (${response.status}): ${detail || "unknown error"}`
    );
  }

  const result = (await response.json()) as unknown;
  const itinerary = coerceItinerary(result);

  if (itinerary.length === 0) {
    throw new Error("Travel backend returned empty or invalid itinerary.");
  }

  const jsonText = JSON.stringify(itinerary, null, 2);
  const selectedFlightsText = formatSelectedFlights(payload.selected_flights);
  const selectedHotelsText = formatSelectedHotels(payload.selected_hotels);

  return {
    content:
      `\`\`\`json\n${jsonText}\n\`\`\`\n\n` +
      `### 已选航班\n${selectedFlightsText}\n\n` +
      `### 已选酒店\n${selectedHotelsText}`,
    itinerary,
  };
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    requestBody = postRequestBodySchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    const incomingMessages = extractIncomingMessages(requestBody);
    const { content } = await generateItineraryFromBackend(incomingMessages);

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const textId = generateId();
        writer.write({ type: "text-start", id: textId });
        writer.write({ type: "text-delta", id: textId, delta: content });
        writer.write({ type: "text-end", id: textId });
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "Travel planner is temporarily unavailable.";

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const textId = generateId();
        writer.write({ type: "text-start", id: textId });
        writer.write({
          type: "text-delta",
          id: textId,
          delta:
            "抱歉，暂时无法生成行程。请检查后端服务与 API Key 后重试。\n\n" +
            detail,
        });
        writer.write({ type: "text-end", id: textId });
      },
    });

    return createUIMessageStreamResponse({ stream });
  }
}

export async function DELETE() {
  return Response.json({ ok: true }, { status: 200 });
}
