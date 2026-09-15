import assert from "node:assert/strict";
import { test } from "node:test";
import { createManagedPaymentHooks } from "../official-fee/managed-payment-hooks";
import { executeManagedPaymentBoundary } from "../runners/managed-payment-boundary";
import { ensureManagedOfficialFeeCard } from "../issuing/managed-card-provider";
import { ensurePhotonPayEscrowCard } from "../issuing/photonpay-card-provider";
import { ensureAirwallexEscrowCard } from "../issuing/airwallex-card-provider";
import { loadVietnamFixedCardFromEnv, payVietnamPortalWithFixedCard } from "../vietnam/fixed-card-payment";
import { putVietnamCardSession, vietnamCardSessionsEnabled } from "../vietnam/card-session";
import { putIndonesiaCardSession, indonesiaCardSessionsEnabled } from "../indonesia/card-session";
import { payAuWithEscrowCard } from "../au/payment";
import { payKhWithEscrowCard } from "../kh/payment";
import { payLaWithEscrowCard } from "../la/payment";
import { payLkWithEscrowCard } from "../lk/payment";
import { payInWithEscrowCard } from "../in/payment";
import { payZaWithEscrowCard } from "../za/payment";

test("removed payment hooks never acquire cards, query financial storage or invoke a portal adapter", async () => {
  const forbidden = async (): Promise<never> => { throw new Error("unexpected financial side effect"); };
  const hooks = createManagedPaymentHooks({ applicationId: "fixture", workerId: "fixture", country: "vietnam", visaType: "VN_E_VISA" }, {
    loadExecutionContext: forbidden, ensureCard: forbidden, finalizeCard: forbidden,
  });
  assert.equal(await hooks.takePaymentCard?.(), null);
  const result = await executeManagedPaymentBoundary({ country: "vietnam", visaType: "VN_E_VISA", adapter: { pay: forbidden }, hooks: { takePaymentCard: forbidden } });
  assert.equal(result.status, "managed_payment_adapter_unavailable");
  assert.match(result.reason, /payment_removed/);
  assert.equal(result.receiptId, null);
});

test("issuer and Vietnam payment entrypoints refuse before inspecting card data", async () => {
  for (const fn of [ensureManagedOfficialFeeCard, ensurePhotonPayEscrowCard, ensureAirwallexEscrowCard, payVietnamPortalWithFixedCard]) {
    await assert.rejects(() => fn(undefined as never), /payment_removed/);
  }
  assert.equal(loadVietnamFixedCardFromEnv({ VN_FIXED_CARD_ENABLED: "true" }), null);
  assert.equal(vietnamCardSessionsEnabled({ NODE_ENV: "development", VN_LOCAL_CARD_SESSION_ENABLED: "true", VN_CLOUD_CARD_SESSION_ENABLED: "true" }), false);
  assert.equal(indonesiaCardSessionsEnabled({ NODE_ENV: "development", ID_LOCAL_CARD_SESSION_ENABLED: "true" }), false);
  assert.throws(() => putVietnamCardSession(undefined as never), /payment_removed/);
  assert.throws(() => putIndonesiaCardSession(undefined as never), /payment_removed/);
});

test("legacy portal pay helpers report attention without touching a browser or returning paid", async () => {
  for (const fn of [payAuWithEscrowCard, payKhWithEscrowCard, payLaWithEscrowCard, payLkWithEscrowCard, payInWithEscrowCard, payZaWithEscrowCard]) {
    const result = await fn(undefined as never);
    assert.equal(result.status, "needs_human");
    assert.equal(result.portalReceiptId, null);
    assert.match(result.reason ?? "", /payment_removed/);
  }
});

test("card-session HTTP routes return 410 and never start runner work", async () => {
  process.env.SUPABASE_URL ??= "http://127.0.0.1:1";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "fixture-only-key";
  const { startHealthServer } = await import("../health-server");
  let workStarted = 0;
  const server = startHealthServer({ port: 0, isWorkerStarted: () => true, onWorkStart: () => { workStarted++; } });
  try {
    if (!server.listening) await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    for (const route of ["/local/vietnam/card-session", "/internal/vietnam/card-session", "/local/indonesia/card-session", "/internal/indonesia/card-session", "/internal/japan-vfs-sg/payment-session"]) {
      const response: Response = await fetch(`http://127.0.0.1:${address.port}${route}`, { method: "POST", body: "{}" });
      assert.equal(response.status, 410);
      assert.equal((await response.json() as { code: string }).code, "payment_removed");
    }
    assert.equal(workStarted, 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
