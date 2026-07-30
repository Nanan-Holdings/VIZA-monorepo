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

import { POST as postTravelChat } from "@/app/api/travel/chat/route";
import { createInitialTravelState } from "@/lib/travel/planner";

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
  if (
    text === "Actually 还是罗马吧，4天，2个人，预算一万人民币，节奏轻快"
  ) {
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
      reply: "两人短途旅行可以先按 8,000–15,000 元总预算参考，机票旺季需要再上调；这只是建议，我不会替你记录。",
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
    expect(body.cards.length).toBeGreaterThan(0);
    expect(body.state.cities).toEqual([]);
    expect(body.state.countries).toEqual([]);
    expect(body.applied_operations).toEqual([]);
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
      cities: ["Rome"],
      travel_days: 4,
      travelers: 2,
      budget: 10_000,
    });

    const keepRome = await (
      await postTravelChat(request("我不想去俄罗斯，但保留罗马", "m7"))
    ).json();
    expect(keepRome.state.cities).toEqual(["Rome"]);

    const departureDate = await (
      await postTravelChat(request("出发时间就定在下周末", "m8"))
    ).json();
    expect(departureDate.state.departure_date).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
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
