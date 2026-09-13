import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeSocketEvent {
  event: string;
  payload: unknown;
}

type FakeSocketHandler = (payload?: unknown) => void;

interface FakeSocket {
  active: boolean;
  connected: boolean;
  id: string;
  emitted: FakeSocketEvent[];
  handlers: Map<string, FakeSocketHandler>;
  managerHandlers: Map<string, FakeSocketHandler>;
  io: {
    on: (event: string, handler: FakeSocketHandler) => FakeSocket["io"];
  };
  on: (event: string, handler: FakeSocketHandler) => FakeSocket;
  emit: (event: string, payload?: unknown) => boolean;
  disconnect: () => void;
  fire: (event: string, payload?: unknown) => void;
}

const testState = vi.hoisted(() => ({
  io: vi.fn(),
  socket: null as FakeSocket | null,
  translate: (key: string) =>
    key === "connectionUnavailable" ? "The connection is unavailable." : key,
}));

const connectionUnavailableCopy = "The connection is unavailable.";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => testState.translate,
}));

vi.mock("socket.io-client", () => ({
  io: testState.io,
}));

vi.mock("@/lib/socket-transports", () => ({
  resolveSocketTransports: () => ["websocket"],
}));

vi.mock("sonner", () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("@/app/actions/companion-sessions", () => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  ensureSessionMessage: vi.fn().mockResolvedValue({ success: true }),
  getMessagePreviews: vi.fn().mockResolvedValue({ previews: [], hasMore: false }),
  getMessagesAroundCheckpoint: vi.fn().mockResolvedValue({
    messages: [],
    hasMoreBefore: false,
  }),
  getRecentMessages: vi.fn().mockResolvedValue({ messages: [], hasMore: false }),
  getSessionMessages: vi.fn().mockResolvedValue([]),
  loadMoreHistory: vi.fn().mockResolvedValue({
    messages: [],
    hasMore: false,
    reachedBoundary: false,
  }),
  renameSession: vi.fn(),
  searchMessages: vi.fn().mockResolvedValue({
    results: [],
    hasMore: false,
    totalCount: 0,
  }),
}));

vi.mock("@/components/application-steps", () => ({
  ConfirmationCard: () => null,
  DatePickerCard: () => null,
  DocumentChecklistCard: () => null,
  DocumentUploadStep: () => null,
  FileUploadCard: () => null,
  FormCard: () => null,
  PassportStep: () => null,
  PersonalInfoStep: () => null,
  ReviewStep: () => null,
  StatusCard: () => null,
  StatusStep: () => null,
  TravelInfoStep: () => null,
}));

vi.mock("../travel-chat/travel-chat-client", () => ({
  TravelChatClient: () => null,
}));

vi.mock("@/components/client/companion/thinking-indicator", () => ({
  ThinkingIndicator: () => <div data-testid="thinking-indicator">Thinking...</div>,
}));

vi.mock("@/components/client/companion/block-message", () => ({
  BlockMessage: () => null,
}));

vi.mock("@/components/client/companion/scroll-to-bottom-fab", () => ({
  ScrollToBottomFab: () => null,
}));

