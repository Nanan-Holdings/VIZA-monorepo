"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { AiAssistIcon } from "@/components/ui/ai-assist-button";
import { Textarea } from "@/components/ui/textarea";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";
import {
  type FieldGuidanceRequest,
  type FieldGuidanceResponse,
  type FieldGuidanceChatMessage,
} from "@/types/field-guidance";

const MAX_HISTORY_MESSAGES = 8;
const MAX_VISIBLE_OPTION_EXPLANATIONS = 2;
const MAX_VISIBLE_EXAMPLES = 2;
const ASK_INPUT_MIN_HEIGHT = 34;
const ASK_INPUT_MAX_HEIGHT = 78;

/** Splits "source → value" style examples so they can be shown as a worked example. */
const EXAMPLE_ARROW = /\s*(?:→|⇒|->|=>)\s*/g;

type ChatMessage = FieldGuidanceChatMessage & { id: string };

interface FieldGuidancePanelProps {
  country?: string | null;
  visaType: string;
  locale: string;
  field: VisaFormFieldRow;
  answer: string;
  allAnswers: Record<string, string>;
  onClose: () => void;
}

function makeMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePlainTextContent(content: string, keepStrong = false): string {
  const withoutBlocks = content
    .replace(/```[\s\S]*?```/g, (block) => {
      const code = block.slice(3, -3);
      const firstNewline = code.indexOf("\n");
      return firstNewline > 0 ? code.slice(firstNewline + 1).trim() : code.trim();
    })
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
    .replace(/^\s*\|(.+)\|\s*$/gm, (_line, cells: string) =>
      cells
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" | "),
    );

  const withoutStrong = keepStrong
    ? withoutBlocks
    : withoutBlocks.replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1");

  return withoutStrong
    .replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, "$1$2$3")
    .replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, "$1$2$3")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderPlainText(content: string) {
  const plainContent = normalizePlainTextContent(content);

  return plainContent.split("\n").map((line, index, lines) => (
    <span key={index}>
      {line}
      {index < lines.length - 1 && <br />}
    </span>
  ));
}

/** Answer copy keeps `**emphasis**` so the key instruction can carry brand weight. */
function renderAnswer(content: string) {
  const plainContent = normalizePlainTextContent(content, true);

  return plainContent.split("\n").map((line, lineIndex, lines) => (
    <span key={lineIndex}>
      {line.split(/\*\*([^*\n]+)\*\*/g).map((part, partIndex) =>
        partIndex % 2 === 1 ? (
          <b key={partIndex} className="font-semibold text-brand-500">
            {part}
          </b>
        ) : (
          <span key={partIndex}>{part}</span>
        ),
      )}
      {lineIndex < lines.length - 1 && <br />}
    </span>
  ));
}

type ParsedExample = { source: string | null; value: string };

function parseExample(raw: string): ParsedExample {
  const text = normalizePlainTextContent(raw);
  // Split on the last arrow only, so arrows inside the source (SIN→DPS) stay intact.
  const matches = [...text.matchAll(EXAMPLE_ARROW)];
  const lastArrow = matches[matches.length - 1];

  if (lastArrow?.index !== undefined) {
    const source = text.slice(0, lastArrow.index).trim();
    const value = text.slice(lastArrow.index + lastArrow[0].length).trim();
    if (source && value) return { source, value };
  }

  return { source: null, value: text };
}

/** Underlines the part of the source document the user should copy. */
function SourceLine({ source, value }: { source: string; value: string }) {
  const matchIndex = value ? source.toLowerCase().indexOf(value.toLowerCase()) : -1;

  if (matchIndex < 0) return <>{source}</>;

  return (
    <>
      {source.slice(0, matchIndex)}
      <mark className="border-b-2 border-brand-500 bg-transparent pb-px font-semibold text-brand-500">
        {source.slice(matchIndex, matchIndex + value.length)}
      </mark>
      {source.slice(matchIndex + value.length)}
    </>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="block text-[10px] font-medium uppercase tracking-[0.06em] text-black/45">
      {children}
    </span>
  );
}

