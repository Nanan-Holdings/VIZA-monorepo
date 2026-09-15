import { describe, expect, it } from "vitest";
import { evaluateSubmissionAccess } from "./submission-access";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function fakeAdmin(seed: Tables) {
  const tables: Tables = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
  );

  const reads: string[] = [];
  return {
    tables, reads,
    client: {
      async rpc() {
        return { data: 0, error: null };
      },
      from(table: string) {
        reads.push(table);
        let filters: Array<(row: Row) => boolean> = [];
        let limitCount: number | null = null;
        let write: Row | null = null;
        const rows = () => {
          const filtered = (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
          return limitCount === null ? filtered : filtered.slice(0, limitCount);
        };
        const result = () => ({ data: rows(), error: null });
        const builder = {
          select() {
            return builder;
          },
          eq(column: string, value: unknown) {
            filters.push((row) => row[column] === value);
            return builder;
          },
          in(column: string, values: readonly unknown[]) {
            filters.push((row) => values.includes(row[column]));
            return builder;
          },
          order() {
            return builder;
          },
          limit(count: number) {
            limitCount = count;
            return builder;
          },
          upsert(value: Row) {
            write = value;
            const existingIndex = (tables[table] ?? []).findIndex(
              (row) => row.application_id === value.application_id,
            );
            if (!tables[table]) tables[table] = [];
            if (existingIndex >= 0) tables[table][existingIndex] = { ...tables[table][existingIndex], ...value };
            else tables[table].push({ ...value });
            filters = [(row) => row.application_id === value.application_id];
            return builder;
          },
          maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
          single: async () => ({
            data: rows()[0] ?? write,
            error: rows()[0] || write ? null : { message: `${table} not found` },
          }),
          then(
            resolve: (value: { data: Row[]; error: null }) => unknown,
            reject?: (reason: unknown) => unknown,
          ) {
            return Promise.resolve(result()).then(resolve, reject);
          },
        };
        return builder;
      },
    },
  };
}

function baseTables(overrides: Tables = {}): Tables {
  return {
    applications: [{
      id: "app-1",
      applicant_id: "profile-1",
      country: "vietnam",
      visa_type: "VN_E_VISA",
      purpose: null,
      visa_package_id: null,
      group_id: null,
      government_fee_cents: null,
      government_fee_currency: null,
    }],
    applicant_profiles: [{ id: "profile-1", auth_user_id: "user-1", dependant_of_user_id: null }],
    applicant_access_grants: [],
    application_submission_entitlements: [],
    order: [],
    payment_records: [],
    government_fee_allocations: [],
    visa_packages: [],
    package_pricing: [],
    ...overrides,
  };
}

describe("submission access without payments", () => {
  it("allows an unpaid application without financial reads or writes", async () => {
    const admin = fakeAdmin(baseTables());
    const before = JSON.stringify(admin.tables);
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1", { payerAuthUserId: "user-1" });
    expect(decision).toMatchObject({ status: "ready", checkoutUrl: null, orderId: null, entitlementId: null });
    expect(decision.agencyFee).toMatchObject({ status: "not_required", amountDueCents: 0 });
    expect(decision.officialFee.status).not.toBe("paid");
    expect(admin.reads).toEqual(["applications", "applicant_profiles"]);
    expect(JSON.stringify(admin.tables)).toBe(before);
  });
  it("does not revive legacy checkout, refunds, or local payment overrides", async () => {
    const admin = fakeAdmin(baseTables({ order: [{ id: "old-order", application_id: "app-1", status: "refunded" }] }));
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1", { checkoutUrl: "https://checkout.example.test", allowDs160PaymentDefer: true });
    expect(decision.status).toBe("ready");
    expect(decision.checkoutUrl).toBeNull();
    expect(decision.paymentOverride).toBeUndefined();
    expect(admin.tables.order[0].status).toBe("refunded");
  });
  it("rejects another account before any mutation", async () => {
    const admin = fakeAdmin(baseTables());
    await expect(evaluateSubmissionAccess(admin.client as never, "app-1", { payerAuthUserId: "other-user" })).rejects.toThrow("does not own");
  });
  it("retains group ownership validation", async () => {
    const tables = baseTables({ application_group: [{ id: "group-1", payer_user_id: "group-owner" }] });
    tables.applications[0].group_id = "group-1";
    const admin = fakeAdmin(tables);
    await expect(evaluateSubmissionAccess(admin.client as never, "app-1", { payerAuthUserId: "user-1" })).rejects.toThrow("does not own");
    expect((await evaluateSubmissionAccess(admin.client as never, "app-1", { payerAuthUserId: "group-owner" })).status).toBe("ready");
  });
  it("fails closed for a missing application", async () => {
    const admin = fakeAdmin(baseTables());
    await expect(evaluateSubmissionAccess(admin.client as never, "missing")).rejects.toThrow("application lookup");
  });
});
