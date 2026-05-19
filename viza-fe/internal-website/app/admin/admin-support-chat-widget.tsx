"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Headphones,
  Mail,
  MessageSquareText,
  Minimize2,
  PanelRightOpen,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConversationStatus = "waiting" | "active" | "resolved";
type Sender = "customer" | "staff";

interface ChatMessage {
  id: string;
  sender: Sender;
  body: string;
  createdAt: string;
  aiGenerated?: boolean;
}

interface Conversation {
  id: string;
  applicantName: string;
  email: string;
  applicationLabel: string;
  applicationStatus: string;
  issue: string;
  priority: "normal" | "urgent";
  status: ConversationStatus;
  unread: number;
  aiGreetingSent: boolean;
  messages: ChatMessage[];
}

const SUPPORT_AGENT_NAME = "Amir";

const QUICK_REPLIES = [
  "我正在查看你的申请资料，请稍等一下。",
  "我看到你这边还需要补一份材料，我帮你确认是哪一项。",
  "你的退款请求我已经记录，会先核对付款和申请状态。",
  "Thanks for waiting. I am checking your application context now.",
];

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: "c-1001",
    applicantName: "Lin Chen",
    email: "lin.chen@example.com",
    applicationLabel: "France Schengen · Type C",
    applicationStatus: "Needs documents",
    issue: "Passport OCR and hotel booking",
    priority: "urgent",
    status: "waiting",
    unread: 2,
    aiGreetingSent: false,
    messages: [
      {
        id: "m-1001-1",
        sender: "customer",
        body: "我的材料页说酒店预订缺失，但是我已经上传了。可以帮我看一下吗？",
        createdAt: "10:22",
      },
      {
        id: "m-1001-2",
        sender: "customer",
        body: "另外护照 OCR 好像没有读出来。",
        createdAt: "10:23",
      },
    ],
  },
  {
    id: "c-1002",
    applicantName: "Maya Tan",
    email: "maya.tan@example.com",
    applicationLabel: "US DS-160 · B1/B2",
    applicationStatus: "Packet ready",
    issue: "Refund policy question",
    priority: "normal",
    status: "active",
    unread: 1,
    aiGreetingSent: false,
    messages: [
      {
        id: "m-1002-1",
        sender: "customer",
        body: "如果我现在取消，还可以退多少？",
        createdAt: "10:14",
      },
    ],
  },
  {
    id: "c-1003",
    applicantName: "Arjun Patel",
    email: "arjun.patel@example.com",
    applicationLabel: "Indonesia B211A",
    applicationStatus: "External handoff",
    issue: "Status update",
    priority: "normal",
    status: "waiting",
    unread: 0,
    aiGreetingSent: true,
    messages: [
      {
        id: "m-1003-1",
        sender: "staff",
        body: "你好，我是 VIZA 客服 Amir。我正在查看你的 Indonesia B211A 申请资料，现在可以继续帮你处理。",
        createdAt: "09:58",
        aiGenerated: true,
      },
      {
        id: "m-1003-2",
        sender: "customer",
        body: "请问现在提交了吗？",
        createdAt: "10:00",
      },
    ],
  },
];

