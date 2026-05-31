"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Mail,
  PanelRightOpen,
  Send,
  UserRound,
} from "lucide-react";
import {
  closeAdminTicket,
  listAdminTicketMessages,
  postAdminTicketReply,
  type AdminSupportMessageRow,
  type AdminSupportTicketRow,
  type TicketTab,
} from "@/app/actions/admin-cs";
import { Button } from "@/components/ui/button";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    tabs: {
      open: "Open",
      mine: "Mine",
      unassigned: "Unassigned",
      breaching: "SLA risk",
    },
    emptyTitle: "No questions in this tab",
    emptyBody: "New customer questions will appear here after they submit the help form.",
    questionList: "Received questions",
    openCount: "{count} open",
    noSelection: "Select a question",
    noSelectionBody: "Choose a customer question from the left to review context and reply.",
    generalSupport: "General support",
    customerQuestion: "Customer question",
    conversation: "Reply window",
    openCase: "Open case",
    email: "Email",
    resolve: "Resolve",
    resolved: "Resolved",
    send: "Send",
    sending: "Sending...",
    placeholder: "Type a clear support reply...",
    applicant: "Customer",
    staff: "Staff",
    submitted: "Submitted",
    updated: "Updated",
    firstResponse: "First response",
    waiting: "Waiting",
    replied: "Replied",
    closed: "Closed",
    slaBreached: "SLA breached",
    slaDue: "SLA due",
    noThread: "No thread messages yet. The original question is shown above.",
    sendError: "Reply failed",
    loadError: "Could not load messages",
    closeError: "Could not resolve ticket",
  },
  zh: {
    tabs: {
      open: "未关闭",
      mine: "我的",
      unassigned: "未分配",
      breaching: "SLA 风险",
    },
    emptyTitle: "这个分类暂无问题",
    emptyBody: "客户通过帮助中心提交问题后，会出现在这里。",
    questionList: "收到的问题",
    openCount: "{count} 个未关闭",
    noSelection: "请选择一个问题",
    noSelectionBody: "从左侧选择客户问题后，可查看上下文并在右侧回复。",
    generalSupport: "通用客服",
    customerQuestion: "客户问题",
    conversation: "回答窗口",
    openCase: "打开案例",
    email: "邮件",
    resolve: "标记解决",
    resolved: "已解决",
    send: "发送",
    sending: "发送中...",
    placeholder: "输入清晰的客服回复...",
    applicant: "客户",
    staff: "客服",
    submitted: "提交时间",
    updated: "更新时间",
    firstResponse: "首次回复",
    waiting: "等待回复",
    replied: "已回复",
    closed: "已关闭",
    slaBreached: "SLA 已超时",
    slaDue: "SLA 截止",
    noThread: "暂无对话消息。原始问题已显示在上方。",
    sendError: "回复失败",
    loadError: "无法加载消息",
    closeError: "无法标记解决",
  },
} as const;

const TABS: TicketTab[] = ["open", "mine", "unassigned", "breaching"];

interface AdminSupportInboxClientProps {
  initialTab: TicketTab;
  initialRows: AdminSupportTicketRow[];
  initialMessages: AdminSupportMessageRow[];
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string, copy: (typeof COPY)["en" | "zh"]) {
  if (status === "staff_replied") return copy.replied;
  if (status === "closed") return copy.closed;
  return copy.waiting;
}

