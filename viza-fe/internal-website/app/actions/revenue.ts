"use server";

import { withAdmin } from "@/lib/auth/with-admin";

/**
 * Operational ledger + revenue aggregates (PAY-007).
 *
 * `getRevenueDashboard()` returns the slice the /admin/revenue page
 * renders: MRR (paid agency-fee revenue, last 30 days), gross margin
 * per package (agency revenue minus the runner's third-party
 * spend), and a refund rate. Computed in TS over the order +
 * order_line tables; database-side roll-up can come later if the
 * volume justifies it.
 */

export interface PackageMargin {
  country: string;
  visaType: string;
  ordersPaid: number;
  agencyRevenueCents: number;
  thirdPartyCostsCents: number;
  refundsCents: number;
  grossMarginCents: number;
  currency: string;
}

export interface RevenueDashboard {
  mrrCents: number;
  mrrCurrency: string;
  ordersPaid30d: number;
  refundsCents30d: number;
  refundRate: number;
  packages: PackageMargin[];
  generatedAt: string;
}

interface OrderRow {
  application_id: string | null;
  status: string;
  agency_fee_cents: number;
  govt_fee_cents: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
}

interface LineRow {
  order_id: string;
  kind: string;
  amount_cents: number;
  currency: string;
}

interface AppRow {
  id: string;
  country: string;
  visa_type: string;
}

const MS_30D = 30 * 24 * 3600 * 1000;

export async function getRevenueDashboard(): Promise<RevenueDashboard> {
  return withAdmin("admin", "actions/revenue:getDashboard", async (admin) => {
    const since = new Date(Date.now() - MS_30D).toISOString();
    const { data: orders, error: orderErr } = await admin
      .from("order")
      .select(
        "id, application_id, status, agency_fee_cents, govt_fee_cents, currency, paid_at, created_at",
      )
      .gte("created_at", since);
    if (orderErr) throw new Error(`order fetch: ${orderErr.message}`);
    const orderRows = (orders ?? []) as Array<OrderRow & { id: string }>;
    const orderIds = orderRows.map((o) => o.id);

    const [{ data: lines }, { data: apps }] = await Promise.all([
      orderIds.length === 0
        ? Promise.resolve({ data: [] as LineRow[] })
        : admin
            .from("order_line")
            .select("order_id, kind, amount_cents, currency")
            .in("order_id", orderIds),
      admin
        .from("applications")
        .select("id, country, visa_type")
        .in(
          "id",
          orderRows
            .map((o) => o.application_id)
            .filter((v): v is string => Boolean(v)),
        ),
    ]);
    const lineRows = (lines ?? []) as LineRow[];
    const appRows = (apps ?? []) as AppRow[];
    const appById = new Map(appRows.map((a) => [a.id, a]));

    const linesByOrder = new Map<string, LineRow[]>();
    for (const l of lineRows) {
      const arr = linesByOrder.get(l.order_id) ?? [];
      arr.push(l);
      linesByOrder.set(l.order_id, arr);
    }

    const paid = orderRows.filter((o) =>
      ["paid", "submitted", "completed"].includes(o.status),
    );
    const refunded = orderRows.filter((o) => o.status === "refunded");

    let mrrCents = 0;
    let mrrCurrency = "USD";
    for (const o of paid) {
      mrrCents += o.agency_fee_cents;
      if (mrrCurrency === "USD") mrrCurrency = o.currency;
    }

    const refundsCents30d = refunded.reduce(
      (sum, o) => sum + o.agency_fee_cents,
      0,
    );

    const refundRate =
      paid.length + refunded.length === 0
        ? 0
        : refunded.length / (paid.length + refunded.length);

    // Per-package roll-up over the same window.
    const packageMap = new Map<string, PackageMargin>();
    for (const o of paid) {
      const app = o.application_id ? appById.get(o.application_id) : undefined;
      if (!app) continue;
      const key = `${app.country}|${app.visa_type}`;
      const cur = packageMap.get(key) ?? {
        country: app.country,
        visaType: app.visa_type,
        ordersPaid: 0,
        agencyRevenueCents: 0,
        thirdPartyCostsCents: 0,
        refundsCents: 0,
        grossMarginCents: 0,
        currency: o.currency,
      };
      cur.ordersPaid += 1;
      cur.agencyRevenueCents += o.agency_fee_cents;
      const tp = (linesByOrder.get(o.id) ?? [])
        .filter((l) => l.kind.startsWith("third_party_"))
        .reduce((s, l) => s + Math.abs(l.amount_cents), 0);
      cur.thirdPartyCostsCents += tp;
      packageMap.set(key, cur);
    }
    for (const o of refunded) {
      const app = o.application_id ? appById.get(o.application_id) : undefined;
      if (!app) continue;
      const key = `${app.country}|${app.visa_type}`;
      const cur = packageMap.get(key);
      if (!cur) continue;
      cur.refundsCents += o.agency_fee_cents;
    }
    for (const cur of packageMap.values()) {
      cur.grossMarginCents =
        cur.agencyRevenueCents - cur.thirdPartyCostsCents - cur.refundsCents;
    }

    return {
      mrrCents,
      mrrCurrency,
      ordersPaid30d: paid.length,
      refundsCents30d,
      refundRate,
      packages: Array.from(packageMap.values()).sort(
        (a, b) => b.agencyRevenueCents - a.agencyRevenueCents,
      ),
      generatedAt: new Date().toISOString(),
    };
  });
}
