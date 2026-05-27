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

function buildTicketBody(activityTitle: string, activityMeta: string, issue: string) {
  return [
    `Activity: ${activityTitle}`,
    `Activity details: ${activityMeta}`,
    "",
    `Issue: ${issue}`,
    "",
    "Source: /client/support recent activity chat",
  ].join("\n");
}

function buildMailto(activityTitle: string, issue: string) {
  const subject = encodeURIComponent(`VIZA support request: ${activityTitle}`);
  const body = encodeURIComponent(
    [
      "Hi VIZA Support,",
      "",
      `Activity: ${activityTitle}`,
      issue ? `Issue: ${issue}` : "Issue:",
      "",
      "Please include your account email, destination, and application reference if available.",
    ].join("\n"),
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}

export function SupportCenterClient() {
  const t = useTranslations("supportCenter");
  const [selectedActivity, setSelectedActivity] = useState<ActivityKey>("application");
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedActivityConfig = RECENT_ACTIVITIES.find((activity) => activity.key === selectedActivity);
  const selectedActivityTitle = t(`activities.${selectedActivity}.title`);
  const selectedActivityMeta = t(`activities.${selectedActivity}.meta`);
  const visibleActivities = showAllActivities ? RECENT_ACTIVITIES : RECENT_ACTIVITIES.slice(0, 3);
  const latestIssue = useMemo(() => {
    const latestUserTurn = [...turns].reverse().find((turn) => turn.role === "user");
    return latestUserTurn?.body ?? "";
  }, [turns]);
  const mailtoHref = buildMailto(selectedActivityTitle, latestIssue);

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

  function selectActivity(activity: ActivityKey) {
    setSelectedActivity(activity);
    setTicketError(null);
    setTurns([]);
  }

  function submitIssue(issue: string) {
    const trimmedIssue = issue.trim();
    if (!trimmedIssue || isPending) return;

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: "user",
      body: trimmedIssue,
    };
    setTurns((current) => [...current, userTurn]);
    setDraft("");
    setTicketError(null);

    startTransition(async () => {
      const result = await createSupportTicket({
        subject: `${selectedActivityTitle}: ${trimmedIssue.slice(0, 72)}`,
        body: buildTicketBody(selectedActivityTitle, selectedActivityMeta, trimmedIssue),
      });

      if (result.error || !result.ticketId) {
        setTicketError(t("agent.ticketError"));
        setTurns((current) => [
          ...current,
          {
            id: `agent-error-${Date.now()}`,
            role: "agent",
            body: t("agent.fallbackReply"),
          },
        ]);
        return;
      }

      const ticketId = result.ticketId;
      setTurns((current) => [
        ...current,
        {
          id: `agent-ticket-${ticketId}`,
          role: "agent",
          body: t("agent.ticketCreated", { ticket: ticketId.slice(0, 8) }),
          ticketId,
        },
      ]);
      setTickets((current) => [
        {
          id: ticketId,
          applicant_id: "",
          application_id: null,
          subject: `${selectedActivityTitle}: ${trimmedIssue.slice(0, 72)}`,
          body: trimmedIssue,
          status: "open",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...current,
      ]);
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitIssue(draft);
  }

  function handleAction(action: HelpActionKey) {
    if (action === "requests") {
      setShowRequests((current) => !current);
      return;
    }
    if (action === "human") {
      setDraft(t("actions.human.prefill"));
    }
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
              {visibleActivities.map((activity) => {
                const Icon = activity.icon;
                const selected = activity.key === selectedActivity;
                return (
                  <button
                    key={activity.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectActivity(activity.key)}
                    className={cn(
                      "flex w-full items-center gap-3 p-4 text-left transition hover:bg-brand-50/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      selected && "bg-brand-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                        activityToneClasses(activity.tone),
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">
                        {t(`activities.${activity.key}.title`)}
                      </span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        {t(`activities.${activity.key}.meta`)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-medium text-brand-500">
                      {t(`activities.${activity.key}.status`)}
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
                onClick={() => setShowAllActivities((current) => !current)}
              >
                {showAllActivities ? t("showLess") : t("viewMore")}
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
                  {tickets.slice(0, 3).map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/support/${ticket.id}`}
                      className="block rounded-lg border border-border p-3 transition hover:border-brand-200 hover:bg-brand-50/60"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">{ticket.subject}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("requests.ticketMeta", { id: ticket.id.slice(0, 8), status: ticket.status })}
                      </span>
                    </Link>
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
                    <h2 className="font-semibold text-foreground">{t("agent.title")}</h2>
                    <p className="text-sm text-muted-foreground">{t("agent.subtitle", { activity: selectedActivityTitle })}</p>
                  </div>
                </div>
                {selectedActivityConfig ? (
                  <Button asChild variant="outline" className="h-10">
                    <Link href={selectedActivityConfig.href}>
                      {t("agent.openActivity")}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="flex-1 space-y-4 p-4 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                  <Bot className="h-4 w-4" />
                </span>
                <div className="max-w-3xl rounded-lg bg-muted px-4 py-3 text-sm leading-6 text-foreground">
                  {t("agent.greeting", {
                    activity: selectedActivityTitle,
                    status: t(`activities.${selectedActivity}.status`),
                  })}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pl-11">
                {QUICK_ISSUES.map((issue) => (
                  <button
                    key={issue}
                    type="button"
                    onClick={() => submitIssue(t(`quickIssues.${issue}`))}
                    disabled={isPending}
                    className="rounded-full border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition hover:border-brand-200 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
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
                      {turn.ticketId ? (
                        <Link
                          href={`/support/${turn.ticketId}`}
                          className="mt-3 inline-flex items-center gap-2 font-medium text-brand-500 underline-offset-4 hover:underline"
                        >
                          {t("agent.openThread")}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {isPending ? (
                <div className="flex items-center gap-2 pl-11 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-brand-500" />
                  {t("agent.creating")}
                </div>
              ) : null}

              {ticketError ? (
                <div className="ml-11 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {ticketError}{" "}
                  <a href={mailtoHref} className="font-medium underline underline-offset-4">
                    {t("emailSupport")}
                  </a>
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
                  disabled={!draft.trim() || isPending}
                  aria-label={t("send")}
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" className="h-10">
                  <a href={mailtoHref}>
                    <Mail className="h-4 w-4" />
                    {t("emailSupport")}
                  </a>
                </Button>
                <Button type="button" variant="outline" className="h-10" onClick={() => setDraft(t("actions.human.prefill"))}>
                  <Headphones className="h-4 w-4" />
                  {t("requestHuman")}
                </Button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
