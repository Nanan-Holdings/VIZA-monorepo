import { forwardJsonToTravelBackend } from "@/lib/travel/backend";
import fs from "node:fs";
import path from "node:path";

type ItineraryDay = {
  day: number | string;
  city: string;
  activities: string[];
  food: string[];
  cost: string;
};

type RevisionResponse = {
  action: "revise" | "restart" | "clarify";
  reply: string;
  itinerary: ItineraryDay[];
  state_patch: Record<string, unknown>;
  module_patch: Record<string, unknown>;
  edit_summary: string;
  quick_replies: Array<{ label: string; value: string }>;
};

type ResponseLocale = "zh" | "en";

function normalizeResponseLocale(locale: unknown): ResponseLocale {
  return typeof locale === "string" && locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeItinerary(value: unknown): ItineraryDay[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const city = typeof item.city === "string" ? item.city.trim() : "";
      if (!city) return null;

      return {
        day:
          typeof item.day === "number" || typeof item.day === "string"
            ? item.day
            : "-",
        city,
        activities: Array.isArray(item.activities)
          ? item.activities.map((activity) => String(activity))
          : [],
        food: Array.isArray(item.food)
          ? item.food.map((food) => String(food))
          : [],
        cost: typeof item.cost === "string" ? item.cost : "N/A",
      } satisfies ItineraryDay;
    })
    .filter((day): day is ItineraryDay => Boolean(day));
}

function itinerarySignature(itinerary: ItineraryDay[]): string {
  return JSON.stringify(
    itinerary.map((day) => ({
      day: String(day.day ?? ""),
      city: day.city.trim(),
      activities: day.activities.map((activity) => activity.trim()),
      food: day.food.map((food) => food.trim()),
      cost: day.cost.trim(),
    }))
  );
}

