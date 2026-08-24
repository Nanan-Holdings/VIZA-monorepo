import { describe, expect, it } from "vitest";
import { evaluateSubmissionAccess } from "./submission-access";

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function fakeAdmin(seed: Tables) {
  const tables: Tables = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]),
  );

  return {
    tables,
    client: {
      async rpc() {
        return { data: 0, error: null };
      },
      from(table: string) {
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

describe("submission access evaluator", () => {
  it("requires both agency and electronic official fees for an unpaid standard account", async () => {
    const admin = fakeAdmin(baseTables());
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");
    expect(decision.status).toBe("payment_required");
    expect(decision.accessLevel).toBe("standard");
    expect(decision.agencyFee).toMatchObject({ status: "required", amountDueCents: 9_900 });
    expect(decision.officialFee).toMatchObject({ status: "required", amountDueCents: 2_500 });
  });

  it("waives only the agency fee and locks a valid high-access grant", async () => {
    const admin = fakeAdmin(baseTables({
      applicant_access_grants: [{
        id: "grant-1",
        auth_user_id: "user-1",
        status: "active",
        starts_at: "2026-01-01T00:00:00.000Z",
        expires_at: "2027-01-01T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
      }],
    }));
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");
    expect(decision.accessLevel).toBe("high");
    expect(decision.agencyFee).toMatchObject({ status: "waived", amountDueCents: 0 });
    expect(decision.officialFee.status).toBe("required");
    expect(admin.tables.application_submission_entitlements[0]).toMatchObject({
      access_grant_id: "grant-1",
      access_level: "high",
    });
    expect(admin.tables.application_submission_entitlements[0].grant_locked_at).toEqual(expect.any(String));
  });

  it("keeps an expired high-access grant out of new application quotes", async () => {
    const admin = fakeAdmin(baseTables({
      applicant_access_grants: [{
        id: "grant-expired",
        auth_user_id: "user-1",
        status: "active",
        starts_at: "2024-01-01T00:00:00.000Z",
        expires_at: "2025-01-01T00:00:00.000Z",
        created_at: "2024-01-01T00:00:00.000Z",
      }],
    }));
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");
    expect(decision.accessLevel).toBe("standard");
    expect(decision.agencyFee.status).toBe("required");
  });

  it("allows high access to submit a free official arrival declaration without checkout", async () => {
    const tables = baseTables({
      applications: [{
        id: "app-1",
        applicant_id: "profile-1",
        country: "south_korea",
        visa_type: "KR_E_ARRIVAL_CARD",
        purpose: null,
        visa_package_id: "package-1",
        government_fee_cents: 0,
        government_fee_currency: "USD",
      }],
      visa_packages: [{ id: "package-1", price_cents: 9_900, currency: "USD" }],
      applicant_access_grants: [{
        id: "grant-1",
        auth_user_id: "user-1",
        status: "active",
        starts_at: "2026-01-01T00:00:00.000Z",
        expires_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      }],
    });
    const decision = await evaluateSubmissionAccess(fakeAdmin(tables).client as never, "app-1");
    expect(decision.status).toBe("ready");
    expect(decision.agencyFee.status).toBe("waived");
    expect(decision.officialFee.status).toBe("not_required");
  });

  it("allows a standard account to submit an explicitly zero-priced Japan VJW package", async () => {
    const admin = fakeAdmin(baseTables({
      applications: [{
        id: "app-1",
        applicant_id: "profile-1",
        country: "japan",
        visa_type: "JP_VISIT_JAPAN_WEB",
        purpose: null,
        visa_package_id: "package-jp-vjw",
        group_id: null,
        government_fee_cents: null,
        government_fee_currency: "USD",
      }],
      visa_packages: [{
        id: "package-jp-vjw",
        price_cents: null,
        currency: "USD",
      }],
      package_pricing: [{
        visa_package_id: "package-jp-vjw",
        currency: "USD",
        government_fee_cents: 0,
        agency_fee_cents: 0,
        updated_at: "2026-08-24T00:00:00.000Z",
      }],
    }));

    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");

    expect(decision.status).toBe("ready");
    expect(decision.accessLevel).toBe("standard");
    expect(decision.agencyFee).toMatchObject({ status: "waived", amountDueCents: 0 });
    expect(decision.officialFee).toMatchObject({ status: "not_required", amountDueCents: 0 });
    expect(admin.tables.application_submission_entitlements[0]).toMatchObject({
      decision_status: "ready",
      agency_fee_status: "waived",
      official_fee_status: "not_required",
    });
  });

  it("preserves a high-access waiver already locked to the application", async () => {
    const admin = fakeAdmin(baseTables({
      application_submission_entitlements: [{
        application_id: "app-1",
        payer_auth_user_id: "user-1",
        access_level: "high",
        access_grant_id: "grant-revoked",
        grant_locked_at: "2026-08-01T00:00:00.000Z",
        agency_fee_status: "waived",
        agency_fee_amount_cents: 9_900,
        official_fee_status: "required",
        official_fee_amount_cents: 2_500,
        currency: "USD",
        order_id: null,
        payment_record_id: null,
        government_fee_allocation_id: null,
        decision_status: "payment_required",
        decision_reason: "official_fee_required",
        locked_at: null,
      }],
    }));
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");
    expect(decision.accessLevel).toBe("high");
    expect(decision.accessGrantId).toBe("grant-revoked");
    expect(decision.agencyFee.status).toBe("waived");
  });

  it("does not retain an old grant reference when high access was never locked", async () => {
    const admin = fakeAdmin(baseTables({
      application_submission_entitlements: [{
        application_id: "app-1",
        payer_auth_user_id: "user-1",
        access_level: "high",
        access_grant_id: "grant-old",
        grant_locked_at: null,
        agency_fee_status: "waived",
        agency_fee_amount_cents: 9_900,
        official_fee_status: "required",
        official_fee_amount_cents: 2_500,
        currency: "USD",
        order_id: null,
        payment_record_id: null,
        government_fee_allocation_id: null,
        decision_status: "payment_required",
        decision_reason: "official_fee_required",
        locked_at: null,
      }],
      applicant_access_grants: [],
    }));

    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");
    expect(decision.accessLevel).toBe("standard");
    expect(decision.accessGrantId).toBeNull();
    expect(admin.tables.application_submission_entitlements[0]).toMatchObject({
      access_level: "standard",
      access_grant_id: null,
    });
  });

  it("uses the group payer's high access for a dependant application", async () => {
    const admin = fakeAdmin(baseTables({
      applications: [{
        id: "app-1",
        applicant_id: "profile-1",
        country: "vietnam",
        visa_type: "VN_E_VISA",
        purpose: null,
        visa_package_id: null,
        group_id: "group-1",
        government_fee_cents: null,
        government_fee_currency: null,
      }],
      applicant_profiles: [{
        id: "profile-1",
        auth_user_id: null,
        dependant_of_user_id: "payer-1",
      }],
      application_group: [{ id: "group-1", payer_user_id: "payer-1" }],
      applicant_access_grants: [{
        id: "grant-payer",
        auth_user_id: "payer-1",
        status: "active",
        starts_at: "2026-01-01T00:00:00.000Z",
        expires_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
      }],
    }));
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1", {
      payerAuthUserId: "payer-1",
    });
    expect(decision.accessLevel).toBe("high");
    expect(decision.agencyFee.status).toBe("waived");
    expect(decision.officialFee.status).toBe("required");
  });

  it("accepts exact paid order and government allocation evidence", async () => {
    const admin = fakeAdmin(baseTables({
      order: [{
        id: "order-1",
        application_id: "app-1",
        status: "paid",
        agency_fee_cents: 9_900,
        govt_fee_cents: 2_500,
        currency: "USD",
        created_at: "2026-08-24T00:00:00.000Z",
      }],
      government_fee_allocations: [{
        id: "allocation-1",
        order_id: "order-1",
        order_line_id: "line-1",
        application_id: "app-1",
        amount_cents: 2_500,
        currency: "USD",
        state: "reserved",
        created_at: "2026-08-24T00:00:01.000Z",
      }],
    }));
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");
    expect(decision.status).toBe("ready");
    expect(decision.agencyFee.status).toBe("paid");
    expect(decision.officialFee.status).toBe("paid");
    expect(decision.orderId).toBe("order-1");
    expect(decision.allocationId).toBe("allocation-1");
  });

  it("recognizes an application-scoped legacy agency payment and collects only the official fee", async () => {
    const admin = fakeAdmin(baseTables({
      payment_records: [{
        id: "payment-1",
        application_id: "app-1",
        order_id: null,
        status: "paid",
        fee_type: "agency_fee",
        amount_cents: 9_900,
        currency: "USD",
        updated_at: "2026-08-24T00:00:00.000Z",
      }],
    }));
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");
    expect(decision.status).toBe("payment_required");
    expect(decision.agencyFee.status).toBe("paid");
    expect(decision.agencyFee.amountDueCents).toBe(0);
    expect(decision.officialFee.amountDueCents).toBe(2_500);
  });

  it("does not accept a payment belonging to another application", async () => {
    const admin = fakeAdmin(baseTables({
      payment_records: [{
        id: "payment-other",
        application_id: "app-other",
        order_id: null,
        status: "paid",
        fee_type: "agency_fee",
        amount_cents: 9_900,
        currency: "USD",
        updated_at: "2026-08-24T00:00:00.000Z",
      }],
    }));
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");
    expect(decision.agencyFee.status).toBe("required");
  });

  it("moves refunds and disputes to manual review", async () => {
    const admin = fakeAdmin(baseTables({
      order: [{
        id: "order-1",
        application_id: "app-1",
        status: "disputed",
        agency_fee_cents: 9_900,
        govt_fee_cents: 2_500,
        currency: "USD",
        created_at: "2026-08-24T00:00:00.000Z",
      }],
    }));
    const decision = await evaluateSubmissionAccess(admin.client as never, "app-1");
    expect(decision.status).toBe("review_required");
    expect(decision.agencyFee.status).toBe("review_required");
  });
});
