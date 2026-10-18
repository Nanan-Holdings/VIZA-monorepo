import Link from "next/link";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { ArrowRight, Inbox } from "lucide-react";
import { getCurrentUser } from "@/lib/rbac";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import {
  getDestinationDisplayNameForLocale,
  getFormVisaType,
  getVisaTypeDisplayNameForLocale,
} from "@/lib/visa-destinations";
import { formatAdminDateTime } from "../applications/copy";
import { EmptyState, ErrorPanel, StatusPill } from "../applications/ui";
import { loadStaffQueue } from "./data";
import { ACTION_REASONS, QUEUE_REASONS, type QueueReason } from "./queue-model";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams?: Promise<SearchParams>;
}

const COPY = {
  en: {
    title: "Staff queue",
    subtitle:
      "Applications that need a person: manual submissions, automation hand-offs, failed submissions and open case work. Newest first. QA and staff test data is hidden.",
    needsAction: "Needs action",
    all: "All open cases",
    showTest: "Show test data",
    hideTest: "Hide test data",
    empty: "Nothing needs a human right now.",
    open: "Record outcome",
    test: "Test data",
    status: "Status",
    reference: "Gov. reference",
    count: (n: number) => `${n} ${n === 1 ? "case" : "cases"}`,
    reasons: {
      staff_action_required: "VIZA team submits",
      runner_needs_human: "Automation needs a human",
      submission_failed: "Submission failed",
      submission_awaiting_staff: "Waiting for staff to finish",
      work_item: "Open work item",
      awaiting_applicant: "Waiting on applicant",
      awaiting_decision: "Waiting for government decision",
    } satisfies Record<QueueReason, string>,
  },
  zh: {
    title: "人工处理队列",
    subtitle: "需要人工处理的申请：人工递交、自动化转人工、递交失败和未结工作项。按时间倒序，已隐藏 QA 与员工测试数据。",
    needsAction: "待处理",
    all: "全部未结案件",
    showTest: "显示测试数据",
    hideTest: "隐藏测试数据",
    empty: "目前没有需要人工处理的案件。",
    open: "记录结果",
    test: "测试数据",
    status: "状态",
    reference: "官方编号",
    count: (n: number) => `${n} 个案件`,
    reasons: {
      staff_action_required: "由 VIZA 团队递交",
      runner_needs_human: "自动化需要人工接手",
      submission_failed: "递交失败",
      submission_awaiting_staff: "等待员工完成递交",
      work_item: "未结工作项",
      awaiting_applicant: "等待申请人补充",
      awaiting_decision: "等待官方结果",
    } satisfies Record<QueueReason, string>,
  },
} as const;

function firstParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function toneFor(reason: QueueReason) {
  if (reason === "submission_failed") return "danger" as const;
  if (reason === "awaiting_decision" || reason === "awaiting_applicant") return "neutral" as const;
  return "warning" as const;
}

export default async function StaffQueuePage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/admin/login");
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const params = (await searchParams) ?? {};
  const view = firstParam(params, "view") === "all" ? "all" : "action";
  const includeTest = firstParam(params, "test") === "1";
  const reasonParam = firstParam(params, "reason");
  const reasonFilter = QUEUE_REASONS.find((reason) => reason === reasonParam) ?? null;

  const { items, error } = await loadStaffQueue({ includeTest });
  const visible = items.filter((item) => {
    if (reasonFilter) return item.signals.some((signal) => signal.reason === reasonFilter);
    return view === "all" || item.needsAction;
  });
  const reasonCounts = new Map<QueueReason, number>();
  for (const item of items) {
    for (const reason of new Set(item.signals.map((signal) => signal.reason))) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }
  const href = (next: Record<string, string | null>) => {
    const query = new URLSearchParams();
    const merged = { view, test: includeTest ? "1" : null, reason: reasonFilter, ...next };
    for (const [key, value] of Object.entries(merged)) {
      if (value && !(key === "view" && value === "action")) query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `/admin/staff-queue?${qs}` : "/admin/staff-queue";
  };
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-semibold ${active ? "border-brand-500 bg-brand-50 text-brand-600" : "border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]"}`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#232323]">
            <Inbox className="h-6 w-6 text-brand-500" />
            {copy.title}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#64748b]">{copy.subtitle}</p>
        </div>
        <p className="text-sm font-semibold text-[#334155]">{copy.count(visible.length)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={href({ view: "action", reason: null })} className={chip(view === "action" && !reasonFilter)}>
          {copy.needsAction} ({items.filter((item) => item.needsAction).length})
        </Link>
        <Link href={href({ view: "all", reason: null })} className={chip(view === "all" && !reasonFilter)}>
          {copy.all} ({items.length})
        </Link>
        {QUEUE_REASONS.filter((reason) => reasonCounts.get(reason)).map((reason) => (
          <Link key={reason} href={href({ reason: reasonFilter === reason ? null : reason })} className={chip(reasonFilter === reason)}>
            {copy.reasons[reason]} ({reasonCounts.get(reason)})
          </Link>
        ))}
        <Link href={href({ test: includeTest ? null : "1" })} className="ml-auto text-xs font-medium text-[#64748b] underline">
          {includeTest ? copy.hideTest : copy.showTest}
        </Link>
      </div>

      {error ? <ErrorPanel title={copy.title} message={error} /> : null}

      {!error && visible.length === 0 ? (
        <EmptyState title={copy.empty} body="" />
      ) : (
        <ul className="divide-y rounded-lg border border-[#e5e7eb] bg-white">
          {visible.map((item) => {
            const country = item.country ? getDestinationDisplayNameForLocale(item.country, locale) : "";
            const visa = item.visaType ? getVisaTypeDisplayNameForLocale(getFormVisaType(item.visaType), locale) : "";
            return (
              <li key={item.applicationId} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#232323]">{item.applicantName || item.applicantEmail || item.applicantId.slice(0, 8)}</span>
                    <span className="text-sm text-[#64748b]">{[country, visa].filter(Boolean).join(" · ")}</span>
                    {item.isTest ? <StatusPill tone="neutral">{copy.test}</StatusPill> : null}
                  </div>
                  {item.applicantEmail ? <p className="text-xs text-[#94a3b8] break-all">{item.applicantEmail}</p> : null}
                  <div className="flex flex-wrap gap-1.5">
                    {[...new Set(item.signals.map((signal) => signal.reason))].map((reason) => (
                      <StatusPill key={reason} tone={toneFor(reason)}>{copy.reasons[reason]}</StatusPill>
                    ))}
                  </div>
                  {item.signals[0]?.detail ? (
                    <p className="max-w-3xl truncate text-xs text-[#64748b]" title={item.signals[0].detail}>{item.signals[0].detail}</p>
                  ) : null}
                  <p className="text-xs text-[#94a3b8]">
                    {copy.status}: {item.status ?? "-"}
                    {item.externalReference ? ` · ${copy.reference}: ${item.externalReference}` : ""}
                    {" · "}
                    {formatAdminDateTime(item.latestAt, locale, "-")}
                    {" · "}
                    <span className="font-mono">{item.applicationId.slice(0, 8)}</span>
                  </p>
                </div>
                <Link
                  href={`/admin/applications/${item.applicationId}#outcome-${item.applicationId}`}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold ${ACTION_REASONS.has(item.signals[0]?.reason) ? "bg-brand-500 text-white hover:bg-brand-600" : "border border-[#d7dce3] text-[#334155] hover:bg-[#f8fafc]"}`}
                >
                  {copy.open}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
