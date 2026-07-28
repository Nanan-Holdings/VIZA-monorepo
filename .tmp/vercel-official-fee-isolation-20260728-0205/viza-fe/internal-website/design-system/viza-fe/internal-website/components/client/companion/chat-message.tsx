"use client";

import { AlertTriangle } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "agent" | "system" | "error";
  content: string;
  timestamp?: number;
}

/**
 * Simple markdown-like rendering
 * Handles bold, italic, code, and line breaks
 */
function renderContent(content: string): React.ReactNode {
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```|`[^`]+`)/g);

  return parts.map((part, index) => {
    // Code block
    if (part.startsWith("```") && part.endsWith("```")) {
      const codeContent = part.slice(3, -3);
      const firstNewline = codeContent.indexOf("\n");
      const language = firstNewline > 0 ? codeContent.slice(0, firstNewline).trim() : "";
      const code = firstNewline > 0 ? codeContent.slice(firstNewline + 1) : codeContent;

      return (
        <pre
          key={index}
          className="my-2 rounded-md bg-gray-900 p-3 overflow-x-auto text-sm"
        >
          {language && (
            <div className="text-gray-400 text-xs mb-2 font-mono">{language}</div>
          )}
          <code className="text-gray-100 font-mono whitespace-pre">{code}</code>
        </pre>
      );
    }

    // Inline code
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 font-mono text-sm"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Regular text - handle bold, italic, line breaks
    return (
      <span key={index}>
        {part.split("\n").map((line, lineIndex, lines) => (
          <span key={lineIndex}>
            {line
              // Bold
              .split(/(\*\*[^*]+\*\*)/g)
              .map((segment, segIndex) => {
                if (segment.startsWith("**") && segment.endsWith("**")) {
                  return (
                    <strong key={segIndex} className="font-semibold">
                      {segment.slice(2, -2)}
                    </strong>
                  );
                }
                // Italic
                return segment.split(/(\*[^*]+\*)/g).map((italicPart, italicIndex) => {
                  if (italicPart.startsWith("*") && italicPart.endsWith("*")) {
                    return (
                      <em key={`${segIndex}-${italicIndex}`} className="italic">
                        {italicPart.slice(1, -1)}
                      </em>
                    );
                  }
                  // Handle links
                  return italicPart
                    .split(/(\[[^\]]+\]\([^)]+\))/g)
                    .map((linkPart, linkIndex) => {
                      const linkMatch = linkPart.match(/\[([^\]]+)\]\(([^)]+)\)/);
                      if (linkMatch) {
                        return (
                          <a
                            key={`${segIndex}-${italicIndex}-${linkIndex}`}
                            href={linkMatch[2]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-500 underline hover:text-brand-600"
                          >
                            {linkMatch[1]}
                          </a>
                        );
                      }
                      return linkPart;
                    });
                });
              })}
            {lineIndex < lines.length - 1 && <br />}
          </span>
        ))}
      </span>
    );
  });
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
        {renderContent(content)}
      </div>
    </div>
  );
}
