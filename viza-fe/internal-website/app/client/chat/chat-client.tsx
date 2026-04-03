"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";
import { Sparkle } from "@phosphor-icons/react";
import Image from "next/image";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { io, Socket } from "socket.io-client";

import { useContinuousChat } from "@/hooks/use-continuous-chat";
import { ChatMessage } from "@/components/client/companion/chat-message";
import { ChatInput } from "@/components/client/companion/chat-input";
import { ThinkingIndicator } from "@/components/client/companion/thinking-indicator";
import { ContinuousSidebar } from "@/components/client/companion/continuous-sidebar";
import { DateDivider, isDifferentDay } from "@/components/client/companion/date-divider";
import { ScrollToBottomFab } from "@/components/client/companion/scroll-to-bottom-fab";
import { HistoryBoundaryMessage } from "@/components/client/companion/history-boundary-message";
import {
  createSession,
  type Session,
  type Message,
  type MessagePreview,
} from "@/app/actions/companion-sessions";
import type {
  ChatMessage as SocketChatMessage,
  ConnectionStatus,
  VisaChatRequest,
  TokenEvent,
  ToolCallEvent,
  ToolResultEvent,
  EscalationEvent,
  ResponseCompleteEvent,
  ErrorEvent,
  LogEntry,
} from "@/types/agent-test";

// Application step components
import {
  PersonalInfoStep,
  PassportStep,
  TravelInfoStep,
  DocumentUploadStep,
  ReviewStep,
  StatusStep,
  FileUploadCard,
  DatePickerCard,
  FormCard,
  DocumentChecklistCard,
  ConfirmationCard,
  StatusCard,
} from "@/components/application-steps";
import type { DocumentType, FormCardField } from "@/components/application-steps";

// Component protocol types (matches backend types/components.ts)
enum ComponentName {
  PersonalInfoStep = "PersonalInfoStep",
  PassportStep = "PassportStep",
  TravelInfoStep = "TravelInfoStep",
  DocumentUploadStep = "DocumentUploadStep",
  ReviewStep = "ReviewStep",
  StatusStep = "StatusStep",
  FileUploadCard = "FileUploadCard",
  DatePickerCard = "DatePickerCard",
  FormCard = "FormCard",
  DocumentChecklistCard = "DocumentChecklistCard",
  ConfirmationCard = "ConfirmationCard",
  StatusCard = "StatusCard",
}

interface ComponentEvent {
  type: "component";
  component: ComponentName;
  componentId: string;
  props: Record<string, unknown>;
}

interface ComponentCompleteEvent {
  type: "component_complete";
  componentId: string;
  result: unknown;
}

interface PendingComponent extends ComponentEvent {
  completed: boolean;
}

// Lazy load debug panel
const DebugPanel = dynamic(
  () => import("@/components/client/companion/debug-panel").then((mod) => ({ default: mod.DebugPanel })),
  { ssr: false }
);

// =============================================================================
// Types
// =============================================================================

interface ChatClientProps {
  userId: string;
  initialSessions: Session[];
  initialActiveSession: Session | null;
  initialMessages: Message[];
  initialCheckpoints?: MessagePreview[];
  isFirstTimeUser?: boolean;
}

// Agent backend URL
const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || "https://agent-backend-staging-kxvsjusria-as.a.run.app";

const TOKEN_BATCH_INTERVAL = 500;

// =============================================================================
// Inline Component Renderer
// =============================================================================

