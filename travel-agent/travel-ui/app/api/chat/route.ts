import type { UIMessage } from "ai";

type TravelField = "country" | "cities" | "city_days" | "travelers" | "budget";

type TravelState = {
  country: string | null;
  cities: string[];
  city_days: Record<string, number>;
  travelers: number | null;
  budget: number | null;
};

const BACKEND_URL = "http://127.0.0.1:8000";

const FIELD_QUESTIONS: Record<TravelField, string> = {
  country: "你想去哪个国家？",
  cities: "请告诉我要去的城市（可多城市，用逗号分隔，例如：Tokyo, Osaka）。",
  city_days:
    "请告诉我每个城市停留几天（例如：Tokyo 3天, Osaka 2天；或按顺序输入：3,2）。",
  travelers: "这次一共几位旅行者？",
  budget: "你的总预算是多少（人民币）？",
};

function extractTextFromMessage(message: UIMessage): string {
  if (typeof (message as { content?: unknown }).content === "string") {
    return ((message as { content?: string }).content ?? "").trim();
  }

  const parts = message.parts ?? [];
  const text = parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join(" ")
    .trim();
  return text;
}

function parseCities(input: string): string[] {
  return input
    .split(/[,，、\n]+/)
    .map((city) => city.trim())
    .filter((city) => city.length > 0);
}

function parsePositiveInt(input: string): number | null {
  const match = input.match(/\d+/);
  if (!match) return null;
  const value = Number(match[0]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCityDays(input: string, cities: string[]): Record<string, number> {
  const result: Record<string, number> = {};

  for (const city of cities) {
    const cityPattern = new RegExp(`${escapeRegExp(city)}[^\\d]*(\\d+)`, "i");
    const match = input.match(cityPattern);
    if (match && match[1]) {
      const dayCount = Number(match[1]);
      if (Number.isFinite(dayCount) && dayCount > 0) {
        result[city] = dayCount;
      }
    }
  }

  if (Object.keys(result).length === cities.length) {
    return result;
  }

  const numbers = input.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length >= cities.length) {
    cities.forEach((city, index) => {
      const dayCount = numbers[index];
      if (Number.isFinite(dayCount) && dayCount > 0) {
        result[city] = dayCount;
      }
    });
  }

  if (Object.keys(result).length !== cities.length) {
    return {};
  }

  return result;
}

function nextMissingField(state: TravelState): TravelField | null {
  if (!state.country) return "country";
  if (state.cities.length === 0) return "cities";
  if (Object.keys(state.city_days).length !== state.cities.length) return "city_days";
  if (!state.travelers) return "travelers";
  if (!state.budget) return "budget";
  return null;
}

function applyUserAnswer(state: TravelState, field: TravelField, input: string): void {
  if (!input.trim()) return;

  switch (field) {
    case "country":
      state.country = input.trim();
      return;
    case "cities": {
      const cities = parseCities(input);
      if (cities.length > 0) {
        state.cities = cities;
        state.city_days = {};
      }
      return;
    }
    case "city_days": {
      if (state.cities.length === 0) return;
      const cityDays = parseCityDays(input, state.cities);
      if (Object.keys(cityDays).length === state.cities.length) {
        state.city_days = cityDays;
      }
      return;
    }
    case "travelers": {
      const travelers = parsePositiveInt(input);
      if (travelers) {
        state.travelers = travelers;
      }
      return;
    }
    case "budget": {
      const budget = parsePositiveInt(input);
      if (budget) {
        state.budget = budget;
      }
      return;
    }
  }
}

function buildStateFromMessages(messages: UIMessage[]): TravelState {
  const state: TravelState = {
    country: null,
    cities: [],
    city_days: {},
    travelers: null,
    budget: null,
  };

  let pending: TravelField | null = "country";

  for (const message of messages) {
    if (message.role !== "user" || !pending) continue;

    const text = extractTextFromMessage(message);
    if (!text) continue;

    applyUserAnswer(state, pending, text);
    pending = nextMissingField(state);
  }

  return state;
}

function toTextResponse(text: string): Response {
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { messages?: UIMessage[] };
    const messages = body.messages ?? [];
    const state = buildStateFromMessages(messages);
    const missing = nextMissingField(state);

    if (missing) {
      const prompt = FIELD_QUESTIONS[missing];
      return toTextResponse(prompt);
    }

    const payload = {
      country: state.country,
      cities: state.cities,
      city_days: state.city_days,
      travelers: state.travelers,
      budget: state.budget,
    };

    const backendResponse = await fetch(`${BACKEND_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      return toTextResponse("行程生成失败，请稍后再试。");
    }

    const backendData = (await backendResponse.json()) as { reply?: unknown };
    const itinerary = Array.isArray(backendData.reply) ? backendData.reply : [];
    const formatted = JSON.stringify(itinerary, null, 2);

    return toTextResponse(formatted);
  } catch {
    return toTextResponse("聊天服务出现错误，请重试。");
  }
}
