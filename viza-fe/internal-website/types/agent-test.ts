/**
 * Agent Test Page Types
 *
 * Types for the agent test chat interface to test the agent-backend.
 * Event interfaces match agent-backend/src/dtos/visa-chat.dto.ts
 */

// =============================================================================
// Chat Message Types
// =============================================================================

export type MessageRole = "user" | "agent";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

// =============================================================================
// Log Entry Types
// =============================================================================

export type LogEventType =
  | "token"
  | "tool_call"
  | "tool_result"
  | "escalation"
  | "response_complete"
  | "error"
  | "app_log"
  | "connected"
  | "disconnected"
  | "proactive_message";

export interface LogEntry {
  id: string;
  eventType: LogEventType;
  timestamp: number;
  data: unknown;
  isExpanded?: boolean;
}

// =============================================================================
// Socket.IO Event Types (matching agent-backend DTOs)
// =============================================================================

/**
 * Request payload for visa_chat_message event
 */
export interface VisaChatRequest {
  user_id: string;
  session_id: string;
  message: string;
  service_id?: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

/**
 * Token event - streamed as agent generates response
 */
export interface TokenEvent {
  type: "token";
  payload: string;
  timestamp: number;
}

/**
 * Tool call event - emitted when agent calls a tool
 */
export interface ToolCallEvent {
  type: "tool_call";
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
}

/**
 * Tool result event - emitted when tool returns a result
 */
export interface ToolResultEvent {
  type: "tool_result";
  toolName: string;
  success: boolean;
  timestamp: number;
}

/**
 * Escalation event - emitted when agent triggers internal escalation
 */
export interface EscalationEvent {
  type: "escalation";
  intent: string;
  riskLevel: "low" | "medium" | "high";
  reason: string;
  timestamp: number;
}

/**
 * Response complete event - emitted when agent finishes processing
 */
export interface ResponseCompleteEvent {
  type: "response_complete";
  sessionId: string;
  userId: string;
  fullResponse: string;
  toolsUsed: string[];
  escalated: boolean;
  duration: number;
  timestamp: number;
}

/**
 * Error event - emitted when an error occurs
 */
export interface ErrorEvent {
  type: "error";
  message: string;
  code?: string;
  timestamp: number;
}

/**
 * App log event - emitted for debug logging
 * Backend sends tool_call/tool_result/db_query events via app_log channel
 */
export interface AppLogEvent {
  type: "tool_call" | "tool_result" | "db_query" | "rag_retrieval";
  category: "tool" | "database" | "rag";
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
  query?: string;
  params?: unknown[];
  duration?: number;
  timestamp: number;
}

/**
 * Union type for all visa chat events
 */
export type VisaChatEvent =
  | TokenEvent
  | ToolCallEvent
  | ToolResultEvent
  | EscalationEvent
  | ResponseCompleteEvent
  | ErrorEvent
  | AppLogEvent;

// =============================================================================
// Connection State Types
// =============================================================================

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

// =============================================================================
// Application Block Event (US-037 / US-038)
// =============================================================================

export interface ApplicationBlockEvent {
  type: "application_block";
  payload: {
    blockType: string;
    title: string;
    description?: string;
    fields: Array<{
      name: string;
      label: string;
      type: "text" | "date" | "select" | "file";
      required?: boolean;
      options?: string[];
      placeholder?: string;
    }>;
    saveTarget: string;
    applicationId?: string;
  };
  timestamp: number;
}
