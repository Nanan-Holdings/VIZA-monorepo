"use client";

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isConnecting?: boolean;
  placeholder?: string;
}

const MAX_ROWS = 10;
const LINE_HEIGHT = 28; // Approximate line height in pixels

export function ChatInput({
  onSend,
  disabled = false,
  isConnecting = false,
  placeholder = "Ask anything...",
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";

    // Calculate new height (capped at MAX_ROWS)
    const maxHeight = LINE_HEIGHT * MAX_ROWS;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = "auto";
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setValue("");

    // Focus back on textarea
    textareaRef.current?.focus();
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send (without shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
        return;
      }

      // Ctrl/Cmd + Enter also sends
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
        return;
      }
    },
    [handleSend]
  );

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-white px-5 sm:px-6 pb-5 pt-2 shadow-sm transition-all duration-200",
        disabled
          ? "border-gray-100 opacity-60"
          : "border-gray-200 hover:border-gray-300 focus-within:border-brand-500"
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          "w-full bg-transparent text-xl outline-none placeholder:text-gray-400 min-w-0 resize-none overflow-y-auto pr-2 pt-4 pb-2",
          "leading-7" // Matches LINE_HEIGHT
        )}
        style={{ height: "40px", maxHeight: `${LINE_HEIGHT * MAX_ROWS}px` }}
        aria-label="Message input"
      />

      <div className="flex justify-end">
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200",
            canSend
              ? "bg-brand-500 text-white hover:bg-brand-600 cursor-pointer"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          )}
          aria-label={isConnecting ? "Connecting..." : "Send message"}
        >
          {isConnecting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  );
}
