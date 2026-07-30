import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as postTravelChat } from "@/app/api/travel/chat/route";
import {
  parseTravelIntent,
  resolveLocalDestinationText,
} from "@/lib/travel/destination-resolver";

function travelChatRequest(
  message: string,
  overrides: Record<string, unknown> = {}
): Request {
  return new Request("http://127.0.0.1:3000/api/travel/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
      ...overrides,
    }),
  });
}

function stubOpenAITravelIntent(): void {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as {
        input: Array<{ role: string; content: string }>;
      };
      const parserInput = JSON.parse(requestBody.input[1].content) as {
        latest_user_message: string;
      };
      const message = parserInput.latest_user_message;
      const fields = {
        travel_days: null as number | null,
        travelers: null as number | null,
        budget: null as number | null,
        departure_date: null as string | null,
        date_flexibility: null as string | null,
        origin_country: null as string | null,
        origin_city: null as string | null,
        return_country: null as string | null,
        return_city: null as string | null,
      };
      let action:
        | "update_fields"
        | "choose_destination"
        | "recommend_destinations"
        | "ask_clarification"
        | "ignore" = "ignore";
      let shouldCreateCard = false;
      let destinationQuery: string | null = null;
      let replyZh = "请继续告诉我你的旅行需求。";

      if (/推荐|中东城市/.test(message)) {
        action = "recommend_destinations";
        replyZh =
          "可以考虑迪拜、阿布扎比和多哈。你可以先告诉我更偏好城市体验、文化还是海滨度假。";
      } else if (/洛杉矶/.test(message)) {
        action = "choose_destination";
        shouldCreateCard = true;
        destinationQuery = "洛杉矶";
        fields.travel_days = 3;
        fields.origin_country = "China";
        fields.origin_city = "Changsha";
        fields.return_country = "China";
        fields.return_city = "Changsha";
        if (/2个人/.test(message)) fields.travelers = 2;
        if (/60000/.test(message)) fields.budget = 60000;
        replyZh = "已识别你明确选择了洛杉矶。";
      } else if (/美国/.test(message)) {
        action = "choose_destination";
        shouldCreateCard = true;
        destinationQuery = "美国";
        replyZh = "你选择了美国，请再确认具体城市。";
      } else if (/一共2个人，预算60000rmb/.test(message)) {
        action = "update_fields";
        fields.travelers = 2;
        fields.budget = 60000;
        replyZh = "已记录 2 位旅行者和 60000 元预算。";
      } else if (/不要这个/.test(message)) {
        action = "ask_clarification";
        replyZh = "你想删除哪一个景点或卡片？";
      }

      return Response.json({
        output_text: JSON.stringify({
          action,
          confidence: 0.95,
          should_create_destination_card: shouldCreateCard,
          destination_query: destinationQuery,
          fields,
          reply_zh: replyZh,
          reply_en: "I understood your travel request.",
        }),
      });
    })
  );
}