function nowLabel() {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function buildAiGreeting(conversation: Conversation) {
  return `你好，我是 VIZA 客服 ${SUPPORT_AGENT_NAME}。我正在查看你的 ${conversation.applicationLabel} 申请资料，现在可以继续帮你处理。`;
}

function statusLabel(status: ConversationStatus) {
  if (status === "waiting") return "Waiting";
  if (status === "active") return "Active";
  return "Resolved";
}

function statusClassName(status: ConversationStatus) {
  if (status === "waiting") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "active") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function AdminSupportChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversations, setConversations] = useState(INITIAL_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState(INITIAL_CONVERSATIONS[0]?.id ?? "");
  const [openConversationIds, setOpenConversationIds] = useState<string[]>([
    INITIAL_CONVERSATIONS[0]?.id ?? "",
    INITIAL_CONVERSATIONS[1]?.id ?? "",
  ]);
  const [draft, setDraft] = useState("");

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];
  const openConversations = openConversationIds
    .map((id) => conversations.find((conversation) => conversation.id === id))
    .filter((conversation): conversation is Conversation => Boolean(conversation));
  const unreadTotal = conversations.reduce((total, conversation) => total + conversation.unread, 0);

  const waitingCount = useMemo(
    () => conversations.filter((conversation) => conversation.status === "waiting").length,
    [conversations],
  );

  useEffect(() => {
    if (!isOpen || isMinimized || !activeConversation || activeConversation.aiGreetingSent) return;

    const timer = window.setTimeout(() => {
      setConversations((current) =>
        current.map((conversation) => {
          if (conversation.id !== activeConversation.id || conversation.aiGreetingSent) return conversation;
          return {
            ...conversation,
            status: "active",
            unread: 0,
            aiGreetingSent: true,
            messages: [
              ...conversation.messages,
              {
                id: `${conversation.id}-ai-greeting-${Date.now()}`,
                sender: "staff",
                body: buildAiGreeting(conversation),
                createdAt: nowLabel(),
                aiGenerated: true,
              },
            ],
          };
        }),
      );
    }, 650);

    return () => window.clearTimeout(timer);
  }, [activeConversation, isMinimized, isOpen]);

  function openWidget() {
    setIsOpen(true);
    setIsMinimized(false);
  }

  function selectConversation(id: string) {
    setActiveConversationId(id);
    setOpenConversationIds((current) => (current.includes(id) ? current : [...current, id]));
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id ? { ...conversation, unread: 0, status: conversation.status === "waiting" ? "active" : conversation.status } : conversation,
      ),
    );
  }

  function closeConversation(id: string) {
    setOpenConversationIds((current) => {
      const next = current.filter((conversationId) => conversationId !== id);
      if (activeConversationId === id) {
        setActiveConversationId(next[0] ?? conversations[0]?.id ?? "");
      }
      return next;
    });
  }

  function sendMessage(body: string, aiGenerated = false) {
    const trimmed = body.trim();
    if (!activeConversation || !trimmed) return;

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversation.id
          ? {
              ...conversation,
              status: "active",
              unread: 0,
              messages: [
                ...conversation.messages,
                {
                  id: `${conversation.id}-staff-${Date.now()}`,
                  sender: "staff",
                  body: trimmed,
                  createdAt: nowLabel(),
                  aiGenerated,
                },
              ],
            }
          : conversation,
      ),
    );
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  function markResolved() {
    if (!activeConversation) return;
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversation.id
          ? {
              ...conversation,
              status: "resolved",
              unread: 0,
            }
          : conversation,
      ),
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openWidget}
        className="fixed bottom-6 right-6 z-50 flex h-14 items-center gap-3 rounded-full bg-brand-500 px-5 text-white shadow-[0_18px_45px_rgba(3,52,110,0.28)] transition hover:bg-brand-400"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
          <Headphones className="h-5 w-5" />
          {unreadTotal > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold">
              {unreadTotal}
            </span>
          )}
        </span>
        <span className="hidden text-sm font-semibold md:block">Support chat</span>
      </button>
    );
  }

  return (
    <section
      className={cn(
        "fixed bottom-6 right-6 z-50 overflow-hidden rounded-xl border border-[#dfe5ee] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]",
        isMinimized ? "w-[360px]" : "h-[680px] w-[min(920px,calc(100vw-2rem))]",
      )}
    >
      <header className="flex h-14 items-center justify-between border-b border-[#edf1f7] bg-white px-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
            <MessageSquareText className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#1f2937]">Customer conversations</p>
            <p className="text-xs text-[#64748b]">{waitingCount} waiting · AI greeting enabled</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-2 text-[#64748b] transition hover:bg-[#f5f7fb]"
            onClick={() => setIsMinimized((value) => !value)}
            aria-label={isMinimized ? "Expand support chat" : "Minimize support chat"}
          >
            {isMinimized ? <ChevronDown className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-[#64748b] transition hover:bg-[#f5f7fb]"
            onClick={() => setIsOpen(false)}
            aria-label="Close support chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {!isMinimized && (
        <div className="grid h-[calc(680px-56px)] grid-cols-[280px_1fr]">
          <aside className="border-r border-[#edf1f7] bg-[#fbfcfe]">
            <div className="border-b border-[#edf1f7] p-3">
              <div className="rounded-lg border border-[#e4eaf3] bg-white px-3 py-2 text-xs text-[#64748b]">
                Multi-chat queue · {openConversations.length} open
              </div>
            </div>
            <div className="max-h-[560px] space-y-2 overflow-y-auto p-3">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  className={cn(
                    "w-full rounded-lg border bg-white p-3 text-left transition hover:border-brand-200",
                    activeConversationId === conversation.id ? "border-brand-300 shadow-sm" : "border-[#e5ebf4]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1f2937]">{conversation.applicantName}</p>
                      <p className="truncate text-xs text-[#64748b]">{conversation.applicationLabel}</p>
                    </div>
                    {conversation.unread > 0 && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {conversation.unread}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#475569]">{conversation.issue}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", statusClassName(conversation.status))}>
                      {statusLabel(conversation.status)}
                    </span>
                    <span className={cn("flex items-center gap-1 text-[10px]", conversation.priority === "urgent" ? "text-red-600" : "text-[#64748b]")}>
                      <Circle className="h-2 w-2 fill-current" />
                      {conversation.priority}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex min-w-0 flex-col">
            <div className="border-b border-[#edf1f7] px-4 py-3">
              <div className="mb-3 flex gap-2 overflow-x-auto">
                {openConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => selectConversation(conversation.id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                      activeConversationId === conversation.id
                        ? "border-brand-300 bg-brand-50 text-brand-700"
                        : "border-[#e4eaf3] bg-white text-[#475569]",
                    )}
                  >
                    {conversation.applicantName}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeConversation(conversation.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          closeConversation(conversation.id);
                        }
                      }}
                      className="rounded-full p-0.5 hover:bg-white"
                      aria-label={`Close ${conversation.applicantName}`}
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>

              {activeConversation && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef3fa] text-brand-500">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1f2937]">{activeConversation.applicantName}</p>
                      <p className="truncate text-xs text-[#64748b]">
                        {activeConversation.email} · {activeConversation.applicationStatus}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/admin/applications">
                        <PanelRightOpen className="h-4 w-4" />
                        Open case
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={`mailto:${activeConversation.email}`}>
                        <Mail className="h-4 w-4" />
                        Email
                      </a>
                    </Button>
                    <Button size="sm" variant="outline" onClick={markResolved}>
                      <CheckCircle2 className="h-4 w-4" />
                      Resolve
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] p-4">
              {activeConversation?.messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.sender === "staff" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[76%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
                      message.sender === "staff" ? "bg-brand-500 text-white" : "border border-[#e4eaf3] bg-white text-[#1f2937]",
                    )}
                  >
                    {message.aiGenerated && (
                      <span className={cn("mb-1 flex items-center gap-1 text-[11px]", message.sender === "staff" ? "text-white/80" : "text-brand-600")}>
                        <Sparkles className="h-3 w-3" />
                        AI auto greeting
                      </span>
                    )}
                    <p>{message.body}</p>
                    <span className={cn("mt-1 block text-[10px]", message.sender === "staff" ? "text-white/70" : "text-[#94a3b8]")}>
                      {message.createdAt}
                    </span>
                  </div>
                </div>
              ))}
              {activeConversation && !activeConversation.aiGreetingSent && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <Bot className="h-4 w-4" />
                  AI is preparing the opening message...
                  <Clock3 className="ml-auto h-4 w-4" />
                </div>
              )}
            </div>

            <div className="border-t border-[#edf1f7] bg-white p-3">
              <div className="mb-2 flex gap-2 overflow-x-auto">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => sendMessage(reply, true)}
                    className="shrink-0 rounded-full border border-[#dfe5ee] bg-white px-3 py-1.5 text-xs text-[#475569] transition hover:border-brand-200 hover:bg-brand-50"
                  >
                    <Sparkles className="mr-1 inline h-3 w-3" />
                    {reply}
                  </button>
                ))}
              </div>
              <form className="flex items-end gap-2" onSubmit={handleSubmit}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Type a reply while reviewing the customer record..."
                  className="min-h-[46px] flex-1 resize-none rounded-lg border border-[#dfe5ee] px-3 py-2 text-sm outline-none transition focus:border-brand-300 focus:ring-1 focus:ring-brand-300"
                />
                <Button type="submit" className="h-[46px] bg-brand-500 hover:bg-brand-400" disabled={!draft.trim()}>
                  <Send className="h-4 w-4" />
                  Send
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
