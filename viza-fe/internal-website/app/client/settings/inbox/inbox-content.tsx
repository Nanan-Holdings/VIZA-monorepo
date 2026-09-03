"use client";

import {
  Archive,
  ArrowBendUpLeft,
  ArrowsClockwise,
  CaretLeft,
  CircleNotch,
  Copy,
  EnvelopeSimple,
  EnvelopeSimpleOpen,
  FileText,
  MagnifyingGlass,
  Paperclip,
  PaperPlaneTilt,
  Sparkle,
  Star,
  Translate,
  Tray,
} from "@phosphor-icons/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ensureInboxAiSummary,
  ensureInboxTranslation,
  flagInboxEmailForConsultant,
  getClientInboxMessage,
  getClientInboxOverview,
  listInboxAttachments,
  markAllInboxRead,
  queueInboxReply,
  setInboxMessageArchived,
  setInboxMessageRead,
  setInboxMessageStarred,
  type ClientInboxListItem,
  type ClientInboxMessage,
} from "@/app/actions/inbox";
import { ClientErrorAlert } from "@/components/client/client-error-alert";
import { BrandInput } from "@/components/client/brand-field";
import { ActionButton } from "@/components/ui/action-button";
import { alertToast } from "@/components/ui/alert-toast";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PageBackButton } from "@/components/ui/page-back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  EMBASSY_FOLDER_CATEGORIES,
  type InboxCategory,
} from "@/lib/inbox/categorize";
import { sanitiseInboundHtml } from "@/lib/inbox/sanitize-html";
import { cn } from "@/lib/utils";

type TabId =
  | "all"
  | "action"
  | "embassy"
  | "appointment"
  | "documents"
  | "payment"
  | "archived";

const TABS: TabId[] = [
  "all",
  "action",
  "embassy",
  "appointment",
  "documents",
  "payment",
  "archived",
];

const CATEGORY_CHIP: Record<InboxCategory, string> = {
  embassy: "bg-brand-50 text-brand-500",
  appointment: "bg-brand-100 text-brand-800",
  documents: "bg-amber-100 text-amber-600",
  payment: "bg-muted text-muted-foreground",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  travel: "bg-muted text-muted-foreground",
  viza: "bg-brand-50 text-brand-500",
  other: "bg-muted text-muted-foreground",
};

const AVATAR_TONES = [
  "bg-brand-500 text-white",
  "bg-brand-400 text-white",
  "bg-brand-300 text-white",
  "bg-brand-50 text-brand-500",
];

