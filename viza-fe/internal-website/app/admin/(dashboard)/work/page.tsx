import Link from "next/link";
import { getLocale } from "next-intl/server";
import { AlertTriangle, ArrowRight, Clock3, ListTodo, RefreshCw, UserCheck } from "lucide-react";
import {
  claimAdminWorkItem,
  syncAdminOperationalWorkItems,
  updateAdminWorkItem,
  type AdminWorkItemRow,
} from "@/app/actions/admin-work-items";
import { Button } from "@/components/ui/button";
import { getWorkItemSop, WORK_ITEM_STATUSES, type WorkItemStatus } from "@/lib/admin/work-item-sops";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams?: Promise<SearchParams>;
}

interface StaffRow {
  id: string;
  name: string | null;
  email: string | null;
}

interface ChecklistItem {
  label: string;
  completed: boolean;
}

const COPY = {
  en: {
    title: "Operations work queue",
    subtitle: "Every exception has an owner, deadline, SOP, evidence trail, and resolution.",
    sync: "Reconcile system signals",
    open: "Open",
    mine: "My work",
    unassigned: "Unassigned",
    overdue: "SLA overdue",
    all: "All",
    empty: "No work items match this view.",
    migration: "The work-item migration has not been applied to this environment yet.",
    owner: "Owner",
    team: "Team",
    due: "Due",
    unowned: "Unassigned",
    claim: "Claim",
    update: "Update",
    reason: "Reason for change",
    resolution: "Resolution code",
    notes: "Resolution notes",
    application: "Open application",
    sop: "SOP checklist",
  },
  zh: {
    title: "运营工作队列",
    subtitle: "每个异常都有负责人、时限、SOP、证据记录和解决结果。",
    sync: "同步系统异常",
    open: "处理中",
    mine: "我的工作",
    unassigned: "未分配",
    overdue: "已超时",
    all: "全部",
    empty: "此视图没有工作项。",
    migration: "当前环境尚未应用工作项数据库迁移。",
    owner: "负责人",
    team: "团队",
    due: "截止时间",
    unowned: "未分配",
    claim: "领取",
    update: "更新",
    reason: "变更原因",
    resolution: "解决代码",
    notes: "解决备注",
    application: "打开申请",
    sop: "SOP 检查清单",
  },
} as const;

function firstParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function isOpen(status: WorkItemStatus): boolean {
  return status !== "resolved" && status !== "cancelled";
}

function priorityClass(priority: string): string {
  if (priority === "p0") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "p1") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusClass(status: WorkItemStatus): string {
  if (status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "waiting_customer") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function parseChecklist(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ChecklistItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { label?: unknown }).label === "string" &&
      typeof (item as { completed?: unknown }).completed === "boolean",
  );
}

