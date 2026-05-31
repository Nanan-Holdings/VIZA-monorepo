"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Inbox,
  Loader2,
  MessageSquareText,
  Send,
} from "lucide-react";
import { listMyTickets, type SupportTicketRow } from "@/app/actions/support";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type RequestStatusKey = "sent" | "pending" | "resolved";

function statusKey(status: string): RequestStatusKey {
  if (status === "closed") return "resolved";
  if (status === "staff_replied") return "pending";
  return "sent";
}

function statusClasses(status: string) {
  if (status === "closed") return "bg-emerald-50 text-emerald-700";
  if (status === "staff_replied") return "bg-amber-50 text-amber-700";
  return "bg-brand-50 text-brand-600";
}

function statusIcon(status: string) {
  if (status === "closed") return CheckCircle2;
  if (status === "staff_replied") return Clock3;
  return Send;
}

export default function SupportRequestsPage() {
  const t = useTranslations("supportCenter");
  const locale = useLocale();
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const counts = useMemo(() => {
    return tickets.reduce(
      (acc, ticket) => {
        acc[statusKey(ticket.status)] += 1;
        return acc;
      },
      { sent: 0, pending: 0, resolved: 0 } satisfies Record<RequestStatusKey, number>,
    );
  }, [tickets]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listMyTickets()
      .then((result) => {
        if (!mounted) return;
        if (result.error) {
          setError(t("requestsPage.error"));
          return;
        }
        setTickets(result.rows ?? []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [t]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 pb-16">
      <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Link
              href="/client/support"
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-500 hover:text-brand-400"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("requestsPage.back")}
            </Link>
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-brand-500">
                {t("requestsPage.eyebrow")}
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-foreground">{t("requestsPage.title")}</h1>
              <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
                {t("requestsPage.subtitle")}
              </p>
            </div>
          </div>
          <Button asChild className="h-11 bg-brand-500 hover:bg-brand-400">
            <Link href="/client/support">
              {t("requestsPage.newRequest")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {(["sent", "pending", "resolved"] as const).map((key) => (
          <div key={key} className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{t(`requests.status.${key}`)}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{counts[key]}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-white shadow-sm">
        <div className="border-b border-border p-5">
          <h2 className="text-xl font-semibold text-foreground">{t("requestsPage.listTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("requestsPage.listSubtitle")}</p>
        </div>

        {loading ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            <p className="text-sm">{t("requests.loading")}</p>
          </div>
        ) : error ? (
          <Empty className="min-h-72 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>{t("requestsPage.errorTitle")}</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : tickets.length === 0 ? (
          <Empty className="min-h-72 border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>{t("requestsPage.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("requests.empty")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild className="bg-brand-500 hover:bg-brand-400">
                <Link href="/client/support">{t("requestsPage.newRequest")}</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="divide-y divide-border">
            {tickets.map((ticket) => {
              const Icon = statusIcon(ticket.status);
              return (
                <Link
                  key={ticket.id}
                  href={`/support/${ticket.id}`}
                  className="grid gap-4 p-5 transition hover:bg-brand-50/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                      <MessageSquareText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-foreground">{ticket.subject}</h3>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                            statusClasses(ticket.status),
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {t(`requests.status.${statusKey(ticket.status)}`)}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{ticket.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("requests.ticketMeta", { id: ticket.id.slice(0, 8) })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    <span className="text-sm text-muted-foreground">
                      {dateFormatter.format(new Date(ticket.updated_at ?? ticket.created_at))}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
