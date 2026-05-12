"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { ArrowDownIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useMessages } from "@/hooks/use-messages";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";
import { TravelPlannerForm } from "./travel-planner-form";

import {
  buildTravelStateFromMessages,
  nextMissingField,
} from "@/lib/travel/planner";

type MessagesProps = {
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  isArtifactVisible: boolean;
  isLoading?: boolean;
  selectedModelId: string;
  onEditMessage?: (message: ChatMessage) => void;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
};

function PureMessages({
  addToolApprovalResponse,
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  isArtifactVisible,
  isLoading,
  selectedModelId: _selectedModelId,
  onEditMessage,
  sendMessage,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    reset,
  } = useMessages({
    status,
  });

  useDataStream();

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      reset();
    }
  }, [chatId, reset]);

  // 👉 planner 状态
  const chatLikeMessages = useMemo(() => {
    return messages.map((m) => ({
      role: m.role,
      parts:
        m.parts?.filter((p) => p.type === "text")?.map((p) => ({
          type: "text",
          text: p.text ?? "",
        })) ?? [],
    }));
  }, [messages]);

  const travelState = useMemo(() => {
    return buildTravelStateFromMessages(chatLikeMessages);
  }, [chatLikeMessages]);

  const missingField = useMemo(() => {
    return nextMissingField(travelState);
  }, [travelState]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-background">
      {messages.length === 0 && !isLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Greeting />
        </div>
      )}

      <div
        className="flex h-full flex-col overflow-y-auto"
        ref={messagesContainerRef}
      >
        {/* 🔥 统一 container（关键） */}
        <div className="mx-auto w-full max-w-4xl flex flex-col gap-5 px-4 pt-6 pb-24">

          {/* 正常消息 */}
          {messages.map((message) => (
            <PreviewMessage key={message.id} message={message} />
          ))}

          {/* thinking */}
          {status === "submitted" && messages.at(-1)?.role !== "assistant" && (
            <ThinkingMessage />
          )}

          {/* 🔥 表单（和输入框完全对齐） */}
          {missingField && (
            <div className="w-full flex justify-start">
              <div className="flex items-start gap-3 w-full">

                {/* avatar */}
                <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50 shrink-0">
                  ✨
                </div>

                {/* form */}
                <div className="flex flex-col gap-2 w-full">
                  <TravelPlannerForm
                    messages={messages}
                    sendMessage={sendMessage}
                    status={status}
                  />
                </div>

              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="min-h-[24px]" />
        </div>
      </div>

      {/* scroll */}
      <button
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${
          isAtBottom ? "opacity-0" : "opacity-100"
        }`}
        onClick={() => scrollToBottom("smooth")}
      >
        <ArrowDownIcon />
      </button>
    </div>
  );
}

export const Messages = PureMessages;