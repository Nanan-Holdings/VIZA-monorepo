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

function normalizeRevisionResponse(
  value: unknown,
  currentItinerary: ItineraryDay[]
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
        "可以，我能帮你增加一天。你想把这一天加在哪个城市？也可以告诉我想加入的景点，比如长城、迪士尼或某个街区；如果你不确定，我可以按当前路线帮你放到最顺的一站。",
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
          ? "已根据你的要求更新行程。"
          : "我需要再确认一下你的修改要求。",
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

function buildRevisionPrompt(payload: Record<string, unknown>): string {
  return `你是 VIZA Travel AI 的 itinerary 修订引擎。

必须只输出 JSON object，不要 Markdown，不要额外解释。
reply 字段必须是中文纯文本，不能包含 Markdown、代码块、JSON、XML 或 HTML。

硬性规则：
1. 用户每一句自然语言修改都必须实际反映到 itinerary、state_patch 或 module_patch。
2. 如果用户要求增加、减少或移动某一天，必须返回完整更新后的 itinerary。
3. 如果用户说“还想去/加/加入”某个城市或景点，必须把它加入合适日期；提到“最后一天”就放到最后一天。
4. 景点和城市按常识归属，例如“长城”归入北京/中国。
5. 如果新增城市不在 state.cities，必须在 state_patch.cities、state_patch.countries、state_patch.travel_order 和 state_patch.city_days 中补齐。
6. 不要只写“已更新”但保持 itinerary 不变；无法安全修改时 action 用 clarify。

输出 schema：
{
  "action": "revise | restart | clarify",
  "reply": "给用户看的中文纯文本",
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
  currentItinerary: ItineraryDay[]
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
            "你是严格的 JSON 输出器。所有 itinerary revision 都必须真实改变 itinerary 或 patch；不能返回 Markdown。",
        },
        { role: "user", content: buildRevisionPrompt(payload) },
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

  return normalizeRevisionResponse(JSON.parse(content), currentItinerary);
}

async function reviseWithTravelBackend(
  payload: Record<string, unknown>,
  currentItinerary: ItineraryDay[]
) {
  const candidatePaths = ["/revise-itinerary", "/api/revise-itinerary"];
  const tried: Array<{ path: string; status: number; detail: string }> = [];

  for (const path of candidatePaths) {
    const response = await forwardJsonToTravelBackend(path, payload);
    const text = await response.text();

    if (response.ok) {
      const normalized = normalizeRevisionResponse(
        JSON.parse(text),
        currentItinerary
      );
      if (isLegacyFallbackRevision(normalized)) {
        return {
          action: "clarify",
          reply:
            "可以，我能帮你调整这份行程。你想把这次修改放在哪个城市或哪一天？比如增加一天在东京、把长城放到最后一天，或者让我按路线自动安排。",
          itinerary: currentItinerary,
          state_patch: {},
          module_patch: {},
          edit_summary: "需要确认具体修改位置",
          quick_replies: [
            { label: "加到最后一天", value: "把这一天加到最后一天" },
            { label: "按路线安排", value: "你按当前路线帮我自动安排" },
            { label: "我指定城市", value: "我想指定加在哪个城市" },
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
    const currentItinerary = normalizeItinerary(payload.current_itinerary);
    const openAiRevision = await reviseWithOpenAI(payload, currentItinerary);

    if (openAiRevision) {
      return Response.json(openAiRevision, { status: 200 });
    }

    const backendRevision = await reviseWithTravelBackend(
      payload,
      currentItinerary
    );
    return Response.json(backendRevision, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revise itinerary.";
    return Response.json({ error: message }, { status: 500 });
  }
}
