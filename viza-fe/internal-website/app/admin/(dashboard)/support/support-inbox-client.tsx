"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  Inbox,
  Mail,
  PanelRightOpen,
  Send,
  UserRound,
  UserCheck,
} from "lucide-react";
import {
  assignTicket,
  closeAdminTicket,
  listInternalNotes,
  listAdminTicketMessages,
  postInternalNote,
  postAdminTicketReply,
  type InternalNoteRow,
  type AdminSupportMessageRow,
  type AdminSupportTicketRow,
  type SupportMacroRow,
  type TicketTab,
} from "@/app/actions/admin-cs";
import { Button } from "@/components/ui/button";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    tabs: {
      open: "Open",
      p2: "P2",
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
    accessUser: "Access user",
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
    unresolved: "Unresolved",
    inProgress: "In progress",
    closed: "Resolved",
    slaBreached: "SLA breached",
    slaDue: "SLA due",
    noThread: "No thread messages yet. The original question is shown above.",
    sendError: "Reply failed",
    loadError: "Could not load messages",
    closeError: "Could not resolve ticket",
    claim: "Claim",
    assigned: "Assigned",
    macro: "Insert macro",
    internalNotes: "Internal notes",
    notePlaceholder: "Add a private staff note...",
    addNote: "Add note",
    assignError: "Could not assign ticket",
    noteError: "Could not save internal note",
  },
  zh: {
    tabs: {
      open: "未关闭",
      p2: "P2",
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
    accessUser: "查看用户申请",
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
    unresolved: "未解决",
    inProgress: "正在解决",
    closed: "已解决",
    slaBreached: "SLA 已超时",
    slaDue: "SLA 截止",
    noThread: "暂无对话消息。原始问题已显示在上方。",
    sendError: "回复失败",
    loadError: "无法加载消息",
    closeError: "无法标记解决",
    claim: "领取",
    assigned: "已分配",
    macro: "插入模板",
    internalNotes: "内部备注",
    notePlaceholder: "添加仅员工可见的备注...",
    addNote: "添加备注",
    assignError: "无法分配工单",
    noteError: "无法保存内部备注",
  },
} as const;

const TABS: TicketTab[] = ["open", "p2", "mine", "unassigned", "breaching"];

interface AdminSupportInboxClientProps {
  initialTab: TicketTab;
  initialRows: AdminSupportTicketRow[];
  initialMessages: AdminSupportMessageRow[];
  initialSelectedId: string;
  initialNotes: InternalNoteRow[];
  initialMacros: SupportMacroRow[];
  currentUserId: string;
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
  if (status === "in_progress" || status === "staff_replied") return copy.inProgress;
  if (status === "resolved" || status === "closed") return copy.closed;
  return copy.unresolved;
}

