// @vitest-environment node

import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getUserFromSupabaseSession } = vi.hoisted(() => ({ getUserFromSupabaseSession: vi.fn() }));
vi.mock("@/lib/client-session", () => ({ getUserFromSupabaseSession }));
vi.mock("@/lib/impersonation-session", () => ({ getImpersonationSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/rbac", () => ({ requireAdmin: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));

import { getBillingOverview } from "@/app/client/billing/data";
import { getBillingCopy } from "@/app/client/billing/copy";

const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER_OWNER = "22222222-2222-4222-8222-222222222222";
type Row = Record<string, unknown>;
type ObservedRead = { method: string | undefined; table: string; query: URLSearchParams; returnedRows: number };

const payments = [
  { id: "agency-paid", applicant_id: OWNER, fee_type: "agency_fee", status: "paid", visa_package_id: "paid-package", created_at: "2026-09-09" },
  { id: "agency-pending", applicant_id: OWNER, fee_type: "agency_fee", status: "pending", visa_package_id: null, created_at: "2026-09-08" },
  { id: "official", applicant_id: OWNER, fee_type: "government_fee", status: "paid", visa_package_id: "excluded-package", created_at: "2026-09-07" },
  { id: "submission", applicant_id: OWNER, fee_type: "submission_checkout", status: "paid", visa_package_id: null, created_at: "2026-09-06" },
  { id: "subscription", applicant_id: OWNER, fee_type: "subscription_fee", status: "paid", visa_package_id: null, created_at: "2026-09-06" },
  { id: "one-time", applicant_id: OWNER, fee_type: "one_time_application_fee", status: "paid", visa_package_id: null, created_at: "2026-09-06" },
  { id: "binding", applicant_id: OWNER, fee_type: "payment_method_binding", status: "paid", visa_package_id: null, created_at: "2026-09-06" },
  { id: "null-fee", applicant_id: OWNER, fee_type: null, status: "paid", visa_package_id: null, created_at: "2026-09-05" },
  { id: "other-owner-official", applicant_id: OTHER_OWNER, fee_type: "government_fee", status: "paid", visa_package_id: "excluded-package", created_at: "2026-09-09" },
];
const applications = [OWNER, OTHER_OWNER].map((owner, index) => ({
  id: `application-${index}`, applicant_id: owner, visa_package_id: "unpaid-package",
  government_fee_cents: 2_500, government_fee_currency: "USD", government_fee_mode: "virtual_card",
}));
const invoices = [
  { id: "invoice-1", applicant_id: OWNER, payment_record_id: "agency-paid", status: "requested" },
  { id: "invoice-2", applicant_id: OTHER_OWNER, payment_record_id: null, status: "requested" },
];
const refunds = [
  { id: "refund-1", applicant_id: OWNER, payment_record_id: "official", status: "pending" },
  { id: "refund-2", applicant_id: OTHER_OWNER, payment_record_id: null, status: "pending" },
];

async function withLocalBilling(
  run: (reads: ObservedRead[]) => Promise<void>,
  failedTable?: string,
): Promise<void> {
  const reads: ObservedRead[] = [];
  const tables: Record<string, Row[]> = {
    payment_records: payments, applications, invoice_requests: invoices, refund_records: refunds,
    visa_packages: ["paid-package", "unpaid-package", "excluded-package"].map((id) => ({ id, name: id })),
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const table = url.pathname.replace("/rest/v1/", "");
    const query = url.searchParams;
    if (request.method !== "GET" || !tables[table]) {
      response.writeHead(405).end();
      return;
    }
    let data = tables[table];
    // Protocol fixture only: apply filters actually sent by the real SDK.
    // This does not measure PostgreSQL execution time or production capacity.
    for (const column of ["applicant_id", "fee_type"]) {
      const filter = query.get(column);
      if (filter?.startsWith("eq.")) data = data.filter((row) => row[column] === filter.slice(3));
    }
    const ids = query.get("id");
    if (ids?.startsWith("in.(")) {
      const selectedIds = ids.slice(4, -1).split(",");
      data = data.filter((row) => selectedIds.includes(String(row.id)));
    }
    if (query.get("order") === "created_at.desc") {
      data = data.toSorted((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
    }
    reads.push({ method: request.method, table, query, returnedRows: table === failedTable ? 0 : data.length });
    response.writeHead(table === failedTable ? 400 : 200, { "content-type": "application/json" });
    response.end(JSON.stringify(table === failedTable ? { code: "42703", message: "Synthetic query failure" } : data));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "local-billing-fixture-service-key");
    getUserFromSupabaseSession.mockResolvedValue({ userId: OWNER, email: "synthetic@viza.test" });
    await run(reads);
  } finally {
    server.closeAllConnections();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("billing reads through the Supabase SDK", () => {
  it("filters agency fees before transfer while retaining statuses, other records, and package sources", async () => {
    await withLocalBilling(async (reads) => {
      const result = await getBillingOverview("en");
      expect(result.error).toBeNull();
      expect(result.payments.map((payment) => payment.id)).toEqual(["agency-paid", "agency-pending"]);
      expect(result.applications).toEqual([applications[0]]);
      expect(result.invoiceRequests).toEqual([invoices[0]]);
      expect(result.refundRecords).toEqual([refunds[0]]);
      expect(result.packages.map((item) => item.id)).toEqual(["paid-package", "unpaid-package"]);
      expect(reads).toHaveLength(5);
      expect(reads.every((read) => read.method === "GET")).toBe(true);
      for (const read of reads.filter((read) => read.table !== "visa_packages")) {
        expect(read.query.get("applicant_id")).toBe(`eq.${OWNER}`);
      }
      const paymentRead = reads.find((read) => read.table === "payment_records");
      expect(paymentRead?.returnedRows).toBe(2);
      expect(paymentRead?.query.get("fee_type")).toBe("eq.agency_fee");
      expect(paymentRead?.query.get("order")).toBe("created_at.desc");
      expect(paymentRead?.query.has("status")).toBe(false);
      expect(paymentRead?.query.has("limit")).toBe(false);
    });
  });

  it("keeps an unpaid applicant's government disclosure, invoice and refund data without reusing another owner's data", async () => {
    await withLocalBilling(async (reads) => {
      await getBillingOverview("en");
      reads.length = 0;
      getUserFromSupabaseSession.mockResolvedValue({ userId: OTHER_OWNER, email: "other@viza.test" });
      const result = await getBillingOverview("en");
      expect(result.error).toBeNull();
      expect(result.payments).toEqual([]);
      expect(result.applications).toEqual([applications[1]]);
      expect(result.invoiceRequests).toEqual([invoices[1]]);
      expect(result.refundRecords).toEqual([refunds[1]]);
      expect(result.packages.map((item) => item.id)).toEqual(["unpaid-package"]);
      expect(reads.find((read) => read.table === "payment_records")?.returnedRows).toBe(0);
      expect(reads).toHaveLength(5);
    });
  });

  it.each(["en", "zh"])("retains localized all-or-nothing read errors (%s)", async (locale) => {
    await withLocalBilling(async (reads) => {
      const result = await getBillingOverview(locale);
      expect(result.error).toBe(getBillingCopy(locale).errors.loadRecords);
      expect([result.payments, result.applications, result.refundRecords, result.invoiceRequests, result.packages])
        .toEqual([[], [], [], [], []]);
      expect(reads.some((read) => read.table === "visa_packages")).toBe(false);
    }, "payment_records");
  });

  it("redirects unauthenticated callers without database requests", async () => {
    await withLocalBilling(async (reads) => {
      getUserFromSupabaseSession.mockResolvedValue(null);
      await expect(getBillingOverview("en")).rejects.toThrow("REDIRECT:/client/login?redirect=/client/billing");
      expect(reads).toEqual([]);
    });
  });
});