function InlineComponent({
  event,
  onComplete,
}: {
  event: PendingComponent;
  onComplete: (componentId: string, result: unknown) => void;
}) {
  const handleComplete = useCallback(
    (result: unknown) => onComplete(event.componentId, result),
    [event.componentId, onComplete]
  );

  const props = event.props as Record<string, unknown>;
  const applicationId = (props.applicationId as string) ?? "";

  if (event.completed) {
    return (
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center flex-shrink-0">
          <span className="text-brand-500 text-sm">✓</span>
        </div>
        <div className="bg-white rounded-xl rounded-tl-md border border-gray-100 px-4 py-3 shadow-sm">
          <p className="text-gray-500 text-sm">{event.component} completed.</p>
        </div>
      </div>
    );
  }

  switch (event.component) {
    case ComponentName.PersonalInfoStep:
      return (
        <PersonalInfoStep
          prefill={props.prefill as Record<string, string> | undefined}
          applicationId={applicationId}
          onComplete={handleComplete}
        />
      );

    case ComponentName.PassportStep:
      return (
        <PassportStep
          prefill={props.prefill as Record<string, string> | undefined}
          applicationId={applicationId}
          onComplete={handleComplete}
        />
      );

    case ComponentName.TravelInfoStep:
      return (
        <TravelInfoStep
          prefill={props.prefill as Record<string, string> | undefined}
          applicationId={applicationId}
          onComplete={handleComplete}
        />
      );

    case ComponentName.DocumentUploadStep:
      return (
        <DocumentUploadStep
          applicationId={applicationId}
          documentTypes={props.documentTypes as DocumentType[] | undefined}
          onComplete={handleComplete}
        />
      );

    case ComponentName.ReviewStep:
      return (
        <ReviewStep
          applicationId={applicationId}
          onComplete={handleComplete}
        />
      );

    case ComponentName.StatusStep:
      return (
        <StatusStep
          confirmationNumber={props.confirmationNumber as string}
          submittedAt={props.submittedAt as string}
          estimatedProcessingDays={props.estimatedProcessingDays as number}
          receiptUrl={props.receiptUrl as string | undefined}
          onComplete={handleComplete}
        />
      );

    case ComponentName.FileUploadCard:
      return (
        <FileUploadCard
          applicationId={applicationId}
          documentType={props.documentType as DocumentType}
          label={props.label as string}
          onComplete={handleComplete}
        />
      );

    case ComponentName.DatePickerCard:
      return (
        <DatePickerCard
          label={props.label as string}
          fieldName={props.fieldName as string}
          minDate={props.minDate as string | undefined}
          maxDate={props.maxDate as string | undefined}
          prefill={props.prefill as string | undefined}
          onComplete={handleComplete}
        />
      );

    case ComponentName.FormCard:
      return (
        <FormCard
          title={props.title as string}
          fields={props.fields as FormCardField[]}
          onComplete={handleComplete}
        />
      );

    case ComponentName.DocumentChecklistCard:
      return (
        <DocumentChecklistCard
          applicationId={applicationId}
          missingDocuments={props.missingDocuments as DocumentType[]}
          onComplete={handleComplete}
        />
      );

    case ComponentName.ConfirmationCard:
      return (
        <ConfirmationCard
          title={props.title as string}
          message={props.message as string}
          confirmLabel={props.confirmLabel as string | undefined}
          cancelLabel={props.cancelLabel as string | undefined}
          onComplete={handleComplete}
        />
      );

    case ComponentName.StatusCard:
      return (
        <StatusCard
          applicationId={applicationId}
          status={props.status as "draft" | "in_progress" | "submitted" | "approved" | "rejected"}
          message={props.message as string | undefined}
          onComplete={handleComplete}
        />
      );

    default:
      return null;
  }
}

// =============================================================================
// Main Chat Component
// =============================================================================

