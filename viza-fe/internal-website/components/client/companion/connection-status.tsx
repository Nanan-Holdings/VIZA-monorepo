"use client";

import { cn } from "@/lib/utils";
import type { ConnectionStatus as ConnectionStatusType } from "@/types/agent-test";

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  locale?: string;
  className?: string;
}

const statusConfig: Record<ConnectionStatusType, { color: string; en: string; zh: string }> = {
  connected: {
    color: "bg-green-500",
    en: "Connected",
    zh: "已连接",
  },
  connecting: {
    color: "bg-amber-500 animate-pulse",
    en: "Connecting...",
    zh: "正在连接……",
  },
  disconnected: {
    color: "bg-gray-400",
    en: "Disconnected",
    zh: "已断开",
  },
  error: {
    color: "bg-red-500",
    en: "Connection error",
    zh: "连接错误",
  },
};

export function ConnectionStatus({ status, locale = "en", className }: ConnectionStatusProps) {
  const config = statusConfig[status];
  const label = locale.toLowerCase().startsWith("zh") ? config.zh : config.en;

  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full",
        config.color,
        className
      )}
      title={label}
      aria-label={label}
    />
  );
}
