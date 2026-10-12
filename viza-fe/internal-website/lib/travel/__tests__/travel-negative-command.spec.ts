import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => ({
  authSession: {
    userId: "user-1",
    sessionKind: "supabase",
  } as { userId: string; sessionKind: string } | null,
  session: {
    id: "session-1",
    state_json: {},
    state_version: 0,
    memory_summary: "",
    openai_previous_response_id: null as string | null,
    pending_actions_json: [] as unknown[],
  },
  messages: [] as Array<{
    role: "user" | "assistant";
    content: string;
    external_message_id: string;
    response_json?: Record<string, unknown>;
  }>,
  openAIRequests: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/travel/auth", () => ({
  getTravelUserSession: vi.fn(async () => testState.authSession),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder = {
        select() {
          return builder;
        },
        eq(key: string, value: unknown) {
          filters[key] = value;
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          if (table === "travel_agent_messages") {
            return Promise.resolve({
              data: testState.messages.map(({ role, content }) => ({
                role,
                content,
              })),
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        },
        maybeSingle() {
          if (table === "travel_agent_sessions") {
            return Promise.resolve({ data: testState.session, error: null });
          }
          if (table === "travel_user_preferences") {
            return Promise.resolve({ data: null, error: null });
          }
          if (table === "travel_agent_messages") {
            const stored = testState.messages.find(
              (message) =>
                message.role === "user" &&
                message.external_message_id === filters.external_message_id
            );
            return Promise.resolve({
              data: stored ? { response_json: stored.response_json } : null,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        insert() {
          return builder;
        },
        upsert() {
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
    async rpc(_name: string, args: Record<string, unknown>) {
      const response = args.p_response_json as Record<string, unknown>;
      testState.session.state_json = args.p_state_json as Record<
        string,
        unknown
      >;
      testState.session.state_version += 1;
      testState.session.memory_summary = String(args.p_memory_summary);
      testState.session.openai_previous_response_id = String(
        args.p_openai_response_id
      );
      testState.session.pending_actions_json =
        args.p_pending_actions_json as unknown[];
      testState.messages.push(
        {
          role: "user",
          content: String(args.p_user_content),
          external_message_id: String(args.p_external_message_id),
          response_json: response,
        },
        {
          role: "assistant",
          content: String(args.p_assistant_content),
          external_message_id: String(args.p_external_message_id),
        }
      );
      return { data: { status: "ok", response }, error: null };
    },
  }),
}));

import {
  GET as getTravelChat,
  POST as postTravelChat,
} from "@/app/api/travel/chat/route";
import { GET as getIpLocation } from "@/app/api/travel/ip-location/route";
import { applyTravelStateOperations } from "@/lib/travel/conversation-state";
import {
  createInitialTravelState,
  createTravelFormMessage,
} from "@/lib/travel/planner";

describe("Travel form display language", () => {
  it("uses the established Chinese city name for form-generated endpoint messages", () => {
    expect(
      createTravelFormMessage({
        origin_country: "美国",
        origin_city: "Los Angeles",
        return_country: "美国",
        return_city: "Los Angeles",
      })
    ).toBe("出发地设为 美国｜洛杉矶；返程地设为 美国｜洛杉矶。");
  });

  it("treats flexible travel as a complete date choice", () => {
    const result = applyTravelStateOperations(createInitialTravelState(), [
      {
        op: "set",
        path: "date_flexibility",
        valueText: "flexible",
        valueNumber: null,
        valueBoolean: null,
        explicit: true,
        evidence: "灵活出行",
      },
    ]);

    expect(result.state.date_flexibility).toBe("flexible");
    expect(result.state.departure_date).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });
});

describe("Travel IP origin suggestion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses edge geolocation headers without contacting a third party", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await getIpLocation(
      new Request("http://127.0.0.1:3000/api/travel/ip-location", {
        headers: {
          "x-vercel-ip-city": "Los%20Angeles",
          "x-vercel-ip-country": "US",
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      city: "Los Angeles",
      country: "United States",
      countryCode: "US",
      source: "edge-headers",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts the first valid provider instead of waiting for failed providers serially", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes("geolocation-db.com")) {
        return Response.json({
          city: "Los Angeles",
          country_name: "United States",
          country_code: "US",
        });
      }
      return new Response("unavailable", { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await getIpLocation(
      new Request("http://127.0.0.1:3000/api/travel/ip-location")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.city).toBe("Los Angeles");
    expect(body.country).toBe("United States");
    expect(body.source).toBe("geolocation-db");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});

function request(
  text: string,
  messageId: string,
  version = testState.session.state_version,
  locale: "zh" | "en" = "zh"
) {
  return new Request("http://127.0.0.1:3000/api/travel/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-1",
      messageId,
      text,
      locale,
      expectedStateVersion: version,
    }),
  });
}

function modelTurn(text: string) {
  const base = {
    intent: "answer_question",
    reply: "我明白了。",
    operations: [] as unknown[],
    recommendations: [] as string[],
    quick_replies: [] as unknown[],
    memory_summary: `用户刚才说：${text}`,
    preference_updates: [] as unknown[],
  };
  if (text === "我不知道去哪") {
    return {
      ...base,
      intent: "recommend_destinations",
      reply:
        "没关系，我们可以先从你喜欢的旅行感觉开始。东京、迪拜和巴厘岛各有不同，你更偏向城市、美食还是放松？",
      recommendations: ["东京", "迪拜", "巴厘岛"],
    };
  }
  if (text === "我想去东京") {
    return {
      ...base,
      intent: "select_destination",
      reply: "好呀，东京已经加入这次旅行。接下来想安排几天？",
      operations: [
        {
          op: "add",
          path: "cities",
          value_text: "东京",
          value_number: null,
          value_boolean: null,
          explicit: true,
          evidence: "东京",
        },
      ],
    };
  }
  if (text === "我想去波兰") {
    return {
      ...base,
      intent: "select_destination",
      reply: "好的，波兰已经加入这次旅行。",
      // Reproduce a model acknowledgement that omitted the state operation.
      operations: [],
    };
  }
  if (text === "我选择了国家：波兰。") {
    return {
      ...base,
      intent: "select_destination",
      reply: "好的，已记录你的目的地国家：波兰。",
      // Form messages are visible natural language. The coordinator must
      // still commit the explicit selection when the model only acknowledges
      // it instead of returning an operation.
      operations: [],
    };
  }
  if (text === "我选择了国家：波兰、德国。") {
    return {
      ...base,
      intent: "select_destination",
      reply: "好的，已记录你选择的国家：波兰和德国。",
      operations: [],
    };
  }
  if (
    text === "Plan a 5-day trip to Warsaw and Krakow" ||
    text === "Create an itinerary for Warsaw and Krakow"
  ) {
    return {
      ...base,
      intent: "generate_itinerary",
      reply: "我会先整理这两个城市的行程。",
      // Deliberately return a non-explicit partial guess. The server must
      // recover the complete explicit facts from the user's sentence.
      operations: [
        {
          op: "add",
          path: "cities",
          value_text: "Warsaw and Krakow",
          value_number: null,
          value_boolean: null,
          explicit: false,
          evidence: "Warsaw",
        },
      ],
    };
  }
  if (text === "我选择了城市：华沙、克拉科夫。") {
    return {
      ...base,
      intent: "select_destination",
      reply: "好的，已记录你选择的城市：华沙和克拉科夫。",
      operations: [],
    };
  }
  if (text === "我想去罗马") {
    return {
      ...base,
      intent: "select_destination",
      reply: "好的，罗马已经加入这次旅行。",
      operations: [
        {
          op: "add",
          path: "cities",
          value_text: "罗马",
          value_number: null,
          value_boolean: null,
          explicit: true,
          evidence: "罗马",
        },
      ],
    };
  }
  if (text === "我不要去东京") {
    return {
      ...base,
      intent: "remove_destination",
      reply: "好的，已经从这次旅行中移除东京。",
      operations: [
        {
          op: "remove",
          path: "cities",
          value_text: "东京",
          value_number: null,
          value_boolean: null,
          explicit: true,
          evidence: "东京",
        },
      ],
    };
  }
  if (text === "其实我不想去罗马了") {
    return {
      ...base,
      intent: "remove_destination",
      reply: "好的，那就先不考虑罗马了。",
      // Reproduce a real model mistake: it acknowledged the removal but only
      // cleared confirmation instead of removing the selected city.
      operations: [
        {
          op: "unset",
          path: "destination_confirmed",
          value_text: null,
          value_number: null,
          value_boolean: null,
          explicit: true,
          evidence: "不想去罗马",
        },
      ],
    };
  }
  if (text === "Actually 还是罗马吧，4天，2个人，预算一万人民币，节奏轻快") {
    return {
      ...base,
      intent: "record_facts",
      reply: "好，那我们回到罗马，按4天、2个人、预算1万人民币来规划。",
      operations: [
        {
          op: "add",
          path: "cities",
          value_text: "Rome",
          value_number: null,
          value_boolean: null,
          explicit: true,
          evidence: "罗马",
        },
        {
          op: "set",
          path: "travel_days",
          value_text: null,
          value_number: 4,
          value_boolean: null,
          explicit: true,
          evidence: "4天",
        },
        {
          op: "set",
          path: "travelers",
          value_text: null,
          value_number: 2,
          value_boolean: null,
          explicit: true,
          evidence: "2个人",
        },
        {
          op: "set",
          path: "budget",
          value_text: null,
          value_number: 10_000,
          value_boolean: null,
          explicit: true,
          evidence: "一万人民币",
        },
      ],
    };
  }
  if (text === "出发时间就定在下周末") {
    return {
      ...base,
      intent: "record_facts",
      reply: "好的，出发时间定在下周末。",
      // Reproduce a model acknowledgement that omitted the matching operation.
      operations: [],
    };
  }
  if (text === "多少预算合适") {
    return {
      ...base,
      reply: "要看目的地和旅行方式。你希望偏经济、舒适，还是轻奢？",
    };
  }
  if (text === "没有") {
    return {
      ...base,
      reply: "没关系，那我先按舒适但不铺张的标准来估算。",
    };
  }
  if (text === "推荐一下预算") {
    return {
      ...base,
      reply:
        "两人短途旅行可以先按 8,000–15,000 元总预算参考，机票旺季需要再上调；这只是建议，我不会替你记录。",
    };
  }
  if (text === "广州出发，2个人去东京玩4天，预算8000，回广州") {
    const operation = (
      path: string,
      valueText: string | null,
      valueNumber: number | null,
      evidence: string
    ) => ({
      op: path === "cities" ? "add" : "set",
      path,
      value_text: valueText,
      value_number: valueNumber,
      value_boolean: null,
      explicit: true,
      evidence,
    });
    return {
      ...base,
      intent: "record_facts",
      operations: [
        operation("cities", "东京", null, "东京"),
        operation("travel_days", null, 4, "4天"),
        operation("travelers", null, 2, "2个人"),
        operation("budget", null, 8000, "预算8000"),
        operation("origin_city", "广州", null, "广州出发"),
        operation("return_city", "广州", null, "回广州"),
      ],
    };
  }
  if (text === "出行日期先按灵活出行：2026-10-05（默认两个月后）。") {
    return {
      ...base,
      intent: "record_facts",
      reply: "好的，暂按灵活出行安排，参考出发日期为2026年10月5日。",
      operations: [
        {
          op: "set",
          path: "departure_date",
          value_text: "2026-10-05",
          value_number: null,
          value_boolean: null,
          explicit: true,
          // Reproduces the production failure: semantically equal, but not a
          // byte-for-byte substring of the user's ISO-formatted message.
          evidence: "2026年10月5日",
        },
        {
          op: "set",
          path: "date_flexibility",
          value_text: "flexible",
          value_number: null,
          value_boolean: null,
          explicit: true,
          evidence: "保持灵活",
        },
      ],
    };
  }
  if (text === "出发和返程城市都设为 日本 Koto-ku。") {
    return {
      ...base,
      intent: "record_facts",
      reply: "好的，已记录从 Koto-ku 出发并返回。",
      operations: [
        {
          op: "set",
          path: "origin_city",
          value_text: "Koto-ku",
          value_number: null,
          value_boolean: null,
          explicit: true,
          evidence: "从 Koto-ku 出发",
        },
      ],
    };
  }
  if (text === "直接生成行程") {
    // The coordinator must honor the user's explicit command even if the
    // model under-classifies this otherwise-correct response.
    return { ...base, intent: "record_facts", reply: "好，我来生成行程。" };
  }
  if (text === "请直接生成行程") {
    return {
      ...base,
      intent: "generate_itinerary",
      reply: "第 1 天先去一个我临时编出来的地方，第 2 天继续游览。",
    };
  }
  if (text === "我还没定预算") {
    return {
      ...base,
      intent: "record_facts",
      reply: "可以先按 8000 元预算规划，你确认后我再记录。",
      operations: [
        {
          op: "set",
          path: "budget",
          value_text: null,
          value_number: 8000,
          value_boolean: null,
          explicit: false,
          evidence: "建议预算 8000 元",
        },
      ],
    };
  }
  if (text === "确认这些更改") {
    return {
      ...base,
      intent: "confirm_action",
      reply: "好的，我来应用这项更改。",
      // Reproduce a model that repeats the pending scalar as an inference.
      // The short confirmation text itself contains no number, so the server
      // must apply the exact persisted proposal instead of revalidating it.
      operations: [
        {
          op: "set",
          path: "budget",
          value_text: null,
          value_number: 8000,
          value_boolean: null,
          explicit: false,
          evidence: "此前建议预算 8000 元",
        },
      ],
    };
  }
  if (text === "取消这些更改") {
    return {
      ...base,
      // The deterministic coordinator must recognize the visible UI action
      // even when the model under-classifies the short reply.
      intent: "answer_question",
      reply: "好的，不应用这项更改。",
    };
  }
  return base;
}

describe("Travel Agent server coordinator", () => {
  beforeEach(() => {
    testState.authSession = {
      userId: "user-1",
      sessionKind: "supabase",
    };
    testState.session.state_json = createInitialTravelState();
    testState.session.state_version = 0;
    testState.session.memory_summary = "";
    testState.session.openai_previous_response_id = null;
    testState.session.pending_actions_json = [];
    testState.messages.length = 0;
    testState.openAIRequests.length = 0;
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        testState.openAIRequests.push(body);
        const input = body.input as Array<{ role: string; content: string }>;
        const text = [...input]
          .reverse()
          .find((item) => item.role === "user")?.content;
        return Response.json({
          id: `resp-${testState.openAIRequests.length}`,
          output_text: JSON.stringify(modelTurn(text ?? "")),
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns a localized session error without calling OpenAI", async () => {
    testState.authSession = null;
    const response = await postTravelChat(request("下周", "m1"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: "登录状态已过期，请重新登录后继续。你的旅行计划没有发生变化。",
      code: "session_expired",
    });
    expect(testState.openAIRequests).toEqual([]);
    expect(testState.session.state_version).toBe(0);
  });

  it("recommends destinations without selecting one", async () => {
    const response = await postTravelChat(request("我不知道去哪", "m1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(testState.openAIRequests[0].model).toBe("gpt-5.6-luna");
    expect(body.cards).toHaveLength(2);
    expect(body.state.cities).toEqual([]);
    expect(body.state.countries).toEqual([]);
    expect(body.applied_operations).toEqual([]);
    expect(body.ui_action).toBe("collect_field");
    expect(body.next_missing_field).toBe("country");
  });

  it("restores the canonical server state without creating a second state source", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      countries: ["日本"],
      country: "日本",
      cities: ["东京"],
    };
    testState.session.state_version = 7;

    const response = await getTravelChat(
      new Request("http://127.0.0.1:3000/api/travel/chat?sessionId=session-1")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.exists).toBe(true);
    expect(body.state.cities).toEqual(["东京"]);
    expect(body.state_version).toBe(7);
  });

  it("adds and removes Tokyo only from explicit commands", async () => {
    const selected = await (
      await postTravelChat(request("我想去东京", "m1"))
    ).json();
    expect(selected.state.cities).toContain("东京");

    const removed = await (
      await postTravelChat(request("我不要去东京", "m2"))
    ).json();
    expect(removed.state.cities).not.toContain("东京");
    expect(removed.state.destination_confirmed).toBe(false);
  });

  it("keeps an explicit country selection instead of reopening the country step", async () => {
    const body = await (
      await postTravelChat(request("我选择了国家：波兰。", "country-planner"))
    ).json();

    expect(body.state.countries).toEqual(["波兰"]);
    expect(body.state.country).toBe("波兰");
    expect(body.next_missing_field).toBe("cities");
    expect(body.ui_action).toBe("collect_field");
  });

  it("advances after a natural-language country when the model omits its operation", async () => {
    const body = await (
      await postTravelChat(request("我想去波兰", "natural-language-country"))
    ).json();

    expect(body.state.countries).toEqual(["波兰"]);
    expect(body.state.country).toBe("波兰");
    expect(body.next_missing_field).toBe("cities");
  });

  it("keeps Poland and records Warsaw, Krakow, and five days from the reported sequence", async () => {
    const selected = await (
      await postTravelChat(request("我选择了国家：波兰。", "reported-country"))
    ).json();
    expect(selected.state.countries).toEqual(["波兰"]);

    const planned = await (
      await postTravelChat(
        request(
          "给我计划，5天左右，去华沙和krakow",
          "reported-plan-after-country"
        )
      )
    ).json();

    expect(planned.state.countries).toEqual(["波兰"]);
    expect(planned.state.cities).toEqual(["华沙", "克拉科夫"]);
    expect(planned.state.travel_days).toBe(5);
    expect(planned.next_missing_field).toBe("destination_confirmation");
    expect(planned.pending_confirmation).toBe(false);
    expect(testState.session.pending_actions_json).toEqual([]);
  });

  it.each([
    {
      label: "Japan with a lowercase English city",
      countryMessage: "我选择了国家：日本。",
      planMessage: "给我安排，6天左右，去东京和osaka",
      expectedCountry: "日本",
      expectedCities: ["东京", "大阪"],
      expectedDays: 6,
      locale: "zh" as const,
    },
    {
      label: "France with mixed Chinese and English cities",
      countryMessage: "我选择了国家：法国。",
      planMessage: "做个7天计划，巴黎和Lyon",
      expectedCountry: "法国",
      expectedCities: ["巴黎", "里昂"],
      expectedDays: 7,
      locale: "zh" as const,
    },
    {
      label: "Italy with an English itinerary request",
      countryMessage: "我选择了国家：意大利。",
      planMessage: "Plan a 5-day trip to Rome and Milan",
      expectedCountry: "意大利",
      expectedCities: ["Rome", "Milan"],
      expectedDays: 5,
      locale: "en" as const,
    },
  ])(
    "does not reopen the country step for $label",
    async ({
      countryMessage,
      planMessage,
      expectedCountry,
      expectedCities,
      expectedDays,
      locale,
    }) => {
      const selected = await (
        await postTravelChat(request(countryMessage, "matrix-country"))
      ).json();

      expect(selected.state.countries).toEqual([expectedCountry]);
      expect(selected.next_missing_field).toBe("cities");

      const planned = await (
        await postTravelChat(
          request(
            planMessage,
            "matrix-plan-after-country",
            testState.session.state_version,
            locale
          )
        )
      ).json();

      expect(planned.state.countries).toEqual([expectedCountry]);
      expect(planned.state.country).toBe(expectedCountry);
      expect(planned.state.cities).toEqual(expectedCities);
      expect(planned.state.travel_days).toBe(expectedDays);
      expect(planned.next_missing_field).toBe("destination_confirmation");
      expect(planned.ui_action).not.toBe("collect_country");
      expect(planned.pending_confirmation).toBe(false);
      expect(testState.session.pending_actions_json).toEqual([]);
    }
  );

  it("recovers both English city facts when the model returns only a non-explicit partial guess", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      countries: ["Poland"],
      country: "Poland",
    };

    const body = await (
      await postTravelChat(
        request(
          "Plan a 5-day trip to Warsaw and Krakow",
          "partial-english-plan",
          0,
          "en"
        )
      )
    ).json();

    expect(body.state.cities).toEqual(["Warsaw", "Krakow"]);
    expect(body.state.travel_days).toBe(5);
    expect(body.applied_operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "add",
          path: "cities",
          valueText: "Warsaw",
          explicit: true,
        }),
        expect.objectContaining({
          op: "add",
          path: "cities",
          valueText: "Krakow",
          explicit: true,
        }),
      ])
    );
    expect(body.pending_confirmation).toBe(false);
    expect(testState.session.pending_actions_json).toEqual([]);
  });

  it("recovers both cities from an English itinerary-for request and does not treat advice questions as selections", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      countries: ["Poland"],
      country: "Poland",
    };

    const itinerary = await (
      await postTravelChat(
        request(
          "Create an itinerary for Warsaw and Krakow",
          "partial-english-itinerary",
          0,
          "en"
        )
      )
    ).json();
    expect(itinerary.state.cities).toEqual(["Warsaw", "Krakow"]);

    testState.session.state_json = createInitialTravelState();
    testState.session.state_version = 0;
    testState.session.pending_actions_json = [];
    testState.messages.length = 0;

    for (const [index, text] of [
      "If I plan a trip to Japan, do I need a visa?",
      "Would a trip to Japan be expensive?",
    ].entries()) {
      const body = await (
        await postTravelChat(request(text, `advice-${index}`, index, "en"))
      ).json();
      expect(body.state.countries).toEqual([]);
      expect(body.state.cities).toEqual([]);
      expect(body.applied_operations).toEqual([]);
    }
  });

  it("treats a direct factual planning question as a destination request", async () => {
    const body = await (
      await postTravelChat(
        request(
          "Can you plan a trip to Japan?",
          "factual-planning-question",
          0,
          "en"
        )
      )
    ).json();

    expect(body.state.countries).toEqual(["Japan"]);
    expect(body.state.cities).toEqual([]);
    expect(body.applied_operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "add",
          path: "countries",
          valueText: "Japan",
          explicit: true,
        }),
      ])
    );
  });

  it("does not infer countries from English words that happen to be ISO codes", async () => {
    for (const [index, text] of [
      "Plan a 5-day trip to Warsaw in May",
      "Plan a 5-day trip to Krakow as usual",
      "Plan a 5-day trip to Warsaw, no rush",
    ].entries()) {
      const body = await (
        await postTravelChat(request(text, `iso-word-${index}`, index, "en"))
      ).json();
      expect(body.state.countries).not.toEqual(
        expect.arrayContaining(["India", "American Samoa", "Norway"])
      );
    }
  });

  it("does not select shorter country names contained inside the stated country", async () => {
    const nigeria = await (
      await postTravelChat(
        request("Plan a trip to Nigeria", "country-prefix-nigeria", 0, "en")
      )
    ).json();
    expect(nigeria.state.countries).toEqual(["Nigeria"]);

    testState.session.state_json = createInitialTravelState();
    testState.session.state_version = 0;
    testState.session.pending_actions_json = [];
    testState.messages.length = 0;

    const equatorialGuinea = await (
      await postTravelChat(
        request(
          "Plan a trip to Equatorial Guinea",
          "country-contained-guinea",
          0,
          "en"
        )
      )
    ).json();
    expect(equatorialGuinea.state.countries).toEqual(["Equatorial Guinea"]);
  });

  it("does not treat a generic plan-to sentence as a travel destination request", async () => {
    const body = await (
      await postTravelChat(
        request("Plan to eat turkey for dinner", "non-travel-plan-to", 0, "en")
      )
    ).json();

    expect(body.state.countries).toEqual([]);
    expect(body.state.cities).toEqual([]);
    expect(body.applied_operations).toEqual([]);
  });

  it("preserves multiple explicit country selections in order", async () => {
    const body = await (
      await postTravelChat(
        request("我选择了国家：波兰、德国。", "multi-country-planner")
      )
    ).json();

    expect(body.state.countries).toEqual(["波兰", "德国"]);
    expect(body.state.country).toBe("波兰、德国");
    expect(body.next_missing_field).toBe("cities");
  });

  it("commits multiple form-selected cities even when they are not destination cards", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      countries: ["波兰"],
      country: "波兰",
    };

    const body = await (
      await postTravelChat(
        request("我选择了城市：华沙、克拉科夫。", "city-planner")
      )
    ).json();

    expect(body.state.cities).toEqual(["华沙", "克拉科夫"]);
    expect(body.next_missing_field).toBe("destination_confirmation");
  });

  it("coordinates country and multiple city facts from one natural-language turn", async () => {
    const body = await (
      await postTravelChat(
        request("我想去波兰，去华沙和krakow", "country-and-cities")
      )
    ).json();

    expect(body.state.countries).toEqual(["波兰"]);
    expect(body.state.cities).toEqual(["华沙", "克拉科夫"]);
    expect(body.pending_confirmation).toBe(false);
  });

  it("does not turn an ambiguous city-only mention into a country", async () => {
    const body = await (
      await postTravelChat(request("我想去Victoria", "ambiguous-city-only"))
    ).json();

    expect(body.state.countries).toEqual([]);
    expect(body.state.cities).toEqual([]);
    expect(body.applied_operations).toEqual([]);
  });

  it("keeps explicit destination replacement and confirmation separate from negation", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      countries: ["波兰"],
      country: "波兰",
      cities: ["华沙", "克拉科夫"],
      destination_confirmed: true,
    };

    const replaced = await (
      await postTravelChat(request("把华沙换成东京", "replace-city"))
    ).json();
    expect(replaced.state.cities).toEqual(["克拉科夫", "东京"]);
    expect(replaced.applied_operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "remove",
          path: "cities",
          valueText: "华沙",
          explicit: true,
        }),
        expect.objectContaining({
          op: "add",
          path: "cities",
          valueText: "东京",
          explicit: true,
        }),
      ])
    );

    for (const [index, text] of [
      "我不是不想去东京",
      "不要推荐东京",
    ].entries()) {
      const body = await (
        await postTravelChat(request(text, `negated-${index}`))
      ).json();
      expect(body.state.cities).toContain("东京");
      expect(body.applied_operations).toEqual([]);
    }
  });

  it("accepts repeated confirmation synonyms only for the selected destinations", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      countries: ["波兰"],
      country: "波兰",
      cities: ["华沙", "克拉科夫"],
    };

    const first = await (
      await postTravelChat(
        request("目的地就这些，继续规划后面的行程信息。", "confirm-1")
      )
    ).json();
    expect(first.state.destination_confirmed).toBe(true);

    const repeated = await (
      await postTravelChat(request("好的，就这些", "confirm-2"))
    ).json();
    expect(repeated.state.destination_confirmed).toBe(true);
    expect(repeated.state.cities).toEqual(["华沙", "克拉科夫"]);
  });

  it("removes the selected city when the model only acknowledges the command", async () => {
    const selected = await (
      await postTravelChat(request("我想去罗马", "m1"))
    ).json();
    expect(selected.state.cities).toContain("罗马");

    const unrelatedRejection = await (
      await postTravelChat(request("我不想去俄罗斯", "m2"))
    ).json();
    expect(unrelatedRejection.state.cities).toContain("罗马");

    const removed = await (
      await postTravelChat(request("其实我不想去罗马了", "m3"))
    ).json();
    expect(removed.state.cities).not.toContain("罗马");
    expect(removed.state.destination_confirmed).toBe(false);
    expect(removed.applied_operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "remove",
          path: "cities",
          valueText: "罗马",
          explicit: true,
        }),
      ])
    );

    await postTravelChat(request("我想去罗马", "m4"));
    const removedByAlias = await (
      await postTravelChat(request("I don't want Rome anymore", "m5"))
    ).json();
    expect(removedByAlias.state.cities).not.toContain("罗马");

    const mixedFacts = await (
      await postTravelChat(
        request(
          "Actually 还是罗马吧，4天，2个人，预算一万人民币，节奏轻快",
          "m6"
        )
      )
    ).json();
    expect(mixedFacts.state).toMatchObject({
      cities: ["罗马"],
      travel_days: 4,
      travelers: 2,
      budget: 10_000,
    });

    const keepRome = await (
      await postTravelChat(request("我不想去俄罗斯，但保留罗马", "m7"))
    ).json();
    expect(keepRome.state.cities).toEqual(["罗马"]);

    const departureDate = await (
      await postTravelChat(request("出发时间就定在下周末", "m8"))
    ).json();
    expect(departureDate.state.departure_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(departureDate.state.date_flexibility).toBe("fixed");
    expect(departureDate.applied_operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: "set",
          path: "departure_date",
          explicit: true,
        }),
        expect.objectContaining({
          op: "set",
          path: "date_flexibility",
          valueText: "fixed",
          explicit: true,
        }),
      ])
    );
  });

  it("keeps budget advice conversational and does not record a budget", async () => {
    for (const [index, text] of [
      "多少预算合适",
      "没有",
      "推荐一下预算",
    ].entries()) {
      const response = await postTravelChat(request(text, `m${index + 1}`));
      const body = await response.json();
      expect(body.state.budget).toBeNull();
    }

    expect(testState.openAIRequests[1].previous_response_id).toBe("resp-1");
    expect(testState.openAIRequests[2].previous_response_id).toBe("resp-2");
  });

  it("extracts multiple explicit facts in one turn and keeps Tokyo canonical", async () => {
    const response = await postTravelChat(
      request("广州出发，2个人去东京玩4天，预算8000，回广州", "multi")
    );
    const body = await response.json();

    expect(body.state.cities).toContain("东京");
    expect(body.state.countries).toContain("日本");
    expect(body.state.travel_days).toBe(4);
    expect(body.state.city_days).toEqual({ 东京: 4 });
    expect(body.state.travelers).toBe(2);
    expect(body.state.budget).toBe(8000);
    expect(body.state.origin_country).toBe("中国");
    expect(body.state.origin_city).toBe("广州");
    expect(body.state.return_country).toBe("中国");
    expect(body.state.return_city).toBe("广州");
  });

  it("commits a planner-card departure date despite model evidence formatting differences", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      countries: ["美国"],
      country: "美国",
      cities: ["旧金山"],
      destination_confirmed: true,
    };

    const response = await postTravelChat(
      request(
        "出行日期先按灵活出行：2026-10-05（默认两个月后）。",
        "departure-date"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.state.departure_date).toBe("2026-10-05");
    expect(body.state.date_flexibility).toBe("flexible");
    expect(body.next_missing_field).toBe("travel_days");
    expect(body.applied_operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "departure_date", explicit: true }),
        expect.objectContaining({ path: "date_flexibility", explicit: true }),
      ])
    );
  });

  it("commits all IP endpoint fields from the visible planner-card message", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      countries: ["美国"],
      country: "美国",
      cities: ["旧金山"],
      city_days: { 旧金山: 2 },
      destination_confirmed: true,
      departure_date: "2026-10-05",
      date_flexibility: "flexible",
      travel_days: 2,
      travelers: 2,
      budget: 4800,
    };

    const response = await postTravelChat(
      request("出发和返程城市都设为 日本 Koto-ku。", "ip-endpoints")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.state.origin_country).toBe("日本");
    expect(body.state.origin_city).toBe("Koto-ku");
    expect(body.state.return_country).toBe("日本");
    expect(body.state.return_city).toBe("Koto-ku");
    expect(body.next_missing_field).toBe("travel_order");
  });

  it("commits an empty final note and advances to itinerary generation", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      countries: ["美国"],
      country: "美国",
      cities: ["旧金山"],
      city_days: { 旧金山: 2 },
      destination_confirmed: true,
      departure_date: "2026-10-05",
      date_flexibility: "flexible",
      travel_days: 2,
      travelers: 2,
      budget: 4800,
      origin_country: "日本",
      origin_city: "Koto-ku",
      return_country: "日本",
      return_city: "Koto-ku",
      travel_order: ["旧金山"],
    };

    const response = await postTravelChat(
      request("我没有额外备注，直接生成行程。", "final-note")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.state.final_note).toBe("");
    expect(body.next_missing_field).toBeNull();
    expect(body.ui_action).toBe("generate_itinerary");
  });

  it("deterministically returns an itinerary UI action for an explicit request when state is complete", async () => {
    testState.session.state_json = {
      ...createInitialTravelState(),
      country: "日本",
      countries: ["日本"],
      cities: ["东京"],
      city_days: { 东京: 4 },
      destination_confirmed: true,
      departure_date: "2026-10-29",
      date_flexibility: "fixed",
      travel_days: 4,
      travelers: 2,
      budget: 8000,
      origin_country: "中国",
      origin_city: "广州",
      return_country: "中国",
      return_city: "广州",
      travel_order: ["东京"],
      final_note: "",
    };

    const body = await (
      await postTravelChat(request("直接生成行程", "generate"))
    ).json();
    expect(body.next_missing_field).toBeNull();
    expect(body.ui_action).toBe("generate_itinerary");
    expect(body.cards).toEqual([]);
  });

  it("does not invent a textual itinerary while required fields are missing", async () => {
    const body = await (
      await postTravelChat(request("请直接生成行程", "generate-incomplete"))
    ).json();

    expect(body.next_missing_field).toBe("country");
    expect(body.ui_action).toBe("collect_field");
    expect(body.reply).toBe(
      "可以。先告诉我想去哪个国家或地区，补齐后我就为你生成完整行程。"
    );
    expect(body.reply).not.toContain("第 1 天");
  });

  it("returns the stored response for a repeated message id without a second model call", async () => {
    const first = await postTravelChat(request("我不知道去哪", "same"));
    const firstBody = await first.json();
    const second = await postTravelChat(request("我不知道去哪", "same", 0));
    const secondBody = await second.json();

    expect(secondBody).toEqual(firstBody);
    expect(testState.openAIRequests).toHaveLength(1);
  });

  it("shows, restores, and applies the exact pending scalar after confirmation", async () => {
    const proposed = await (
      await postTravelChat(request("我还没定预算", "pending-budget"))
    ).json();

    expect(proposed.state.budget).toBeNull();
    expect(proposed.pending_confirmation).toBe(true);
    expect(proposed.pending_actions).toEqual([
      {
        op: "set",
        path: "budget",
        valueText: null,
        valueNumber: 8000,
        valueBoolean: null,
      },
    ]);

    const restored = await (
      await getTravelChat(
        new Request("http://127.0.0.1:3000/api/travel/chat?sessionId=session-1")
      )
    ).json();
    expect(restored.pending_confirmation).toBe(true);
    expect(restored.pending_actions).toEqual(proposed.pending_actions);

    const confirmed = await (
      await postTravelChat(request("确认这些更改", "confirm-budget"))
    ).json();
    expect(confirmed.state.budget).toBe(8000);
    expect(confirmed.applied_operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "budget", valueNumber: 8000 }),
      ])
    );
    expect(confirmed.pending_confirmation).toBe(false);
    expect(confirmed.pending_actions).toEqual([]);
    expect(testState.session.pending_actions_json).toEqual([]);
  });

  it("clears a visible pending proposal without applying it when rejected", async () => {
    await postTravelChat(request("我还没定预算", "pending-budget-reject"));

    const rejected = await (
      await postTravelChat(request("取消这些更改", "reject-budget"))
    ).json();
    expect(rejected.state.budget).toBeNull();
    expect(rejected.applied_operations).toEqual([]);
    expect(rejected.pending_confirmation).toBe(false);
    expect(rejected.pending_actions).toEqual([]);
    expect(testState.session.pending_actions_json).toEqual([]);
  });

  it("rejects a stale state version before calling the model or mutating state", async () => {
    await postTravelChat(request("我想去东京", "version-first"));
    const before = structuredClone(testState.session.state_json);

    const response = await postTravelChat(
      request("我想去罗马", "version-stale", 0)
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("state_version_conflict");
    expect(body.state).toEqual(before);
    expect(testState.session.state_json).toEqual(before);
    expect(testState.openAIRequests).toHaveLength(1);
  });

  it("does not mutate state when OpenAI fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 }))
    );
    const before = structuredClone(testState.session.state_json);
    const response = await postTravelChat(request("我想去东京", "m1"));

    expect(response.status).toBe(502);
    expect(testState.session.state_json).toEqual(before);
    expect(testState.session.state_version).toBe(0);
    expect(testState.messages).toEqual([]);
  });
});
