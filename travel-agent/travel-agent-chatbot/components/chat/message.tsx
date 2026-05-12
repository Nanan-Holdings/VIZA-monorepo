"use client";

import type { ChatMessage } from "@/lib/types";
import { parseItineraryText } from "@/lib/travel/planner";
import { sanitizeText } from "@/lib/utils";
import { SparklesIcon } from "./icons";
import { TravelItineraryPanel } from "./travel-itinerary-panel";

function stripItineraryJson(text: string) {
  const withoutFenced = text.replace(/```json[\s\S]*?```/gi, "").trim();
  if (withoutFenced !== text) return withoutFenced.trim();

  const bracketMatch = text.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    return text.replace(bracketMatch[0], "").trim();
  }

  return text;
}

const PurePreviewMessage = ({
  message,
}: {
  message: ChatMessage;
}) => {
  const isUser = message.role === "user";

  const assistantText = isUser
    ? ""
    : message.parts
        ?.filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("\n")
        .trim() ?? "";

  const itineraryFromText = isUser ? [] : parseItineraryText(assistantText);
  const hasToolItinerary =
    !isUser && message.parts?.some((part) => part.type === "tool-itinerary");
  const shouldRenderItinerary =
    !isUser && (hasToolItinerary || itineraryFromText.length > 0);

  const content = message.parts?.map((part: any, i: number) => {
    // ✅ 普通文本
    if (part.type === "text") {
      const rawText = part.text ?? "";
      const cleanedText = shouldRenderItinerary
        ? stripItineraryJson(rawText)
        : rawText;
      const safeText = sanitizeText(cleanedText);

      if (!safeText) return null;

      return (
        <div
          key={i}
          className={`px-4 py-2 text-[13px] leading-[1.65] break-words rounded-2xl
            max-w-[min(90%,700px)]
            ${
              isUser
                ? "bg-accent text-accent-foreground rounded-br-md"
                : "bg-muted text-foreground rounded-bl-md"
            }
          `}
        >
          {safeText}
        </div>
      );
    }

    return null;
  });

  return (
    <div className="w-full flex py-1">
      {isUser ? (
        <div className="w-full flex justify-end">{content}</div>
      ) : (
        <div className="w-full flex justify-start gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50 shrink-0">
            <SparklesIcon size={13} />
          </div>

          <div className="flex flex-col gap-2 w-full">
            {content}
            {shouldRenderItinerary && (
              <div className="w-full">
                <TravelItineraryPanel messages={[message]} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const PreviewMessage = PurePreviewMessage;

export const ThinkingMessage = () => {
  return (
    <div className="w-full flex justify-start py-1">
      <div className="flex items-center gap-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50">
          <SparklesIcon size={13} />
        </div>
        <div className="text-sm opacity-70">Thinking...</div>
      </div>
    </div>
  );
};