"use client";

import { AlertTriangle } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "agent" | "system" | "error";
  content: string;
  timestamp?: number;
}

function normalizePlainTextContent(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, (block) => {
      const code = block.slice(3, -3);
      const firstNewline = code.indexOf("\n");
      return firstNewline > 0 ? code.slice(firstNewline + 1).trim() : code.trim();
    })
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
    .replace(/^\s*\|(.+)\|\s*$/gm, (_line, cells: string) =>
      cells
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" | ")
    )
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderPlainContent(content: string): React.ReactNode {
  const plainContent = normalizePlainTextContent(content);

  return plainContent.split("\n").map((line, index, lines) => (
    <span key={index}>
      {line}
      {index < lines.length - 1 && <br />}
    </span>
  ));
}

export function ChatMessage({
  role,
  content,
  timestamp,
}: ChatMessageProps) {
  // User message
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-brand-500 text-white rounded-xl rounded-br-md px-6 py-4 max-w-[85%]">
          <p className="text-base sm:text-lg whitespace-pre-wrap leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }

  // System message (e.g., escalation)
  if (role === "system") {
    return (
      <div className="flex justify-center my-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>{content}</span>
        </div>
      </div>
    );
  }

  // Error message
  if (role === "error") {
    return (
      <div className="w-full flex gap-3 items-start">
        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-red-600" />
        </div>
        <p className="text-red-700 text-base sm:text-lg whitespace-pre-wrap leading-relaxed">
          {content}
        </p>
      </div>
    );
  }

  // Agent message
  return (
    <div className="w-full">
      {/* Message content */}
      <div className="text-gray-700 text-base sm:text-lg whitespace-pre-wrap leading-relaxed">
        {renderPlainContent(content)}
      </div>
    </div>
  );
}
