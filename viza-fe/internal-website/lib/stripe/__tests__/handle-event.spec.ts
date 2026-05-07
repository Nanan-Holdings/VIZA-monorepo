/**
 * Integration test for the PAY-002 webhook handler.
 *
 * Uses fixed JSON shapes that mirror what `stripe trigger
 * checkout.session.completed` and `stripe trigger charge.refunded`
 * emit. We don't talk to Stripe — the goal is to prove the handler
 * applies the right DB writes given a known event.
 *
 * Run with:
 *   npx tsx --test lib/stripe/__tests__/handle-event.spec.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyStripeEvent } from "../handle-event";

interface UpdateCall {
  table: string;
  patch: Record<string, unknown>;
  where: Array<[string, unknown]>;
}

function fakeAdmin(): {
  client: {
    from: (table: string) => unknown;
  };
  updates: UpdateCall[];
  selectStubs: Map<string, unknown>;
} {
  const updates: UpdateCall[] = [];
  const selectStubs = new Map<string, unknown>();

  const client = {
    from(table: string) {
      let where: Array<[string, unknown]> = [];
      const builder: Record<string, unknown> = {
        select(_cols: string) {
          return builder;
        },
        eq(col: string, val: unknown) {
          where.push([col, val]);
          return builder;
        },
        maybeSingle() {
          const key = `${table}|${where.map((w) => `${w[0]}=${w[1]}`).join(",")}`;
          const stub = selectStubs.get(key) ?? null;
          return Promise.resolve({ data: stub, error: null });
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              updates.push({
                table,
                patch,
                where: [...where, [col, val]],
              });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
      return builder;
    },
  };

  return { client, updates, selectStubs };
}

test("checkout.session.completed marks order paid", async () => {
  const { client, updates } = fakeAdmin();
  const result = await applyStripeEvent(client as never, {
    id: "evt_test_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_abc",
        payment_status: "paid",
        payment_intent: "pi_test_xyz",
        amount_total: 9900,
        metadata: { order_id: "ord_123" },
      },
    },
  });
  assert.deepEqual(result, { kind: "paid", orderId: "ord_123" });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].table, "order");
  assert.equal(updates[0].patch.status, "paid");
  assert.equal(updates[0].patch.stripe_payment_intent_id, "pi_test_xyz");
  assert.deepEqual(updates[0].where, [["id", "ord_123"]]);
});

test("checkout.session.completed without payment_status=paid is ignored", async () => {
  const { client, updates } = fakeAdmin();
  const result = await applyStripeEvent(client as never, {
    id: "evt_test_2",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_abc",
        payment_status: "unpaid",
        metadata: { order_id: "ord_123" },
      },
    },
  });
  assert.equal(result.kind, "ignored");
  assert.equal(updates.length, 0);
});

test("charge.refunded marks order refunded", async () => {
  const { client, updates, selectStubs } = fakeAdmin();
  selectStubs.set(
    "order|stripe_payment_intent_id=pi_test_xyz",
    { id: "ord_123" },
  );
  const result = await applyStripeEvent(client as never, {
    id: "evt_test_3",
    type: "charge.refunded",
    data: {
      object: {
        payment_intent: "pi_test_xyz",
        refunded: true,
      },
    },
  });
  assert.deepEqual(result, { kind: "refunded", orderId: "ord_123" });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].table, "order");
  assert.equal(updates[0].patch.status, "refunded");
});

test("unknown event type is ignored without DB writes", async () => {
  const { client, updates } = fakeAdmin();
  const result = await applyStripeEvent(client as never, {
    id: "evt_test_4",
    type: "invoice.paid",
    data: { object: {} },
  });
  assert.equal(result.kind, "ignored");
  assert.equal(updates.length, 0);
});