function ExampleCard({
  caption,
  examples,
}: {
  caption: string;
  examples: ParsedExample[];
}) {
  if (examples.length === 0) return null;

  return (
    <div className="mx-4 mb-4 overflow-hidden rounded-[10px] border border-[#efefef] bg-[#fafafa]">
      <div className="px-3.5 pb-1.5 pt-2.5">
        <Eyebrow>{caption}</Eyebrow>
      </div>
      {examples.map((example, index) => (
        <div key={`${example.value}-${index}`}>
          {example.source && (
            <div className="overflow-hidden text-ellipsis whitespace-nowrap px-3.5 pb-2.5 font-mono text-[11px] tracking-[0.04em] text-black/45">
              <SourceLine source={example.source} value={example.value} />
            </div>
          )}
          <div className="border-t border-[#efefef] px-3.5 py-2.5">
            <span className="min-w-0 break-words text-[12px] font-medium text-[#3d3d3d]">
              {example.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function OptionExplanationList({
  title,
  items,
}: {
  title: string;
  items: NonNullable<FieldGuidanceResponse["guidance"]["optionExplanations"]>;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mx-4 mb-4 overflow-hidden rounded-[10px] border border-[#efefef] bg-[#fafafa]">
      <div className="px-3.5 pb-1.5 pt-2.5">
        <Eyebrow>{title}</Eyebrow>
      </div>
      {items.slice(0, MAX_VISIBLE_OPTION_EXPLANATIONS).map((item) => (
        <div
          key={`${item.value}-${item.label}`}
          className="border-t border-[#efefef] px-3.5 py-2.5 text-[11px]"
        >
          <div className="break-words text-[12px] font-medium text-[#3d3d3d]">
            {normalizePlainTextContent(item.label)}
          </div>
          <p className="mt-1 min-w-0 break-words leading-4 text-black/55">
            {renderPlainText(item.description)}
          </p>
        </div>
      ))}
    </section>
  );
}

function NoteList({
  notes,
  warnings,
}: {
  notes: string[];
  warnings: string[];
}) {
  if (notes.length === 0 && warnings.length === 0) return null;

  // Same voice as the answer paragraph above the example card — just bulleted.
  const bulletClass = "flex min-w-0 gap-1.5 text-[13px] leading-[1.5]";

  return (
    <section className="mb-4 flex flex-col gap-1 px-4">
      {notes.map((note, index) => (
        <span key={`note-${index}`} className={`${bulletClass} text-[#3d3d3d]`}>
          <span aria-hidden="true">•</span>
          <span className="min-w-0 break-words">{normalizePlainTextContent(note)}</span>
        </span>
      ))}
      {warnings.map((warning, index) => (
        <span key={`warning-${index}`} className={`${bulletClass} text-[#92400e]`}>
          <span aria-hidden="true">•</span>
          <span className="min-w-0 break-words">{normalizePlainTextContent(warning)}</span>
        </span>
      ))}
    </section>
  );
}

export function FieldGuidancePanel({
  country,
  visaType,
  locale,
  field,
  answer,
  allAnswers,
  onClose,
}: FieldGuidancePanelProps) {
  const [data, setData] = useState<FieldGuidanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questionLoading, setQuestionLoading] = useState(false);
  const askInputRef = useRef<HTMLTextAreaElement>(null);

  const isZh = locale.toLowerCase().startsWith("zh");
  const labels = useMemo(
    () => ({
      eyebrow: isZh ? "字段填写帮助" : "Field guidance",
      loading: isZh ? "AI 正在读取题目要求..." : "AI is reading the field requirements...",
      retry: isZh ? "重试" : "Retry",
      examples: isZh ? "示例" : "Examples",
      optionExplanations: isZh ? "选项说明" : "Option explanations",
      askPlaceholder: isZh
        ? "比如：这个必须和护照完全一样吗？"
        : "For example: does this need to match my passport exactly?",
      send: isZh ? "发送" : "Send",
      close: isZh ? "关闭" : "Close",
    }),
    [isZh],
  );
  // The popover re-renders on every scroll/reposition, which hands us fresh
  // `field`/`allAnswers` object identities. Read them through a ref so the
  // fetch callback stays stable and the panel only loads once per field.
  const requestRef = useRef({ visaType, country, locale, field, answer, allAnswers });
  requestRef.current = { visaType, country, locale, field, answer, allAnswers };

  const fetchGuidance = useCallback(
    async (nextQuestion?: string, history?: FieldGuidanceChatMessage[]) => {
      if (nextQuestion) {
        setQuestionLoading(true);
        setData((current) => current ? { ...current, reply: undefined } : current);
      } else {
        setLoading(true);
      }
      setError(null);

      const requestBody: FieldGuidanceRequest = {
        ...requestRef.current,
        question: nextQuestion,
        history: history && history.length > 0 ? history : undefined,
      };

      try {
        const res = await fetch("/api/field-guidance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Guidance service returned ${res.status}`);
        const nextData = (await res.json()) as FieldGuidanceResponse;
        setData(nextData);
        if (nextQuestion) {
          const reply = nextData.reply?.trim();
          if (reply) {
            setMessages((current) => [
              ...current,
              { id: makeMessageId("assistant"), role: "assistant", content: reply },
            ]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load field guidance");
      } finally {
        setLoading(false);
        setQuestionLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchGuidance();
  }, [fetchGuidance, field.fieldName, visaType, country, locale]);

  useLayoutEffect(() => {
    const input = askInputRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(
      Math.max(input.scrollHeight, ASK_INPUT_MIN_HEIGHT),
      ASK_INPUT_MAX_HEIGHT,
    )}px`;
  }, [question]);

  const handleAsk = useCallback(() => {
    const trimmed = question.trim();
    if (!trimmed || questionLoading) return;
    const history = messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [
      ...current,
      { id: makeMessageId("user"), role: "user", content: trimmed },
    ]);
    void fetchGuidance(trimmed, history);
    setQuestion("");
  }, [fetchGuidance, messages, question, questionLoading]);

  const handleQuestionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
      if (event.shiftKey && !event.ctrlKey && !event.metaKey) return;

      event.preventDefault();
      handleAsk();
    },
    [handleAsk],
  );

  const examples = useMemo(
    () => (data?.guidance.examples ?? []).slice(0, MAX_VISIBLE_EXAMPLES).map(parseExample),
    [data?.guidance.examples],
  );
  const optionExplanations = data?.guidance.optionExplanations ?? [];
  const notes = useMemo(
    () => [
      ...(data?.guidance.formatHints ?? []).slice(0, 1),
      ...(data?.guidance.hints ?? []).slice(0, 1),
    ],
    [data?.guidance.formatHints, data?.guidance.hints],
  );
  const warnings = (data?.guidance.officialWarnings ?? []).slice(0, 1);
  const hasChatHistory = messages.length > 0 || questionLoading;

  return (
    <div
      className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#efefef] bg-white shadow-md"
      onClick={(event) => event.stopPropagation()}
      data-field-guidance-panel={field.fieldName}
    >
      <div className="flex items-start gap-2.5 border-b border-[#efefef] px-4 pb-3.5 pt-4">
        <div className="min-w-0 flex-1">
          <Eyebrow>{labels.eyebrow}</Eyebrow>
          <h3 className="mt-1 break-words text-[15px] font-medium leading-tight tracking-[-0.4px] text-[#3d3d3d]">
            {field.label || data?.guidance.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#989898] transition-colors hover:bg-[#f6f6f6] hover:text-[#3d3d3d]"
          aria-label={labels.close}
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-4 py-4 text-[11px] text-black/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {labels.loading}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center gap-2 px-4 py-4 text-[11px] text-black/45">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#989898]" />
          <span className="min-w-0 break-words">{error}</span>
          <button
            type="button"
            onClick={() => void fetchGuidance()}
            className="ml-auto shrink-0 text-[11px] font-medium text-brand-500 underline-offset-2 hover:underline"
          >
            {labels.retry}
          </button>
        </div>
      )}

      {data && !loading && (
        <>
          <p className="min-w-0 text-pretty break-words px-4 py-4 text-[13px] leading-[1.5] text-[#3d3d3d]">
            {renderAnswer(data.guidance.summary)}
          </p>

          <ExampleCard caption={labels.examples} examples={examples} />

          <OptionExplanationList
            title={labels.optionExplanations}
            items={optionExplanations}
          />

          <NoteList notes={notes} warnings={warnings} />
        </>
      )}

      {hasChatHistory && (
        <div className="flex max-h-[224px] flex-col gap-2.5 overflow-y-auto border-t border-[#efefef] px-4 py-3">
          {messages.map((message) =>
            message.role === "user" ? (
              <div className="flex justify-end" key={message.id}>
                <div className="max-w-[82%] rounded-xl rounded-br-sm bg-brand-500 px-3 py-2 text-[11px] leading-4 text-white">
                  {renderPlainText(message.content)}
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 items-start gap-1.5" key={message.id}>
                <span className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#f6f6f6] text-brand-500">
                  <AiAssistIcon className="h-3 w-3" />
                </span>
                <div className="min-w-0 max-w-[86%] break-words rounded-xl rounded-tl-sm bg-[#fafafa] px-3 py-2 text-[11px] leading-4 text-[#3d3d3d]">
                  {renderPlainText(message.content)}
                </div>
              </div>
            ),
          )}
          {questionLoading && (
            <div className="flex min-w-0 items-start gap-1.5">
              <span className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#f6f6f6] text-brand-500">
                <AiAssistIcon className="h-3 w-3" />
              </span>
              <div className="min-w-0 rounded-xl rounded-tl-sm bg-[#fafafa] px-3 py-2 text-[11px] leading-4">
                <span className="inline-flex items-center gap-1.5 text-black/45">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isZh ? "正在回答..." : "Replying..."}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-[#efefef] px-4 py-3.5">
        <Textarea
          ref={askInputRef}
          rows={1}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleQuestionKeyDown}
          placeholder={labels.askPlaceholder}
          aria-label={labels.eyebrow}
          aria-keyshortcuts="Enter Control+Enter Meta+Enter"
          className="min-h-[34px] flex-1 resize-none overflow-y-auto rounded-[17px] border-[#e5e7eb] bg-white px-3.5 py-2 text-[12px] leading-[18px] text-[#3d3d3d] shadow-none placeholder:text-black/40 focus-visible:border-brand-500 focus-visible:ring-1 focus-visible:ring-brand-500 md:text-[12px]"
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={!question.trim() || questionLoading}
          aria-label={labels.send}
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {questionLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

    </div>
  );
}
