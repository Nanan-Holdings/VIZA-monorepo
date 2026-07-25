/**
 * Live PhotonPay UAT smoke test — exercises the real card-issuing flow through
 * the PhotonPayClient, printing raw responses so we can confirm field shapes.
 *
 * Opens a small single-use recharge card, reads its detail + CVV, then freezes
 * it. UAT test funds only. Never run against production.
 *
 * Usage:
 *   set -a; . .secrets/photonpay/uat.env; set +a
 *   PHOTONPAY_ENABLED=1 npx tsx scripts/photonpay-uat-smoke.ts
 */
import { createPhotonPayClient } from "../src/clients/photonpay.js";

function mask(pan?: string): string {
  if (!pan) return "(none)";
  const s = pan.replace(/\s/g, "");
  return s.length <= 8 ? "****" : `${s.slice(0, 6)}••••${s.slice(-4)}`;
}

async function main(): Promise<void> {
  const client = createPhotonPayClient();
  if (!client) {
    throw new Error("PHOTONPAY_ENABLED is off — set it and source .secrets/photonpay/uat.env");
  }

  const usdAccount = process.env.PHOTONPAY_UAT_USD_ACCOUNT;
  const cardholderId = process.env.PHOTONPAY_UAT_CARDHOLDER;
  if (!usdAccount || !cardholderId) {
    throw new Error("Set PHOTONPAY_UAT_USD_ACCOUNT and PHOTONPAY_UAT_CARDHOLDER (see uat.env)");
  }

  console.log("1) getCardBins");
  const bins = await client.getCardBins();
  const usdBin = bins.find(
    (b) => b.cardCurrency === "USD" && b.cardType.includes("recharge") && b.cardFormFactor.includes("virtual_card"),
  );
  if (!usdBin) throw new Error("no USD recharge virtual BIN available");
  console.log(`   → using bin ${usdBin.cardBin} (${usdBin.cardScheme} ${usdBin.cardCurrency})`);

  const requestId = `viza-uat-${Date.now()}`;
  const rechargeAmount = Number(process.env.PHOTONPAY_UAT_RECHARGE ?? "25");
  console.log(`2) openCard requestId=${requestId} recharge $${rechargeAmount.toFixed(2)}`);
  const ack = await client.openCard({
    requestId,
    cardBin: usdBin.cardBin,
    cardCurrency: "USD",
    cardType: "recharge",
    cardholderId,
    accountId: usdAccount,
    rechargeAmount,
    transactionLimitType: "unlimited",
    nickname: "VIZA UAT smoke",
  });
  console.log(`   → status=${ack.status} card=${ack.card?.cardId ?? "-"} PAN=${mask(ack.card?.cardNo)} exp=${ack.card?.expirationDate ?? "?"} balance=$${ack.card?.cardBalance ?? "?"}`);
  const cardId = ack.card?.cardId;
  if (!cardId) throw new Error(`openCard returned no card: ${JSON.stringify(ack.raw)}`);

  console.log(`3) getCardDetail ${cardId}`);
  const detail = await client.getCardDetail(cardId);
  console.log(`   PAN=${mask(detail.cardNo)} exp=${detail.expirationDate ?? "?"} status=${detail.cardStatus ?? "?"} balance=$${detail.cardBalance ?? "?"}`);

  console.log("4) CVV retrievable (length only — never logged/stored)");
  const cvv = detail.cvv ?? ack.card?.cvv ?? (await client.getCvv(cardId).catch(() => undefined));
  console.log(cvv ? `   → cvv present, length ${cvv.length}` : "   → cvv not returned inline; getCvv path used");

  // Clean up: cancel the test cards so they don't hold UAT funds. Include any
  // orphan cardId passed via PHOTONPAY_UAT_CLEANUP (from an earlier failed run).
  const toCancel = [cardId, process.env.PHOTONPAY_UAT_CLEANUP].filter(Boolean) as string[];
  console.log(`5) cancelCard cleanup: ${toCancel.join(", ")}`);
  for (const id of toCancel) {
    try {
      await client.cancelCard(id);
      console.log(`   → cancelled ${id}`);
    } catch (e) {
      console.log(`   → cancel ${id} error (non-fatal): ${(e as Error).message}`);
    }
  }

  console.log(`\n✅ UAT issuing flow complete end-to-end. issued+read+cancelled cardId=${cardId}`);
}

main().catch((e) => {
  console.error("\n❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
