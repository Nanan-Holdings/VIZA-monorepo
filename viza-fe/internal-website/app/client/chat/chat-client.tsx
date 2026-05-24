"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Loader2,
  PanelLeft,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Sparkle } from "@phosphor-icons/react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { io, Socket } from "socket.io-client";

import { useContinuousChat } from "@/hooks/use-continuous-chat";
import { ChatMessage } from "@/components/client/companion/chat-message";
import { BlockMessage } from "@/components/client/companion/block-message";
import type { ApplicationBlockPayload } from "@/components/client/companion/block-message";
import { ChatInput } from "@/components/client/companion/chat-input";
import { ThinkingIndicator } from "@/components/client/companion/thinking-indicator";
import { DateDivider, isDifferentDay } from "@/components/client/companion/date-divider";
import { ScrollToBottomFab } from "@/components/client/companion/scroll-to-bottom-fab";
import { HistoryBoundaryMessage } from "@/components/client/companion/history-boundary-message";
import { TravelChatClient } from "../travel-chat/travel-chat-client";
import {
  createSession,
  deleteSession,
  ensureSessionMessage,
  getSessionMessages,
  renameSession,
  type Message,
  type PersistableVisaMessageRole,
  type Session,
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
  ApplicationBlockEvent,
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

// Component protocol types
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
  initialSessionId: string | null;
  initialMessages: Message[];
  travelApplicationId: string | null;
  travelApplicationStatus: string | null;
}

// Agent backend URL
const AGENT_BACKEND_URL =
  process.env.NEXT_PUBLIC_AGENT_BACKEND_URL || "http://localhost:3002";

const TOKEN_BATCH_INTERVAL = 500;
const ACTIVE_VIZA_SESSION_STORAGE_KEY = "viza_chat_session_id";

type ChatAgentMode = "viza" | "travel";

interface PendingVizaMessage {
  message: string;
  sessionId: string;
}

function getSessionDisplayTitle(session: Session): string {
  return session.title || session.firstMessagePreview || "New conversation";
}

