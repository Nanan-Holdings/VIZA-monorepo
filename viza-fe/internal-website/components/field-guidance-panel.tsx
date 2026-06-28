"use client";

import { type KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { type VisaFormFieldRow } from "@/types/visa-form-fields";
import {
  type FieldGuidanceRequest,
  type FieldGuidanceResponse,
  type FieldGuidanceChatMessage,
  type FieldGuidanceSeverity,
} from "@/types/field-guidance";
import { cn } from "@/lib/utils";

const MAX_HISTORY_MESSAGES = 8;

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

function severityClasses(severity: FieldGuidanceSeverity): string {
  if (severity === "error") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "warning") return "border-[#b8d3f3] bg-[#eef6ff] text-[#03346E]";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function SeverityIcon({ severity }: { severity: FieldGuidanceSeverity }) {
  if (severity === "ok") return <CheckCircle2 className="h-4 w-4 shrink-0" />;
  return <AlertCircle className="h-4 w-4 shrink-0" />;
}

function makeMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    )
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/(^|[^\w])\*([^*\n]+)\*([^\w]|$)/g, "$1$2$3")
    .replace(/(^|[^\w])_([^_\n]+)_([^\w]|$)/g, "$1$2$3")
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

function sourceIdentity(source: FieldGuidanceResponse["sources"][number]): string {
  return [source.title.trim(), source.url?.trim() ?? "", source.excerpt.trim()].join("|");
}

function localizedSourceTitle(title: string, isZh: boolean): string {
  if (!isZh) return title;
  const normalized = title.toLowerCase();

  if (normalized.includes("photo")) return "签证照片官方要求";
  if (normalized.includes("indonesia")) return "印度尼西亚申请表与材料要求";
  if (normalized.includes("united states")) return "美国签证申请表与材料要求";
  if (normalized.includes("local")) return "VIZA 本地字段提示";
  if (normalized.includes("application form") || normalized.includes("document intake")) {
    return "官方申请表与材料要求";
  }
  return title;
}

function sourceCountryLabel(text: string): string | null {
  const normalized = text.toLowerCase();
  if (normalized.includes("indonesia")) return "印度尼西亚";
  if (normalized.includes("united states") || /\bcountry:\s*us\b/.test(normalized)) return "美国";
  return null;
}

function sourceVisaTypeLabel(text: string): string | null {
  const normalized = text.toLowerCase();
  if (normalized.includes("tourist_b211a")) return "B211A 旅游签证";
  if (normalized.includes("b1_b2")) return "B1/B2";
  if (normalized.includes("ds160") || normalized.includes("ds-160")) return "DS-160";
  return null;
}

function sourceScopeSummary(source: FieldGuidanceResponse["sources"][number]): string {
  const haystack = `${source.title} ${source.excerpt}`;
  const normalized = haystack.toLowerCase();
  const country = sourceCountryLabel(haystack);
  const visaType = sourceVisaTypeLabel(haystack);
  const scopeParts = [
    country ? `适用国家/地区：${country}` : null,
    visaType ? `签证类型：${visaType}` : null,
  ].filter(Boolean);

  let description = "官方资料摘录";
  if (normalized.includes("photo")) {
    description = "官方签证照片要求";
  } else if (normalized.includes("fields to collect before filling the form")) {
    description = "填表前字段清单";
  } else if (normalized.includes("application channel and form scope")) {
    description = "申请渠道和表单范围";
  } else if (normalized.includes("supporting documents and review checklist")) {
    description = "支持材料和核对清单";
  } else if (normalized.includes("local")) {
    description = "VIZA 本地规则提示";
  }

  return scopeParts.length > 0 ? `${description}。${scopeParts.join("；")}。` : `${description}。`;
}