describe("travel negative command handling", () => {
  beforeEach(() => {
    stubOpenAITravelIntent();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(["不要这个", "这个不要", "删掉这个", "不要这个卡片"])(
    "classifies vague removal command %s without destination entities",
    (message) => {
      const intent = parseTravelIntent(message);

      expect(intent.intent).toBe("remove_item");
      expect(intent.destinations).toEqual([]);

      const resolution = resolveLocalDestinationText(message);
      expect(resolution.status).toBe("unresolved");
      expect(resolution.cards).toEqual([]);
      expect(resolution.debugTrace?.cardSourceStatus).toBe("none");
    }
  );

  it.each(["换一个", "我不喜欢这个景点", "这个太远了", "不要"])(
    "asks for clarification instead of creating a card for %s",
    (message) => {
      const intent = parseTravelIntent(message);

      expect(["replace_item", "remove_item", "clarify_needed"]).toContain(
        intent.intent
      );

      const resolution = resolveLocalDestinationText(message);
      expect(resolution.status).toBe("unresolved");
      expect(resolution.cards).toEqual([]);
    }
  );

  it("does not create a destination card for explicit removal of a known attraction", () => {
    const intent = parseTravelIntent("删掉岳麓山");
    expect(intent.intent).toBe("remove_item");
    expect(intent.destinations).toEqual([]);

    const resolution = resolveLocalDestinationText("删掉岳麓山");
    expect(resolution.status).toBe("unresolved");
    expect(resolution.cards).toEqual([]);
  });

  it.each(["你好", "hello", "谢谢", "好的"])(
    "does not create a destination card for greeting %s",
    (message) => {
      const intent = parseTravelIntent(message);
      expect(intent.intent).toBe("invalid_or_unrelated");

      const resolution = resolveLocalDestinationText(message);
      expect(resolution.status).toBe("unresolved");
      expect(resolution.cards).toEqual([]);
    }
  );

  it("chat API answers vague removal with clarification and no cards", async () => {
    const response = await postTravelChat(travelChatRequest("不要这个"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cards).toEqual([]);
    expect(payload.candidate_payload).toEqual({});
    expect(payload.reply).toContain("你想删除哪一个景点或卡片");
  });

  it("chat API answers greetings without creating destination cards", async () => {
    const response = await postTravelChat(travelChatRequest("你好"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cards).toEqual([]);
    expect(payload.candidate_payload).toEqual({});
  });

  it.each([
    "请给我推荐",
    "给我推荐一下",
    "请推荐一个旅行目的地",
    "还有推荐的中东城市吗",
  ])(
    "asks for recommendation preferences without creating a destination card for %s",
    async (message) => {
      const resolution = resolveLocalDestinationText(message);
      expect(resolution.status).toBe("unresolved");
      expect(resolution.cards).toEqual([]);

      const response = await postTravelChat(travelChatRequest(message));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.cards).toEqual([]);
      expect(payload.candidate_payload).toEqual({});
      expect(payload.reply).toContain("偏好");
      expect(JSON.stringify(payload)).not.toContain(`"title":"${message}"`);
    }
  );

  it("feeds the complete visible conversation to the AI parser before clarifying a recommendation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const requestBody = JSON.parse(String(init?.body)) as {
          input: Array<{ role: string; content: string }>;
        };
        const parserInput = JSON.parse(requestBody.input[1].content) as {
          conversation_history: Array<{ role: string; content: string }>;
          latest_user_message: string;
        };

        expect(parserInput.conversation_history).toEqual([
          { role: "user", content: "我想从新加坡出发" },
          { role: "assistant", content: "你想去哪里？" },
          { role: "user", content: "请给我推荐" },
        ]);
        expect(parserInput.latest_user_message).toBe("请给我推荐");

        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              action: "ask_clarification",
              confidence: 0.9,
              should_create_destination_card: false,
              destination_query: null,
              fields: {
                travel_days: null,
                travelers: null,
                budget: null,
                departure_date: null,
                date_flexibility: null,
                origin_country: null,
                origin_city: null,
                return_country: null,
                return_city: null,
              },
              reply_zh: "请补充偏好。",
              reply_en: "Please share your preferences.",
            }),
          }),
          { status: 200 }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await postTravelChat(
      travelChatRequest("请给我推荐", {
        messages: [
          { role: "user", content: "我想从新加坡出发" },
          { role: "assistant", content: "你想去哪里？" },
          { role: "user", content: "请给我推荐" },
        ],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cards).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("strips backend cards when the latest message does not name a destination", async () => {
    const response = await postTravelChat(travelChatRequest("随便说点什么"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cards).toEqual([]);
  });

  it("returns an OpenAI error instead of creating a fallback card", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream unavailable", { status: 503 }))
    );

    const response = await postTravelChat(
      travelChatRequest("还有推荐的中东城市吗")
    );
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toContain("OpenAI request failed");
    expect(payload.cards).toBeUndefined();
  });

  it("chat API parses a full Chinese planning prompt without turning origin into a destination", async () => {
    const response = await postTravelChat(
      travelChatRequest(
        "我想去洛杉矶玩3天，预算60000，从长沙出发，2个人，帮我规划一下旅行计划"
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cards.map((card: { city?: string }) => card.city)).toEqual([
      "Los Angeles",
    ]);
    expect(payload.quick_replies).toEqual([]);
    expect(payload.candidate_payload).toMatchObject({
      cities: ["Los Angeles"],
      travel_days: 3,
      travelers: 2,
      budget: 60000,
      origin_country: "China",
      origin_city: "Changsha",
      return_country: "China",
      return_city: "Changsha",
      destination_confirmed: true,
    });
  });

  it("chat API treats traveler and budget follow-up as field updates, not a destination", async () => {
    const response = await postTravelChat(
      travelChatRequest("一共2个人，预算60000rmb", {
        locale: "zh",
        state: {
          countries: ["United States"],
          cities: ["Los Angeles"],
          destination_confirmed: true,
          travel_days: 3,
          origin_country: "China",
          origin_city: "Changsha",
          return_country: "China",
          return_city: "Changsha",
          travel_order: ["Los Angeles"],
        },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cards).toEqual([]);
    expect(payload.quick_replies).toEqual([]);
    expect(payload.candidate_payload).toMatchObject({
      travelers: 2,
      budget: 60000,
    });
    expect(JSON.stringify(payload)).not.toContain("一共2个人");
  });

  it("chat API asks for a city instead of creating a card for country-only prompts", async () => {
    const response = await postTravelChat(
      travelChatRequest("我想要去美国", { locale: "zh" })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cards).toEqual([]);
    expect(payload.quick_replies).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining("加入计划") }),
      ])
    );
    expect(payload.reply).toContain("城市");
    expect(payload.candidate_payload).toMatchObject({
      countries: ["United States"],
      destination_confirmed: false,
    });
    expect(JSON.stringify(payload)).not.toContain('"city":"美国"');
  });

  it("does not create a card when OpenAI does not classify the message as an explicit destination choice", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({
              action: "update_fields",
              confidence: 0.9,
              should_create_destination_card: false,
              destination_query: null,
              fields: {
                travel_days: 3,
                travelers: null,
                budget: null,
                departure_date: null,
                date_flexibility: null,
                origin_country: null,
                origin_city: "Changsha",
                return_country: null,
                return_city: null,
              },
              reply_zh: "已记录。",
              reply_en: "Noted.",
            }),
          }),
          { status: 200 }
        );
      })
    );

    const response = await postTravelChat(
      travelChatRequest("我想去洛杉矶玩3天，从长沙出发，帮我规划一下旅行计划")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cards).toEqual([]);
    expect(payload.candidate_payload).toMatchObject({
      travel_days: 3,
      origin_city: "Changsha",
    });
  });
});
