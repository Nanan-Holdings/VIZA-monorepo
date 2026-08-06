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
      testState.session.state_json = args.p_state_json as Record<string, unknown>;
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
import {
  applyTravelStateOperations,
} from "@/lib/travel/conversation-state";
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
  version = testState.session.state_version
) {
  return new Request("http://127.0.0.1:3000/api/travel/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "session-1",
      messageId,
      text,
      locale: "zh",
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
      reply: "没关系，我们可以先从你喜欢的旅行感觉开始。东京、迪拜和巴厘岛各有不同，你更偏向城市、美食还是放松？",
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
      reply: "两人短途旅行可以先按 8,000–15,000 元总预算参考，机票旺季需要再上调；这只是建议，我不会替你记录。",
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
        const text = [...input].reverse().find((item) => item.role === "user")
          ?.content;
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
