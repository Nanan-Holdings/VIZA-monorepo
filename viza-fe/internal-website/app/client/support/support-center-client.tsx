"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FolderKanban,
  HelpCircle,
  History,
  Inbox,
  Loader2,
  MessageSquareText,
  Search,
  SendHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  createSupportTicket,
  listMyTickets,
  type SupportTicketRow,
} from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type IssueTypeKey = "application" | "documents" | "billing" | "status" | "account";
type HelpActionKey = "faqs" | "requests";
type ChatTurn = {
  id: string;
  role: "agent" | "user";
  body: string;
};

const ISSUE_TYPES: Array<{
  key: IssueTypeKey;
  icon: LucideIcon;
  href: string;
  tone: "info" | "success" | "warning";
}> = [
  { key: "application", icon: ClipboardList, href: "/client/application", tone: "info" },
  { key: "documents", icon: FileCheck2, href: "/client/documents", tone: "warning" },
  { key: "billing", icon: CreditCard, href: "/client/billing", tone: "success" },
  { key: "status", icon: CalendarClock, href: "/client/status", tone: "info" },
  { key: "account", icon: FolderKanban, href: "/client/settings", tone: "success" },
];

const HELP_ACTIONS: Array<{
  key: HelpActionKey;
  icon: LucideIcon;
  href?: string;
}> = [
  { key: "faqs", icon: HelpCircle, href: "/client/help" },
  { key: "requests", icon: Inbox },
];

const QUICK_ISSUES = ["stuck", "change", "refund", "deadline"] as const;

