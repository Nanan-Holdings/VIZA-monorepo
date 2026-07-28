"use client";

import { cn } from "@/lib/utils";
import type { ConnectionStatus as ConnectionStatusType } from "@/types/agent-test";

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  className?: string;
}

const statusConfig: Record<ConnectionStatusType, { color: string; label: string }> = {
  connected: {
    color: "bg-green-500",
    label: "Connected",
  },
  connecting: {
    color: "bg-amber-500 animate-pulse",
    label: "Connecting...",
  },
  disconnected: {
    color: "bg-gray-400",
    label: "Disconnected",
  },
  error: {
    color: "bg-red-500",
    label: "Connection error",
  },
};

export function ConnectionStatus({ status, className }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full",
        config.color,
        className
      )}
      title={config.label}
      aria-label={config.label}
    />
  );
}