vi.mock("@/components/client/companion/history-boundary-message", () => ({
  HistoryBoundaryMessage: () => null,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

import { ChatClient } from "./chat-client";

function createFakeSocket(): FakeSocket {
  const socket: FakeSocket = {
    active: true,
    connected: false,
    id: "socket-test",
    emitted: [],
    handlers: new Map(),
    managerHandlers: new Map(),
    io: {
      on(event, handler) {
        socket.managerHandlers.set(event, handler);
        return socket.io;
      },
    },
    on(event, handler) {
      socket.handlers.set(event, handler);
      return socket;
    },
    emit(event, payload) {
      socket.emitted.push({ event, payload });
      return true;
    },
    disconnect() {
      socket.connected = false;
      socket.active = false;
      socket.fire("disconnect", "test disconnect");
    },
    fire(event, payload) {
      socket.handlers.get(event)?.(payload);
    },
  };

  return socket;
}

function renderChat() {
  return render(
    <ChatClient
      userId="user-test"
      initialSessions={[]}
      initialSessionId="session-test"
      initialMessages={[]}
      travelApplicationId={null}
      travelApplicationStatus={null}
    />
  );
}

function connectSocket(): FakeSocket {
  const socket = testState.socket;
  if (!socket) throw new Error("The fake socket was not created");

  act(() => {
    socket.connected = true;
    socket.fire("connect");
  });

  return socket;
}

function sendMessage(message: string) {
  const input = screen.getByRole("textbox", { name: "Message input" });
  fireEvent.change(input, { target: { value: message } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

function visaRequests(socket: FakeSocket): unknown[] {
  return socket.emitted
    .filter((entry) => entry.event === "visa_chat_message")
    .map((entry) => entry.payload);
}

function responseComplete(fullResponse: string) {
  return {
    type: "response_complete",
    sessionId: "session-test",
    userId: "user-test",
    fullResponse,
    toolsUsed: [],
    escalated: false,
    duration: 12,
    timestamp: Date.now(),
  };
}

describe("ChatClient VIZA streaming contract", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    testState.socket = createFakeSocket();
    testState.io.mockReset();
    testState.io.mockImplementation(() => testState.socket);

    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    testState.socket = null;
    vi.clearAllMocks();
  });

  it("keeps token previews hidden while the assistant response is streaming", async () => {
    renderChat();
    const socket = connectSocket();

    sendMessage("How can I apply for a visa?");
    await waitFor(() => expect(visaRequests(socket)).toHaveLength(1));

    act(() => {
      socket.fire("token", {
        type: "token",
        payload: "ToapplyforaJapanShort-TermTourismeVISA",
        timestamp: Date.now(),
      });
    });

    expect(screen.getByTestId("thinking-indicator")).toBeInTheDocument();
    expect(screen.queryByText("ToapplyforaJapanShort-TermTourismeVISA")).not.toBeInTheDocument();
  });

  it("renders the parsed full response immediately when streaming completes", async () => {
    renderChat();
    const socket = connectSocket();

    sendMessage("How can I apply for a visa?");
    await waitFor(() => expect(visaRequests(socket)).toHaveLength(1));

    act(() => {
      socket.fire("token", {
        type: "token",
        payload: "unparsed partial preview",
        timestamp: Date.now(),
      });
      socket.fire(
        "response_complete",
        responseComplete("**To apply** for a Japan short-term tourism visa.")
      );
    });

    expect(screen.getByText("To apply for a Japan short-term tourism visa.")).toBeInTheDocument();
    expect(screen.queryByText("unparsed partial preview")).not.toBeInTheDocument();
    expect(screen.queryByTestId("thinking-indicator")).not.toBeInTheDocument();
  });

  it("replaces a failed response with localized connection copy without partial text", async () => {
    renderChat();
    const socket = connectSocket();

    sendMessage("How can I apply for a visa?");
    await waitFor(() => expect(visaRequests(socket)).toHaveLength(1));

    act(() => {
      socket.fire("token", {
        type: "token",
        payload: "private partial assistant text",
        timestamp: Date.now(),
      });
      socket.fire("error", {
        type: "error",
        message: "upstream provider failure",
        code: "AGENT_ERROR",
        timestamp: Date.now(),
      });
    });

    expect(screen.getByText(connectionUnavailableCopy)).toBeInTheDocument();
    expect(screen.queryByText("private partial assistant text")).not.toBeInTheDocument();
    expect(screen.queryByText("upstream provider failure")).not.toBeInTheDocument();
    expect(screen.queryByTestId("thinking-indicator")).not.toBeInTheDocument();
  });

  it("keeps a second message queued until the first response completes", async () => {
    renderChat();
    const socket = connectSocket();

    sendMessage("first question");
    await waitFor(() => expect(visaRequests(socket)).toHaveLength(1));

    sendMessage("second question");
    expect(visaRequests(socket)).toHaveLength(1);
    expect(screen.getByText("second question")).toBeInTheDocument();

    act(() => {
      socket.fire("response_complete", responseComplete("first answer"));
    });

    await waitFor(() => expect(visaRequests(socket)).toHaveLength(2));
    expect((visaRequests(socket)[1] as { message: string }).message).toBe("second question");
  });
});