export function ChatClient({
  userId,
  initialSessions: _initialSessions,
  initialActiveSession,
  initialMessages,
  initialCheckpoints = [],
  isFirstTimeUser: initialIsFirstTimeUser = false,
}: ChatClientProps) {
  const t = useTranslations("chat");

  // ==========================================================================
  // Session & UI State
  // ==========================================================================

  const [sessionId, setSessionId] = useState<string | null>(
    initialActiveSession?.id || null
  );

  const [showChat, setShowChat] = useState(() => {
    // Persist chat view across remounts via sessionStorage
    if (typeof window !== "undefined" && sessionStorage.getItem("viza_chat_active") === "true") {
      return true;
    }
    return !!initialActiveSession || initialMessages.length > 0;
  });
  const [showDebug, setShowDebug] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileSearchActive, setIsMobileSearchActive] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingMessages] = useState(false);

  const [pendingMessages, setPendingMessages] = useState<string[]>([]);

  const [_isNearBottom, setIsNearBottom] = useState(true);

  // Component inline state
  const [pendingComponents, setPendingComponents] = useState<PendingComponent[]>([]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const queuedMessageRef = useRef<{ message: string; tempId: string } | null>(null);

  // ==========================================================================
  // Inline Socket Management (with component event support)
  // ==========================================================================

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [socketMessages, setSocketMessages] = useState<SocketChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const tokenBufferRef = useRef<string>("");
  const tokenFlushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

  const generateId = useCallback(() => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, []);

  const addLog = useCallback(
    (eventType: LogEntry["eventType"], data: unknown) => {
      const entry: LogEntry = {
        id: generateId(),
        eventType,
        timestamp: Date.now(),
        data,
        isExpanded: false,
      };
      setLogs((prev) => [...prev, entry]);
    },
    [generateId]
  );

  const flushTokenBuffer = useCallback(() => {
    if (tokenBufferRef.current) {
      const buffered = tokenBufferRef.current;
      addLog("token", { text: buffered });
      tokenBufferRef.current = "";

      // Push buffered tokens into the streaming message so the UI renders them
      if (currentMessageIdRef.current) {
        const msgId = currentMessageIdRef.current;
        setSocketMessages((prev) =>
          prev.map((msg) =>
            msg.id === msgId
              ? { ...msg, content: (msg.content || "") + buffered }
              : msg
          )
        );
      }
    }
    if (tokenFlushTimeoutRef.current) {
      clearTimeout(tokenFlushTimeoutRef.current);
      tokenFlushTimeoutRef.current = null;
    }
  }, [addLog]);

  const scheduleTokenFlush = useCallback(() => {
    if (!tokenFlushTimeoutRef.current) {
      tokenFlushTimeoutRef.current = setTimeout(flushTokenBuffer, TOKEN_BATCH_INTERVAL);
    }
  }, [flushTokenBuffer]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setStatus("connecting");

    const socket = io(`${AGENT_BACKEND_URL}/visa`, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      addLog("connected", { socketId: socket.id });
      socket.emit("join_room", `user:${userId}`);
    });

    socket.on("disconnect", (reason) => {
      setStatus("disconnected");
      addLog("disconnected", { reason });
      flushTokenBuffer();
    });

    socket.on("connect_error", (error) => {
      setStatus("error");
      addLog("error", { message: error.message, type: "connect_error" });
    });

    socket.on("token", (event: TokenEvent) => {
      tokenBufferRef.current += event.payload;
      scheduleTokenFlush();
    });

    socket.on("tool_call", (event: ToolCallEvent) => {
      flushTokenBuffer();
      addLog("tool_call", { toolName: event.toolName, args: event.args });
    });

    socket.on("tool_result", (event: ToolResultEvent) => {
      addLog("tool_result", { toolName: event.toolName, success: event.success });
    });

    socket.on("escalation", (event: EscalationEvent) => {
      flushTokenBuffer();
      addLog("escalation", { intent: event.intent, riskLevel: event.riskLevel, reason: event.reason });
    });

    socket.on("response_complete", (event: ResponseCompleteEvent) => {
      flushTokenBuffer();
      addLog("response_complete", {
        duration: event.duration,
        toolsUsed: event.toolsUsed,
        escalated: event.escalated,
        responseLength: event.fullResponse?.length || 0,
      });

      if (currentMessageIdRef.current) {
        const messageId = currentMessageIdRef.current;
        setSocketMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, isStreaming: false, content: event.fullResponse || "" }
              : msg
          )
        );
        currentMessageIdRef.current = null;
      }
    });

    socket.on("error", (event: ErrorEvent) => {
      flushTokenBuffer();
      addLog("error", { message: event.message, code: event.code });

      if (currentMessageIdRef.current) {
        setSocketMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentMessageIdRef.current
              ? { ...msg, isStreaming: false, content: msg.content || `Error: ${event.message}` }
              : msg
          )
        );
        currentMessageIdRef.current = null;
      }
    });

    socket.on("app_log", (event: Record<string, unknown>) => {
      addLog("app_log", {
        type: event.type,
        category: event.category,
        name: event.name,
        args: event.args,
        result: event.result,
        query: event.query,
        duration: event.duration,
      });
    });

    // Component inline rendering event
    socket.on("component", (event: ComponentEvent) => {
      if (event.type === "component") {
        setPendingComponents((prev) => [...prev, { ...event, completed: false }]);
      }
    });

    socket.on("proactive_message", (event: { sessionId: string; message: SocketChatMessage }) => {
      const proactiveMessage: SocketChatMessage = {
        id: event.message.id,
        role: "agent",
        content: event.message.content,
        timestamp: new Date((event.message as unknown as { createdAt: string }).createdAt).getTime(),
        isStreaming: false,
      };
      setSocketMessages((prev) => [...prev, proactiveMessage]);
      addLog("proactive_message", { messageId: event.message.id });
    });
  }, [userId, addLog, flushTokenBuffer, scheduleTokenFlush]);

  const disconnect = useCallback(() => {
    flushTokenBuffer();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus("disconnected");
  }, [flushTokenBuffer]);

  const socketSendMessage = useCallback(
    (message: string, sessionIdOverride?: string) => {
      const effectiveSessionId = sessionIdOverride || sessionId;

      if (!socketRef.current?.connected) {
        addLog("error", { message: "Not connected to server" });
        return;
      }

      if (!effectiveSessionId) {
        addLog("error", { message: "No session ID provided" });
        return;
      }

      const userMessageId = generateId();
      const userMessage: SocketChatMessage = {
        id: userMessageId,
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      setSocketMessages((prev) => [...prev, userMessage]);

      const agentMessageId = generateId();
      const agentMessage: SocketChatMessage = {
        id: agentMessageId,
        role: "agent",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };
      setSocketMessages((prev) => [...prev, agentMessage]);
      currentMessageIdRef.current = agentMessageId;

      const request: VisaChatRequest = {
        user_id: userId,
        session_id: effectiveSessionId,
        message,
      };

      socketRef.current.emit("visa_chat_message", request);
    },
    [userId, sessionId, addLog, generateId]
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  // Handle component completion — emit back to backend
  const handleComponentComplete = useCallback(
    (componentId: string, result: unknown) => {
      const event: ComponentCompleteEvent = {
        type: "component_complete",
        componentId,
        result,
      };
      socketRef.current?.emit("component_complete", event);
      setPendingComponents((prev) =>
        prev.map((c) => (c.componentId === componentId ? { ...c, completed: true } : c))
      );
    },
    []
  );

  // Auto-connect
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tokenFlushTimeoutRef.current) {
        clearTimeout(tokenFlushTimeoutRef.current);
      }
    };
  }, []);

  // ==========================================================================
  // Continuous Chat Hook
  // ==========================================================================

  const continuousChat = useContinuousChat({
    userId,
    initialMessages,
    initialCheckpoints,
    isFirstTimeUser: initialIsFirstTimeUser,
  });

  const {
    messages: chatMessages,
    isLoadingMore,
    hasMoreHistory,
    loadMoreHistory,
    jumpToMessage,
    jumpTargetId,
    refreshCheckpoints,
    addSocketMessage,
    setMessages: setChatMessages,
    setShowNewMessageButton,
    setShowScrollToBottom,
    pendingNewConversation,
    setPendingNewConversation,
    setCurrentSessionId,
  } = continuousChat;

  // ==========================================================================
  // Merge socket messages into continuous chat
  // ==========================================================================

  const prevSocketMessagesRef = useRef<typeof socketMessages>([]);

  useEffect(() => {
    const prev = prevSocketMessagesRef.current;

    for (let i = 0; i < socketMessages.length; i++) {
      const current = socketMessages[i];
      const previous = prev[i];
      if (current !== previous) {
        addSocketMessage({ ...current, sessionId: sessionId || undefined } as SocketChatMessage);
      }
    }

    prevSocketMessagesRef.current = socketMessages;
  }, [socketMessages, sessionId, addSocketMessage]);

  // ==========================================================================
  // Streaming state
  // ==========================================================================

  const isStreaming = useMemo(() => chatMessages.some((msg) => msg.isStreaming), [chatMessages]);

  const wasStreamingRef = useRef(false);
  useEffect(() => {
    const wasStreaming = wasStreamingRef.current;
    wasStreamingRef.current = isStreaming;

    if (wasStreaming && !isStreaming && queuedMessageRef.current) {
      const { message, tempId } = queuedMessageRef.current;
      queuedMessageRef.current = null;

      setChatMessages((prev) => prev.filter((m) => m.id !== tempId));
      socketSendMessage(message, sessionId || undefined);
    }
  }, [isStreaming, socketSendMessage, sessionId, setChatMessages]);

  // ==========================================================================
  // Smart Scroll
  // ==========================================================================

  const isNearBottomRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);

  const checkScrollPosition = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (isProgrammaticScrollRef.current) return;

    const threshold = 150;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nowNearBottom = distanceFromBottom < threshold;

    if (isNearBottomRef.current !== nowNearBottom) {
      isNearBottomRef.current = nowNearBottom;
      setIsNearBottom(nowNearBottom);
    }

    if (!nowNearBottom) {
      shouldAutoScrollRef.current = false;
    }

    setShowScrollToBottom(distanceFromBottom > 300);

    if (container.scrollTop < 100 && !isLoadingMore && hasMoreHistory) {
      prevScrollHeightRef.current = container.scrollHeight;
      loadMoreHistory();
    }
  }, [setShowScrollToBottom, isLoadingMore, hasMoreHistory, loadMoreHistory]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingMore) return;

    if (prevScrollHeightRef.current > 0) {
      const newScrollHeight = container.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
      if (scrollDiff > 0) {
        container.scrollTop = scrollDiff;
      }
      prevScrollHeightRef.current = 0;
    }
  }, [chatMessages, isLoadingMore]);

  const hasScrolledToBottomRef = useRef(false);
  useEffect(() => {
    if (chatMessages.length > 0 && !hasScrolledToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      hasScrolledToBottomRef.current = true;
    }
  }, [chatMessages.length]);

  const prevMessageCountRef = useRef(chatMessages.length);
  useEffect(() => {
    if (!hasScrolledToBottomRef.current) return;

    const prevCount = prevMessageCountRef.current;
    const currentCount = chatMessages.length;
    prevMessageCountRef.current = currentCount;

    const hasNewMessage = currentCount > prevCount;
    if (!hasNewMessage) return;

    shouldAutoScrollRef.current = true;

    if (isNearBottomRef.current && !isLoadingMore) {
      isProgrammaticScrollRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => { isProgrammaticScrollRef.current = false; }, 500);
      setShowNewMessageButton(false);
    } else if (!shouldAutoScrollRef.current) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg && !lastMsg.isStreaming) {
        setShowNewMessageButton(true);
      }
    }
  }, [chatMessages, isLoadingMore, setShowNewMessageButton]);

  useEffect(() => {
    if (!isStreaming) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      if (!shouldAutoScrollRef.current) return;

      isProgrammaticScrollRef.current = true;
      container.scrollTop = container.scrollHeight;
      requestAnimationFrame(() => { isProgrammaticScrollRef.current = false; });
    });

    observer.observe(container, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [isStreaming]);

  const scrollToBottom = useCallback(() => {
    shouldAutoScrollRef.current = true;
    isProgrammaticScrollRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 500);
    setShowNewMessageButton(false);
    setIsNearBottom(true);
    isNearBottomRef.current = true;
  }, [setShowNewMessageButton]);

  useEffect(() => {
    if (jumpTargetId) {
      const element = document.getElementById(`msg-${jumpTargetId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [jumpTargetId]);

  // ==========================================================================
  // Connection Status Effects
  // ==========================================================================

  useEffect(() => {
    if (status === "error") {
      toast.error(t("connectionReconnecting"));
    } else if (status === "connected" && pendingMessages.length > 0) {
      for (const msg of pendingMessages) {
        socketSendMessage(msg);
      }
      setPendingMessages([]);
      toast.success(t("connectedSending"));
    }
  }, [status, pendingMessages, socketSendMessage]);

  useEffect(() => {
    const handleFocus = () => refreshCheckpoints();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshCheckpoints]);

  // ==========================================================================
  // Escalation detection
  // ==========================================================================

  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog?.eventType === "escalation") {
      toast.info(t("agentNotified"));
    }
  }, [logs]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleSendMessage = useCallback(
    async (message: string) => {
      // Ensure chat view persists across any remounts
      sessionStorage.setItem("viza_chat_active", "true");

      let currentSessionId = sessionId;

      if (!currentSessionId || pendingNewConversation) {
        const newSession = await createSession(userId);
        if (!newSession) {
          toast.error(t("failedToStart"));
          return;
        }
        currentSessionId = newSession.id;
        setSessionId(currentSessionId);
        setCurrentSessionId(currentSessionId);
        setPendingNewConversation(false);
      }

      if (status !== "connected") {
        setPendingMessages((prev) => [...prev, message]);
        toast.info(t("willSendWhenConnected"));
        return;
      }

      if (isStreaming) {
        if (queuedMessageRef.current) return;
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        addSocketMessage({
          id: tempId,
          role: "user",
          content: message,
          timestamp: Date.now(),
          isStreaming: false,
          sessionId: currentSessionId,
        } as SocketChatMessage);
        queuedMessageRef.current = { message, tempId };
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
        return;
      }

      socketSendMessage(message, currentSessionId);
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    },
    [sessionId, userId, status, socketSendMessage, pendingNewConversation, setCurrentSessionId, setPendingNewConversation, isStreaming, addSocketMessage]
  );

  const handleVizaAiClick = useCallback(() => {
    setShowChat(true);
    sessionStorage.setItem("viza_chat_active", "true");
  }, []);

  const handleSupportTeamClick = useCallback(() => {
    toast.info(t("supportComingSoon"));
  }, []);

  const handleCheckpointClick = useCallback(async (messageId: string) => {
    setShowMobileSidebar(false);
    setShowChat(true);
    await jumpToMessage(messageId);
  }, [jumpToMessage]);

  const handleSearchResultClick = useCallback(async (messageId: string) => {
    setShowMobileSidebar(false);
    setShowChat(true);
    await jumpToMessage(messageId);
  }, [jumpToMessage]);

  // ==========================================================================
  // Render messages with dividers
  // ==========================================================================

  const renderMessagesWithDividers = useCallback(() => {
    const elements: React.ReactNode[] = [];
    let lastTimestamp: number | null = null;

    chatMessages.forEach((msg) => {
      if (lastTimestamp !== null && isDifferentDay(lastTimestamp, msg.timestamp)) {
        elements.push(<DateDivider key={`date-${msg.id}`} date={new Date(msg.timestamp)} />);
      }

      if (msg.isStreaming && msg.content === "") {
        lastTimestamp = msg.timestamp;
        return;
      }

      const isJumpTarget = jumpTargetId === msg.id;
      elements.push(
        <div
          key={msg.id}
          id={`msg-${msg.id}`}
          className={cn(
            "transition-colors duration-1000",
            isJumpTarget && "bg-yellow-50 -mx-4 px-4 py-2 rounded-md"
          )}
        >
          <ChatMessage
            role={msg.role === "user" ? "user" : "agent"}
            content={msg.content}
            timestamp={msg.timestamp}
          />
        </div>
      );

      lastTimestamp = msg.timestamp;
    });

    return elements;
  }, [chatMessages, jumpTargetId]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="chat-page fixed top-[104px] bottom-0 left-0 right-0 bg-[#fafafa] z-10 border-t border-[#e5e5e5]">
      {/* Desktop Sidebar - hidden (available for future use) */}
      <div className="hidden">
        <ContinuousSidebar
          checkpoints={continuousChat.checkpoints}
          isLoadingCheckpoints={continuousChat.isLoadingCheckpoints}
          hasMoreCheckpoints={continuousChat.hasMoreCheckpoints}
          onLoadMoreCheckpoints={continuousChat.loadMoreCheckpoints}
          onCheckpointClick={handleCheckpointClick}
          searchQuery={continuousChat.searchQuery}
          searchResults={continuousChat.searchResults}
          isSearching={continuousChat.isSearching}
          hasMoreSearchResults={continuousChat.hasMoreSearchResults}
          searchTotalCount={continuousChat.searchTotalCount}
          onSearch={continuousChat.search}
          onLoadMoreSearchResults={continuousChat.loadMoreSearchResults}
          onClearSearch={continuousChat.clearSearch}
          onSearchResultClick={handleSearchResultClick}
          onNewCareTeamChat={() => {}}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          collapsed={sidebarCollapsed}
        />
      </div>

      {/* Main Content */}
      <main className="h-full flex flex-col min-h-0">
        {/* Mobile Header — only in chat view */}
        {showChat && (
          <div className="hidden px-4 sm:px-6 pt-0 pb-2 -mt-2">
            <div className="flex items-center justify-between border-b border-[#e5e5e5] pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
              <p className="text-[17px] font-medium text-[#3d3d3d] tracking-[-0.2px]">VIZA</p>
              <button
                onClick={() => setShowMobileSidebar((prev) => !prev)}
                className="flex flex-col justify-center gap-1.5 rounded-full p-2 hover:bg-gray-100 transition-colors"
                aria-label={showMobileSidebar ? "Close chat menu" : "Open chat menu"}
              >
                <span className={cn("block h-[2px] w-5 bg-[#6b6b6b] rounded-full transition-transform duration-200", showMobileSidebar && "translate-y-[3.5px] rotate-45")} />
                <span className={cn("block h-[2px] w-3 bg-[#6b6b6b] rounded-full ml-auto transition-all duration-200", showMobileSidebar && "w-5 -translate-y-[3.5px] -rotate-45")} />
              </button>
            </div>

            <AnimatePresence>
              {showMobileSidebar && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 pb-2">
                    {!isMobileSearchActive ? (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => { setIsMobileSearchActive(true); continuousChat.search(""); }}
                          className="w-full flex items-center gap-3 py-2.5 px-2 rounded-md text-[#989898] hover:text-gray-700 hover:bg-gray-100/60 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span className="font-medium text-[15px] leading-[1.6]">{t("searchChats")}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2 py-2.5">
                        <input
                          type="text"
                          autoFocus
                          placeholder={t("searchPlaceholder")}
                          value={continuousChat.searchQuery}
                          onChange={(e) => continuousChat.search(e.target.value)}
                          className="flex-1 bg-gray-100 outline-none font-medium text-[14px] text-gray-800 px-3 py-2 rounded-md placeholder:text-[rgba(0,0,0,0.35)]"
                        />
                        <button
                          onClick={() => { setIsMobileSearchActive(false); continuousChat.clearSearch(); }}
                          className="flex items-center justify-center px-3 py-2 rounded-md text-[#989898] hover:text-gray-700 hover:bg-gray-100/60 transition-colors"
                          aria-label="Close search"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-[#efefef]">
                      {isMobileSearchActive ? (
                        <>
                          <p className="text-xs font-medium text-[rgba(0,0,0,0.3)] uppercase tracking-wider px-2 mb-2">
                            Search Results {continuousChat.searchTotalCount > 0 && `(${continuousChat.searchTotalCount})`}
                          </p>
                          <div className="max-h-[40vh] overflow-y-auto">
                            {continuousChat.searchResults.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {continuousChat.searchResults.map((result) => (
                                  <button
                                    key={result.id}
                                    onClick={() => { handleSearchResultClick(result.id); setIsMobileSearchActive(false); }}
                                    className="w-full text-left text-sm py-2 px-2 rounded-md text-[rgba(0,0,0,0.35)] hover:text-[rgba(0,0,0,0.6)] hover:bg-gray-100/60 transition-colors truncate"
                                  >
                                    {result.content}
                                  </button>
                                ))}
                                {continuousChat.hasMoreSearchResults && (
                                  <button
                                    onClick={() => continuousChat.loadMoreSearchResults()}
                                    className="w-full text-center text-sm py-2 px-2 text-brand-500 hover:bg-gray-100/60 transition-colors"
                                  >
                                    Load more results
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 px-2">{t("noResults")}</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-[rgba(0,0,0,0.3)] uppercase tracking-wider px-2 mb-2">{t("sessionHistory")}</p>
                          <div className="max-h-[40vh] overflow-y-auto">
                            {continuousChat.checkpoints.length > 0 ? (
                              <div className="flex flex-col gap-0.5">
                                {continuousChat.checkpoints.map((checkpoint) => (
                                  <button
                                    key={checkpoint.id}
                                    onClick={() => handleCheckpointClick(checkpoint.id)}
                                    className="w-full text-left text-sm py-2 px-2 rounded-md text-[rgba(0,0,0,0.35)] hover:text-[rgba(0,0,0,0.6)] hover:bg-gray-100/60 transition-colors truncate"
                                  >
                                    {checkpoint.content}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 px-2">{t("noConversations")}</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!showChat ? (
            /* Selection View */
            <motion.div
              key="selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-y-auto pt-6 pb-12 md:pb-4 md:pt-8 lg:py-10 h-full min-h-0"
            >
              <div className="flex-1 flex flex-col px-4 sm:px-6 md:px-8 lg:px-0">
                <div className="max-w-4xl w-full mx-auto flex flex-col flex-1 justify-between">
                  <div className="w-full flex flex-col gap-3 md:gap-6">
                    <div className="flex flex-col gap-3">
                      <h1 className="font-heading font-medium text-[18px] md:text-[24px] lg:text-[28px] leading-[1.3] text-[#3d3d3d] text-center tracking-[-0.54px] md:tracking-[-0.72px] lg:tracking-[-0.84px]">
                        Hi there, how can we help with your visa?
                      </h1>
                    </div>

                    {/* Mobile cards */}
                    <div className="flex flex-col gap-3 md:hidden w-full">
                      {/* VIZA AI Card - Mobile */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleVizaAiClick}
                        className="bg-white relative rounded-[16px] cursor-pointer transition-shadow duration-200 hover:shadow-[0_2px_12px_rgba(194,120,95,0.15)] overflow-hidden"
                      >
                        <div aria-hidden="true" className="absolute inset-0 border border-brand-500/40 rounded-[16px] pointer-events-none" />
                        <div className="relative flex items-center justify-between p-5 gap-4 w-full">
                          <div className="flex flex-col gap-1 items-start flex-1 min-w-0">
                            <h2 className="font-heading font-medium text-[16px] leading-[1.3] text-[#3d3d3d] tracking-[-0.48px] text-left">
                              <span>{t("chatWith")} </span>
                              <span className="text-brand-500">{t("vizaAI")}</span>
                            </h2>
                            <p className="font-sans font-medium text-[11px] leading-[1.6] text-[rgba(0,0,0,0.45)] text-left">
                              {t("vizaAIDescription")}
                            </p>
                          </div>
                          <div className="flex gap-1.5 items-center flex-shrink-0">
                            <span className="font-sans font-medium text-[10px] text-[rgba(0,0,0,0.25)] leading-[1.6] whitespace-nowrap">
                              {t("immediate")}
                            </span>
                          </div>
                        </div>
                      </motion.button>

                      {/* Support Team Card - Mobile */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSupportTeamClick}
                        className="bg-white relative rounded-[16px] cursor-pointer transition-shadow duration-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden"
                      >
                        <div aria-hidden="true" className="absolute inset-0 border border-[#e5e5e5] rounded-[16px] pointer-events-none" />
                        <div className="relative flex items-center justify-between p-5 gap-4 w-full">
                          <div className="flex flex-col gap-1 items-start flex-1 min-w-0">
                            <h2 className="font-heading font-medium text-[16px] leading-[1.3] text-[#3d3d3d] tracking-[-0.48px] text-left">
                              {t("askSupportTeam")}
                            </h2>
                            <p className="font-sans font-medium text-[11px] leading-[1.6] text-[rgba(0,0,0,0.45)] text-left">
                              {t("supportDescription")}
                            </p>
                          </div>
                          <div className="flex gap-1.5 items-center flex-shrink-0">
                            <span className="font-sans font-medium text-[10px] text-[rgba(0,0,0,0.25)] leading-[1.6] whitespace-nowrap">
                              {t("supportResponseTime")}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    </div>

                    {/* Desktop cards */}
                    <div className="hidden md:flex flex-col md:flex-row gap-4 md:gap-[18px] w-full">
                      {/* VIZA AI Card - Desktop */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleVizaAiClick}
                        className="flex-1 bg-white relative rounded-[16px] md:rounded-[18px] cursor-pointer transition-shadow duration-200 shadow-sm hover:shadow-[0_4px_20px_rgba(194,120,95,0.12)] group overflow-hidden"
                      >
                        <div aria-hidden="true" className="absolute inset-0 border border-brand-500/40 rounded-[16px] md:rounded-[18px] pointer-events-none" />
                        <div className="relative flex flex-col h-full p-6 md:p-7 lg:p-8 gap-16 md:gap-12 lg:gap-20">
                          <div className="flex items-center justify-between w-full">
                            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                              <Sparkle size={18} weight="fill" className="text-white" />
                            </div>
                            <span className="font-sans font-medium text-[11px] md:text-[12px] text-[rgba(0,0,0,0.25)] leading-[1.6]">
                              {t("immediate")}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 items-start w-full">
                            <h2 className="font-heading font-medium text-[20px] md:text-[22px] lg:text-[24px] leading-[1.3] text-[#3d3d3d] tracking-[-0.6px] text-left">
                              <span>{t("chatWith")} </span>
                              <span className="text-brand-500">{t("vizaAI")}</span>
                            </h2>
                            <p className="font-sans font-medium text-[12px] md:text-[13px] leading-[1.6] text-[rgba(0,0,0,0.45)] text-left">
                              {t("vizaAIDescription")}
                            </p>
                          </div>
                        </div>
                      </motion.button>

                      {/* Support Team Card - Desktop */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSupportTeamClick}
                        className="flex-1 bg-white relative rounded-[16px] md:rounded-[18px] cursor-pointer transition-shadow duration-200 shadow-sm hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] group overflow-hidden"
                      >
                        <div aria-hidden="true" className="absolute inset-0 border border-[#e5e5e5] rounded-[16px] md:rounded-[18px] pointer-events-none" />
                        <div className="relative flex flex-col h-full p-6 md:p-7 lg:p-8 gap-16 md:gap-12 lg:gap-20">
                          <div className="flex items-center justify-between w-full">
                            {/* Team member photos */}
                            <div className="flex items-center -space-x-[10px]">
                              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden border-2 border-white">
                                <Image alt="Team member" className="object-cover w-full h-full" src="/images/concierge/team-member-1.png" width={32} height={32} />
                              </div>
                              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden border-2 border-white">
                                <Image alt="Team member" className="object-cover w-full h-full" src="/images/concierge/team-member-2.png" width={32} height={32} />
                              </div>
                              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden border-2 border-white">
                                <Image alt="Team member" className="object-cover w-full h-full" src="/images/concierge/team-member-3.png" width={32} height={32} />
                              </div>
                            </div>
                            <span className="font-sans font-medium text-[11px] md:text-[12px] text-[rgba(0,0,0,0.25)] leading-[1.6]">
                              {t("supportResponseTime")}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 items-start w-full">
                            <h2 className="font-heading font-medium text-[20px] md:text-[22px] lg:text-[24px] leading-[1.3] text-[#3d3d3d] tracking-[-0.6px] text-left">
                              {t("askSupportTeam")}
                            </h2>
                            <p className="font-sans font-medium text-[12px] md:text-[13px] leading-[1.6] text-[rgba(0,0,0,0.45)] text-left">
                              {t("supportDescription")}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 md:gap-6 w-full mt-4 md:mt-8 lg:mt-12">
                    <div className="bg-white relative rounded-[16px] md:rounded-[18px] overflow-hidden border border-[#efefef] shadow-[0px_0px_8px_rgba(206,206,206,0.25)]">
                      <div className="flex items-center px-5 md:px-6 py-3 md:py-4 gap-3 md:gap-4">
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && inputValue.trim()) {
                              handleVizaAiClick();
                              setTimeout(() => handleSendMessage(inputValue.trim()), 100);
                              setInputValue("");
                            }
                          }}
                          placeholder={t("inputPlaceholder")}
                          className="flex-1 bg-transparent outline-none font-sans font-medium text-[16px] md:text-[17px] leading-[1.5] text-gray-800 tracking-[-0.24px] placeholder:text-[rgba(0,0,0,0.35)]"
                        />
                        <button
                          onClick={() => {
                            if (inputValue.trim()) {
                              handleVizaAiClick();
                              setTimeout(() => handleSendMessage(inputValue.trim()), 100);
                              setInputValue("");
                            }
                          }}
                          className="flex-shrink-0 rounded-full hover:opacity-80 transition-opacity active:opacity-60"
                          aria-label="Send message"
                        >
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-brand-500 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          </div>
                        </button>
                      </div>
                    </div>

                    <p className="font-sans font-normal text-[13px] md:text-[14px] leading-[1.2] text-[rgba(0,0,0,0.25)] text-center px-2">
                      VIZA AI can make mistakes. Please double-check important information.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Chat View */
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col items-center px-4 sm:px-6 pt-0 pb-4 h-full min-h-0 overflow-hidden"
            >
              <div className="w-full max-w-[980px] flex flex-col flex-1 relative overflow-hidden min-h-0 mx-auto">
                {/* Messages Area */}
                <div
                  ref={messagesContainerRef}
                  onScroll={checkScrollPosition}
                  className="flex-1 overflow-y-auto space-y-12 mb-0 relative overscroll-y-contain min-h-0 w-full max-w-[900px] mx-auto pt-10"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {continuousChat.isLoadingMore && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    </div>
                  )}

                  {continuousChat.reachedHistoryBoundary && <HistoryBoundaryMessage />}

                  {isLoadingMessages && (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-20 w-3/4 rounded-xl" />
                      </div>
                      <div className="flex justify-end">
                        <Skeleton className="h-12 w-2/3 rounded-xl" />
                      </div>
                      <div className="flex gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-16 w-1/2 rounded-xl" />
                      </div>
                    </div>
                  )}

                  {/* Messages with date dividers */}
                  {!isLoadingMessages && renderMessagesWithDividers()}

                  {/* Thinking indicator */}
                  {isStreaming &&
                    continuousChat.messages[continuousChat.messages.length - 1]?.content === "" && (
                      <ThinkingIndicator />
                    )}

                  {/* Inline component renders */}
                  {pendingComponents.map((comp) => (
                    <motion.div
                      key={comp.componentId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-full"
                    >
                      <InlineComponent
                        event={comp}
                        onComplete={handleComponentComplete}
                      />
                    </motion.div>
                  ))}

                  {/* Scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>

                <div className="mt-auto pt-0 relative">
                  <ScrollToBottomFab
                    show={continuousChat.showScrollToBottom}
                    onClick={scrollToBottom}
                    hasNewMessage={continuousChat.showNewMessageButton}
                    className="-top-24 right-2 sm:-top-16"
                  />

                  <ChatInput
                    onSend={handleSendMessage}
                    disabled={status !== "connected"}
                    isConnecting={status === "connecting"}
                  />
                  <p className="mt-3 text-center text-sm text-gray-400">
                    VIZA AI can make mistakes. Please double-check important information.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Debug Panel */}
      {showDebug && (
        <DebugPanel
          isOpen={showDebug}
          onClose={() => setShowDebug(false)}
          logs={logs}
          onClearLogs={clearLogs}
          status={status}
        />
      )}
    </div>
  );
}
