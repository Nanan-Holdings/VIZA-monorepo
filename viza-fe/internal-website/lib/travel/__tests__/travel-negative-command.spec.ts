import { describe, expect, it } from "vitest";
import { POST as postTravelChat } from "@/app/api/travel/chat/route";
import {
  parseTravelIntent,
  resolveLocalDestinationText,
} from "@/lib/travel/destination-resolver";

function travelChatRequest(message: string): Request {
  return new Request("http://127.0.0.1:3000/api/travel/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: message }],
    }),
  });
}

describe("travel negative command handling", () => {
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
    expect(payload.debug?.travel_pipeline?.detectedIntent).toBe("remove_item");
  });

  it("chat API answers greetings without creating destination cards", async () => {
    const response = await postTravelChat(travelChatRequest("你好"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.cards).toEqual([]);
    expect(payload.candidate_payload).toEqual({});
    expect(payload.debug?.travel_pipeline?.detectedIntent).toBe(
      "invalid_or_unrelated"
    );
  });
});
