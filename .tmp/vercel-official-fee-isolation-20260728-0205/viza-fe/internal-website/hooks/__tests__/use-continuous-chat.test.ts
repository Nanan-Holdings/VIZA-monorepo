import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock server actions
vi.mock("@/app/actions/companion-sessions", () => ({
  getMessagePreviews: vi.fn().mockResolvedValue({ previews: [], hasMore: false }),
  getMessagesAroundCheckpoint: vi.fn().mockResolvedValue({ messages: [], hasMoreBefore: false }),
  loadMoreHistory: vi.fn().mockResolvedValue({ messages: [], hasMore: false, reachedBoundary: false }),
  searchMessages: vi.fn().mockResolvedValue({ results: [], hasMore: false, totalCount: 0 }),
  getRecentMessages: vi.fn().mockResolvedValue([]),
}));

import { useContinuousChat } from "../use-continuous-chat";

describe("useContinuousChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with empty messages when no initialMessages provided", () => {
    const { result } = renderHook(() =>
      useContinuousChat({ userId: "p1" })
    );
    expect(result.current.messages).toEqual([]);
  });

  it("initializes messages from initialMessages prop", () => {
    const { result } = renderHook(() =>
      useContinuousChat({
        userId: "p1",
        initialMessages: [
          {
            id: "msg-1",
            sessionId: "s1",
            senderType: "user",
            content: "Hello",
            intent: null,
            riskLevel: null,
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
      })
    );
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe("Hello");
    expect(result.current.messages[0].role).toBe("user");
  });

  describe("addSocketMessage", () => {
    it("adds a new message", () => {
      const { result } = renderHook(() =>
        useContinuousChat({ userId: "p1" })
      );

      act(() => {
        result.current.addSocketMessage({
          id: "new-1",
          role: "user",
          content: "Hello",
          timestamp: Date.now(),
          isStreaming: false,
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe("new-1");
      expect(result.current.messages[0].content).toBe("Hello");
    });

    it("adds a streaming agent placeholder", () => {
      const { result } = renderHook(() =>
        useContinuousChat({ userId: "p1" })
      );

      act(() => {
        result.current.addSocketMessage({
          id: "agent-1",
          role: "agent",
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].isStreaming).toBe(true);
      expect(result.current.messages[0].content).toBe("");
    });

    it("updates an existing message when same id is provided", () => {
      const { result } = renderHook(() =>
        useContinuousChat({ userId: "p1" })
      );

      // Add initial streaming placeholder
      act(() => {
        result.current.addSocketMessage({
          id: "agent-1",
          role: "agent",
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
        });
      });

      expect(result.current.messages[0].content).toBe("");
      expect(result.current.messages[0].isStreaming).toBe(true);

      // Update with streamed token content
      act(() => {
        result.current.addSocketMessage({
          id: "agent-1",
          role: "agent",
          content: "Hello, I remember",
          timestamp: Date.now(),
          isStreaming: true,
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe("Hello, I remember");
      expect(result.current.messages[0].isStreaming).toBe(true);
    });

    it("marks message as complete on response_complete (isStreaming=false)", () => {
      const { result } = renderHook(() =>
        useContinuousChat({ userId: "p1" })
      );

      // Add initial streaming placeholder
      act(() => {
        result.current.addSocketMessage({
          id: "agent-1",
          role: "agent",
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
        });
      });

      // Simulate response_complete: full content + isStreaming=false
      act(() => {
        result.current.addSocketMessage({
          id: "agent-1",
          role: "agent",
          content: "I remember you mentioned your goal is to lose 10kg.",
          timestamp: Date.now(),
          isStreaming: false,
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe(
        "I remember you mentioned your goal is to lose 10kg."
      );
      expect(result.current.messages[0].isStreaming).toBe(false);
    });

    it("does not duplicate messages on re-add with same id", () => {
      const { result } = renderHook(() =>
        useContinuousChat({ userId: "p1" })
      );

      const msg = {
        id: "msg-1",
        role: "user" as const,
        content: "Hello",
        timestamp: Date.now(),
        isStreaming: false,
      };

      act(() => {
        result.current.addSocketMessage(msg);
        result.current.addSocketMessage(msg);
        result.current.addSocketMessage(msg);
      });

      expect(result.current.messages).toHaveLength(1);
    });

    it("handles full message lifecycle: placeholder → tokens → complete", () => {
      const { result } = renderHook(() =>
        useContinuousChat({ userId: "p1" })
      );

      const ts = Date.now();

      // 1. User sends message
      act(() => {
        result.current.addSocketMessage({
          id: "user-1",
          role: "user",
          content: "What do you remember about me?",
          timestamp: ts,
          isStreaming: false,
        });
      });

      // 2. Agent placeholder (streaming starts)
      act(() => {
        result.current.addSocketMessage({
          id: "agent-1",
          role: "agent",
          content: "",
          timestamp: ts + 1,
          isStreaming: true,
        });
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].isStreaming).toBe(true);
      expect(result.current.messages[1].content).toBe("");

      // 3. First token batch arrives
      act(() => {
        result.current.addSocketMessage({
          id: "agent-1",
          role: "agent",
          content: "I remember ",
          timestamp: ts + 1,
          isStreaming: true,
        });
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe("I remember ");

      // 4. More tokens
      act(() => {
        result.current.addSocketMessage({
          id: "agent-1",
          role: "agent",
          content: "I remember you mentioned",
          timestamp: ts + 1,
          isStreaming: true,
        });
      });

      expect(result.current.messages[1].content).toBe("I remember you mentioned");

      // 5. Response complete
      act(() => {
        result.current.addSocketMessage({
          id: "agent-1",
          role: "agent",
          content: "I remember you mentioned your goal is to lose weight.",
          timestamp: ts + 1,
          isStreaming: false,
        });
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe(
        "I remember you mentioned your goal is to lose weight."
      );
      expect(result.current.messages[1].isStreaming).toBe(false);
    });
  });
});
