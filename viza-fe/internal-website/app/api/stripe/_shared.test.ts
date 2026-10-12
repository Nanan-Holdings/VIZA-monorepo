import { describe, expect, it, vi } from "vitest";
import {
  settleLinkedOrderAfterConfirmedPayment,
  type PaymentRecordRow,
} from "./_shared";

const record: PaymentRecordRow = {
  id: "payment-1",
  application_id: "application-1",
  applicant_id: "applicant-1",
  order_id: "order-1",
  visa_package_id: "package-1",
  provider: "stripe",
  provider_session_id: "cs_1",
  provider_payment_id: "pi_1",
  amount_cents: 5000,
  currency: "USD",
  status: "paid",
  fee_type: "agency_fee",
  receipt_url: null,
  metadata: null,
  created_at: null,
  updated_at: null,
};

function checkoutOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    application_id: "application-1",
    applicant_id: "applicant-1",
    agency_fee_cents: 10000,
    currency: "USD",
    status: "pending",
    metadata: {
      beta: { discount_cents: 5000 },
      checkout_payment: {
        provider: "stripe",
        expected_amount_minor: 5000,
        currency: "USD",
      },
    },
    paid_at: null,
    updated_at: null,
    ...overrides,
  };
}

function fakeAdmin(order: ReturnType<typeof checkoutOrder>) {
  const update = vi.fn();
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: order, error: null }) }),
    }),
    update: (payload: Record<string, unknown>) => {
      update(payload);
      return {
        eq: () => ({
          in: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: order.id }, error: null }),
            }),
          }),
        }),
      };
    },
  }));
  return { client: { from } as never, update };
}

describe("settleLinkedOrderAfterConfirmedPayment", () => {
  it("marks an exactly matching discounted checkout order paid", async () => {
    const admin = fakeAdmin(checkoutOrder());

    await expect(settleLinkedOrderAfterConfirmedPayment(admin.client, record)).resolves.toBe(true);
    expect(admin.update).toHaveBeenCalledWith(expect.objectContaining({ status: "paid" }));
  });

  it("fails closed when the webhook amount differs from the checkout snapshot", async () => {
    const admin = fakeAdmin(checkoutOrder());

    await expect(
      settleLinkedOrderAfterConfirmedPayment(admin.client, { ...record, amount_cents: 4999 }),
    ).rejects.toThrow("does not match");
    expect(admin.update).not.toHaveBeenCalled();
  });

  it("is idempotent when a matching order is already paid", async () => {
    const admin = fakeAdmin(checkoutOrder({ status: "paid" }));

    await expect(settleLinkedOrderAfterConfirmedPayment(admin.client, record)).resolves.toBe(true);
    expect(admin.update).not.toHaveBeenCalled();
  });

  it("does nothing for legacy agency payments without a linked order", async () => {
    const admin = fakeAdmin(checkoutOrder());

    await expect(
      settleLinkedOrderAfterConfirmedPayment(admin.client, { ...record, order_id: null }),
    ).resolves.toBe(false);
    expect(admin.update).not.toHaveBeenCalled();
  });
});
