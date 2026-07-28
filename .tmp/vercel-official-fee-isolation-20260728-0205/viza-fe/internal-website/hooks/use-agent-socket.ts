"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ChatMessage,
  LogEntry,
  ConnectionStatus,
  VisaChatRequest,
  TokenEvent,
  ToolCallEvent,
  ToolResultEvent,
  EscalationEvent,
  ResponseCompleteEvent,
  ErrorEvent,
  AppLogEvent,
  ApplicationBlockEvent,
} from "@/types/agent-test";

interface UseAgentSocketOptions {
  serverUrl: string;
  userId: string;
  sessionId: string;
  onTokenBatch?: (tokens: string) => void;
  /** Called when the agent emits an application_block tool event (US-038) */
  onApplicationBlock?: (event: ApplicationBlockEvent) => void;
}

interface UseAgentSocketReturn {
  status: ConnectionStatus;
  messages: ChatMessage[];
  logs: LogEntry[];
  sendMessage: (message: string, sessionIdOverride?: string) => void;
  clearLogs: () => void;
  clearMessages: () => void;
  connect: () => void;
  disconnect: () => void;
}

// Token batching interval in ms
const TOKEN_BATCH_INTERVAL = 500;

/**
 * Custom hook for managing Socket.IO connection to the visa agent backend
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Token batching to reduce log noise
 * - Full event logging with expandable data
 * - US-038: application_block event forwarded via onApplicationBlock callback
 */
export function useAgentSocket({
  serverUrl,
  userId,
  sessionId,
  onApplicationBlock,
}: UseAgentSocketOptions): UseAgentSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const tokenBufferRef = useRef<string>("");
  const tokenFlushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  // Keep onApplicationBlock stable in a ref to avoid reconnect on every render
  const onApplicationBlockRef = useRef(onApplicationBlock);
  useEffect(() => {
    onApplicationBlockRef.current = onApplicationBlock;
  }, [onApplicationBlock]);

  // Generate unique ID
  const generateId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  // Add log entry
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

  // Flush accumulated tokens to log
  const flushTokenBuffer = useCallback(() => {
    if (tokenBufferRef.current) {
      addLog("token", { text: tokenBufferRef.current });
      tokenBufferRef.current = "";
    }
    if (tokenFlushTimeoutRef.current) {
      clearTimeout(tokenFlushTimeoutRef.current);
      tokenFlushTimeoutRef.current = null;
    }
  }, [addLog]);

  // Schedule token flush
  const scheduleTokenFlush = useCallback(() => {
    if (!tokenFlushTimeoutRef.current) {
      tokenFlushTimeoutRef.current = setTimeout(
        flushTokenBuffer,
        TOKEN_BATCH_INTERVAL
      );
    }
  }, [flushTokenBuffer]);

  // Connect to socket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    setStatus("connecting");

    const visaSocket = io(`${serverUrl}/visa`, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 20000,
    });

    socketRef.current = visaSocket;

    // Connection events
    visaSocket.on("connect", () => {
      setStatus("connected");
      addLog("connected", { socketId: visaSocket.id });
      visaSocket.emit("join_room", `user:${userId}`);
    });

    visaSocket.on("disconnect", (reason) => {
      setStatus("disconnected");
      addLog("disconnected", { reason });
      flushTokenBuffer();
    });

    visaSocket.on("connect_error", (error) => {
      setStatus("error");
      addLog("error", { message: error.message, type: "connect_error" });
    });

    // Token streaming
    visaSocket.on("token", (event: TokenEvent) => {
      tokenBufferRef.current += event.payload;
      scheduleTokenFlush();
    });

    // Tool call
    visaSocket.on("tool_call", (event: ToolCallEvent) => {
      flushTokenBuffer();
      addLog("tool_call", {
        toolName: event.toolName,
        args: event.args,
      });
    });

    // Tool result
    visaSocket.on("tool_result", (event: ToolResultEvent) => {
      addLog("tool_result", {
        toolName: event.toolName,
        success: event.success,
      });
    });

    // Escalation
    visaSocket.on("escalation", (event: EscalationEvent) => {
      flushTokenBuffer();
      addLog("escalation", {
        intent: event.intent,
        riskLevel: event.riskLevel,
        reason: event.reason,
      });
    });

    // Response complete
    visaSocket.on("response_complete", (event: ResponseCompleteEvent) => {
      flushTokenBuffer();
      addLog("response_complete", {
        duration: event.duration,
        toolsUsed: event.toolsUsed,
        escalated: event.escalated,
        responseLength: event.fullResponse?.length || 0,
      });

      if (currentMessageIdRef.current) {
        const messageId = currentMessageIdRef.current;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, isStreaming: false, content: event.fullResponse || "" }
              : msg
          )
        );
        currentMessageIdRef.current = null;
      }
    });

    // Error
    visaSocket.on("error", (event: ErrorEvent) => {
      flushTokenBuffer();
      addLog("error", {
        message: event.message,
        code: event.code,
      });

      if (currentMessageIdRef.current) {
        setMessages((prev) =>
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

    // App log (debug)
    visaSocket.on("app_log", (event: Record<string, unknown>) => {
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

    // Proactive messages
    visaSocket.on(
      "proactive_message",
      (event: { sessionId: string; message: { id: string; content: string; createdAt: string; intent?: string } }) => {
        const proactiveMessage: ChatMessage = {
          id: event.message.id,
          role: "agent",
          content: event.message.content,
          timestamp: new Date(event.message.createdAt).getTime(),
          isStreaming: false,
        };
        setMessages((prev) => [...prev, proactiveMessage]);
        addLog("proactive_message", {
          intent: event.message.intent,
          messageId: event.message.id,
        });
      }
    );

    // US-038: application_block — forward to parent callback
    visaSocket.on("application_block", (event: ApplicationBlockEvent) => {
      addLog("tool_call", {
        toolName: "send_application_block",
        args: event.payload,
      });
      onApplicationBlockRef.current?.(event);
    });
  }, [serverUrl, userId, addLog, flushTokenBuffer, scheduleTokenFlush]);

  // Disconnect from socket
  const disconnect = useCallback(() => {
    flushTokenBuffer();
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setStatus("disconnected");
  }, [flushTokenBuffer]);

  // Send message
  const sendMessage = useCallback(
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
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const agentMessageId = generateId();
      const agentMessage: ChatMessage = {
        id: agentMessageId,
        role: "agent",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };
      setMessages((prev) => [...prev, agentMessage]);
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

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
    currentMessageIdRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tokenFlushTimeoutRef.current) {
        clearTimeout(tokenFlushTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return {
    status,
    messages,
    logs,
    sendMessage,
    clearLogs,
    clearMessages,
    connect,
    disconnect,
  };
}
