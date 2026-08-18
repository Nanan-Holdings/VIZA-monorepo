import Link from "next/link";
import { getLocale } from "next-intl/server";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CreditCard,
  Headphones,
  ListTodo,
  ShieldAlert,
} from "lucide-react";
import {
  AdminEmptyState,
  AdminMetricCard,
  AdminPage,
  AdminPageHeader,
  AdminPriorityBadge,
  AdminSectionCard,
} from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface WorkRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  owning_team: string;
  assigned_to: string | null;
  due_at: string | null;
  application_id: string | null;
}

interface OperationalSignal {
  key: string;
  title: string;
  detail: string;
  href: string;
  severity: "critical" | "warning";
}

const COPY = {
  en: {
    title: "Operations control tower",
    subtitle: "What needs attention now—from purchase through official submission and result delivery.",
    openWork: "Open work",
    unassigned: "Unassigned",
    overdue: "SLA overdue",
    systemSignals: "System signals",
    provisioning: "Provisioning failures",
    submissions: "Submission failures",
    refunds: "Refunds & disputes",
    support: "Open support",
    portals: "Portal incidents",
    takeovers: "Takeovers",
    notificationFailures: "Notification failures",
    leads: "Open leads",
    privacy: "Privacy requests",
    appointments: "Appointment actions",
    operationalQueues: "Operational queues",
    operationalQueuesDescription: "Live workloads across customer, commercial, and platform operations.",
    queue: "Priority work",
    signals: "Exceptions not yet reconciled",
    noWork: "No open work items.",
    noSignals: "No active exception signals.",
    openQueue: "Open work queue",
    reconcile: "Reconcile these signals from the work queue.",
    dataWarning: "Some operational sources are unavailable in this environment.",
  },
  zh: {
    title: "运营控制台",
    subtitle: "从购买、资料处理到官方提交与结果交付，集中查看当前需要处理的事项。",
    openWork: "处理中工作",
    unassigned: "未分配",
    overdue: "已超时",
    systemSignals: "系统异常",
    provisioning: "开通失败",
    submissions: "提交失败",
    refunds: "退款与争议",
    support: "待处理客服",
    portals: "门户事故",
    takeovers: "人工接管",
    notificationFailures: "通知失败",
    leads: "待处理线索",
    privacy: "隐私请求",
    appointments: "预约操作",
    operationalQueues: "运营队列",
    operationalQueuesDescription: "客户、交易与平台运营的实时工作量。",
    queue: "优先工作",
    signals: "尚未同步为工作项的异常",
    noWork: "没有待处理工作项。",
    noSignals: "没有活动异常。",
    openQueue: "打开工作队列",
    reconcile: "请在工作队列中同步这些异常。",
    dataWarning: "当前环境中部分运营数据源不可用。",
  },
} as const;

function activeWork(status: string): boolean {
  return status !== "resolved" && status !== "cancelled";
}