function localizedSourceExcerpt(source: FieldGuidanceResponse["sources"][number], isZh: boolean): string {
  if (isZh) return sourceScopeSummary(source);

  const excerpt = normalizePlainTextContent(source.excerpt)
    .replace(/^#\s*/, "")
    .replace(/\s*Source URL:\s*\S+/gi, "")
    .replace(/\s*Source:\s*[^#]+$/gi, "")
    .replace(/\s*Document type:\s*[a-z0-9_/-]+/gi, "")
    .replace(/\s*Visa type:\s*([a-z0-9_/-]+)/gi, " Visa type: $1")
    .replace(/\s*Country:\s*([a-z0-9_/-]+)/gi, "Country: $1")
    .trim();
  return excerpt;
}

function SectionList({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: string[];
  compact?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#697386]">
        {title}
      </h4>
      <div className={compact ? "flex min-w-0 flex-wrap gap-2" : "flex min-w-0 flex-col gap-1.5"}>
        {items.map((item, index) => {
          const plainItem = normalizePlainTextContent(item);
          return (
            <span
              key={`${item}-${index}`}
              className={compact
                ? "min-w-0 break-words rounded-md border border-[#e8e8e8] bg-white px-2.5 py-1 text-[13px] text-[#24272f]"
                : "min-w-0 break-words text-[13px] leading-5 text-[#4b5563]"}
            >
              {compact ? plainItem : `• ${plainItem}`}
            </span>
          );
        })}
      </div>
    </section>
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
    <section className="flex flex-col gap-2">
      <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#697386]">
        {title}
      </h4>
      <div className="flex min-w-0 flex-col gap-2">
        {items.map((item) => (
          <div
            key={`${item.value}-${item.label}`}
            className="min-w-0 rounded-lg border border-[#e8e8e8] bg-white p-3 text-[13px]"
          >
            <div className="break-words font-medium text-[#1f2937]">
              {normalizePlainTextContent(item.label)}
            </div>
            <p className="mt-1 min-w-0 break-words leading-5 text-[#4b5563]">
              {renderPlainText(item.description)}
            </p>
          </div>
        ))}
      </div>
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

  const isZh = locale.toLowerCase().startsWith("zh");
  const labels = useMemo(
    () => ({
      loading: isZh ? "AI 正在读取题目要求..." : "AI is reading the field requirements...",
      retry: isZh ? "重试" : "Retry",
      examples: isZh ? "示例" : "Examples",
      optionExplanations: isZh ? "选项说明" : "Option explanations",
      hints: isZh ? "填写提示" : "Hints",
      warnings: isZh ? "官方注意事项" : "Official warnings",
      format: isZh ? "格式" : "Format",
      sources: isZh ? "来源" : "Sources",
      ask: isZh ? "继续问这个问题" : "Ask about this field",
      askPlaceholder: isZh
        ? "比如：这个必须和护照完全一样吗？"
        : "For example: does this need to match my passport exactly?",
      send: isZh ? "发送" : "Send",
      close: isZh ? "关闭" : "Close",
      confidence: isZh ? "可信度" : "Confidence",
      generated: isZh ? "AI 生成" : "AI generated",
      fallback: isZh ? "规则提示" : "Rule-based",
    }),
    [isZh],
  );
  const visibleSources = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    return data.sources.filter((source) => {
      const key = sourceIdentity(source);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data]);

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
        visaType,
        country,
        locale,
        field,
        answer,
        allAnswers,
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
    [allAnswers, answer, country, field, locale, visaType],
  );

  useEffect(() => {
    void fetchGuidance();
  }, [fetchGuidance]);

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

  const hasChatHistory = messages.length > 0 || questionLoading;

  return (
    <div
      className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-[#dbe7f5] bg-[#f8fbff] p-4 shadow-sm sm:p-5"
      onClick={(event) => event.stopPropagation()}
      data-field-guidance-panel={field.fieldName}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#03346E] text-white">
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-[#1f2937]">
              {data?.guidance.title ?? (isZh ? "字段填写帮助" : "Field guidance")}
            </h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {data && (
                <>
                  {data.aiUsed && (
                    <Badge variant="outline" className="border-[#d8e2ef] bg-white text-[10px] text-[#4b5563]">
                      {labels.confidence}: {data.confidence}
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-[#d8e2ef] bg-white text-[10px] text-[#4b5563]">
                    {data.aiUsed ? labels.generated : labels.fallback}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[#697386] transition-colors hover:bg-white hover:text-[#1f2937]"
          aria-label={labels.close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-[#697386]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {labels.loading}
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
          <span>{error}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void fetchGuidance()}
            className="h-8 shrink-0 bg-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {labels.retry}
          </Button>
        </div>
      )}

      {data && !loading && (
        <div className="mt-4 grid min-w-0 gap-5">
          <div className="flex min-w-0 flex-col gap-4">
            <div className={cn("flex items-start gap-2 rounded-lg border p-3 text-[13px]", severityClasses(data.validation.severity))}>
              <SeverityIcon severity={data.validation.severity} />
              <div className="flex flex-col gap-1">
                {data.validation.messages.map((message, index) => (
                  <span className="min-w-0 break-words" key={`${message}-${index}`}>{message}</span>
                ))}
              </div>
            </div>

            <p className="min-w-0 break-words text-[13px] leading-5 text-[#3f4652]">
              {renderPlainText(data.guidance.summary)}
            </p>

            <div className="grid min-w-0 gap-4 md:grid-cols-2">
              <SectionList title={labels.examples} items={data.guidance.examples} compact />
              <OptionExplanationList
                title={labels.optionExplanations}
                items={data.guidance.optionExplanations ?? []}
              />
              <SectionList title={labels.format} items={data.guidance.formatHints} compact />
              <SectionList title={labels.hints} items={data.guidance.hints} />
              <SectionList title={labels.warnings} items={data.guidance.officialWarnings} />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {hasChatHistory && (
              <section className="rounded-xl border border-[#d8e2ef] bg-white p-3">
                <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-[#03346E]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#03346E] text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  VIZA AI
                </div>
                <div className="flex flex-col gap-3">
                  {messages.map((message) =>
                    message.role === "user" ? (
                      <div className="flex justify-end" key={message.id}>
                        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-[#03346E] px-3.5 py-2.5 text-[13px] leading-5 text-white">
                          {renderPlainText(message.content)}
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-w-0 items-start gap-2" key={message.id}>
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f1fb] text-[#03346E]">
                          <Bot className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 max-w-[86%] break-words rounded-2xl rounded-tl-md bg-[#f4f7fb] px-3.5 py-2.5 text-[13px] leading-5 text-[#24272f]">
                          {renderPlainText(message.content)}
                        </div>
                      </div>
                    ),
                  )}
                  {questionLoading && (
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f1fb] text-[#03346E]">
                        <Bot className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 max-w-[86%] break-words rounded-2xl rounded-tl-md bg-[#f4f7fb] px-3.5 py-2.5 text-[13px] leading-5 text-[#24272f]">
                        <span className="inline-flex items-center gap-2 text-[#697386]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {isZh ? "正在回答..." : "Replying..."}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#697386]">
                {labels.ask}
              </label>
              <Textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
                placeholder={labels.askPlaceholder}
                aria-keyshortcuts="Enter Control+Enter Meta+Enter"
                className="min-h-[92px] resize-none rounded-lg border-[#d8e2ef] bg-white text-[13px] focus:border-[#03346E] focus:ring-1 focus:ring-[#03346E]"
              />
              <Button
                type="button"
                onClick={handleAsk}
                size="sm"
                disabled={!question.trim() || questionLoading}
                className="self-end bg-[#03346E] hover:bg-[#022a5a]"
              >
                {questionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {labels.send}
              </Button>
            </div>

            {visibleSources.length > 0 && (
              <section className="flex flex-col gap-2 border-t border-[#e3edf8] pt-3">
                <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#697386]">
                  {labels.sources}
                </h4>
                <div className="flex min-w-0 flex-col gap-2">
                  {visibleSources.map((source, index) => (
                    <div key={`${sourceIdentity(source)}-${index}`} className="min-w-0 break-words text-[12px] leading-5 text-[#697386]">
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-words font-medium text-[#03346E] hover:underline"
                        >
                          {localizedSourceTitle(source.title, isZh)}
                        </a>
                      ) : (
                        <span className="break-words font-medium text-[#3f4652]">
                          {localizedSourceTitle(source.title, isZh)}
                        </span>
                      )}
                      <p className="min-w-0 break-words">
                        {renderPlainText(localizedSourceExcerpt(source, isZh))}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
