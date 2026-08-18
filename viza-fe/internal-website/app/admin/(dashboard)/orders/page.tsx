import Link from "next/link";
import { getLocale } from "next-intl/server";
import { AlertTriangle, ArrowRight, CreditCard, RefreshCw, Search } from "lucide-react";
import { retryPaymentProvisioning } from "@/app/actions/admin-commerce";
import { normalizeInterfaceLocale } from "@/lib/i18n/locale";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}
interface OrderRow {
  id: string;
  application_id: string;
  applicant_id: string;
  agency_fee_cents: number;
  govt_fee_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface ProvisioningRow {
  id: string;
  order_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  user_status: string;
  profile_status: string;
  application_status: string;
  inbox_status: string;
  allocation_status: string;
  runner_status: string;
  last_error: string | null;
  updated_at: string;
}

interface AllocationRow {
  order_id: string;
  state: string;
  amount_cents: number;
  currency: string;
}

interface RefundRow {
  application_id: string;
  status: string;
  amount_cents: number;
  currency: string;
}

const COPY = {
  en: {
    title: "Orders & payment operations",
    subtitle: "Commercial payment, account provisioning, official-fee allocation, and refund state in one workflow.",
    search: "Search order, application, or applicant ID",
    all: "All statuses",
    order: "Order",
    customer: "Applicant",
    amount: "Commercial total",
    provisioning: "Provisioning",
    officialFee: "Official-fee allocation",
    refund: "Refund / dispute",
    created: "Created",
    noOrders: "No orders match these filters.",
    retry: "Retry now",
    retryReason: "Required retry reason",
    steps: "Provisioning steps",
    attempts: "attempts",
    openCase: "Open case",
    unavailable: "Some commerce data could not be loaded.",
  },
  zh: {
    title: "订单与支付运营",
    subtitle: "集中查看商业付款、账户开通、官方费用分配和退款状态。",
    search: "搜索订单、申请或客户 ID",
    all: "全部状态",
    order: "订单",
    customer: "客户",
    amount: "商业付款总额",
    provisioning: "开通流程",
    officialFee: "官方费用分配",
    refund: "退款 / 争议",
    created: "创建时间",
    noOrders: "没有符合筛选条件的订单。",
    retry: "立即重试",
    retryReason: "必填的重试原因",
    steps: "开通步骤",
    attempts: "尝试次数",
    openCase: "打开案件",
    unavailable: "部分交易运营数据无法加载。",
  },
} as const;

function firstParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value) || "";
}