function statusTone(status: string) {
  if (status === "resolved" || status === "closed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "in_progress" || status === "staff_replied") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function isSlaBreached(row: AdminSupportTicketRow) {
  return !row.first_response_at && row.sla_due_at && Date.parse(row.sla_due_at) < Date.now();
}

export function AdminSupportInboxClient({
  initialTab,
  initialRows,
  initialMessages,
  initialSelectedId,
  initialNotes,
  initialMacros,
  currentUserId,
}: AdminSupportInboxClientProps) {
  const locale = useLocale();
  const interfaceLocale = normalizeInterfaceLocale(locale);
  const copy = COPY[interfaceLocale];
  const router = useRouter();
  const [tab, setTab] = useState<TicketTab>(initialTab);
  const [rows, setRows] = useState(initialRows);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [messagesByTicket, setMessagesByTicket] = useState<Record<string, AdminSupportMessageRow[]>>(
    initialSelectedId ? { [initialSelectedId]: initialMessages } : {},
  );
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [notesByTicket, setNotesByTicket] = useState<Record<string, InternalNoteRow[]>>(
    initialSelectedId ? { [initialSelectedId]: initialNotes } : {},
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTicket = rows.find((row) => row.id === selectedId) ?? null;
  const selectedMessages = selectedTicket ? messagesByTicket[selectedTicket.id] ?? [] : [];
  const selectedNotes = selectedTicket ? notesByTicket[selectedTicket.id] ?? [] : [];
  const openCount = useMemo(
    () => rows.filter((row) => row.status !== "resolved" && row.status !== "closed").length,
    [rows],
  );

  useEffect(() => {
    setTab(initialTab);
    setRows(initialRows);
    setSelectedId(initialSelectedId);
    setMessagesByTicket(initialSelectedId ? { [initialSelectedId]: initialMessages } : {});
    setNotesByTicket(initialSelectedId ? { [initialSelectedId]: initialNotes } : {});
    setDraft("");
    setNoteDraft("");
    setError(null);
  }, [initialMessages, initialNotes, initialRows, initialSelectedId, initialTab]);

  function switchTab(nextTab: TicketTab) {
    setTab(nextTab);
    router.replace(`/admin/support?tab=${nextTab}`);
    router.refresh();
  }

  function selectTicket(ticketId: string) {
    setSelectedId(ticketId);
    router.replace(`/admin/support?tab=${tab}&ticket=${ticketId}`);
    setError(null);
    if (messagesByTicket[ticketId] && notesByTicket[ticketId]) return;

    startTransition(async () => {
      const [messageResult, noteResult] = await Promise.all([
        listAdminTicketMessages(ticketId),
        listInternalNotes(ticketId),
      ]);
      if (messageResult.error || noteResult.error) {
        setError(`${copy.loadError}: ${messageResult.error || noteResult.error}`);
        return;
      }
      setMessagesByTicket((current) => ({ ...current, [ticketId]: messageResult.rows ?? [] }));
      setNotesByTicket((current) => ({ ...current, [ticketId]: noteResult.rows ?? [] }));
    });
  }

  function claimTicket() {
    if (!selectedTicket || !currentUserId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignTicket({ ticketId: selectedTicket.id, assignToUserId: currentUserId });
      if (!result.ok) {
        setError(`${copy.assignError}: ${result.reason ?? "unknown"}`);
        return;
      }
      setRows((current) => current.map((row) => row.id === selectedTicket.id ? { ...row, assigned_to: currentUserId } : row));
      router.refresh();
    });
  }

  function addInternalNote() {
    if (!selectedTicket || !noteDraft.trim()) return;
    const body = noteDraft.trim();
    setError(null);
    startTransition(async () => {
      const result = await postInternalNote({ ticketId: selectedTicket.id, body });
      if (!result.ok) {
        setError(`${copy.noteError}: ${result.reason ?? "unknown"}`);
        return;
      }
      const refreshed = await listInternalNotes(selectedTicket.id);
      setNotesByTicket((current) => ({ ...current, [selectedTicket.id]: refreshed.rows ?? current[selectedTicket.id] ?? [] }));
      setNoteDraft("");
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
                status: "in_progress",
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
            ? { ...row, status: "resolved", updated_at: new Date().toISOString() }
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
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold uppercase text-brand-700">
                        {row.priority}
                      </span>
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", statusTone(row.status))}>
                        {statusLabel(row.status, copy)}
                      </span>
                    </div>
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
                      <a
                        href={`/admin/applications/${selectedTicket.applicant_id}`}
                        className="font-semibold text-brand-500 hover:underline"
                      >
                        {selectedTicket.applicantName}
                      </a>{" "}
                      · {selectedTicket.applicationLabel || copy.generalSupport}
                    </p>
                    <p className="mt-1 truncate text-sm text-[#64748b]">
                      {selectedTicket.applicantEmail ?? copy.generalSupport}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTicket.assigned_to !== currentUserId ? (
                    <Button variant="outline" onClick={claimTicket} disabled={isPending || !currentUserId}>
                      <UserCheck className="h-4 w-4" />{copy.claim}
                    </Button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700"><UserCheck className="h-4 w-4" />{copy.assigned}</span>
                  )}
                  <Button asChild variant="outline">
                    <a href={`/admin/applications/${selectedTicket.applicant_id}`}>
                      <UserRound className="h-4 w-4" />
                      {copy.accessUser}
                    </a>
                  </Button>
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
                  <Button
                    variant="outline"
                    onClick={resolveTicket}
                    disabled={isPending || selectedTicket.status === "resolved" || selectedTicket.status === "closed"}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {selectedTicket.status === "resolved" || selectedTicket.status === "closed" ? copy.resolved : copy.resolve}
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
              <div className="mb-3 grid gap-3 lg:grid-cols-2">
                <label className="text-xs font-semibold text-[#64748b]">
                  {copy.macro}
                  <select
                    defaultValue=""
                    onChange={(event) => {
                      const macro = initialMacros.find((item) => item.id === event.target.value);
                      if (macro) setDraft(macro.body);
                      event.target.value = "";
                    }}
                    className="mt-1 h-9 w-full rounded-md border border-[#d7d7d7] bg-white px-3 text-sm font-normal"
                  >
                    <option value="">{copy.macro}</option>
                    {initialMacros.map((macro) => <option key={macro.id} value={macro.id}>{macro.title}</option>)}
                  </select>
                </label>
                <details className="rounded-md border border-[#e5e7eb] p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-[#64748b]"><BookOpenText className="mr-1 inline h-4 w-4" />{copy.internalNotes} ({selectedNotes.length})</summary>
                  <div className="mt-2 max-h-28 space-y-2 overflow-y-auto">{selectedNotes.map((note) => <p key={note.id} className="rounded bg-[#fafbfc] p-2 text-xs text-[#475569]">{note.body}</p>)}</div>
                  <div className="mt-2 flex gap-2"><input value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder={copy.notePlaceholder} className="h-9 min-w-0 flex-1 rounded-md border px-3 text-sm" /><Button type="button" variant="outline" onClick={addInternalNote} disabled={isPending || !noteDraft.trim()}>{copy.addNote}</Button></div>
                </details>
              </div>
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
