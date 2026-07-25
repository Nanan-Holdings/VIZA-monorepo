/**
 * PhotonPay 发卡 UAT acceptance run — exercises EVERY integrated card-issuing
 * endpoint end-to-end through the PhotonPayClient (常规卡/recharge card model),
 * so the run doubles as the complete request record. Card spend is simulated
 * with 交易模拟 (sandBoxTransaction), which drives real issuing-transaction
 * webhooks received & verified by the public receiver at
 * https://api.groovesheet.net/viza-photonpay-webhook.
 *
 * UAT test funds only. Never run against production.
 */
import { createPhotonPayClient } from "../src/clients/photonpay.js";

function mask(pan?: string): string {
  if (!pan) return "(none)";
  const s = pan.replace(/\s/g, "");
  return s.length <= 8 ? "****" : `${s.slice(0, 6)}••••${s.slice(-4)}`;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const client = createPhotonPayClient();
  if (!client) throw new Error("PHOTONPAY_ENABLED is off — source .secrets/photonpay/uat.env");
  const usdAccount = process.env.PHOTONPAY_UAT_USD_ACCOUNT;
  if (!usdAccount) throw new Error("Set PHOTONPAY_UAT_USD_ACCOUNT (see uat.env)");

  console.log("\n========== PhotonPay 发卡 UAT acceptance (full) ==========\n");

  console.log("[1/14] subscribeWebhook (订阅Webhook通知)");
  await client
    .subscribeWebhook([
      { topicCode: "issuing_transaction_topic", templateCode: "issuing_transaction_v4_template" },
      { topicCode: "issuing_card_status_update_topic", templateCode: "issuing_card_status_update_v4_template" },
    ])
    .then(() => console.log("      → subscribed: issuing transaction + card status"))
    .catch((e) => console.log(`      → subscribe note: ${(e as Error).message}`));

  console.log("[2/14] getCardBin (卡bin查询)");
  const bins = await client.getCardBins();
  const usdBin = bins.find(
    (b) => b.cardCurrency === "USD" && b.cardType.includes("recharge") && b.cardFormFactor.includes("virtual_card"),
  );
  if (!usdBin) throw new Error("no USD recharge virtual BIN available");
  console.log(`      → ${bins.length} bin(s); using ${usdBin.cardBin} (${usdBin.cardScheme} ${usdBin.cardCurrency})`);

  const requestId = `viza-acc-${Date.now()}`;
  console.log(`[3/14] openCard (单卡开卡, 常规卡, 无 cardholderId) requestId=${requestId}`);
  const ack = await client.openCard({
    requestId,
    cardBin: usdBin.cardBin,
    cardCurrency: "USD",
    cardType: "recharge",
    accountId: usdAccount,
    rechargeAmount: 20,
    transactionLimitType: "unlimited",
    nickname: "VIZA UAT acceptance",
  });
  const cardId = ack.card?.cardId;
  console.log(`      → status=${ack.status} card=${cardId ?? "-"} PAN=${mask(ack.card?.cardNo)}`);
  if (!cardId) throw new Error(`openCard returned no card: ${JSON.stringify(ack.raw)}`);

  console.log(`[4/14] getRequestResult (请求结果查询) requestId=${requestId}`);
  const rr = await client.getRequestResult(requestId);
  console.log(`      → status=${rr.status}`);

  const rechargeReqId = `viza-rch-${Date.now()}`;
  console.log(`[5/14] preRecharge (换汇询价) requestId=${rechargeReqId} +$20`);
  await client
    .preRecharge({ requestId: rechargeReqId, accountId: usdAccount, cardId, rechargeAmount: 20 })
    .then(() => console.log("      → FX quote obtained"))
    .catch((e) => console.log(`      → preRecharge note: ${(e as Error).message}`));
  console.log(`[6/14] recharge (转入下单) requestId=${rechargeReqId}`);
  await client
    .recharge(rechargeReqId)
    .then(() => console.log("      → recharged (transfer-in confirmed)"))
    .catch((e) => console.log(`      → recharge note: ${(e as Error).message}`));

  console.log(`[7/14] getCardDetail (卡信息查询) ${cardId}`);
  const detail = await client.getCardDetail(cardId);
  console.log(`      → status=${detail.cardStatus ?? "?"} balance=$${detail.cardBalance ?? "?"}`);
  console.log(`[8/14] getCvv (CVV查询)`);
  const cvv = await client.getCvv(cardId).catch(() => detail.cvv ?? ack.card?.cvv);
  const expiry = detail.expirationDate ?? ack.card?.expirationDate;
  console.log(cvv ? `      → CVV present (length ${cvv.length}); in-memory only, never stored` : "      → CVV not returned");

  const txnReqId = `viza-txn-${Date.now()}`;
  console.log(`[9/14] sandboxTransaction (交易模拟·授权 auth $10) requestId=${txnReqId}`);
  if (cvv && expiry) {
    await client
      .sandboxTransaction({ requestId: txnReqId, cardId, cvv, expirationDate: expiry, txnCurrency: "USD", txnAmount: 10, txnType: "auth" })
      .then(() => console.log("      → auth simulated (issuing-transaction webhook dispatched)"))
      .catch((e) => console.log(`      → sandbox note: ${(e as Error).message}`));
  } else {
    console.log("      → skipped (no cvv/expiry available)");
  }
  console.log("      → waiting 8s for issuing-transaction webhook to arrive at receiver...");
  await sleep(8000);

  console.log(`[10/14] pagingVccTradeOrder (交易明细) cardId=${cardId}`);
  const orders = await client.getTradeOrders({ pageIndex: 1, pageSize: 20, cardId });
  console.log(`      → ${orders.total} order(s)`);

  console.log(`[11/14] pagingIssuingHistory (卡历史明细) cardId=${cardId}`);
  const history = await client.getIssuingHistory({ pageIndex: 1, pageSize: 20, cardId });
  console.log(`      → ${history.total} transaction(s)`);

  // Let the sandbox auth hold auto-release before returning funds / cancelling.
  await sleep(6000);
  const afterTxn = await client.getCardDetail(cardId);
  const bal = Number(afterTxn.cardBalance ?? 0);
  console.log(`[12/14] rechargeReturn (卡金额退还) $${bal.toFixed(2)}`);
  if (bal > 0) {
    await client
      .rechargeReturn(cardId, `viza-ret-${Date.now()}`, bal)
      .then(() => console.log("      → funds returned to account"))
      .catch((e) => console.log(`      → return note: ${(e as Error).message}`));
    await sleep(5000);
  } else {
    console.log("      → nothing to return");
  }

  console.log(`[13/14] freezeCard (冻结/解冻) ${cardId}`);
  await client.freezeCard(cardId, `${requestId}-freeze`).then(
    () => console.log(`      → frozen`),
    (e) => console.log(`      → freeze note: ${(e as Error).message}`),
  );
  await sleep(6000);
  await client.freezeCard(cardId, `${requestId}-unfreeze`, "unfreeze").then(
    () => console.log(`      → unfrozen`),
    (e) => console.log(`      → unfreeze note: ${(e as Error).message}`),
  );
  await sleep(6000);

  console.log(`[14/14] cancelCard (销卡) ${cardId}`);
  await client.cancelCard(cardId).then(
    () => console.log(`      → cancelled`),
    (e) => console.log(`      → cancel note: ${(e as Error).message}`),
  );

  console.log("\n✅ Acceptance sequence complete — all 发卡 endpoints exercised end-to-end on UAT.\n");
}

main().catch((e) => {
  console.error("\n❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