function formatSessionDate(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatStoredMessages(messages: Message[]): SocketChatMessage[] {
  return messages
    .filter((msg) => msg.senderType === "user" || msg.senderType === "agent")
    .map((msg) => ({
      id: msg.id,
      role: msg.senderType === "user" ? "user" : "agent",
      content: msg.content,
      timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
      isStreaming: false,
      sessionId: msg.sessionId,
    }));
}

function formatStoredBlocks(
  messages: Message[]
): Array<{ id: string; payload: ApplicationBlockPayload; timestamp: number }> {
  return messages
    .filter((msg) => msg.senderType === "block" && msg.blockData)
    .map((msg) => ({
      id: msg.id,
      payload: msg.blockData as unknown as ApplicationBlockPayload,
      timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
    }));
}

function parseRequestedChatMode(value: string | null): ChatAgentMode | null {
  if (value === "travel" || value === "travel-agent") return "travel";
  if (value === "visa" || value === "visa-consultant") return "viza";
  return null;
}

function ChatSessionPanel({
  sessions,
  activeSessionId,
  disabled,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onClose,
  onCollapse,
}: {
  sessions: Session[];
  activeSessionId: string | null;
  disabled: boolean;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => Promise<boolean>;
  onDeleteSession: (sessionId: string) => Promise<boolean>;
  onClose?: () => void;
  onCollapse?: () => void;
}) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [deleteConfirmSessionId, setDeleteConfirmSessionId] = useState<
    string | null
  >(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [pendingSessionAction, setPendingSessionAction] = useState<string | null>(
    null
  );

  const actionDisabled = disabled || pendingSessionAction !== null;

  const startRename = (session: Session) => {
    setDeleteConfirmSessionId(null);
    setEditingSessionId(session.id);
    setDraftTitle(getSessionDisplayTitle(session));
  };

  const cancelRename = () => {
    setEditingSessionId(null);
    setDraftTitle("");
  };

  const submitRename = async () => {
    if (!editingSessionId) return;
    setPendingSessionAction(`rename:${editingSessionId}`);
    const saved = await onRenameSession(editingSessionId, draftTitle);
    setPendingSessionAction(null);
    if (saved) {
      cancelRename();
    }
  };

  const handleDelete = async (session: Session) => {
    setPendingSessionAction(`delete:${session.id}`);
    const deleted = await onDeleteSession(session.id);
    setPendingSessionAction(null);
    if (deleted && editingSessionId === session.id) {
      cancelRename();
    }
    if (deleted) {
      setDeleteConfirmSessionId(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white text-gray-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e8e8e8] px-5 py-5">
        <div>
          <p className="text-lg font-semibold leading-tight text-[#3d3d3d]">
            VIZA chats
          </p>
          <p className="mt-1 text-base leading-snug text-[rgba(0,0,0,0.48)]">
            Separate visa conversations
          </p>
        </div>
        {(onCollapse || onClose) && (
          <div className="flex items-center gap-1">
          {onCollapse && (
            <button
              aria-label="Collapse VIZA chat list"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
              onClick={onCollapse}
              type="button"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              aria-label="Close chat list"
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <button
          className="mb-4 flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-lg font-medium text-[#03346E] transition-colors hover:bg-[#03346E]/5 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={actionDisabled}
          onClick={onNewSession}
          type="button"
        >
          <Plus className="h-5 w-5" />
          <span>New chat</span>
        </button>

        {sessions.length === 0 ? (
          <p className="px-3 py-8 text-center text-base text-gray-400">
            No conversations yet
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const active = session.id === activeSessionId;
              const title = getSessionDisplayTitle(session);
              const editing = editingSessionId === session.id;
              const confirmingDelete = deleteConfirmSessionId === session.id;

              if (editing) {
                return (
                  <form
                    className="rounded-md border border-[#03346E]/20 bg-[#03346E]/5 p-2"
                    key={session.id}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitRename();
                    }}
                  >
                    <input
                      aria-label="Conversation title"
                      autoFocus
                      className="w-full rounded bg-white px-2.5 py-2 text-base text-gray-900 outline-none ring-1 ring-transparent focus:ring-[#03346E]/30"
                      disabled={pendingSessionAction !== null}
                      maxLength={80}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelRename();
                        }
                      }}
                      value={draftTitle}
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        className="rounded-md bg-[#03346E] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#022a58] disabled:opacity-40"
                        disabled={pendingSessionAction !== null}
                        type="submit"
                      >
                        Save
                      </button>
                      <button
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-white disabled:opacity-40"
                        disabled={pendingSessionAction !== null}
                        onClick={cancelRename}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                );
              }

              if (confirmingDelete) {
                return (
                  <div
                    className="flex items-center gap-1 rounded-md border border-red-100 bg-red-50 p-1.5"
                    key={session.id}
                  >
                    <div className="min-w-0 flex-1 px-2">
                      <span className="block text-base font-medium text-red-700">
                        Delete conversation?
                      </span>
                      <span className="block truncate text-sm text-red-500">
                        {title}
                      </span>
                    </div>
                    <button
                      aria-label={`Confirm delete ${title}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-red-600 transition-colors hover:bg-red-100 disabled:opacity-40"
                      disabled={pendingSessionAction !== null}
                      onClick={() => {
                        void handleDelete(session);
                      }}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label="Cancel delete"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white disabled:opacity-40"
                      disabled={pendingSessionAction !== null}
                      onClick={() => setDeleteConfirmSessionId(null)}
                      type="button"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  className={cn(
                    "group flex w-full items-center rounded-md transition-colors",
                    active
                      ? "bg-[#03346E]/8 text-[#03346E]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                  key={session.id}
                >
                  <button
                    aria-pressed={active}
                    className="min-w-0 flex-1 px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={actionDisabled}
                    onClick={() => onSelectSession(session.id)}
                    type="button"
                  >
                    <span className="block truncate text-lg font-medium leading-snug">
                      {title}
                    </span>
                    <span className="mt-1 block text-base leading-snug text-gray-400">
                      {formatSessionDate(session.createdAt)}
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5 pr-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button
                      aria-label={`Rename ${title}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-white hover:text-[#03346E] disabled:opacity-40"
                      disabled={actionDisabled}
                      onClick={() => startRename(session)}
                      type="button"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label={`Delete ${title}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      disabled={actionDisabled}
                      onClick={() => setDeleteConfirmSessionId(session.id)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

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
          <span className="text-brand-500 text-sm">+</span>
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
      return <ReviewStep applicationId={applicationId} onComplete={handleComplete} />;
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
  initialSessions,
  initialSessionId,
  initialMessages,
  travelApplicationId,
  travelApplicationStatus,
}: ChatClientProps) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedChatMode = parseRequestedChatMode(searchParams.get("agent"));

  // ==========================================================================
  // Session & UI State
  // ==========================================================================

  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [showChat, setShowChat] = useState(() => {
    if (requestedChatMode) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("viza_chat_active", "true");
      }
      return true;
    }
    if (typeof window !== "undefined" && sessionStorage.getItem("viza_chat_active") === "true") {
      return true;
    }
    return initialMessages.length > 0 || !!initialSessionId;
  });
  const [chatMode, setChatMode] = useState<ChatAgentMode>(
    requestedChatMode ?? "viza"
  );
  const [showDebug] = useState(false);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const [sessionPanelCollapsed, setSessionPanelCollapsed] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<PendingVizaMessage[]>([]);
  const [_isNearBottom, setIsNearBottom] = useState(true);
  const [pendingComponents, setPendingComponents] = useState<PendingComponent[]>([]);
  const [blockMessages, setBlockMessages] = useState<
    Array<{ id: string; payload: ApplicationBlockPayload; timestamp: number }>
  >(() => formatStoredBlocks(initialMessages));

  const selectChatMode = useCallback((mode: ChatAgentMode) => {
    setShowChat(true);
    setChatMode(mode);
    sessionStorage.setItem("viza_chat_active", "true");

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("agent", mode === "travel" ? "travel" : "visa");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (!requestedChatMode) return;
    selectChatMode(requestedChatMode);
  }, [requestedChatMode, selectChatMode]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const hasScrolledToBottomRef = useRef(false);
  const queuedMessageRef = useRef<{ message: string; tempId: string } | null>(null);

  // ==========================================================================
  // Socket Management
  // ==========================================================================

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [socketMessages, setSocketMessages] = useState<SocketChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const tokenBufferRef = useRef<string>("");
  const tokenFlushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  const chatContextRef = useRef<SocketChatMessage[]>([]);

  const generateId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    []
  );

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

  const ensureMessagePersisted = useCallback(
    (
      targetSessionId: string,
      role: PersistableVisaMessageRole,
      content: string
    ) => {
      void ensureSessionMessage(userId, targetSessionId, role, content).then(
        (result) => {
          if (!result.success) {
            console.warn("Failed to persist VIZA chat message", {
              sessionId: targetSessionId,
              role,
              error: result.error,
            });
          }
        }
      );
    },
    [userId]
  );

  const flushTokenBuffer = useCallback(() => {
    if (tokenBufferRef.current) {
      const buffered = tokenBufferRef.current;
      addLog("token", { text: buffered });
      tokenBufferRef.current = "";

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
      addLog("escalation", {
        intent: event.intent,
        riskLevel: event.riskLevel,
        reason: event.reason,
      });
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

      if (event.sessionId && event.fullResponse?.trim()) {
        ensureMessagePersisted(event.sessionId, "assistant", event.fullResponse);
      }
    });

    socket.on("error", (event: ErrorEvent) => {
      flushTokenBuffer();
      addLog("error", { message: event.message, code: event.code });

      if (currentMessageIdRef.current) {
        setSocketMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentMessageIdRef.current
              ? {
                  ...msg,
                  isStreaming: false,
                  content: msg.content || `Error: ${event.message}`,
                }
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

    socket.on("component", (event: ComponentEvent) => {
      if (event.type === "component") {
        setPendingComponents((prev) => [...prev, { ...event, completed: false }]);
      }
    });

    // Application redirect CTA from the VIZA backend
    socket.on("application_block", (event: ApplicationBlockEvent) => {
      addLog("tool_call", {
        toolName: event.payload.blockType ?? "application_block",
        args: event.payload,
      });
      setBlockMessages((prev) => [
        ...prev,
        {
          id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          payload: event.payload,
          timestamp: event.timestamp,
        },
      ]);
    });

    socket.on(
      "proactive_message",
      (event: { sessionId: string; message: SocketChatMessage }) => {
        const proactiveMessage: SocketChatMessage = {
          id: event.message.id,
          role: "agent",
          content: event.message.content,
          timestamp: new Date(
            (event.message as unknown as { createdAt: string }).createdAt
          ).getTime(),
          isStreaming: false,
        };
        setSocketMessages((prev) => [...prev, proactiveMessage]);
        addLog("proactive_message", { messageId: event.message.id });
      }
    );
  }, [
    userId,
    addLog,
    ensureMessagePersisted,
    flushTokenBuffer,
    scheduleTokenFlush,
  ]);

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
      setSocketMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: "user",
          content: message,
          timestamp: Date.now(),
        },
      ]);

      const agentMessageId = generateId();
      setSocketMessages((prev) => [
        ...prev,
        {
          id: agentMessageId,
          role: "agent",
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
        },
      ]);
      currentMessageIdRef.current = agentMessageId;

      const request: VisaChatRequest = {
        user_id: userId,
        session_id: effectiveSessionId,
        message,
        locale,
        history: [
          ...chatContextRef.current
            .filter((msg) => !msg.isStreaming && msg.content.trim().length > 0)
            .slice(-24)
            .map((msg) => ({
              role: msg.role === "user" ? "user" as const : "assistant" as const,
              content: msg.content,
            })),
          { role: "user", content: message },
        ],
      };
      ensureMessagePersisted(effectiveSessionId, "user", message);
      socketRef.current.emit("visa_chat_message", request);
    },
    [userId, sessionId, addLog, ensureMessagePersisted, generateId, locale]
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  const handleComponentComplete = useCallback(
    (componentId: string, result: unknown) => {
      const event: ComponentCompleteEvent = {
        type: "component_complete",
        componentId,
        result,
      };
      socketRef.current?.emit("component_complete", event);
      setPendingComponents((prev) =>
        prev.map((c) =>
          c.componentId === componentId ? { ...c, completed: true } : c
        )
      );
    },
    []
  );

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

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
    sessionId,
    initialMessages: initialMessages.filter(
      (message) => message.senderType === "user" || message.senderType === "agent"
    ),
    initialCheckpoints: [],
    isFirstTimeUser:
      initialMessages.filter(
        (message) =>
          message.senderType === "user" || message.senderType === "agent"
      ).length === 0,
  });

  const {
    messages: chatMessages,
    isLoadingMore,
    hasMoreHistory,
    loadMoreHistory,
    jumpToMessage,
    jumpTargetId,
    addSocketMessage,
    resetHistoryState,
    setMessages: setChatMessages,
    setShowNewMessageButton,
    setShowScrollToBottom,
  } = continuousChat;

  useEffect(() => {
    chatContextRef.current = chatMessages;
  }, [chatMessages]);

  // ==========================================================================
  // Merge socket messages into continuous chat
  // ==========================================================================

  const prevSocketMessagesRef = useRef<typeof socketMessages>([]);

  const resetRuntimeMessages = useCallback(() => {
    flushTokenBuffer();
    tokenBufferRef.current = "";
    if (tokenFlushTimeoutRef.current) {
      clearTimeout(tokenFlushTimeoutRef.current);
      tokenFlushTimeoutRef.current = null;
    }
    currentMessageIdRef.current = null;
    queuedMessageRef.current = null;
    prevSocketMessagesRef.current = [];
    hasScrolledToBottomRef.current = false;
    setSocketMessages([]);
    setPendingMessages([]);
    setPendingComponents([]);
    setBlockMessages([]);
    setShowNewMessageButton(false);
    setShowScrollToBottom(false);
  }, [flushTokenBuffer, setShowNewMessageButton, setShowScrollToBottom]);

  useEffect(() => {
    const prev = prevSocketMessagesRef.current;
    for (let i = 0; i < socketMessages.length; i++) {
      const current = socketMessages[i];
      const previous = prev[i];
      if (current !== previous) {
        addSocketMessage({
          ...current,
          sessionId: sessionId || undefined,
        } as SocketChatMessage);
      }
    }
    prevSocketMessagesRef.current = socketMessages;
  }, [socketMessages, sessionId, addSocketMessage]);

  // ==========================================================================
  // Streaming state
  // ==========================================================================

  const isStreaming = useMemo(
    () => chatMessages.some((msg) => msg.isStreaming),
    [chatMessages]
  );

  const shouldShowNewChatGreeting =
    !isLoadingMessages &&
    chatMessages.length === 0 &&
    pendingComponents.length === 0 &&
    blockMessages.length === 0;

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
    if (!container || isProgrammaticScrollRef.current) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nowNearBottom = distanceFromBottom < 150;

    if (isNearBottomRef.current !== nowNearBottom) {
      isNearBottomRef.current = nowNearBottom;
      setIsNearBottom(nowNearBottom);
    }

    if (!nowNearBottom) shouldAutoScrollRef.current = false;

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
      const scrollDiff = container.scrollHeight - prevScrollHeightRef.current;
      if (scrollDiff > 0) container.scrollTop = scrollDiff;
      prevScrollHeightRef.current = 0;
    }
  }, [chatMessages, isLoadingMore]);

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

    if (currentCount <= prevCount) return;

    shouldAutoScrollRef.current = true;

    if (isNearBottomRef.current && !isLoadingMore) {
      isProgrammaticScrollRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 500);
      setShowNewMessageButton(false);
    } else if (!shouldAutoScrollRef.current) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg && !lastMsg.isStreaming) setShowNewMessageButton(true);
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
      requestAnimationFrame(() => {
        isProgrammaticScrollRef.current = false;
      });
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [isStreaming]);

  const scrollToBottom = useCallback(() => {
    shouldAutoScrollRef.current = true;
    isProgrammaticScrollRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 500);
    setShowNewMessageButton(false);
    setIsNearBottom(true);
    isNearBottomRef.current = true;
  }, [setShowNewMessageButton]);

  useEffect(() => {
    if (jumpTargetId) {
      const element = document.getElementById(`msg-${jumpTargetId}`);
      if (element)
        element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [jumpTargetId]);

  // ==========================================================================
  // Connection Status Effects
  // ==========================================================================

  useEffect(() => {
    if (status === "error") {
      toast.error(t("connectionReconnecting"));
    } else if (status === "connected" && pendingMessages.length > 0) {
      for (const pending of pendingMessages) {
        socketSendMessage(pending.message, pending.sessionId);
      }
      setPendingMessages([]);
      toast.success(t("connectedSending"));
    }
  }, [status, pendingMessages, socketSendMessage]);

  useEffect(() => {
    const lastLog = logs[logs.length - 1];
    if (lastLog?.eventType === "escalation") {
      toast.info(t("agentNotified"));
    }
  }, [logs]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const markSessionUsed = useCallback((activeSessionId: string, message: string) => {
    const preview = message.slice(0, 30);
    setSessions((prev) => {
      const existing = prev.find((session) => session.id === activeSessionId);
      if (!existing) return prev;

      const updated: Session = {
        ...existing,
        firstMessagePreview: existing.firstMessagePreview || preview,
        endedAt: new Date().toISOString(),
      };

      return [
        updated,
        ...prev.filter((session) => session.id !== activeSessionId),
      ];
    });
  }, []);

  const handleNewVizaSession = useCallback(() => {
    if (isStreaming) {
      toast.info("Please wait for the current response to finish.");
      return;
    }

    setSessionId(null);
    sessionStorage.removeItem(ACTIVE_VIZA_SESSION_STORAGE_KEY);
    setChatMessages([]);
    resetHistoryState(false);
    resetRuntimeMessages();
    setShowChat(true);
    setChatMode("viza");
    setSessionPanelOpen(false);
    sessionStorage.setItem("viza_chat_active", "true");
  }, [isStreaming, resetHistoryState, resetRuntimeMessages, setChatMessages]);

  const handleSessionSelect = useCallback(
    async (nextSessionId: string) => {
      if (nextSessionId === sessionId) {
        sessionStorage.setItem(ACTIVE_VIZA_SESSION_STORAGE_KEY, nextSessionId);
        setSessionPanelOpen(false);
        setShowChat(true);
        setChatMode("viza");
        return;
      }

      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return;
      }

      setIsLoadingMessages(true);
      setSessionId(nextSessionId);
      sessionStorage.setItem(ACTIVE_VIZA_SESSION_STORAGE_KEY, nextSessionId);
      setShowChat(true);
      setChatMode("viza");
      setSessionPanelOpen(false);
      sessionStorage.setItem("viza_chat_active", "true");
      resetRuntimeMessages();

      try {
        const messages = await getSessionMessages(nextSessionId, userId);
        setChatMessages(formatStoredMessages(messages));
        setBlockMessages(formatStoredBlocks(messages));
        resetHistoryState(messages.length >= 50);
      } catch (error) {
        console.error("Error loading VIZA session:", error);
        toast.error("Failed to load conversation");
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [
      isStreaming,
      resetHistoryState,
      resetRuntimeMessages,
      sessionId,
      setChatMessages,
      userId,
    ]
  );

  const restoredActiveSessionRef = useRef(false);
  useEffect(() => {
    if (restoredActiveSessionRef.current) return;

    const savedSessionId = sessionStorage.getItem(ACTIVE_VIZA_SESSION_STORAGE_KEY);
    if (!savedSessionId) {
      restoredActiveSessionRef.current = true;
      return;
    }

    if (savedSessionId === sessionId) {
      restoredActiveSessionRef.current = true;
      return;
    }

    if (!sessions.some((session) => session.id === savedSessionId)) return;

    restoredActiveSessionRef.current = true;
    void handleSessionSelect(savedSessionId);
  }, [handleSessionSelect, sessionId, sessions]);

  const handleRenameVizaSession = useCallback(
    async (targetSessionId: string, nextTitle: string) => {
      const result = await renameSession(userId, targetSessionId, nextTitle);

      if (!result.success) {
        toast.error(result.error || "Failed to rename conversation");
        return false;
      }

      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== targetSessionId) return session;
          const nextSession: Session = { ...session };
          if (result.title) {
            nextSession.title = result.title;
          } else {
            delete nextSession.title;
          }
          return nextSession;
        })
      );
      toast.success(
        result.title ? "Conversation renamed" : "Conversation title cleared"
      );
      return true;
    },
    [userId]
  );

  const handleDeleteVizaSession = useCallback(
    async (targetSessionId: string) => {
      if (isStreaming) {
        toast.info("Please wait for the current response to finish.");
        return false;
      }

      const result = await deleteSession(userId, targetSessionId);

      if (!result.success) {
        toast.error(result.error || "Failed to delete conversation");
        return false;
      }

      const remainingSessions = sessions.filter(
        (session) => session.id !== targetSessionId
      );
      setSessions(remainingSessions);

      if (sessionId === targetSessionId) {
        const nextSession = remainingSessions[0];
        if (nextSession) {
          await handleSessionSelect(nextSession.id);
        } else {
          setSessionId(null);
          sessionStorage.removeItem(ACTIVE_VIZA_SESSION_STORAGE_KEY);
          setChatMessages([]);
          resetHistoryState(false);
          resetRuntimeMessages();
          setShowChat(true);
          setChatMode("viza");
        }
      }

      toast.success("Conversation deleted");
      return true;
    },
    [
      handleSessionSelect,
      isStreaming,
      resetHistoryState,
      resetRuntimeMessages,
      sessionId,
      sessions,
      setChatMessages,
      userId,
    ]
  );

  const handleSendMessage = useCallback(
    async (message: string) => {
      sessionStorage.setItem("viza_chat_active", "true");

      let effectiveSessionId = sessionId;
      if (!effectiveSessionId) {
        const newSession = await createSession(userId, travelApplicationId);
        if (!newSession) {
          toast.error(t("failedToStart"));
          return;
        }

        effectiveSessionId = newSession.id;
        setSessionId(effectiveSessionId);
        sessionStorage.setItem(ACTIVE_VIZA_SESSION_STORAGE_KEY, effectiveSessionId);
        setSessions((prev) => [
          newSession,
          ...prev.filter((session) => session.id !== newSession.id),
        ]);
      }

      if (status !== "connected") {
        setPendingMessages((prev) => [
          ...prev,
          { message, sessionId: effectiveSessionId },
        ]);
        markSessionUsed(effectiveSessionId, message);
        toast.info(t("willSendWhenConnected"));
        return;
      }

      if (isStreaming) {
        if (queuedMessageRef.current) return;
        const tempId = `temp-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`;
        addSocketMessage({
          id: tempId,
          role: "user",
          content: message,
          timestamp: Date.now(),
          isStreaming: false,
          sessionId: effectiveSessionId,
        } as SocketChatMessage);
        queuedMessageRef.current = { message, tempId };
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
        return;
      }

      socketSendMessage(message, effectiveSessionId);
      markSessionUsed(effectiveSessionId, message);
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight;
      }
    },
    [
      sessionId,
      status,
      socketSendMessage,
      isStreaming,
      addSocketMessage,
      markSessionUsed,
      t,
      travelApplicationId,
      userId,
    ]
  );

  const handleVizaAiClick = useCallback(() => {
    selectChatMode("viza");
  }, [selectChatMode]);

  const handleWelcomeInputSend = useCallback(() => {
    const message = inputValue.trim();
    if (!message) return;

    handleVizaAiClick();
    setTimeout(() => handleSendMessage(message), 100);
    setInputValue("");
  }, [handleSendMessage, handleVizaAiClick, inputValue]);

  const handleWelcomeInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const isComposing =
        event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;
      if (isComposing) return;

      if (event.key === "Escape" && inputValue.length > 0) {
        event.preventDefault();
        setInputValue("");
        return;
      }

      const shouldSend =
        event.key === "Enter" && (event.ctrlKey || event.metaKey || !event.shiftKey);
      if (shouldSend) {
        event.preventDefault();
        handleWelcomeInputSend();
      }
    },
    [handleWelcomeInputSend, inputValue.length]
  );

  const handleTravelAiClick = useCallback(() => {
    selectChatMode("travel");
  }, [selectChatMode]);

  const handleSupportTeamClick = useCallback(() => {
    router.push("/client/support");
  }, [router]);

  // ==========================================================================
  // Render messages with dividers
  // ==========================================================================

  const renderMessagesWithDividers = useCallback(() => {
    const elements: React.ReactNode[] = [];
    let lastTimestamp: number | null = null;

    chatMessages.forEach((msg) => {
      if (
        lastTimestamp !== null &&
        isDifferentDay(lastTimestamp, msg.timestamp)
      ) {
        elements.push(
          <DateDivider
            key={`date-${msg.id}`}
            date={new Date(msg.timestamp)}
          />
        );
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
      {chatMode === "viza" && !sessionPanelCollapsed && (
        <>
          <aside
            className="absolute bottom-4 left-4 top-4 z-20 hidden w-[280px] lg:block"
            data-testid="viza-session-sidebar"
          >
            <ChatSessionPanel
              activeSessionId={sessionId}
              disabled={isStreaming || isLoadingMessages}
              onCollapse={() => {
                setSessionPanelCollapsed(true);
                setSessionPanelOpen(false);
              }}
              onDeleteSession={handleDeleteVizaSession}
              onNewSession={handleNewVizaSession}
              onRenameSession={handleRenameVizaSession}
              onSelectSession={handleSessionSelect}
              sessions={sessions}
            />
          </aside>

          {sessionPanelOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button
                aria-label="Close chat list"
                className="absolute inset-0 bg-black/20"
                onClick={() => {
                  setSessionPanelOpen(false);
                  setSessionPanelCollapsed(true);
                }}
                type="button"
              />
              <aside className="absolute bottom-4 left-4 top-4 w-[min(84vw,320px)] shadow-xl">
                <ChatSessionPanel
                  activeSessionId={sessionId}
                  disabled={isStreaming || isLoadingMessages}
                  onClose={() => {
                    setSessionPanelOpen(false);
                    setSessionPanelCollapsed(true);
                  }}
                  onDeleteSession={handleDeleteVizaSession}
                  onNewSession={handleNewVizaSession}
                  onRenameSession={handleRenameVizaSession}
                  onSelectSession={handleSessionSelect}
                  sessions={sessions}
                />
              </aside>
            </div>
          )}
        </>
      )}

      {chatMode === "viza" && sessionPanelCollapsed && (
        <button
          aria-label="Expand VIZA chat list"
          className="absolute left-4 top-4 z-30 hidden h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#03346E] shadow-sm transition-colors hover:bg-gray-50 lg:flex"
          onClick={() => setSessionPanelCollapsed(false)}
          type="button"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {chatMode === "viza" && sessionPanelCollapsed && sessionPanelOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close chat list"
            className="absolute inset-0 bg-black/20"
            onClick={() => setSessionPanelOpen(false)}
            type="button"
          />
          <aside className="absolute bottom-4 left-4 top-4 w-[min(84vw,320px)] shadow-xl">
            <ChatSessionPanel
              activeSessionId={sessionId}
              disabled={isStreaming || isLoadingMessages}
              onDeleteSession={handleDeleteVizaSession}
              onClose={() => setSessionPanelOpen(false)}
              onNewSession={handleNewVizaSession}
              onRenameSession={handleRenameVizaSession}
              onSelectSession={handleSessionSelect}
              sessions={sessions}
            />
          </aside>
        </div>
      )}

      <main
        className="h-full flex flex-col min-h-0"
      >
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
              <button
                aria-label="Open VIZA chat list"
                className="absolute left-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#03346E] shadow-sm lg:hidden"
                onClick={() => setSessionPanelOpen(true)}
                type="button"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <div className="flex-1 flex flex-col px-4 sm:px-6 md:px-8 lg:px-0">
                <div className="max-w-4xl w-full mx-auto flex flex-col flex-1 justify-between">
                  <div className="w-full flex flex-col gap-3 md:gap-6">
                    <h1 className="font-heading font-medium text-[18px] md:text-[24px] lg:text-[28px] leading-[1.3] text-[#3d3d3d] text-center tracking-[-0.54px] md:tracking-[-0.72px] lg:tracking-[-0.84px]">
                      Hi there, which visa can we help you with today?
                    </h1>

                    {/* Mobile cards */}
                    <div className="flex flex-col gap-3 md:hidden w-full">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleVizaAiClick}
                        className="bg-white relative rounded-[16px] cursor-pointer transition-shadow duration-200 hover:shadow-[0_2px_12px_rgba(3,52,110,0.12)] overflow-hidden"
                      >
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 border border-brand-500/40 rounded-[16px] pointer-events-none"
                        />
                        <div className="relative flex items-center justify-between p-5 gap-4 w-full">
                          <div className="flex flex-col gap-1 items-start flex-1 min-w-0">
                            <h2 className="font-heading font-medium text-[16px] leading-[1.3] text-[#3d3d3d] tracking-[-0.48px] text-left">
                              <span>{t("chatWith")} </span>
                              <span className="text-brand-500">
                                {t("vizaAI")}
                              </span>
                            </h2>
                            <p className="font-sans font-medium text-[11px] leading-[1.6] text-[rgba(0,0,0,0.45)] text-left">
                              {t("vizaAIDescription")}
                            </p>
                          </div>
                          <span className="font-sans font-medium text-[10px] text-[rgba(0,0,0,0.25)] leading-[1.6] whitespace-nowrap">
                            {t("immediate")}
                          </span>
                        </div>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSupportTeamClick}
                        className="bg-white relative rounded-[16px] cursor-pointer transition-shadow duration-200 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden"
                      >
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 border border-[#e5e5e5] rounded-[16px] pointer-events-none"
                        />
                        <div className="relative flex items-center justify-between p-5 gap-4 w-full">
                          <div className="flex flex-col gap-1 items-start flex-1 min-w-0">
                            <h2 className="font-heading font-medium text-[16px] leading-[1.3] text-[#3d3d3d] tracking-[-0.48px] text-left">
                              {t("askSupportTeam")}
                            </h2>
                            <p className="font-sans font-medium text-[11px] leading-[1.6] text-[rgba(0,0,0,0.45)] text-left">
                              {t("supportDescription")}
                            </p>
                          </div>
                          <span className="font-sans font-medium text-[10px] text-[rgba(0,0,0,0.25)] leading-[1.6] whitespace-nowrap">
                            {t("supportResponseTime")}
                          </span>
                        </div>
                      </motion.button>
                    </div>

                    {/* Desktop cards */}
                    <div className="hidden md:flex flex-col md:flex-row gap-4 md:gap-[18px] w-full">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleVizaAiClick}
                        className="flex-1 bg-white relative rounded-[16px] md:rounded-[18px] cursor-pointer transition-shadow duration-200 shadow-sm hover:shadow-[0_4px_20px_rgba(3,52,110,0.10)] overflow-hidden"
                      >
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 border border-brand-500/40 rounded-[16px] md:rounded-[18px] pointer-events-none"
                        />
                        <div className="relative flex flex-col h-full p-6 md:p-7 lg:p-8 gap-16 md:gap-12 lg:gap-20">
                          <div className="flex items-center justify-between w-full">
                            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
                              <Sparkle
                                size={18}
                                weight="fill"
                                className="text-white"
                              />
                            </div>
                            <span className="font-sans font-medium text-[11px] md:text-[12px] text-[rgba(0,0,0,0.25)] leading-[1.6]">
                              {t("immediate")}
                            </span>
                          </div>
                          <div className="flex flex-col gap-2 items-start w-full">
                            <h2 className="font-heading font-medium text-[20px] md:text-[22px] lg:text-[24px] leading-[1.3] text-[#3d3d3d] tracking-[-0.6px] text-left">
                              <span>{t("chatWith")} </span>
                              <span className="text-brand-500">
                                {t("vizaAI")}
                              </span>
                            </h2>
                            <p className="font-sans font-medium text-[12px] md:text-[13px] leading-[1.6] text-[rgba(0,0,0,0.45)] text-left">
                              {t("vizaAIDescription")}
                            </p>
                          </div>
                        </div>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSupportTeamClick}
                        className="flex-1 bg-white relative rounded-[16px] md:rounded-[18px] cursor-pointer transition-shadow duration-200 shadow-sm hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] overflow-hidden"
                      >
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 border border-[#e5e5e5] rounded-[16px] md:rounded-[18px] pointer-events-none"
                        />
                        <div className="relative flex flex-col h-full p-6 md:p-7 lg:p-8 gap-16 md:gap-12 lg:gap-20">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center -space-x-[10px]">
                              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden border-2 border-white">
                                <Image
                                  alt="Team member"
                                  className="object-cover w-full h-full"
                                  src="/images/concierge/team-member-1.png"
                                  width={32}
                                  height={32}
                                />
                              </div>
                              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden border-2 border-white">
                                <Image
                                  alt="Team member"
                                  className="object-cover w-full h-full"
                                  src="/images/concierge/team-member-2.png"
                                  width={32}
                                  height={32}
                                />
                              </div>
                              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden border-2 border-white">
                                <Image
                                  alt="Team member"
                                  className="object-cover w-full h-full"
                                  src="/images/concierge/team-member-3.png"
                                  width={32}
                                  height={32}
                                />
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

                    <div className="rounded-[16px] border border-[#e5e5e5] bg-white p-4 md:p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="font-heading text-[16px] font-medium text-[#3d3d3d]">
                            {t("travelAI")}
                          </p>
                          <p className="mt-1 text-[12px] text-[rgba(0,0,0,0.45)]">
                            {!travelApplicationId
                              ? t("noApplicationFound")
                              : t("travelApplicationLinked")}
                          </p>
                          {travelApplicationStatus && (
                            <p className="mt-1 text-[11px] text-[rgba(0,0,0,0.35)]">
                              {t("currentApplicationStatus", {
                                status: travelApplicationStatus,
                              })}
                            </p>
                          )}
                        </div>
                        <button
                          className={cn(
                            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                            "bg-[#03346E] text-white hover:bg-[#02264f]"
                          )}
                          onClick={handleTravelAiClick}
                          type="button"
                        >
                          {t("openTravelAI")}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5 md:gap-6 w-full mt-4 md:mt-8 lg:mt-12">
                    <div className="bg-white relative rounded-[16px] md:rounded-[18px] overflow-hidden border border-[#efefef] shadow-[0px_0px_8px_rgba(206,206,206,0.25)]">
                      <div className="flex items-center px-5 md:px-6 py-3 md:py-4 gap-3 md:gap-4">
                        <input
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          onKeyDown={handleWelcomeInputKeyDown}
                          placeholder={t("inputPlaceholder")}
                          className="flex-1 bg-transparent outline-none font-sans font-medium text-[16px] md:text-[17px] leading-[1.5] text-gray-800 tracking-[-0.24px] placeholder:text-[rgba(0,0,0,0.35)]"
                          aria-keyshortcuts="Enter Control+Enter Meta+Enter Escape"
                        />
                        <button
                          onClick={handleWelcomeInputSend}
                          className="flex-shrink-0 rounded-full hover:opacity-80 transition-opacity active:opacity-60"
                          aria-label="Send message"
                        >
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-brand-500 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 10l7-7m0 0l7 7m-7-7v18"
                              />
                            </svg>
                          </div>
                        </button>
                      </div>
                    </div>

                    <p className="font-sans font-normal text-[13px] md:text-[14px] leading-[1.2] text-[rgba(0,0,0,0.25)] text-center px-2">
                      {t("consultantDisclaimer")}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Chat View 鈥?full width, no sidebar */
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "flex-1 flex flex-col items-center px-4 sm:px-6 pt-0 pb-4 h-full min-h-0 overflow-hidden",
                chatMode === "travel" ? "px-2 sm:px-3" : ""
              )}
            >
              <div
                className={cn(
                  "w-full flex flex-col flex-1 relative overflow-hidden min-h-0 mx-auto",
                  chatMode === "travel" ? "max-w-[2100px]" : "max-w-[980px]"
                )}
              >
                <div
                  className={cn(
                    "mx-auto mb-2 mt-3 flex w-full items-center gap-2",
                    chatMode === "travel" ? "max-w-[2060px]" : "max-w-[900px]"
                  )}
                >
                  {chatMode === "viza" && sessionPanelCollapsed && (
                    <button
                      aria-label="Open VIZA chat list"
                      className="absolute left-4 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#e5e5e5] bg-white text-[#03346E] shadow-sm transition-colors hover:bg-gray-50 lg:hidden"
                      onClick={() => setSessionPanelOpen(true)}
                      type="button"
                    >
                      <PanelLeft className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                      chatMode === "viza"
                        ? "bg-[#03346E] text-white"
                        : "bg-white text-[#03346E] border border-[#03346E]/30 hover:bg-[#03346E]/5"
                    )}
                    onClick={() => selectChatMode("viza")}
                    type="button"
                  >
                    {t("vizaAI")}
                  </button>
                  <button
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                      chatMode === "travel"
                        ? "bg-[#03346E] text-white"
                        : "bg-white text-[#03346E] border border-[#03346E]/30 hover:bg-[#03346E]/5"
                    )}
                    onClick={() => selectChatMode("travel")}
                    type="button"
                  >
                    {t("travelAI")}
                  </button>
                  {chatMode === "viza" && sessionPanelCollapsed && (
                    <button
                      aria-label="New VIZA chat"
                      className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#03346E]/20 bg-white text-[#03346E] transition-colors hover:bg-[#03346E]/5 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={isStreaming || isLoadingMessages}
                      onClick={handleNewVizaSession}
                      type="button"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {chatMode === "travel" ? (
                  <div className="w-full min-h-0 flex-1 overflow-hidden">
                    <TravelChatClient applicationId={travelApplicationId} embedded />
                  </div>
                ) : (
                  <>
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

                  {continuousChat.reachedHistoryBoundary && (
                    <HistoryBoundaryMessage />
                  )}

                  {isLoadingMessages && (
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-20 w-3/4 rounded-xl" />
                      </div>
                      <div className="flex justify-end">
                        <Skeleton className="h-12 w-2/3 rounded-xl" />
                      </div>
                    </div>
                  )}

                  {shouldShowNewChatGreeting && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="w-full"
                    >
                      <ChatMessage
                        role="agent"
                        content={t("newChatGreeting")}
                      />
                    </motion.div>
                  )}

                  {!isLoadingMessages && renderMessagesWithDividers()}

                  {isStreaming &&
                    continuousChat.messages[
                      continuousChat.messages.length - 1
                    ]?.content === "" && <ThinkingIndicator />}

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

                  {/* Application redirect CTA messages from the VIZA backend */}
                  {blockMessages.map((block) => (
                    <motion.div
                      key={block.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <BlockMessage payload={block.payload} />
                    </motion.div>
                  ))}

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
                        disabled={isLoadingMessages}
                        isConnecting={status === "connecting"}
                      />
                      <p className="mt-3 text-center text-sm text-gray-400">
                        {t("consultantDisclaimer")}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showDebug && (
        <DebugPanel
          isOpen={showDebug}
          onClose={() => {}}
          logs={logs}
          onClearLogs={clearLogs}
          status={status}
        />
      )}
    </div>
  );
}