export default async function AdminWorkQueuePage({ searchParams }: PageProps) {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const params = (await searchParams) ?? {};
  const view = firstParam(params, "view") || "open";
  const currentUser = await getCurrentUser();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_work_items")
    .select("*")
    .order("priority", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(250);
  const { data: staffData } = await admin
    .from("users")
    .select("id, name, email")
    .in("role", ["admin", "staff", "customer_service"])
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const staff = (staffData ?? []) as StaffRow[];
  const names = new Map(staff.map((row) => [row.id, row.name || row.email || row.id.slice(0, 8)]));
  const allRows = ((data ?? []) as AdminWorkItemRow[]).filter((row) => {
    if (view === "all") return true;
    if (view === "mine") return isOpen(row.status) && row.assigned_to === currentUser?.id;
    if (view === "unassigned") return isOpen(row.status) && !row.assigned_to;
    if (view === "overdue") return isOpen(row.status) && Boolean(row.due_at && new Date(row.due_at) < new Date());
    return isOpen(row.status);
  });
  const rawRows = (data ?? []) as AdminWorkItemRow[];
  const metrics = {
    open: rawRows.filter((row) => isOpen(row.status)).length,
    unassigned: rawRows.filter((row) => isOpen(row.status) && !row.assigned_to).length,
    overdue: rawRows.filter(
      (row) => isOpen(row.status) && Boolean(row.due_at && new Date(row.due_at) < new Date()),
    ).length,
  };

  async function syncSignals() {
    "use server";
    await syncAdminOperationalWorkItems();
  }

  async function claimWork(formData: FormData) {
    "use server";
    await claimAdminWorkItem(String(formData.get("id")), "Claimed from the operations queue");
  }

  async function updateWork(formData: FormData) {
    "use server";
    const status = String(formData.get("status")) as WorkItemStatus;
    await updateAdminWorkItem({
      id: String(formData.get("id")),
      status,
      assignedTo: String(formData.get("assignedTo") || "") || null,
      resolutionCode: String(formData.get("resolutionCode") || ""),
      resolutionNotes: String(formData.get("resolutionNotes") || ""),
      reason: String(formData.get("reason") || "Status updated from the operations queue"),
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-brand-500" />
            <h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1>
          </div>
          <p className="mt-1 text-sm text-[#64748b]">{copy.subtitle}</p>
        </div>
        <form action={syncSignals}>
          <Button type="submit" variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {copy.sync}
          </Button>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { key: "open", label: copy.open, value: metrics.open, icon: ListTodo },
          { key: "mine", label: copy.mine, value: rawRows.filter((row) => isOpen(row.status) && row.assigned_to === currentUser?.id).length, icon: UserCheck },
          { key: "unassigned", label: copy.unassigned, value: metrics.unassigned, icon: UserCheck },
          { key: "overdue", label: copy.overdue, value: metrics.overdue, icon: AlertTriangle },
        ].map((metric) => (
          <Link
            key={metric.key}
            href={`/admin/work?view=${metric.key}`}
            className="rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm transition hover:border-brand-200"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#64748b]">{metric.label}</span>
              <metric.icon className="h-4 w-4 text-brand-500" />
            </div>
            <p className="mt-2 text-3xl font-semibold text-[#232323]">{metric.value}</p>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["open", copy.open],
          ["mine", copy.mine],
          ["unassigned", copy.unassigned],
          ["overdue", copy.overdue],
          ["all", copy.all],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/work?view=${key}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${view === key ? "border-brand-300 bg-brand-50 text-brand-600" : "border-[#e5e7eb] bg-white text-[#64748b]"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">{copy.migration}</p>
          <p className="mt-1 font-mono text-xs">{error.message}</p>
        </div>
      ) : allRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d7dce3] bg-white p-10 text-center text-sm text-[#64748b]">
          {copy.empty}
        </div>
      ) : (
        <div className="space-y-4">
          {allRows.map((item) => {
            const sop = getWorkItemSop(item.kind);
            const checklist = parseChecklist(item.checklist);
            const overdue = Boolean(item.due_at && isOpen(item.status) && new Date(item.due_at) < new Date());
            return (
              <article key={item.id} className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${priorityClass(item.priority)}`}>
                        {item.priority}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(item.status)}`}>
                        {item.status.replaceAll("_", " ")}
                      </span>
                      <span className="text-xs font-medium text-[#64748b]">{item.kind.replaceAll("_", " ")}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-[#232323]">{item.title}</h2>
                    {item.description ? <p className="mt-1 text-sm text-[#64748b]">{item.description}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#64748b]">
                      <span>{copy.team}: <strong className="text-[#334155]">{item.owning_team}</strong></span>
                      <span>{copy.owner}: <strong className="text-[#334155]">{item.assigned_to ? names.get(item.assigned_to) || item.assigned_to.slice(0, 8) : copy.unowned}</strong></span>
                      <span className={overdue ? "font-semibold text-red-700" : ""}>
                        <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                        {copy.due}: {item.due_at ? new Date(item.due_at).toLocaleString() : "—"}
                      </span>
                    </div>
                    {item.application_id ? (
                      <Link href={`/admin/applications/${item.application_id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                        {copy.application}<ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </div>

                  {!item.assigned_to && isOpen(item.status) ? (
                    <form action={claimWork}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button type="submit" className="gap-2"><UserCheck className="h-4 w-4" />{copy.claim}</Button>
                    </form>
                  ) : null}
                </div>

                {(checklist.length > 0 || sop) ? (
                  <details className="mt-4 rounded-lg border border-[#edf0f4] bg-[#fafbfc] p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-[#334155]">{copy.sop}</summary>
                    <ol className="mt-3 space-y-2 text-sm text-[#64748b]">
                      {(checklist.length > 0 ? checklist : (sop?.checklist || []).map((label) => ({ label, completed: false }))).map((step, index) => (
                        <li key={`${item.id}-${index}`} className="flex gap-2">
                          <span className="font-mono text-xs text-brand-500">{String(index + 1).padStart(2, "0")}</span>
                          <span>{step.label}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}

                {isOpen(item.status) ? (
                  <details className="mt-3 rounded-lg border border-[#edf0f4] p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-[#334155]">{copy.update}</summary>
                    <form action={updateWork} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <input type="hidden" name="id" value={item.id} />
                      <select name="status" defaultValue={item.status} className="h-10 rounded-md border px-3 text-sm">
                        {WORK_ITEM_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                      </select>
                      <select name="assignedTo" defaultValue={item.assigned_to || ""} className="h-10 rounded-md border px-3 text-sm">
                        <option value="">{copy.unowned}</option>
                        {staff.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}
                      </select>
                      <select name="resolutionCode" defaultValue={item.resolution_code || ""} className="h-10 rounded-md border px-3 text-sm">
                        <option value="">{copy.resolution}</option>
                        {(sop?.resolutionCodes || []).map((code) => <option key={code} value={code}>{code.replaceAll("_", " ")}</option>)}
                      </select>
                      <input name="reason" required placeholder={copy.reason} className="h-10 rounded-md border px-3 text-sm" />
                      <div className="flex gap-2">
                        <input name="resolutionNotes" placeholder={copy.notes} className="h-10 min-w-0 flex-1 rounded-md border px-3 text-sm" />
                        <Button type="submit">{copy.update}</Button>
                      </div>
                    </form>
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