function avatarToneFor(fromAddr: string): string {
  let hash = 0;
  for (let i = 0; i < fromAddr.length; i += 1) {
    hash = (hash * 31 + fromAddr.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function senderName(fromAddr: string): string {
  const match = fromAddr.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  if (match?.[1]?.trim()) return match[1].trim();
  return fromAddr.trim();
}

function senderEmail(fromAddr: string): string {
  const match = fromAddr.match(/<([^>]+)>/);
  return (match?.[1] ?? fromAddr).trim();
}

function senderInitials(fromAddr: string): string {
  const name = senderName(fromAddr);
  const words = name
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word[0] ?? ""));
  const initials = words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return initials || name.slice(0, 1).toUpperCase() || "?";
}

function formatListTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function formatFullTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function matchesTab(item: ClientInboxListItem, tab: TabId): boolean {
  if (tab === "archived") return item.archived;
  if (item.archived) return false;
  if (tab === "all") return true;
  if (tab === "action") return item.needsAction;
  if (tab === "embassy") {
    return EMBASSY_FOLDER_CATEGORIES.includes(item.category);
  }
  return item.category === tab;
}

function tabCount(items: ClientInboxListItem[], tab: TabId): number {
  if (tab === "all") {
    return items.filter((item) => !item.archived && !item.read).length;
  }
  return items.filter((item) => matchesTab(item, tab)).length;
}

export function InboxContent() {
  const t = useTranslations("settings.inbox");
  const settingsT = useTranslations("settings");
  const locale = useLocale();

  const [overview, setOverview] = useState<{
    alias: string | null;
    items: ClientInboxListItem[];
  } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ClientInboxMessage>>(
    {},
  );
  const [messageLoading, setMessageLoading] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [translated, setTranslated] = useState(false);
  const [translationPending, setTranslationPending] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

  const loading = overview === null && !loadFailed;
  const items = useMemo(() => overview?.items ?? [], [overview]);
  const alias = overview?.alias ?? null;

  const patchItem = useCallback(
    (id: string, patch: Partial<ClientInboxListItem>) => {
      setOverview((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === id ? { ...item, ...patch } : item,
              ),
            }
          : current,
      );
    },
    [],
  );

  const patchMessage = useCallback(
    (id: string, patch: Partial<ClientInboxMessage>) => {
      setMessages((current) =>
        current[id] ? { ...current, [id]: { ...current[id], ...patch } } : current,
      );
    },
    [],
  );

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const data = await getClientInboxOverview();
      setOverview(data);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesTab(item, tab)) return false;
      if (!needle) return true;
      const haystack =
        `${item.from_addr} ${item.subject ?? ""} ${item.snippet}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, tab, query]);

  const selectedItem = useMemo(
    () => filtered.find((item) => item.id === selectedId) ?? null,
    [filtered, selectedId],
  );
  const message = selectedItem ? messages[selectedItem.id] : undefined;

  const openMessage = useCallback(
    (item: ClientInboxListItem) => {
      setSelectedId(item.id);
      setReplyOpen(false);
      setReplyText("");
      setTranslated(false);
      if (!item.read) {
        patchItem(item.id, { read: true });
        void setInboxMessageRead(item.id, true).catch(() => {
          patchItem(item.id, { read: false });
        });
      }
      if (!messages[item.id]) {
        setMessageLoading(true);
        void getClientInboxMessage(item.id)
          .then((detail) => {
            if (detail) {
              setMessages((current) => ({ ...current, [item.id]: detail }));
            }
          })
          .catch(() => {
            alertToast(t("loadError"), { variant: "destructive" });
          })
          .finally(() => setMessageLoading(false));
      }
    },
    [messages, patchItem, t],
  );

  // Lazily enrich the open message: AI reading pass, then attachment manifest.
  useEffect(() => {
    if (!message || message.ai || aiPending) return;
    setAiPending(true);
    void ensureInboxAiSummary(message.id, locale)
      .then((result) => {
        if (result.ok) patchMessage(message.id, { ai: result.ai });
      })
      .catch(() => undefined)
      .finally(() => setAiPending(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.id, message?.ai]);

  useEffect(() => {
    if (!message || message.attachments !== null || !message.hasOriginal) return;
    void listInboxAttachments(message.id)
      .then((result) => {
        patchMessage(message.id, {
          attachments: result.ok ? result.attachments : [],
        });
        if (result.ok) {
          patchItem(message.id, { attachmentCount: result.attachments.length });
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.id, message?.attachments]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getClientInboxOverview();
      setOverview(data);
      alertToast(t("refreshed"), { variant: "success" });
    } catch {
      alertToast(t("loadError"), { variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  const handleCopyAddress = useCallback(async () => {
    if (!alias) return;
    try {
      await navigator.clipboard.writeText(alias);
      alertToast(t("addressCopied"), { variant: "success" });
    } catch {
      // Clipboard can be unavailable (permissions); the address stays visible.
    }
  }, [alias, t]);

  const handleMarkAllRead = useCallback(() => {
    setOverview((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => ({ ...item, read: true })),
          }
        : current,
    );
    void markAllInboxRead()
      .then(() => alertToast(t("allMarkedRead"), { variant: "success" }))
      .catch(() => void load());
  }, [load, t]);

  const handleToggleRead = useCallback(
    (item: ClientInboxListItem) => {
      const next = !item.read;
      patchItem(item.id, { read: next });
      void setInboxMessageRead(item.id, next)
        .then(() =>
          alertToast(next ? t("markedRead") : t("markedUnread"), {
            variant: "success",
          }),
        )
        .catch(() => patchItem(item.id, { read: !next }));
    },
    [patchItem, t],
  );

  const handleToggleStar = useCallback(
    (item: ClientInboxListItem) => {
      const next = !item.starred;
      patchItem(item.id, { starred: next });
      void setInboxMessageStarred(item.id, next).catch(() =>
        patchItem(item.id, { starred: !next }),
      );
    },
    [patchItem],
  );

  const handleToggleArchive = useCallback(
    (item: ClientInboxListItem) => {
      const next = !item.archived;
      patchItem(item.id, { archived: next });
      if (selectedId === item.id) setSelectedId(null);
      void setInboxMessageArchived(item.id, next)
        .then(() =>
          alertToast(next ? t("archived") : t("unarchived"), {
            variant: "success",
          }),
        )
        .catch(() => patchItem(item.id, { archived: !next }));
    },
    [patchItem, selectedId, t],
  );

  const handleToggleTranslate = useCallback(() => {
    if (!message) return;
    if (translated) {
      setTranslated(false);
      return;
    }
    const localeKey = locale.toLowerCase().slice(0, 2);
    if (message.translations[localeKey]) {
      setTranslated(true);
      return;
    }
    setTranslationPending(true);
    void ensureInboxTranslation(message.id, locale)
      .then((result) => {
        if (result.ok) {
          patchMessage(message.id, {
            translations: {
              ...message.translations,
              [localeKey]: result.paragraphs,
            },
          });
          setTranslated(true);
        } else {
          alertToast(t("translateFailed"), { variant: "destructive" });
        }
      })
      .catch(() => alertToast(t("translateFailed"), { variant: "destructive" }))
      .finally(() => setTranslationPending(false));
  }, [locale, message, patchMessage, t, translated]);

  const handleSendReply = useCallback(() => {
    if (!message) return;
    const body = replyText.trim();
    if (!body) {
      alertToast(t("replyEmpty"), { variant: "warning" });
      return;
    }
    setReplySending(true);
    void queueInboxReply(message.id, body)
      .then((result) => {
        if (result.ok) {
          patchMessage(message.id, {
            replies: [...message.replies, result.reply],
          });
          setReplyOpen(false);
          setReplyText("");
          alertToast(t("replySent"), { variant: "success" });
        } else if (result.code === "empty") {
          alertToast(t("replyEmpty"), { variant: "warning" });
        } else {
          alertToast(t("replyFailed"), { variant: "destructive" });
        }
      })
      .catch(() => alertToast(t("replyFailed"), { variant: "destructive" }))
      .finally(() => setReplySending(false));
  }, [message, patchMessage, replyText, t]);

  const handleAskConsultant = useCallback(() => {
    if (!message) return;
    void flagInboxEmailForConsultant(message.id)
      .then((result) => {
        if (result.ok) {
          alertToast(t("askConsultantSent"), { variant: "success" });
        }
      })
      .catch(() => undefined);
  }, [message, t]);

  const localeKey = locale.toLowerCase().slice(0, 2);
  const translatedParagraphs = message?.translations[localeKey];
  const showDetailPane = selectedItem !== null;
  const hasAlias = alias !== null;

  return (
    <main className="mx-auto w-full max-w-[1090px] px-5 py-8 sm:px-8">
      <PageBackButton
        fallbackHref="/client/settings"
        label={settingsT("commonBack")}
        className="h-11 w-11"
      />

      <div className="mt-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {loadFailed ? (
        <div className="mt-6">
          <ClientErrorAlert
            message={t("loadError")}
            action={
              <ActionButton size="xs" variant="outline" onClick={() => void load()}>
                {t("retry")}
              </ActionButton>
            }
          />
        </div>
      ) : null}

      {!loading && !loadFailed && !hasAlias ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Tray />
            </EmptyMedia>
            <EmptyTitle>{t("noAliasTitle")}</EmptyTitle>
            <EmptyDescription>{t("noAliasBody")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {!loadFailed && (loading || hasAlias) ? (
        <div className="mt-6 flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm lg:h-[calc(100vh-300px)] lg:min-h-[560px]">
          {/* Header: alias chip, search, refresh */}
          <div className="flex flex-none flex-wrap items-center gap-3 p-5 pb-4">
            <div className="flex min-w-0 flex-1 basis-full flex-col gap-2 sm:basis-auto">
              {loading ? (
                <Skeleton className="h-8 w-64 rounded-full" />
              ) : (
                <div className="flex min-h-8 items-center gap-2 self-start whitespace-nowrap rounded-full border border-[#e8e8e8] bg-[#fafafa] py-0.5 pl-3 pr-1">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t("addressLabel")}
                  </span>
                  <span className="truncate text-[13px] font-medium text-brand-500">
                    {alias}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyAddress()}
                    aria-label={t("copyAddress")}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand-50 hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="relative min-w-[200px] flex-1 basis-[220px]">
              <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <BrandInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="pl-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 flex-none"
              onClick={() => void handleRefresh()}
              disabled={refreshing || loading}
              aria-label={t("refresh")}
            >
              {refreshing ? (
                <CircleNotch className="animate-spin" />
              ) : (
                <ArrowsClockwise />
              )}
            </Button>
          </div>

          {/* Folder tabs */}
          <div className="flex flex-none items-center gap-6 overflow-x-auto border-b px-5">
            {TABS.map((id) => {
              const active = tab === id;
              const count = tabCount(items, id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-brand-500 text-brand-500"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>{t(`tabs.${id}`)}</span>
                  {count > 0 ? (
                    <span
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[11px] font-medium",
                        active
                          ? "bg-brand-500 text-white"
                          : "bg-brand-50 text-brand-500",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* Conversation list */}
            <aside
              className={cn(
                "flex min-h-0 flex-col lg:w-[372px] lg:flex-none lg:border-r",
                showDetailPane && "hidden lg:flex",
              )}
            >
              <div className="flex h-10 flex-none items-center justify-between border-b pl-5 pr-3">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {loading
                    ? t("loading")
                    : t("conversationCount", { count: filtered.length })}
                </span>
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="rounded px-1.5 py-1 text-xs font-medium text-brand-500 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("markAllRead")}
                </button>
              </div>

              <div className="ay-scrollbar-visible min-h-0 flex-1 lg:overflow-y-auto">
                {loading ? (
                  <div aria-hidden className="py-1">
                    {Array.from({ length: 7 }).map((_, index) => (
                      <div
                        key={index}
                        className="flex gap-3 border-b border-border/60 px-5 py-4"
                      >
                        <Skeleton className="h-9 w-9 flex-none rounded-full" />
                        <div className="flex flex-1 flex-col gap-2">
                          <Skeleton className="h-2.5 w-2/5" />
                          <Skeleton className="h-2.5 w-4/5" />
                          <Skeleton className="h-2.5 w-3/5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <Empty className="border-0 bg-transparent md:p-10">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        {query ? <MagnifyingGlass /> : <Tray />}
                      </EmptyMedia>
                      <EmptyTitle>
                        {query
                          ? t("emptySearchTitle")
                          : tab === "archived"
                            ? t("emptyArchivedTitle")
                            : t("emptyFolderTitle")}
                      </EmptyTitle>
                      <EmptyDescription>
                        {query
                          ? t("emptySearchBody")
                          : t("emptyFolderBody", { address: alias ?? "" })}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  filtered.map((item) => {
                    const selected = item.id === selectedId;
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openMessage(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openMessage(item);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer gap-3 border-b border-border/60 border-l-2 py-4 pl-4 pr-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                          selected
                            ? "border-l-brand-500 bg-brand-50"
                            : item.read
                              ? "border-l-transparent hover:bg-[#fafafa]"
                              : "border-l-brand-300 hover:bg-[#fafafa]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-semibold",
                            avatarToneFor(item.from_addr),
                          )}
                        >
                          {senderInitials(item.from_addr)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex items-baseline gap-2">
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-sm",
                                item.read ? "font-normal" : "font-semibold",
                              )}
                            >
                              {senderName(item.from_addr)}
                            </span>
                            <span className="flex-none text-[11px] text-muted-foreground">
                              {formatListTime(item.received_at, locale)}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "truncate text-[13px]",
                              item.read
                                ? "font-normal text-muted-foreground"
                                : "font-semibold text-foreground",
                            )}
                          >
                            {item.subject ?? "—"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {item.snippet}
                          </span>
                          <span className="mt-1 flex items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
                                CATEGORY_CHIP[item.category],
                              )}
                            >
                              {t(`categories.${item.category}`)}
                            </span>
                            {item.attachmentCount ? (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                                <Paperclip className="size-3" />
                                {item.attachmentCount}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="flex flex-none flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleStar(item);
                            }}
                            aria-label={item.starred ? t("unstar") : t("star")}
                            aria-pressed={item.starred}
                            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Star
                              weight={item.starred ? "fill" : "regular"}
                              className={cn(
                                "size-4",
                                item.starred
                                  ? "text-amber-600"
                                  : "text-muted-foreground/60",
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleArchive(item);
                            }}
                            aria-label={
                              item.archived ? t("unarchive") : t("archive")
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-brand-50 hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Archive className="size-4" />
                          </button>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Reading pane */}
            <section
              className={cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                !showDetailPane && "hidden lg:flex",
              )}
            >
              {loading || (showDetailPane && messageLoading && !message) ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
                  <CircleNotch className="size-6 animate-spin text-brand-500" />
                  <p className="text-sm text-muted-foreground">{t("loading")}</p>
                </div>
              ) : !showDetailPane ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-10 py-16 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
                    <Tray className="size-6 text-brand-500" />
                  </span>
                  <h3 className="text-lg font-semibold">
                    {t("noSelectionTitle")}
                  </h3>
                  <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                    {t("noSelectionBody", { address: alias ?? "" })}
                  </p>
                </div>
              ) : message && selectedItem ? (
                <div className="ay-scrollbar-visible min-h-0 flex-1 lg:overflow-y-auto">
                  <div className="mx-auto w-full max-w-[720px] px-5 py-6 sm:px-7">
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                    >
                      <CaretLeft className="size-4" />
                      {t("backToList")}
                    </button>

                    <div className="mb-5 flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-lg"
                        onClick={() => handleToggleRead(selectedItem)}
                      >
                        {selectedItem.read ? (
                          <EnvelopeSimple />
                        ) : (
                          <EnvelopeSimpleOpen />
                        )}
                        {selectedItem.read ? t("markUnread") : t("markRead")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-lg"
                        onClick={() => handleToggleArchive(selectedItem)}
                      >
                        <Archive />
                        {selectedItem.archived ? t("unarchive") : t("archive")}
                      </Button>
                      <div className="flex-1" />
                      {message.text || message.html ? (
                        <Button
                          type="button"
                          variant={translated ? "default" : "outline"}
                          className="h-10 rounded-lg"
                          onClick={handleToggleTranslate}
                          disabled={translationPending}
                        >
                          {translationPending ? (
                            <CircleNotch className="animate-spin" />
                          ) : (
                            <Translate />
                          )}
                          {translationPending
                            ? t("translating")
                            : translated
                              ? t("showOriginal")
                              : t("translate")}
                        </Button>
                      ) : null}
                    </div>

                    <h2 className="mb-4 text-2xl font-semibold leading-snug">
                      {message.subject ?? "—"}
                    </h2>

                    <div className="flex items-center gap-3 border-b pb-5">
                      <span
                        className={cn(
                          "flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-semibold",
                          avatarToneFor(message.from_addr),
                        )}
                      >
                        {senderInitials(message.from_addr)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold">
                            {senderName(message.from_addr)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
                              CATEGORY_CHIP[message.category],
                            )}
                          >
                            {t(`categories.${message.category}`)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {senderEmail(message.from_addr)} · {t("to")}{" "}
                          {alias ?? ""}
                        </p>
                      </div>
                      <span className="flex-none text-xs text-muted-foreground">
                        {formatFullTime(message.received_at, locale)}
                      </span>
                    </div>

                    {/* AI reading panel */}
                    {message.ai || aiPending ? (
                      <div className="mt-5 overflow-hidden rounded-xl border border-brand-100 bg-brand-50">
                        <div className="flex items-center gap-2 px-4 pt-3.5">
                          <Sparkle
                            weight="fill"
                            className="size-3.5 text-brand-500"
                          />
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                            {t("aiPanelTitle")}
                          </span>
                        </div>
                        {message.ai ? (
                          <>
                            <p className="px-4 pb-4 pt-2 text-sm leading-6 text-brand-800">
                              {message.ai.summary}
                            </p>
                            {message.ai.details.length > 0 ? (
                              <div className="grid grid-cols-2 gap-px border-t border-brand-100 bg-brand-100 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
                                {message.ai.details.map((detail) => (
                                  <div
                                    key={`${detail.label}-${detail.value}`}
                                    className="flex flex-col gap-0.5 bg-white px-4 py-3"
                                  >
                                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                      {detail.label}
                                    </span>
                                    <span className="text-sm font-medium">
                                      {detail.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
                            <span className="sr-only">{t("aiReading")}</span>
                            <Skeleton className="h-3 w-4/5 bg-brand-100" />
                            <Skeleton className="h-3 w-3/5 bg-brand-100" />
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Body */}
                    <div className="mt-6">
                      {translated && translatedParagraphs ? (
                        <div className="flex flex-col gap-4">
                          {translatedParagraphs.map((paragraph, index) => (
                            <p
                              key={index}
                              className="text-[15px] leading-7 text-foreground"
                            >
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      ) : message.html ? (
                        <div
                          className="prose prose-sm max-w-none text-foreground"
                          dangerouslySetInnerHTML={{
                            __html: sanitiseInboundHtml(message.html),
                          }}
                        />
                      ) : message.text ? (
                        <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-7 text-foreground">
                          {message.text}
                        </pre>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {message.hasOriginal
                            ? t("bodyInAttachment")
                            : t("noBody")}
                        </p>
                      )}
                    </div>

                    {/* Attachments */}
                    {message.hasOriginal ? (
                      <div className="mt-7">
                        {message.attachments && message.attachments.length > 0 ? (
                          <>
                            <p className="mb-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                              {t("attachmentsLabel", {
                                count: message.attachments.length,
                              })}
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {message.attachments.map((attachment) => (
                                <div
                                  key={attachment.index}
                                  className="flex w-full max-w-[320px] items-center gap-3 rounded-xl border bg-white p-3 shadow-sm"
                                >
                                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-50">
                                    <FileText className="size-4 text-brand-500" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-medium">
                                      {attachment.filename ??
                                        `attachment-${attachment.index + 1}`}
                                    </span>
                                    <span className="block text-[11px] text-muted-foreground">
                                      {formatSize(attachment.size)}
                                    </span>
                                  </span>
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="h-7 flex-none rounded-full px-3 text-xs"
                                  >
                                    <a
                                      href={`/api/inbox/${message.id}/attachment/${attachment.index}`}
                                    >
                                      {t("download")}
                                    </a>
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}
                        <p className="mt-3 text-xs text-muted-foreground">
                          <a
                            href={`/api/inbox/${message.id}/download`}
                            className="font-medium text-brand-500 hover:underline"
                          >
                            {t("downloadOriginal")}
                          </a>
                        </p>
                      </div>
                    ) : null}

                    {/* Reply thread */}
                    {message.replies.filter((reply) => reply.kind === "reply")
                      .length > 0 ? (
                      <div className="mt-6 flex flex-col gap-4">
                        {message.replies
                          .filter((reply) => reply.kind === "reply")
                          .map((reply) => (
                            <div
                              key={reply.id}
                              className="border-l-2 border-brand-200 py-1 pl-4"
                            >
                              <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span>
                                  {t("youReplied", { address: alias ?? "" })} ·{" "}
                                  {formatFullTime(reply.created_at, locale)}
                                </span>
                                <span
                                  className={cn(
                                    "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium",
                                    reply.status === "sent"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-amber-100 text-amber-600",
                                  )}
                                >
                                  {reply.status === "sent"
                                    ? t("sentLabel")
                                    : t("pendingReview")}
                                </span>
                              </p>
                              <p className="whitespace-pre-wrap text-sm leading-6">
                                {reply.body}
                              </p>
                            </div>
                          ))}
                      </div>
                    ) : null}

                    {/* Reply composer */}
                    <div className="mt-7">
                      {!replyOpen ? (
                        <div className="flex flex-wrap gap-2.5">
                          <ActionButton
                            variant="secondary"
                            onClick={() => setReplyOpen(true)}
                          >
                            <ArrowBendUpLeft />
                            {t("reply")}
                          </ActionButton>
                          <ActionButton
                            variant="outline"
                            onClick={handleAskConsultant}
                          >
                            {t("askConsultant")}
                          </ActionButton>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                          <p className="border-b px-4 py-3 text-[13px] text-muted-foreground">
                            {t("replyTo", {
                              name: senderName(message.from_addr),
                              address: alias ?? "",
                            })}
                          </p>
                          <Textarea
                            value={replyText}
                            onChange={(event) => setReplyText(event.target.value)}
                            placeholder={t("replyPlaceholder")}
                            aria-label={t("replyPlaceholder")}
                            className="min-h-[132px] resize-y rounded-none border-0 px-4 py-3.5 text-sm leading-6 shadow-none focus-visible:ring-0"
                          />
                          <div className="flex flex-wrap items-center gap-2.5 border-t bg-[#fafafa] px-4 py-3">
                            <ActionButton
                              onClick={handleSendReply}
                              loading={replySending}
                              loadingText={t("send")}
                            >
                              {t("send")}
                              <PaperPlaneTilt />
                            </ActionButton>
                            <ActionButton
                              variant="ghost"
                              onClick={() => {
                                setReplyOpen(false);
                                setReplyText("");
                              }}
                            >
                              {t("discard")}
                            </ActionButton>
                            <div className="flex-1" />
                            <span className="text-xs text-muted-foreground">
                              {t("replyNote")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </main>
  );
}