function activityToneClasses(tone: "info" | "success" | "warning") {
  if (tone === "success") return "bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "bg-amber-50 text-amber-700";
  return "bg-brand-50 text-brand-500";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function buildTicketBody(input: {
  issueTitle: string;
  issueMeta: string;
  description: string;
  latestQuestion: string;
  attachments: string[];
}) {
  const lines = [
    `Issue type: ${input.issueTitle}`,
    input.issueMeta ? `Context: ${input.issueMeta}` : "",
    input.latestQuestion ? `Latest question: ${input.latestQuestion}` : "",
    "",
    "Request details:",
    input.description,
    "",
    `Attachments: ${input.attachments.length > 0 ? input.attachments.join(", ") : "none"}`,
    "",
    "Source: /client/support request form",
  ];
  return lines.filter(Boolean).join("\n");
}

export function SupportCenterClient() {
  const t = useTranslations("supportCenter");
  const [selectedIssue, setSelectedIssue] = useState<IssueTypeKey>("application");
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [requestView, setRequestView] = useState<"knowledge" | "request">("knowledge");
  const [requestSubject, setRequestSubject] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestFiles, setRequestFiles] = useState<File[]>([]);
  const [requestSuccessId, setRequestSuccessId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const selectedIssueConfig = ISSUE_TYPES.find((issue) => issue.key === selectedIssue);
  const selectedIssueTitle = t(`activities.${selectedIssue}.title`);
  const selectedIssueMeta = t(`activities.${selectedIssue}.meta`);
  const visibleIssues = showAllIssues ? ISSUE_TYPES : ISSUE_TYPES.slice(0, 3);
  const showHandoff = turns.some((turn) => turn.role === "agent");

  useEffect(() => {
    let mounted = true;
    setTicketsLoading(true);
    listMyTickets()
      .then((result) => {
        if (!mounted) return;
        if (result.rows) setTickets(result.rows);
      })
      .finally(() => {
        if (mounted) setTicketsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function selectIssue(issue: IssueTypeKey) {
    setSelectedIssue(issue);
    setTurns([]);
    setDraft("");
    setRequestError(null);
    setRequestSuccessId(null);
    setRequestView("knowledge");
  }

  function submitIssue(issue: string) {
    const trimmedIssue = issue.trim();
    if (!trimmedIssue) return;

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: "user",
      body: trimmedIssue,
    };
    const agentTurn: ChatTurn = {
      id: `agent-${Date.now()}`,
      role: "agent",
      body: t("agent.kbAnswer", { activity: selectedIssueTitle }),
    };
    setTurns((current) => [...current, userTurn, agentTurn]);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitIssue(draft);
  }

  function handleAction(action: HelpActionKey) {
    if (action === "requests") {
      setShowRequests((current) => !current);
    }
  }

  function openRequestForm() {
    setRequestView("request");
    setRequestError(null);
    setRequestSuccessId(null);
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setRequestFiles(files);
  }

  function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedSubject = requestSubject.trim();
    const trimmedDescription = requestDescription.trim();
    if (trimmedSubject.length < 3) {
      setRequestError(t("requestForm.subjectError"));
      return;
    }
    if (trimmedDescription.length < 10) {
      setRequestError(t("requestForm.descriptionError"));
      return;
    }

    const latestQuestion = [...turns].reverse().find((turn) => turn.role === "user")?.body ?? "";
    const attachmentList = requestFiles.map((file) => `${file.name} (${formatFileSize(file.size)})`);
    setRequestError(null);

    startTransition(async () => {
      const result = await createSupportTicket({
        subject: trimmedSubject,
        body: buildTicketBody({
          issueTitle: selectedIssueTitle,
          issueMeta: selectedIssueMeta,
          description: trimmedDescription,
          latestQuestion,
          attachments: attachmentList,
        }),
      });

      if (result.error || !result.ticketId) {
        setRequestError(t("requestForm.submitError"));
        return;
      }

      const ticketId = result.ticketId;
      setRequestSuccessId(ticketId);
      setRequestSubject("");
      setRequestDescription("");
      setRequestFiles([]);
      setTickets((current) => [
        {
          id: ticketId,
          applicant_id: "",
          application_id: null,
          subject: trimmedSubject,
          body: trimmedDescription,
          status: "open",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...current,
      ]);
      setShowRequests(true);
    });
  }

  function requestStatusLabel(status: string) {
    if (status === "open") return t("requests.status.sent");
    if (status === "staff_replied") return t("requests.status.pending");
    if (status === "closed") return t("requests.status.resolved");
    return t("requests.status.pending");
  }

  function requestStatusClasses(status: string) {
    if (status === "closed") return "bg-emerald-50 text-emerald-700";
    if (status === "staff_replied") return "bg-amber-50 text-amber-700";
    return "bg-brand-50 text-brand-600";
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 pb-16">
      <section className="overflow-hidden rounded-lg border border-brand-100 bg-brand-500 text-white shadow-sm">
        <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1fr_320px] lg:items-center">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-normal text-brand-100">{t("eyebrow")}</p>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold md:text-4xl">{t("title")}</h1>
              <p className="max-w-2xl text-base leading-7 text-brand-50">{t("subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-brand-500">
              <Bot className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="font-semibold">{t("agent.cardTitle")}</p>
              <p className="text-sm leading-6 text-brand-50">{t("agent.cardDescription")}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-white shadow-sm">
            <div className="border-b border-border p-5">
              <h2 className="text-xl font-semibold text-foreground">{t("activitiesTitle")}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("activitiesSubtitle")}</p>
            </div>
            <div className="divide-y divide-border">
              {visibleIssues.map((issue) => {
                const Icon = issue.icon;
                const selected = issue.key === selectedIssue;
                return (
                  <button
                    key={issue.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectIssue(issue.key)}
                    className={cn(
                      "flex w-full items-center gap-3 p-4 text-left transition hover:bg-brand-50/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      selected && "bg-brand-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                        activityToneClasses(issue.tone),
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">
                        {t(`activities.${issue.key}.title`)}
                      </span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        {t(`activities.${issue.key}.meta`)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-border p-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                onClick={() => setShowAllIssues((current) => !current)}
              >
                {showAllIssues ? t("showLess") : t("viewMore")}
              </Button>
            </div>
          </section>

          <section className="space-y-3">
            {HELP_ACTIONS.map((action) => {
              const Icon = action.icon;
              const content = (
                <>
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-foreground">
                      {t(`actions.${action.key}.title`)}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {t(`actions.${action.key}.description`)}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              );

              if (action.href) {
                return (
                  <Link
                    key={action.key}
                    href={action.href}
                    className="flex min-h-24 items-center gap-4 rounded-lg border border-border bg-white p-4 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => handleAction(action.key)}
                  className="flex min-h-24 w-full items-center gap-4 rounded-lg border border-border bg-white p-4 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {content}
                </button>
              );
            })}
          </section>

          {showRequests ? (
            <section className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-brand-500" />
                <h2 className="font-semibold text-foreground">{t("requests.title")}</h2>
              </div>
              {ticketsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("requests.loading")}
                </div>
              ) : tickets.length > 0 ? (
                <div className="space-y-2">
                  {tickets.slice(0, 4).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-lg border border-border p-3 transition hover:border-brand-200 hover:bg-brand-50/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="block truncate text-sm font-medium text-foreground">{ticket.subject}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            requestStatusClasses(ticket.status),
                          )}
                        >
                          {requestStatusLabel(ticket.status)}
                        </span>
                      </div>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("requests.ticketMeta", { id: ticket.id.slice(0, 8) })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-muted-foreground">{t("requests.empty")}</p>
              )}
            </section>
          ) : null}
        </aside>

        <section className="min-h-[640px] rounded-lg border border-border bg-white shadow-sm">
          <div className="flex h-full flex-col">
            <div className="border-b border-border p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                    <MessageSquareText className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-foreground">
                      {requestView === "knowledge" ? t("agent.title") : t("requestForm.title")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {requestView === "knowledge"
                        ? t("agent.subtitle", { activity: selectedIssueTitle })
                        : t("requestForm.subtitle")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedIssueConfig ? (
                    <Button asChild variant="outline" className="h-10">
                      <Link href={selectedIssueConfig.href}>
                        {t("agent.openActivity")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  {requestView === "knowledge" ? (
                    <Button type="button" className="h-10" onClick={openRequestForm}>
                      {t("agent.handoffCta")}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10"
                      onClick={() => setRequestView("knowledge")}
                    >
                      {t("requestForm.backToHelp")}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {requestView === "request" ? (
              <form className="flex-1 space-y-4 p-4 sm:p-6" onSubmit={handleRequestSubmit}>
                {requestSuccessId ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="h-6 w-6" />
                    </span>
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground">{t("requestForm.successTitle")}</h3>
                      <p className="text-sm text-muted-foreground">{t("requestForm.successBody")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("requestForm.successMeta", { id: requestSuccessId.slice(0, 8) })}
                      </p>
                    </div>
                    <Button type="button" className="h-10" onClick={() => setRequestView("knowledge")}
                    >
                      {t("requestForm.backToHelp")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-brand-100 bg-brand-50/70 p-4 text-sm text-foreground">
                      <p className="font-semibold">{t("requestForm.issueLabel", { activity: selectedIssueTitle })}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{selectedIssueMeta}</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground" htmlFor="support-request-subject">
                        {t("requestForm.subjectLabel")}
                      </label>
                      <Input
                        id="support-request-subject"
                        value={requestSubject}
                        onChange={(event) => setRequestSubject(event.target.value)}
                        placeholder={t("requestForm.subjectPlaceholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground" htmlFor="support-request-description">
                        {t("requestForm.descriptionLabel")}
                      </label>
                      <Textarea
                        id="support-request-description"
                        value={requestDescription}
                        onChange={(event) => setRequestDescription(event.target.value)}
                        placeholder={t("requestForm.descriptionPlaceholder")}
                        rows={6}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground" htmlFor="support-request-files">
                        {t("requestForm.attachmentsLabel")}
                      </label>
                      <Input id="support-request-files" type="file" multiple onChange={handleAttachmentChange} />
                      {requestFiles.length > 0 ? (
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {requestFiles.map((file) => (
                            <li key={`${file.name}-${file.lastModified}`}>
                              {file.name} · {formatFileSize(file.size)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("requestForm.attachmentsHint")}</p>
                      )}
                    </div>

                    {requestError ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {requestError}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" className="h-11" disabled={isSubmitting}>
                        {isSubmitting ? t("requestForm.sending") : t("requestForm.submit")}
                      </Button>
                      <p className="text-xs text-muted-foreground">{t("requestForm.helper")}</p>
                    </div>
                  </>
                )}
              </form>
            ) : (
              <>
                <div className="flex-1 space-y-4 p-4 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="max-w-3xl rounded-lg bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                      {t("agent.greeting", { activity: selectedIssueTitle })}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pl-11">
                    {QUICK_ISSUES.map((issue) => (
                      <button
                        key={issue}
                        type="button"
                        onClick={() => submitIssue(t(`quickIssues.${issue}`))}
                        className="rounded-full border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {t(`quickIssues.${issue}`)}
                      </button>
                    ))}
                  </div>

                  {turns.map((turn) => {
                    const fromUser = turn.role === "user";
                    return (
                      <div key={turn.id} className={cn("flex items-start gap-3", fromUser && "justify-end")}>
                        {!fromUser ? (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                            <CheckCircle2 className="h-4 w-4" />
                          </span>
                        ) : null}
                        <div
                          className={cn(
                            "max-w-3xl rounded-lg px-4 py-3 text-sm leading-6",
                            fromUser ? "bg-brand-500 text-white" : "bg-muted text-foreground",
                          )}
                        >
                          <p>{turn.body}</p>
                        </div>
                      </div>
                    );
                  })}

                  {showHandoff ? (
                    <div className="ml-11 rounded-lg border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-foreground">
                      <p>{t("agent.handoffHint")}</p>
                      <Button type="button" variant="outline" className="mt-3 h-9" onClick={openRequestForm}>
                        {t("agent.handoffCta")}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <form className="border-t border-border p-4 sm:p-5" onSubmit={handleSubmit}>
                  <label className="mb-2 block text-sm font-semibold text-foreground" htmlFor="support-agent-message">
                    {t("questionLabel")}
                  </label>
                  <div className="flex min-h-12 items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:ring-1 focus-within:ring-ring">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      id="support-agent-message"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
                      placeholder={t("questionPlaceholder")}
                    />
                    <button
                      type="submit"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-muted"
                      disabled={!draft.trim()}
                      aria-label={t("send")}
                    >
                      <SendHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
