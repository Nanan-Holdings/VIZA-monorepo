import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface OrderRow {
  id: string;
  application_id: string;
  agency_fee_cents: number;
  govt_fee_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface LineRow {
  id: string;
  kind: string;
  amount_cents: number;
  currency: string;
  payee: string;
  description: string | null;
}

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "TWD", "CLP", "ISK"]);

function formatAmount(cents: number, currency: string, locale: string): string {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL.has(upper)) return `${cents.toLocaleString(locale)} ${upper}`;
  return `${(cents / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${upper}`;
}

type OrderCopy = {
  order: string;
  back: string;
  status: string;
  paid: string;
  created: string;
  kind: string;
  description: string;
  payee: string;
  amount: string;
  total: string;
  downloadReceipt: string;
  b2bInvoice: string;
  company: string;
  taxId: string;
  vatPercent: string;
  billingAddress: string;
  downloadInvoice: string;
  notFound: string;
};

const COPY: Record<"en" | "zh", OrderCopy> = {
  en: {
    order: "Order",
    back: "Back",
    status: "Status",
    paid: "paid",
    created: "created",
    kind: "Kind",
    description: "Description",
    payee: "Payee",
    amount: "Amount",
    total: "Total",
    downloadReceipt: "Download receipt (PDF)",
    b2bInvoice: "Need a B2B invoice with company + tax ID?",
    company: "Company name",
    taxId: "Tax / VAT ID",
    vatPercent: "VAT % (optional)",
    billingAddress: "Billing address (optional)",
    downloadInvoice: "Download invoice (PDF)",
    notFound: "Order not found.",
  },
  zh: {
    order: "订单",
    back: "返回",
    status: "状态",
    paid: "支付于",
    created: "创建于",
    kind: "类型",
    description: "说明",
    payee: "收款方",
    amount: "金额",
    total: "合计",
    downloadReceipt: "下载收据（PDF）",
    b2bInvoice: "需要填写公司和税号的企业发票？",
    company: "公司名称",
    taxId: "税号 / VAT ID",
    vatPercent: "VAT 税率（可选）",
    billingAddress: "账单地址（可选）",
    downloadInvoice: "下载发票（PDF）",
    notFound: "未找到订单。",
  },
};

function getCopy(locale: string) {
  return locale.toLowerCase().startsWith("zh") ? COPY.zh : COPY.en;
}

function prettifyCode(value: string) {
  return value.replace(/_/g, " ");
}

function localizeStatus(value: string, locale: string) {
  const zh = locale.toLowerCase().startsWith("zh");
  const key = value.trim().toLowerCase();
  const labels: Record<string, [string, string]> = {
    pending: ["Pending", "处理中"],
    paid: ["Paid", "已支付"],
    failed: ["Failed", "失败"],
    cancelled: ["Cancelled", "已取消"],
    refunded: ["Refunded", "已退款"],
  };
  return labels[key]?.[zh ? 1 : 0] ?? (zh ? "处理中" : prettifyCode(value));
}

function localizeKind(value: string, locale: string) {
  const zh = locale.toLowerCase().startsWith("zh");
  const key = value.trim().toLowerCase();
  const labels: Record<string, [string, string]> = {
    agency_fee: ["Agency fee", "服务费"],
    government_fee: ["Official fee", "官方费用"],
    official_fee: ["Official fee", "官方费用"],
    service_fee: ["Service fee", "服务费"],
  };
  return labels[key]?.[zh ? 1 : 0] ?? (zh ? "费用项目" : prettifyCode(value));
}

export default async function ClientOrderPage({ params }: PageProps) {
  const { id } = await params;
  const locale = await getLocale();
  const copy = getCopy(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/client/login");

  const [{ data: order, error }, { data: lines }] = await Promise.all([
    supabase
      .from("order")
      .select(
        "id, application_id, agency_fee_cents, govt_fee_cents, currency, status, paid_at, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("order_line")
      .select("id, kind, amount_cents, currency, payee, description")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (error || !order) {
    return (
      <div className="w-full p-6 md:p-8 max-w-3xl mx-auto">
        <p className="text-sm text-[#6b6b6b]">{copy.notFound}</p>
      </div>
    );
  }

  const ord = order as OrderRow;
  const lineRows = (lines ?? []) as LineRow[];
  const total =
    lineRows.length > 0
      ? lineRows.reduce((s, l) => s + l.amount_cents, 0)
      : ord.agency_fee_cents + ord.govt_fee_cents;

  return (
    <div className="w-full py-6 md:py-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <Link
          href="/client/home"
          className="text-sm text-brand-500 hover:underline mb-1 inline-block"
        >
          &larr; {copy.back}
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-[#232323] break-all">{copy.order} {ord.id}</h1>
        <p className="text-sm text-[#6b6b6b]">
          {copy.status}: {localizeStatus(ord.status, locale)} ·{" "}
          {ord.paid_at
            ? `${copy.paid} ${new Date(ord.paid_at).toLocaleDateString(locale)}`
            : `${copy.created} ${new Date(ord.created_at).toLocaleDateString(locale)}`}
        </p>
      </div>

      <div className="bg-white rounded-lg border border-[#efefef] shadow-sm overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b bg-[#fafafa]">
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">{copy.kind}</th>
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">{copy.description}</th>
              <th className="text-left px-3 py-2 font-medium text-[#6b6b6b]">{copy.payee}</th>
              <th className="text-right px-3 py-2 font-medium text-[#6b6b6b]">{copy.amount}</th>
            </tr>
          </thead>
          <tbody>
            {lineRows.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-[#232323]">{localizeKind(l.kind, locale)}</td>
                <td className="px-3 py-2 text-[#232323]">
                  {l.description ?? l.payee}
                </td>
                <td className="px-3 py-2 text-[#6b6b6b]">{l.payee}</td>
                <td className="px-3 py-2 text-right font-mono text-[#232323]">
                  {formatAmount(l.amount_cents, l.currency, locale)}
                </td>
              </tr>
            ))}
            <tr className="bg-[#fafafa] font-medium">
              <td className="px-3 py-2" colSpan={3}>
                {copy.total}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatAmount(total, ord.currency, locale)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={`/api/orders/${ord.id}/receipt`}
          className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-[#d1d5db] text-sm hover:bg-[#fafafa]"
        >
          {copy.downloadReceipt}
        </a>
        <details className="text-sm">
          <summary className="cursor-pointer text-brand-500 hover:underline">
            {copy.b2bInvoice}
          </summary>
          <form
            method="get"
            action={`/api/orders/${ord.id}/receipt`}
            className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            <input type="hidden" name="mode" value="invoice" />
            <input
              name="company"
              placeholder={copy.company}
              required
              className="px-3 py-2 border rounded text-sm"
            />
            <input
              name="tax_id"
              placeholder={copy.taxId}
              required
              className="px-3 py-2 border rounded text-sm"
            />
            <input
              name="vat_percent"
              placeholder={copy.vatPercent}
              className="px-3 py-2 border rounded text-sm"
            />
            <input
              name="billing"
              placeholder={copy.billingAddress}
              className="px-3 py-2 border rounded text-sm"
            />
            <button
              type="submit"
              className="sm:col-span-2 px-4 py-2 rounded-md bg-black text-white text-sm"
            >
              {copy.downloadInvoice}
            </button>
          </form>
        </details>
      </div>
    </div>
  );
}