function statusTone(status: string) {
  if (status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "staff_replied") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function isSlaBreached(row: AdminSupportTicketRow) {
  return !row.first_response_at && row.sla_due_at && Date.parse(row.sla_due_at) < Date.now();
}

export function AdminSupportInboxClient({
  initialTab,
  initialRows,
  initialMessages,
}: AdminSupportInboxClientProps) {
  const locale = useLocale();
  const interfaceLocale = normalizeInterfaceLocale(locale);
  const copy = COPY[interfaceLocale];
  const router = useRouter();
  const [tab, setTab] = useState<TicketTab>(initialTab);
  const [rows, setRows] = useState(initialRows);
  const [selectedId, setSelectedId] = useState(initialRows[0]?.id ?? "");
  const [messagesByTicket, setMessagesByTicket] = useState<Record<string, AdminSupportMessageRow[]>>(
    initialRows[0] ? { [initialRows[0].id]: initialMessages } : {},
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTicket = rows.find((row) => row.id === selectedId) ?? null;
  const selectedMessages = selectedTicket ? messagesByTicket[selectedTicket.id] ?? [] : [];
  const openCount = useMemo(() => rows.filter((row) => row.status !== "closed").length, [rows]);

  useEffect(() => {
    setTab(initialTab);
    setRows(initialRows);
    setSelectedId(initialRows[0]?.id ?? "");
    setMessagesByTicket(initialRows[0] ? { [initialRows[0].id]: initialMessages } : {});
    setDraft("");
    setError(null);
  }, [initialMessages, initialRows, initialTab]);

  function switchTab(nextTab: TicketTab) {
    setTab(nextTab);
    router.replace(`/admin/support?tab=${nextTab}`);
    router.refresh();
  }

  function selectTicket(ticketId: string) {
    setSelectedId(ticketId);
    setError(null);
    if (messagesByTicket[ticketId]) return;

    startTransition(async () => {
      const result = await listAdminTicketMessages(ticketId);
      if (result.error) {
        setError(`${copy.loadError}: ${result.error}`);
        return;
      }
      setMessagesByTicket((current) => ({ ...current, [ticketId]: result.rows ?? [] }));
    });
  }

  function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTicket || !draft.trim()) return;
    const body = draft.trim();
    setError(null);

    startTransition(async () => {
      const result = await postAdminTicketReply({ ticketId: selectedTicket.id, body });
      if (!result.ok || !result.message) {
        setError(`${copy.sendError}: ${result.reason ?? "unknown"}`);
        return;
      }
      const message = result.message;
      setMessagesByTicket((current) => ({
        ...current,
        [selectedTicket.id]: [...(current[selectedTicket.id] ?? []), message],
      }));
      setRows((current) =>
        current.map((row) =>
          row.id === selectedTicket.id
            ? {
                ...row,
                status: "staff_replied",
                first_response_at: row.first_response_at ?? message.created_at,
                updated_at: message.created_at,
              }
            : row,
        ),
      );
      setDraft("");
      router.refresh();
    });
  }

  function resolveTicket() {
    if (!selectedTicket) return;
    setError(null);
    startTransition(async () => {
      const result = await closeAdminTicket(selectedTicket.id);
      if (!result.ok) {
        setError(`${copy.closeError}: ${result.reason ?? "unknown"}`);
        return;
      }
      setRows((current) =>
        current.map((row) =>
          row.id === selectedTicket.id
            ? { ...row, status: "closed", updated_at: new Date().toISOString() }
            : row,
        ),
      );
      router.refresh();
    });
  }

  return (
    <div className="grid min-h-[680px] overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-sm lg:grid-cols-[360px_1fr]">
      <aside className="border-r border-[#e5e7eb] bg-[#fbfcfe]">
        <div className="border-b border-[#e5e7eb] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#232323]">
              <Inbox className="h-4 w-4 text-brand-500" />
              {copy.questionList}
            </div>
            <span className="text-xs text-[#64748b]">
              {copy.openCount.replace("{count}", String(openCount))}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => switchTab(item)}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                  item === tab
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-[#e5e7eb] bg-white text-[#64748b] hover:border-brand-200",
                )}
              >
                {copy.tabs[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[590px] space-y-2 overflow-y-auto p-3">
          {rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-white p-5 text-center">
              <p className="font-semibold text-[#232323]">{copy.emptyTitle}</p>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">{copy.emptyBody}</p>
            </div>
          ) : (
            rows.map((row) => {
              const breached = isSlaBreached(row);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => selectTicket(row.id)}
                  className={cn(
                    "w-full rounded-lg border bg-white p-4 text-left transition hover:border-brand-200",
                    row.id === selectedId ? "border-brand-300 shadow-sm" : "border-[#e5e7eb]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#232323]">{row.applicantName}</p>
                      <p className="truncate text-xs text-[#64748b]">{row.applicantEmail ?? row.applicationLabel}</p>
                    </div>
                    {breached && <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-medium text-[#334155]">{row.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748b]">{row.body}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", statusTone(row.status))}>
                      {statusLabel(row.status, copy)}
                    </span>
                    <span className="text-xs text-[#94a3b8]">{formatDate(row.updated_at, locale)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col">
        {!selectedTicket ? (
          <div className="flex min-h-[520px] flex-1 flex-col items-center justify-center px-6 text-center">
            <Mail className="h-10 w-10 text-[#94a3b8]" />
            <h2 className="mt-4 text-lg font-semibold text-[#232323]">{copy.noSelection}</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#64748b]">{copy.noSelectionBody}</p>
          </div>
        ) : (
          <>
            <div className="border-b border-[#e5e7eb] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold text-[#232323]">{selectedTicket.subject}</h2>
                    <p className="mt-1 truncate text-sm text-[#64748b]">
                      {selectedTicket.applicantName} · {selectedTicket.applicationLabel || copy.generalSupport}
                    </p>
                    <p className="mt-1 truncate text-sm text-[#64748b]">
                      {selectedTicket.applicantEmail ?? copy.generalSupport}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTicket.application_id && (
                    <Button asChild variant="outline">
                      <a href={`/admin/applications/${selectedTicket.application_id}`}>
                        <PanelRightOpen className="h-4 w-4" />
                        {copy.openCase}
                      </a>
                    </Button>
                  )}
                  {selectedTicket.applicantEmail && (
                    <Button asChild variant="outline">
                      <a href={`mailto:${selectedTicket.applicantEmail}`}>
                        <Mail className="h-4 w-4" />
                        {copy.email}
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" onClick={resolveTicket} disabled={isPending || selectedTicket.status === "closed"}>
                    <CheckCircle2 className="h-4 w-4" />
                    {selectedTicket.status === "closed" ? copy.resolved : copy.resolve}
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-md border border-[#e5e7eb] bg-[#fbfcfe] p-3">
                  <p className="text-xs font-semibold uppercase text-[#64748b]">{copy.submitted}</p>
                  <p className="mt-1 text-[#232323]">{formatDate(selectedTicket.created_at, locale)}</p>
                </div>
                <div className="rounded-md border border-[#e5e7eb] bg-[#fbfcfe] p-3">
                  <p className="text-xs font-semibold uppercase text-[#64748b]">{copy.updated}</p>
                  <p className="mt-1 text-[#232323]">{formatDate(selectedTicket.updated_at, locale)}</p>
                </div>
                <div className="rounded-md border border-[#e5e7eb] bg-[#fbfcfe] p-3">
                  <p className="text-xs font-semibold uppercase text-[#64748b]">{copy.firstResponse}</p>
                  <p className="mt-1 text-[#232323]">
                    {selectedTicket.first_response_at
                      ? formatDate(selectedTicket.first_response_at, locale)
                      : selectedTicket.sla_due_at
                        ? `${copy.slaDue}: ${formatDate(selectedTicket.sla_due_at, locale)}`
                        : "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#f8fafc] p-5">
              <div className="mb-4 max-w-3xl rounded-lg border border-[#e5e7eb] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase text-[#64748b]">{copy.customerQuestion}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#232323]">{selectedTicket.body}</p>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-[#232323]">{copy.conversation}</h3>
              {selectedMessages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#cbd5e1] bg-white p-4 text-sm text-[#64748b]">
                  {copy.noThread}
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedMessages.map((message) => {
                    const isStaff = message.author_kind === "staff";
                    return (
                      <div key={message.id} className={cn("flex", isStaff ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[78%] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
                            isStaff
                              ? "bg-brand-500 text-white"
                              : "border border-[#e5e7eb] bg-white text-[#232323]",
                          )}
                        >
                          <p className="mb-1 text-xs font-semibold opacity-75">
                            {isStaff ? copy.staff : copy.applicant}
                          </p>
                          <p className="whitespace-pre-wrap">{message.body}</p>
                          <p className={cn("mt-2 text-xs", isStaff ? "text-white/70" : "text-[#94a3b8]")}>
                            {formatDate(message.created_at, locale)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form onSubmit={submitReply} className="border-t border-[#e5e7eb] bg-white p-4">
              {error && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="flex items-end gap-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={copy.placeholder}
                  className="min-h-[84px] flex-1 resize-none rounded-md border border-[#d7d7d7] bg-white px-3 py-3 text-sm text-[#232323] outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <Button type="submit" className="h-[84px] bg-brand-500 px-6 text-white hover:bg-brand-600" disabled={isPending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                  {isPending ? copy.sending : copy.send}
                </Button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