function hasPatch(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getItineraryCities(
  currentItinerary: ItineraryDay[],
  payload: Record<string, unknown>
): string[] {
  const state = isRecord(payload.state) ? payload.state : {};
  const seen = new Set<string>();
  const cities = [
    ...currentItinerary.map((day) => day.city),
    ...getStringArray(state.cities),
    ...getStringArray(state.travel_order),
  ];

  return cities.filter((city) => {
    const key = city.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isAmbiguousDayReductionPrompt(
  payload: Record<string, unknown>,
  currentItinerary: ItineraryDay[]
): boolean {
  const prompt =
    typeof payload.user_prompt === "string" ? payload.user_prompt.trim() : "";
  if (!prompt) return false;

  const asksToReduceDays =
    /(减少|减掉|缩短|删掉|删除|去掉|砍掉|少).{0,8}(\d+\s*天|一天|一日|day|days)|\b(remove|delete|drop|shorten|reduce)\b.{0,20}\b(\d+\s*days?|one day|a day)\b/i.test(
      prompt
    );
  if (!asksToReduceDays) return false;

  if (
    /随便|任意|你帮我|帮我选|自动|都可以|无所谓|any|whatever|whichever|you choose|up to you/i.test(
      prompt
    )
  ) {
    return false;
  }

  if (
    /第\s*\d+\s*天|day\s*\d+|最后一天|最后一日|第一天|第一日|last day|first day|\d{1,2}\s*月\s*\d{1,2}\s*日/i.test(
      prompt
    )
  ) {
    return false;
  }

  return !getItineraryCities(currentItinerary, payload).some((city) =>
    new RegExp(escapeRegExp(city), "i").test(prompt)
  );
}

function buildAmbiguousReductionClarification(
  payload: Record<string, unknown>,
  currentItinerary: ItineraryDay[],
  locale: ResponseLocale
): RevisionResponse | null {
  if (!isAmbiguousDayReductionPrompt(payload, currentItinerary)) return null;

  const cities = getItineraryCities(currentItinerary, payload);
  const lastDay = Math.max(1, currentItinerary.length);
  const firstCity = cities[0];

  return {
    action: "clarify",
    reply:
      locale === "zh"
        ? "你想减少哪一天？请告诉我删除第几天、从哪个城市减少一天；如果都可以，也可以直接说“你帮我选一天”。"
        : "Which day should I remove? Tell me the day number or city to reduce, or say I can choose any day.",
    itinerary: currentItinerary,
    state_patch: {},
    module_patch: {},
    edit_summary: "",
    quick_replies:
      locale === "zh"
        ? [
            { label: `删除第 ${lastDay} 天`, value: `删除第 ${lastDay} 天` },
            ...(firstCity
              ? [
                  {
                    label: `从${firstCity}减少`,
                    value: `从${firstCity}减少一天`,
                  },
                ]
              : []),
            { label: "你帮我选一天", value: "你帮我选一天，减少任意一天" },
          ].slice(0, 3)
        : [
            { label: `Delete day ${lastDay}`, value: `Delete day ${lastDay}` },
            ...(firstCity
              ? [
                  {
                    label: `Reduce ${firstCity}`,
                    value: `Reduce one day in ${firstCity}`,
                  },
                ]
              : []),
            { label: "You choose", value: "You choose one day to remove." },
          ].slice(0, 3),
  };
}

function normalizeRevisionResponse(
  value: unknown,
  currentItinerary: ItineraryDay[],
  locale: ResponseLocale
): RevisionResponse {
  if (!isRecord(value)) {
    throw new Error("OpenAI revision response is not an object.");
  }

  const rawAction = typeof value.action === "string" ? value.action : "";
  const action =
    rawAction === "revise" || rawAction === "restart" || rawAction === "clarify"
      ? rawAction
      : "clarify";
  const itinerary = normalizeItinerary(value.itinerary);
  const statePatch = isRecord(value.state_patch) ? value.state_patch : {};
  const modulePatch = isRecord(value.module_patch) ? value.module_patch : {};

  if (action === "revise" && itinerary.length === 0) {
    throw new Error("OpenAI revision returned an empty itinerary.");
  }

  const effectiveItinerary = itinerary.length ? itinerary : currentItinerary;
  if (
    action === "revise" &&
    itinerarySignature(effectiveItinerary) === itinerarySignature(currentItinerary) &&
    !hasPatch(statePatch) &&
    !hasPatch(modulePatch)
  ) {
    return {
      action: "clarify",
      reply:
        locale === "zh"
          ? "可以，我能继续帮你改这份行程。请告诉我具体要改第几天、哪个城市或哪个景点；如果你不确定，也可以说让我按当前路线自动安排。"
          : "Yes, I can keep revising this itinerary. Please tell me the day, city, or place to change; if you are not sure, say that I can place it automatically along the current route.",
      itinerary: currentItinerary,
      state_patch: {},
      module_patch: {},
      edit_summary: "OpenAI returned unchanged itinerary",
      quick_replies: [],
    };
  }

  return {
    action,
    reply:
      typeof value.reply === "string" && value.reply.trim()
        ? value.reply.trim()
        : action === "revise"
          ? locale === "zh" ? "已根据你的要求更新行程。" : "I updated the itinerary based on your request."
          : locale === "zh" ? "我需要再确认一下你的修改要求。" : "I need to confirm your revision request first.",
    itinerary: effectiveItinerary,
    state_patch: statePatch,
    module_patch: modulePatch,
    edit_summary:
      typeof value.edit_summary === "string" ? value.edit_summary.trim() : "",
    quick_replies: Array.isArray(value.quick_replies)
      ? value.quick_replies.filter(
          (reply): reply is { label: string; value: string } =>
            isRecord(reply) &&
            typeof reply.label === "string" &&
            typeof reply.value === "string"
        )
      : [],
  };
}

function isLegacyFallbackRevision(value: RevisionResponse): boolean {
  const combined = `${value.reply}\n${value.edit_summary}`;
  return (
    combined.includes("保留原路线") &&
    combined.includes("轻量调整行程说明")
  );
}

function buildRevisionPrompt(payload: Record<string, unknown>, locale: ResponseLocale): string {
  const languageInstruction = locale === "zh"
    ? "reply 和 quick_replies 必须使用简体中文。"
    : "reply and quick_replies must be in English.";

  return `你是 VIZA Travel AI 的 itinerary 修订引擎。

必须只输出 JSON object，不要 Markdown，不要额外解释。
reply 字段必须是纯文本，不能包含 Markdown、代码块、JSON、XML 或 HTML。
${languageInstruction}

硬性规则：
1. 用户每一句自然语言修改都必须实际反映到 itinerary、state_patch 或 module_patch。
2. 如果用户要求增加、减少或移动某一天，必须返回完整更新后的 itinerary。
3. 如果用户只说“减少一天 / 减少 1 天 / remove one day”但没有指定第几天、城市或日期，并且没有说“任意/随便/你帮我选/any/you choose”，action 必须用 clarify，追问要删除哪一天；不能自行删最后一天或任意一天。
4. 如果用户说“还想去/加/加入”某个城市或景点，必须把它加入合适日期；提到“最后一天”就放到最后一天。
5. 景点和城市按常识归属，例如“长城”归入北京/中国。
6. 如果新增城市不在 state.cities，必须在 state_patch.cities、state_patch.countries、state_patch.travel_order 和 state_patch.city_days 中补齐。
7. 不要只写“已更新”但保持 itinerary 不变；无法安全修改时 action 用 clarify。

输出 schema：
{
  "action": "revise | restart | clarify",
  "reply": "给用户看的纯文本",
  "itinerary": [],
  "state_patch": {},
  "module_patch": {},
  "edit_summary": "一句话说明改了什么",
  "quick_replies": [{"label": "便宜一点", "value": "把这次旅行便宜一点"}]
}

当前请求：
${JSON.stringify(payload)}`;
}

function readEnvValue(filePath: string, key: string): string | null {
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, "utf8");
  const pattern = new RegExp(`^${key}\\s*=\\s*(.*)$`, "m");
  const match = content.match(pattern);
  if (!match?.[1]) return null;

  return match[1].trim().replace(/^["']|["']$/g, "") || null;
}

function getOpenAiApiKey(): string | null {
  const directKey = process.env.OPENAI_API_KEY?.trim();
  if (directKey) return directKey;

  const candidateEnvFiles = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "viza-be/travel-service/.env.local"),
    path.resolve(process.cwd(), "viza-be/travel-service/.env"),
    path.resolve(process.cwd(), "..", "viza-be/travel-service/.env.local"),
    path.resolve(process.cwd(), "..", "viza-be/travel-service/.env"),
    path.resolve(process.cwd(), "../..", "viza-be/travel-service/.env.local"),
    path.resolve(process.cwd(), "../..", "viza-be/travel-service/.env"),
  ];

  for (const envFile of candidateEnvFiles) {
    const value = readEnvValue(envFile, "OPENAI_API_KEY");
    if (value) return value;
  }

  return null;
}

async function reviseWithOpenAI(
  payload: Record<string, unknown>,
  currentItinerary: ItineraryDay[],
  locale: ResponseLocale
): Promise<RevisionResponse | null> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TRAVEL_REVISION_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            locale === "zh"
              ? "你是严格的 JSON 输出器。所有 itinerary revision 都必须真实改变 itinerary 或 patch；不能返回 Markdown。用户可见文本必须使用简体中文。"
              : "You are a strict JSON generator. Every itinerary revision must actually change the itinerary or patch; never return Markdown. User-facing text must be in English.",
        },
        { role: "user", content: buildRevisionPrompt(payload, locale) },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || "OpenAI itinerary revision failed.");
  }

  const raw = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = raw.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI itinerary revision returned empty content.");
  }

  return normalizeRevisionResponse(JSON.parse(content), currentItinerary, locale);
}