export default async function AdminDashboardPage() {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [work, provisioning, runners, refunds, support, portals, takeovers, dlq, leads, privacy, appointments] = await Promise.all([
    admin.from("admin_work_items").select("id, title, status, priority, owning_team, assigned_to, due_at, application_id").order("priority").order("due_at", { ascending: true, nullsFirst: false }).limit(100),
    admin.from("payment_provisioning_jobs").select("id, order_id, status, last_error").in("status", ["retry", "dead_letter"]).limit(50),
    admin.from("runner_job").select("id, application_id, country, status, last_error").in("status", ["failed", "dead_letter", "needs_human"]).limit(50),
    admin.from("refund_request").select("id, application_id, status, reason").in("status", ["requested", "disputed"]).limit(50),
    admin.from("support_ticket").select("id, subject, status").not("status", "in", "(resolved,closed)").limit(100),
    admin.from("portal_health").select("country, status, error, note").in("status", ["degraded", "down"]).limit(50),
    admin.from("takeover_session").select("id, application_id, status, reason").in("status", ["queued", "claimed"]).limit(50),
    admin.from("notification_dlq").select("id, template_key, channel, error").is("replayed_at", null).limit(50),
    admin.from("marketing_leads").select("id, status").in("status", ["new", "contacted", "qualified"]).limit(100),
    admin.from("data_privacy_requests").select("id, status").in("status", ["requested", "pending", "processing"]).limit(100),
    admin.from("appointment_assistance_jobs").select("id, status").eq("requires_user_action", true).limit(100),
  ]);

  const sourceErrors = [work, provisioning, runners, refunds, support, portals, takeovers, dlq, leads, privacy, appointments]
    .map((result) => result.error?.message)
    .filter((message): message is string => Boolean(message));
  const workRows = ((work.data ?? []) as WorkRow[]).filter((row) => activeWork(row.status));
  const unassigned = workRows.filter((row) => !row.assigned_to).length;
  const overdue = workRows.filter((row) => Boolean(row.due_at && row.due_at < now)).length;
  const signalCount =
    (provisioning.data?.length ?? 0) +
    (runners.data?.length ?? 0) +
    (refunds.data?.length ?? 0) +
    (portals.data?.length ?? 0) +
    (takeovers.data?.length ?? 0) +
    (dlq.data?.length ?? 0) +
    (privacy.data?.length ?? 0) +
    (appointments.data?.length ?? 0);

  const signals: OperationalSignal[] = [];
  for (const row of (provisioning.data ?? []).slice(0, 3)) {
    signals.push({
      key: `provisioning-${row.id}`,
      title: `${copy.provisioning}: ${row.status}`,
      detail: row.last_error || `Order ${String(row.order_id).slice(0, 8)}`,
      href: "/admin/work",
      severity: row.status === "dead_letter" ? "critical" : "warning",
    });
  }
  for (const row of (runners.data ?? []).slice(0, 3)) {
    signals.push({
      key: `runner-${row.id}`,
      title: `${String(row.country).replaceAll("_", " ")} · ${row.status}`,
      detail: row.last_error || copy.submissions,
      href: `/admin/jobs/${row.id}`,
      severity: row.status === "dead_letter" ? "critical" : "warning",
    });
  }
  for (const row of (refunds.data ?? []).slice(0, 2)) {
    signals.push({
      key: `refund-${row.id}`,
      title: `${copy.refunds}: ${row.status}`,
      detail: row.reason,
      href: "/admin/billing",
      severity: row.status === "disputed" ? "critical" : "warning",
    });
  }
  for (const row of (portals.data ?? []).slice(0, 2)) {
    signals.push({
      key: `portal-${row.country}`,
      title: `${String(row.country).replaceAll("_", " ")} · ${row.status}`,
      detail: row.error || row.note || copy.portals,
      href: "/admin/portal-health",
      severity: row.status === "down" ? "critical" : "warning",
    });
  }
  for (const row of (takeovers.data ?? []).slice(0, 2)) {
    signals.push({
      key: `takeover-${row.id}`,
      title: copy.takeovers,
      detail: row.reason,
      href: `/admin/takeovers/${row.id}`,
      severity: "critical",
    });
  }

  const operationalQueues = [
    { label: copy.provisioning, value: provisioning.data?.length ?? 0, href: "/admin/work", icon: CreditCard, critical: true },
    { label: copy.submissions, value: runners.data?.length ?? 0, href: "/admin/metrics", icon: Bot, critical: true },
    { label: copy.support, value: support.data?.length ?? 0, href: "/admin/support", icon: Headphones, critical: false },
    { label: copy.portals, value: portals.data?.length ?? 0, href: "/admin/portal-health", icon: Activity, critical: true },
    { label: copy.leads, value: leads.data?.length ?? 0, href: "/admin/leads", icon: Headphones, critical: false },
    { label: copy.privacy, value: privacy.data?.length ?? 0, href: "/admin/privacy", icon: ShieldAlert, critical: true },
    { label: copy.appointments, value: appointments.data?.length ?? 0, href: "/admin/cal-bookings", icon: AlertTriangle, critical: true },
    { label: copy.refunds, value: refunds.data?.length ?? 0, href: "/admin/refunds", icon: CreditCard, critical: true },
    { label: copy.takeovers, value: takeovers.data?.length ?? 0, href: "/admin/takeovers", icon: Bot, critical: true },
    { label: copy.notificationFailures, value: dlq.data?.length ?? 0, href: "/admin/notifications/dlq", icon: Activity, critical: true },
  ];

  return (
    <AdminPage>
      <AdminPageHeader title={copy.title} description={copy.subtitle} />

      {sourceErrors.length > 0 ? (
        <details className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <summary className="cursor-pointer font-medium">{copy.dataWarning}</summary>
          <ul className="mt-2 space-y-1 font-mono text-xs text-amber-800">{sourceErrors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>
        </details>
      ) : null}

      <section className="admin-page-grid sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label={copy.openWork} value={workRows.length} href="/admin/work" icon={ListTodo} />
        <AdminMetricCard label={copy.unassigned} value={unassigned} href="/admin/work?view=unassigned" icon={Headphones} />
        <AdminMetricCard label={copy.overdue} value={overdue} href="/admin/work?view=overdue" icon={AlertTriangle} tone={overdue > 0 ? "critical" : "default"} />
        <AdminMetricCard label={copy.systemSignals} value={signalCount} href="/admin/work" icon={ShieldAlert} tone={signalCount > 0 ? "critical" : "default"} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminSectionCard title={copy.queue} actionHref="/admin/work" actionLabel={copy.openQueue}>
          {workRows.length === 0 ? (
            <AdminEmptyState>{copy.noWork}</AdminEmptyState>
          ) : (
            <ul className="divide-y">
              {workRows.slice(0, 8).map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-5 py-3">
                  <AdminPriorityBadge priority={row.priority} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.owning_team}{row.due_at ? ` · ${new Date(row.due_at).toLocaleString()}` : ""}</p>
                  </div>
                  <Link href="/admin/work" aria-label={row.title} className="text-muted-foreground hover:text-primary"><ArrowRight className="size-4" /></Link>
                </li>
              ))}
            </ul>
          )}
        </AdminSectionCard>

        <AdminSectionCard title={copy.operationalQueues} description={copy.operationalQueuesDescription}>
          <div className="grid sm:grid-cols-2">
            {operationalQueues.map((item) => (
              <Link key={item.label} href={item.href} className="group flex items-center gap-3 border-b px-4 py-3 transition-colors odd:sm:border-r hover:bg-muted/50">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:text-primary"><item.icon className="size-4" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                <Badge variant={item.critical && item.value > 0 ? "destructive" : "secondary"}>{item.value}</Badge>
              </Link>
            ))}
          </div>
        </AdminSectionCard>
      </div>

      <AdminSectionCard title={copy.signals} description={copy.reconcile}>
          {signals.length === 0 ? (
            <AdminEmptyState>{copy.noSignals}</AdminEmptyState>
          ) : (
            <ul className="divide-y">
              {signals.slice(0, 8).map((signal) => (
                <li key={signal.key}>
                  <Link href={signal.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50">
                    <span className={`size-2.5 shrink-0 rounded-full ${signal.severity === "critical" ? "bg-destructive" : "bg-amber-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{signal.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{signal.detail}</p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </AdminSectionCard>
    </AdminPage>
  );
}
