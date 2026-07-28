"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Trash2, Copy, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { LogEntry, ConnectionStatus } from "@/types/agent-test";

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  onClearLogs: () => void;
  status: ConnectionStatus;
}

/**
 * Format timestamp to HH:MM:SS
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Get color for log event type
 */
function getEventColor(eventType: LogEntry["eventType"]): string {
  switch (eventType) {
    case "connected":
      return "text-green-600";
    case "disconnected":
      return "text-red-600";
    case "token":
      return "text-gray-500";
    case "tool_call":
      return "text-purple-600";
    case "tool_result":
      return "text-blue-600";
    case "escalation":
      return "text-amber-600";
    case "error":
      return "text-red-600";
    case "app_log":
      return "text-blue-500";
    case "response_complete":
      return "text-green-500";
    default:
      return "text-gray-600";
  }
}

/**
 * Get background color for status badge
 */
function getStatusBgColor(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "bg-green-500";
    case "connecting":
      return "bg-amber-500";
    case "disconnected":
      return "bg-gray-400";
    case "error":
      return "bg-red-500";
  }
}

/**
 * Format log data for display
 */
function formatLogData(data: unknown): string {
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

/**
 * Render a single log entry
 */
function LogEntryItem({ log }: { log: LogEntry }) {
  const data = log.data as Record<string, unknown> | null;

  return (
    <div className="border-b border-gray-100 py-2 px-3 text-xs font-mono">
      <div className="flex items-start gap-2">
        <span className="text-gray-400 flex-shrink-0">[{formatTime(log.timestamp)}]</span>
        <span className={cn("font-medium", getEventColor(log.eventType))}>
          {log.eventType}
        </span>
      </div>

      {/* Token events - show text inline */}
      {log.eventType === "token" && data?.text != null ? (
        <div className="mt-1 text-gray-600 break-all">{String(data.text)}</div>
      ) : null}

      {/* Tool call events */}
      {log.eventType === "tool_call" ? (
        <div className="mt-1 space-y-1">
          <div className="text-purple-700">Tool: {String(data?.toolName ?? "unknown")}</div>
          {data?.args != null ? (
            <pre className="text-gray-500 text-[10px] overflow-x-auto bg-gray-50 p-1 rounded">
              {formatLogData(data.args)}
            </pre>
          ) : null}
        </div>
      ) : null}

      {/* Tool result events */}
      {log.eventType === "tool_result" ? (
        <div className="mt-1">
          <span className="text-blue-700">Tool: {String(data?.toolName ?? "unknown")}</span>
          <span
            className={cn(
              "ml-2",
              data?.success ? "text-green-600" : "text-red-600"
            )}
          >
            {data?.success ? "Success" : "Failed"}
          </span>
        </div>
      ) : null}

      {/* Escalation events */}
      {log.eventType === "escalation" ? (
        <div className="mt-1 text-amber-700">
          Intent: {String(data?.intent ?? "unknown")} | Risk: {String(data?.riskLevel ?? "unknown")}
          {data?.reason != null ? <div className="text-gray-600">{String(data.reason)}</div> : null}
        </div>
      ) : null}

      {/* Error events */}
      {log.eventType === "error" ? (
        <div className="mt-1 text-red-600">
          {String(data?.message ?? "Unknown error")}
          {data?.code != null ? <span className="text-gray-500"> ({String(data.code)})</span> : null}
        </div>
      ) : null}

      {/* App log events */}
      {log.eventType === "app_log" ? (
        <div className="mt-1">
          <span className="inline-block px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
            {String(data?.category ?? "app")}
          </span>
          <span className="ml-2 text-gray-700">{String(data?.name ?? "log")}</span>
          {data?.duration != null ? (
            <span className="ml-2 text-gray-500">{String(data.duration)}ms</span>
          ) : null}
        </div>
      ) : null}

      {/* Response complete events */}
      {log.eventType === "response_complete" ? (
        <div className="mt-1 text-green-700">
          Duration: {String(data?.duration ?? 0)}ms | Tools: {String(data?.toolsUsed ?? 0)}
          {data?.escalated ? (
            <span className="ml-2 text-amber-600">Escalated</span>
          ) : null}
        </div>
      ) : null}

      {/* Connected/Disconnected events */}
      {(log.eventType === "connected" || log.eventType === "disconnected") && data ? (
        <div className="mt-1 text-gray-500">
          {log.eventType === "connected" && data?.socketId != null ? (
            <span>Socket: {String(data.socketId)}</span>
          ) : null}
          {log.eventType === "disconnected" && data?.reason != null ? (
            <span>Reason: {String(data.reason)}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DebugPanel({
  isOpen,
  onClose,
  logs,
  onClearLogs,
  status,
}: DebugPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLogs = useCallback(async () => {
    const logsText = logs
      .map((log) => {
        const time = formatTime(log.timestamp);
        const data = log.data ? ` ${formatLogData(log.data)}` : "";
        return `[${time}] ${log.eventType}${data}`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(logsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy logs:", err);
    }
  }, [logs]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed right-0 top-32 bottom-0 w-[300px] bg-white border-l border-gray-200 shadow-lg z-20 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900">Debug</h3>
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  getStatusBgColor(status)
                )}
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopyLogs}
                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="Copy all logs"
                disabled={logs.length === 0}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
              <button
                onClick={onClearLogs}
                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="Clear logs"
              >
                <Trash2 className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="Close debug panel"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Logs */}
          <ScrollArea className="flex-1">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                No logs yet
              </div>
            ) : (
              <div className="flex flex-col-reverse">
                {/* Newest first */}
                {[...logs].reverse().map((log) => (
                  <LogEntryItem key={log.id} log={log} />
                ))}
              </div>
            )}
          </ScrollArea>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
