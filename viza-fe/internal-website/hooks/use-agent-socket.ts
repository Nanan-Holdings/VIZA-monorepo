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
} from "@/types/agent-test";

interface UseAgentSocketOptions {
  serverUrl: string;
  userId: string;
  sessionId: string;
  onTokenBatch?: (tokens: string) => void;
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
 */
export function useAgentSocket({
  serverUrl,
  userId,
  sessionId,
}: UseAgentSocketOptions): UseAgentSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const tokenBufferRef = useRef<string>("");
  const tokenFlushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);

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

    // Connect to visa namespace
    // Use polling first, then upgrade to websocket (more reliable for cloud environments)
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

      // Join user room for proactive messages (greetings, check-ins)
      visaSocket.emit("join_room", `user:${userId}`);
    });

    visaSocket.on("disconnect", (reason) => {
      setStatus("disconnected");
      addLog("disconnected", { reason });
      // Flush any remaining tokens
      flushTokenBuffer();
    });

    visaSocket.on("connect_error", (error) => {
      setStatus("error");
      addLog("error", { message: error.message, type: "connect_error" });
    });

    // Token streaming
    visaSocket.on("token", (event: TokenEvent) => {
      // Accumulate tokens in buffer
      tokenBufferRef.current += event.payload;
      scheduleTokenFlush();
      // Tokens buffered silently — full message revealed on response_complete
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
      console.log("[response_complete] Full event:", event);
      console.log("[response_complete] fullResponse:", event.fullResponse);
      console.log("[response_complete] currentMessageId:", currentMessageIdRef.current);

      flushTokenBuffer();
      addLog("response_complete", {
        duration: event.duration,
        toolsUsed: event.toolsUsed,
        escalated: event.escalated,
        responseLength: event.fullResponse?.length || 0,
      });

      // Mark current message as complete
      if (currentMessageIdRef.current) {
        const messageId = currentMessageIdRef.current;
        console.log("[response_complete] Updating message:", messageId, "with content length:", event.fullResponse?.length);
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, isStreaming: false, content: event.fullResponse || "" }
              : msg
          );
          console.log("[response_complete] Messages after update:", updated.map(m => ({ id: m.id, isStreaming: m.isStreaming, contentLength: m.content.length })));
          return updated;
        });
        currentMessageIdRef.current = null;
      } else {
        console.log("[response_complete] WARNING: currentMessageIdRef is null, cannot update message");
      }
    });

    // Error
    visaSocket.on("error", (event: ErrorEvent) => {
      flushTokenBuffer();
      addLog("error", {
        message: event.message,
        code: event.code,
      });

      // Mark current message as errored
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

    // App log (debug) - backend sends tool_call/tool_result/db_query events via app_log
    visaSocket.on("app_log", (event: Record<string, unknown>) => {
      // Backend AppLogEvent has: type, category, name, args, result, query, params, duration, timestamp
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

    // Proactive messages (reminders, check-ins sent by worker)
    // Note: Backend already filters by user room, no need to check sessionId here
    visaSocket.on("proactive_message", (event: { sessionId: string; message: any }) => {
      console.log("[proactive_message] Received:", event);

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
    });
  }, [serverUrl, addLog, flushTokenBuffer, scheduleTokenFlush]);

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
  // sessionIdOverride allows passing a fresh sessionId when state hasn't updated yet
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

      // Add user message to chat
      const userMessageId = generateId();
      const userMessage: ChatMessage = {
        id: userMessageId,
        role: "user",
        content: message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Create agent message placeholder
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
      console.log("[sendMessage] Set currentMessageIdRef to:", agentMessageId);

      // Send to server
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

  // Clear messages (for session switching)
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