function tone(status: string): string {
  if (["paid", "completed", "succeeded", "consumed", "reserved"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["failed", "dead_letter", "disputed", "review_required"].includes(status)) return "border-red-200 bg-red-50 text-red-700";
  if (["retry", "requested", "pending", "reserved_pending_treasury"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const locale = normalizeInterfaceLocale(await getLocale());
  const copy = COPY[locale];
  const params = (await searchParams) ?? {};
  const q = firstParam(params, "q").toLowerCase();
  const status = firstParam(params, "status");
  const admin = createAdminClient();
  const [ordersResult, provisioningResult, allocationsResult, refundsResult] = await Promise.all([
    admin.from("order").select("id, application_id, applicant_id, agency_fee_cents, govt_fee_cents, currency, status, paid_at, created_at").order("created_at", { ascending: false }).limit(250),
    admin.from("payment_provisioning_jobs").select("id, order_id, status, attempts, max_attempts, user_status, profile_status, application_status, inbox_status, allocation_status, runner_status, last_error, updated_at").limit(250),
    admin.from("government_fee_allocations").select("order_id, state, amount_cents, currency").limit(250),
    admin.from("refund_request").select("application_id, status, amount_cents, currency").order("created_at", { ascending: false }).limit(250),
  ]);
  const errors = [ordersResult, provisioningResult, allocationsResult, refundsResult]
    .map((result) => result.error?.message)
    .filter((message): message is string => Boolean(message));
  const provisioningByOrder = new Map(((provisioningResult.data ?? []) as ProvisioningRow[]).map((row) => [row.order_id, row]));
  const allocationByOrder = new Map(((allocationsResult.data ?? []) as AllocationRow[]).map((row) => [row.order_id, row]));
  const refundsByApplication = new Map<string, RefundRow[]>();
  for (const refund of (refundsResult.data ?? []) as RefundRow[]) {
    refundsByApplication.set(refund.application_id, [...(refundsByApplication.get(refund.application_id) || []), refund]);
  }
  const orders = ((ordersResult.data ?? []) as OrderRow[]).filter((row) => {
    const matchesText = !q || [row.id, row.application_id, row.applicant_id].some((value) => value.toLowerCase().includes(q));
    return matchesText && (!status || row.status === status);
  });

  async function retryProvisioning(formData: FormData) {
    "use server";
    await retryPaymentProvisioning({
      jobId: String(formData.get("jobId")),
      reason: String(formData.get("reason")),
    });
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <div className="flex items-center gap-2"><CreditCard className="h-6 w-6 text-brand-500" /><h1 className="text-2xl font-semibold text-[#232323]">{copy.title}</h1></div>
        <p className="mt-1 text-sm text-[#64748b]">{copy.subtitle}</p>
      </div>

      {errors.length > 0 ? <details className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><summary className="cursor-pointer font-semibold">{copy.unavailable}</summary><ul className="mt-2 font-mono text-xs">{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></details> : null}

      <form method="get" className="flex flex-col gap-3 rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm md:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-[#94a3b8]" /><input name="q" defaultValue={q} placeholder={copy.search} className="h-10 w-full rounded-md border border-[#d7dce3] pl-9 pr-3 text-sm" /></label>
        <select name="status" defaultValue={status} className="h-10 rounded-md border border-[#d7dce3] bg-white px-3 text-sm"><option value="">{copy.all}</option>{["draft", "pending", "paid", "submitted", "completed", "refunded", "cancelled"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <button type="submit" className="h-10 rounded-md bg-[#232323] px-5 text-sm font-semibold text-white">{copy.search}</button>
      </form>

      {orders.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-[#64748b]">{copy.noOrders}</div> : (
        <div className="space-y-4">
          {orders.map((order) => {
            const provisioning = provisioningByOrder.get(order.id);
            const allocation = allocationByOrder.get(order.id);
            const refunds = refundsByApplication.get(order.application_id) || [];
            const total = order.agency_fee_cents + order.govt_fee_cents;
            return (
              <article key={order.id} className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone(order.status)}`}>{order.status}</span><span className="font-mono text-sm font-semibold text-[#334155]">{copy.order} {order.id.slice(0, 12)}</span></div>
                    <p className="mt-2 text-xs text-[#64748b]">{copy.customer}: <span className="font-mono">{order.applicant_id}</span></p>
                    <p className="mt-1 text-xs text-[#64748b]">{copy.created}: {new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-left lg:text-right"><p className="text-xs text-[#64748b]">{copy.amount}</p><p className="text-xl font-semibold text-[#232323]">{(total / 100).toFixed(2)} {order.currency}</p><Link href={`/admin/applications/${order.application_id}`} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">{copy.openCase}<ArrowRight className="h-3.5 w-3.5" /></Link></div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-[#fafbfc] p-3"><p className="text-xs font-semibold text-[#64748b]">{copy.provisioning}</p><span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tone(provisioning?.status || "not_started")}`}>{provisioning?.status || "not started"}</span>{provisioning ? <p className="mt-2 text-xs text-[#64748b]">{provisioning.attempts}/{provisioning.max_attempts} {copy.attempts}</p> : null}</div>
                  <div className="rounded-lg bg-[#fafbfc] p-3"><p className="text-xs font-semibold text-[#64748b]">{copy.officialFee}</p><span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${tone(allocation?.state || "not_allocated")}`}>{allocation?.state || "not allocated"}</span>{allocation ? <p className="mt-2 text-xs text-[#64748b]">{(allocation.amount_cents / 100).toFixed(2)} {allocation.currency}</p> : null}</div>
                  <div className="rounded-lg bg-[#fafbfc] p-3"><p className="text-xs font-semibold text-[#64748b]">{copy.refund}</p>{refunds.length === 0 ? <p className="mt-2 text-sm text-[#94a3b8]">—</p> : <div className="mt-2 flex flex-wrap gap-1">{refunds.map((refund, index) => <span key={`${refund.status}-${index}`} className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone(refund.status)}`}>{refund.status} · {(refund.amount_cents / 100).toFixed(2)} {refund.currency}</span>)}</div>}</div>
                </div>

                {provisioning ? <details className="mt-3 rounded-lg border border-[#edf0f4] p-3"><summary className="cursor-pointer text-sm font-semibold text-[#334155]">{copy.steps}</summary><div className="mt-3 flex flex-wrap gap-2">{[["user", provisioning.user_status], ["profile", provisioning.profile_status], ["application", provisioning.application_status], ["inbox", provisioning.inbox_status], ["allocation", provisioning.allocation_status], ["runner", provisioning.runner_status]].map(([label, value]) => <span key={label} className={`rounded-full border px-2 py-1 text-xs ${tone(value)}`}>{label}: {value}</span>)}</div>{provisioning.last_error ? <p className="mt-3 rounded bg-red-50 p-2 font-mono text-xs text-red-700"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{provisioning.last_error}</p> : null}{["retry", "dead_letter"].includes(provisioning.status) ? <form action={retryProvisioning} className="mt-3 flex flex-col gap-2 sm:flex-row"><input type="hidden" name="jobId" value={provisioning.id} /><input name="reason" required placeholder={copy.retryReason} className="h-9 flex-1 rounded-md border px-3 text-sm" /><button type="submit" className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand-500 px-4 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" />{copy.retry}</button></form> : null}</details> : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
