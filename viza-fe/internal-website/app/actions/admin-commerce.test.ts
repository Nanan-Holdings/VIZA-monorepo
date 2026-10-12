import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const createAdminClientMock = vi.hoisted(() => vi.fn());
const refundOrderLinesMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/rbac", () => ({ requireRole: requireRoleMock }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));
vi.mock("./refunds", () => ({ refundOrderLines: refundOrderLinesMock }));

import { executeApprovedRefund } from "./admin-commerce";

function fakeAdmin(options: {
  correlationWriteError?: string;
  correlationNoRow?: boolean;
  raceWinnerStatus?: string;
  raceWinnerRefundId?: string | null;
} = {}) {
  const refundRequest = {
    id: "request-1",
    application_id: "application-1",
    status: "approved",
    amount_cents: 5_000,
    currency: "CNY",
    stripe_refund_id: null as string | null,
  };
  const auditEvents: Array<Record<string, unknown>> = [];
  return {
    refundRequest,
    auditEvents,
    client: {
      from(table: string) {
        let operation = "select";
        let payload: Record<string, unknown> = {};
        const builder: Record<string, unknown> = {
          select() { return builder; },
          eq() { return builder; },
          maybeSingle: async () => {
            if (table === "refund_request" && operation === "update") {
              if (options.correlationWriteError) {
                return {
                  data: null,
                  error: { message: options.correlationWriteError },
                };
              }
              if (options.correlationNoRow) {
                if (options.raceWinnerStatus) {
                  refundRequest.status = options.raceWinnerStatus;
                  refundRequest.stripe_refund_id = options.raceWinnerRefundId ?? null;
                }
                return { data: null, error: null };
              }
              Object.assign(refundRequest, payload);
              return { data: { id: refundRequest.id }, error: null };
            }
            return {
              data: table === "refund_request"
                ? { ...refundRequest }
                : { id: "order-1", application_id: "application-1" },
              error: null,
            };
          },
          insert(value: Record<string, unknown>) {
            operation = "insert";
            payload = value;
            return builder;
          },
          update(value: Record<string, unknown>) {
            operation = "update";
            payload = value;
            return builder;
          },
          then(resolve: (value: { error: { message: string } | null }) => unknown) {
            if (operation === "insert" && table === "admin_command_events") {
              auditEvents.push(payload);
            }
            if (operation === "update" && table === "refund_request") {
              if (!options.correlationWriteError) Object.assign(refundRequest, payload);
              return Promise.resolve({
                error: options.correlationWriteError
                  ? { message: options.correlationWriteError }
                  : null,
              }).then(resolve);
            }
            return Promise.resolve({ error: null }).then(resolve);
          },
        };
        return builder;
      },
    },
  };
}

const input = {
  refundRequestId: "request-1",
  orderId: "order-1",
  lineIds: ["line-1"],
  reason: "Customer requested cancellation",
};

describe("executeApprovedRefund provider lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleMock.mockResolvedValue({ id: "admin-1" });
  });

  it.each(["wechat", "stripe"] as const)(
    "records %s provider acceptance without prematurely completing the request",
    async (provider) => {
      const admin = fakeAdmin();
      createAdminClientMock.mockReturnValue(admin.client);
      refundOrderLinesMock.mockResolvedValue({
        orderId: "order-1",
        provider,
        refundId: `${provider}-refund-1`,
        refundedCents: 5_000,
        currency: provider === "wechat" ? "CNY" : "USD",
        decisions: [],
      });

      const result = await executeApprovedRefund(input);

      expect(result.success).toBe(true);
      expect(admin.refundRequest.status).toBe("approved");
      // Legacy schema name: this is intentionally the provider-neutral
      // callback correlation id for both Stripe and WeChat.
      expect(admin.refundRequest.stripe_refund_id).toBe(`${provider}-refund-1`);
      expect(admin.auditEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({
          command: "refund.execute_accepted",
          after_state: expect.objectContaining({
            provider,
            status: "awaiting_provider_callback",
          }),
        }),
      ]));
    },
  );

  it("keeps an accepted refund retryable when correlation storage fails", async () => {
    const admin = fakeAdmin({ correlationWriteError: "temporary database error" });
    createAdminClientMock.mockReturnValue(admin.client);
    refundOrderLinesMock.mockResolvedValue({
      orderId: "order-1",
      provider: "wechat",
      refundId: "wechat-refund-1",
      refundedCents: 5_000,
      currency: "CNY",
      decisions: [],
    });

    const result = await executeApprovedRefund(input);

    expect(result).toMatchObject({
      success: false,
      error: "wechat refund wechat-refund-1 was accepted, but request state sync failed: temporary database error",
    });
    expect(admin.refundRequest.status).toBe("approved");
    expect(admin.refundRequest.stripe_refund_id).toBeNull();
  });

  it("accepts a Stripe callback that wins the correlation-write race", async () => {
    const admin = fakeAdmin({
      correlationNoRow: true,
      raceWinnerStatus: "refunded",
      raceWinnerRefundId: "stripe-refund-1",
    });
    createAdminClientMock.mockReturnValue(admin.client);
    refundOrderLinesMock.mockResolvedValue({
      orderId: "order-1",
      provider: "stripe",
      refundId: "stripe-refund-1",
      refundedCents: 5_000,
      currency: "USD",
      decisions: [],
    });

    await expect(executeApprovedRefund(input)).resolves.toMatchObject({ success: true });
    expect(admin.refundRequest.status).toBe("refunded");
  });
});
