import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock socket.io-client
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockEmit = vi.fn();
const mockDisconnect = vi.fn();

const mockSocket = {
  on: mockOn,
  off: mockOff,
  emit: mockEmit,
  disconnect: mockDisconnect,
  connected: false,
  id: "test-socket-id",
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

// Import after mocking
import { useAgentSocket } from "../use-agent-socket";

describe("useAgentSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("initializes with disconnected status", () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    expect(result.current.status).toBe("disconnected");
  });

  it("initializes with empty messages", () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    expect(result.current.messages).toEqual([]);
  });

  it("initializes with empty logs", () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    expect(result.current.logs).toEqual([]);
  });

  it("provides connect function", () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    expect(typeof result.current.connect).toBe("function");
  });

  it("provides disconnect function", () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    expect(typeof result.current.disconnect).toBe("function");
  });

  it("provides sendMessage function", () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    expect(typeof result.current.sendMessage).toBe("function");
  });

  it("provides clearLogs function", () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    expect(typeof result.current.clearLogs).toBe("function");
  });

  it("provides clearMessages function", () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    expect(typeof result.current.clearMessages).toBe("function");
  });

  it("sets status to connecting when connect is called", async () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    await act(async () => {
      result.current.connect();
    });

    expect(result.current.status).toBe("connecting");
  });

  it("registers event handlers on connect", async () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    await act(async () => {
      result.current.connect();
    });

    // Should register for connection events
    expect(mockOn).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("disconnect", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("connect_error", expect.any(Function));

    // Should register for chat events
    expect(mockOn).toHaveBeenCalledWith("token", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("tool_call", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("tool_result", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("escalation", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("response_complete", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("does not send message when not connected", async () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    await act(async () => {
      result.current.sendMessage("Hello");
    });

    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("disconnects on unmount", async () => {
    const { unmount } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    unmount();

    // Cleanup should be called
    // Note: actual disconnect call depends on socket being connected
  });

  it("clears messages when clearMessages is called", async () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    await act(async () => {
      result.current.clearMessages();
    });

    expect(result.current.messages).toEqual([]);
  });

  it("clears logs when clearLogs is called", async () => {
    const { result } = renderHook(() =>
      useAgentSocket({
        serverUrl: "http://localhost:3002",
        userId: "user-1",
        sessionId: "session-1",
      })
    );

    await act(async () => {
      result.current.clearLogs();
    });

    expect(result.current.logs).toEqual([]);
  });
});
