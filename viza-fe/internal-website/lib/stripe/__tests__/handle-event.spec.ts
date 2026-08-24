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

interface RpcCall {
  name: string;
  args: Record<string, unknown>;
}

function fakeAdmin(): {
  client: {
    from: (table: string) => unknown;
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  updates: UpdateCall[];
  rpcCalls: RpcCall[];
  selectStubs: Map<string, unknown>;
  setRpcError: (message: string | null) => void;
} {
  const updates: UpdateCall[] = [];
  const rpcCalls: RpcCall[] = [];
  const selectStubs = new Map<string, unknown>();
  let rpcError: { message: string } | null = null;

  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return Promise.resolve({ data: null, error: rpcError });
    },
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

  return {
    client,
    updates,
    rpcCalls,
    selectStubs,
    setRpcError(message) {
      rpcError = message ? { message } : null;
    },
  };
}

test("checkout.session.completed confirms order, entitlement and allocation atomically", async () => {
  const { client, updates, rpcCalls } = fakeAdmin();
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
  assert.equal(updates.length, 0);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, "confirm_submission_order_payment");
  assert.equal(rpcCalls[0].args.p_order_id, "ord_123");
  assert.equal(rpcCalls[0].args.p_provider_payment_id, "pi_test_xyz");
  assert.equal(rpcCalls[0].args.p_provider, "stripe");
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

test("checkout.session.completed fails closed when atomic confirmation fails", async () => {
  const { client, setRpcError } = fakeAdmin();
  setRpcError("allocation amount mismatch");

  await assert.rejects(
    applyStripeEvent(client as never, {
      id: "evt_test_rpc_failure",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_failure",
          payment_status: "paid",
          payment_intent: "pi_test_failure",
          amount_total: 9900,
          metadata: { order_id: "ord_failure" },
        },
      },
    }),
    /atomic order payment confirmation: allocation amount mismatch/,
  );
});

test("a delayed paid event does not revive a refunded order", async () => {
  const { client, updates, selectStubs } = fakeAdmin();
  selectStubs.set("order|id=ord_123", { status: "refunded" });
  const result = await applyStripeEvent(client as never, {
    id: "evt_delayed_paid",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_abc",
        payment_status: "paid",
        payment_intent: "pi_test_xyz",
        metadata: { order_id: "ord_123" },
      },
    },
  });
  assert.deepEqual(result, { kind: "ignored", type: "checkout.session.completed" });
  assert.equal(updates.length, 0);
});

for (const terminalStatus of ["partially_refunded", "disputed", "chargeback"] as const) {
  test(`a delayed paid event does not revive a ${terminalStatus} order`, async () => {
    const { client, updates, selectStubs, rpcCalls } = fakeAdmin();
    selectStubs.set("order|id=ord_123", { status: terminalStatus });

    const result = await applyStripeEvent(client as never, {
      id: `evt_delayed_${terminalStatus}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_abc",
          payment_status: "paid",
          payment_intent: "pi_test_xyz",
          metadata: { order_id: "ord_123" },
        },
      },
    });

    assert.deepEqual(result, { kind: "ignored", type: "checkout.session.completed" });
    assert.equal(updates.length, 0);
    assert.equal(rpcCalls.length, 0);
  });
}

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

test("charge.dispute.created marks order disputed + pauses submission_queue", async () => {
  const { client, updates, selectStubs } = fakeAdmin();
  selectStubs.set(
    "order|stripe_payment_intent_id=pi_test_xyz",
    { id: "ord_123", application_id: "app_456" },
  );
  const result = await applyStripeEvent(client as never, {
    id: "evt_test_5",
    type: "charge.dispute.created",
    data: {
      object: {
        id: "dp_test",
        payment_intent: "pi_test_xyz",
        reason: "fraudulent",
        status: "needs_response",
      },
    },
  });
  assert.deepEqual(result, { kind: "disputed", orderId: "ord_123" });
  assert.equal(updates.length, 2);
  assert.equal(updates[0].table, "order");
  assert.equal(updates[0].patch.status, "disputed");
  assert.equal(updates[1].table, "submission_queue");
  assert.equal(updates[1].patch.status, "paused_dispute");
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