async function reviseWithTravelBackend(
  payload: Record<string, unknown>,
  currentItinerary: ItineraryDay[],
  locale: ResponseLocale
) {
  const candidatePaths = ["/revise-itinerary", "/api/revise-itinerary"];
  const tried: Array<{ path: string; status: number; detail: string }> = [];

  for (const path of candidatePaths) {
    const response = await forwardJsonToTravelBackend(path, payload);
    const text = await response.text();

    if (response.ok) {
      const normalized = normalizeRevisionResponse(
        JSON.parse(text),
        currentItinerary,
        locale
      );
      if (isLegacyFallbackRevision(normalized)) {
        return {
          action: "clarify",
          reply:
            locale === "zh"
              ? "可以，我能帮你调整这份行程。你想把这次修改放在哪个城市或哪一天？比如增加一天在东京、把长城放到最后一天，或者让我按路线自动安排。"
              : "Sure, I can revise this itinerary. Which city or day should this change go into? For example, add a day in Tokyo, put the Great Wall on the last day, or let me place it automatically along the route.",
          itinerary: currentItinerary,
          state_patch: {},
          module_patch: {},
          edit_summary: "需要确认具体修改位置",
          quick_replies: [
            ...(locale === "zh"
              ? [
                  { label: "加到最后一天", value: "把这一天加到最后一天" },
                  { label: "按路线安排", value: "你按当前路线帮我自动安排" },
                  { label: "我指定城市", value: "我想指定加在哪个城市" },
                ]
              : [
                  { label: "Add to last day", value: "Add this day to the last day" },
                  { label: "Place by route", value: "Place it automatically along the current route" },
                  { label: "I’ll choose a city", value: "I want to choose which city to add it to" },
                ]),
          ],
        };
      }
      return normalized;
    }

    tried.push({ path, status: response.status, detail: text || "" });

    if (response.status !== 404) {
      throw new Error(text || "Failed to revise itinerary.");
    }
  }

  throw new Error(
    `No compatible itinerary revision endpoint found on backend. ${JSON.stringify(
      tried
    )}`
  );
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const locale = normalizeResponseLocale(payload.locale);
    const currentItinerary = normalizeItinerary(payload.current_itinerary);
    const clarification = buildAmbiguousReductionClarification(
      payload,
      currentItinerary,
      locale
    );
    if (clarification) {
      return Response.json(clarification, { status: 200 });
    }

    const openAiRevision = await reviseWithOpenAI(payload, currentItinerary, locale);

    if (openAiRevision) {
      return Response.json(openAiRevision, { status: 200 });
    }

    const backendRevision = await reviseWithTravelBackend(
      payload,
      currentItinerary,
      locale
    );
    return Response.json(backendRevision, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revise itinerary.";
    return Response.json({ error: message }, { status: 500 });
  }
}
