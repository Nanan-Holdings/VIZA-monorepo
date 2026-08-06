/**
 * Issue one PhotonPay UAT virtual card, validate it, then cancel it.
 *
 * This script is deliberately stricter than the normal provider:
 * - UAT host only;
 * - explicit operator confirmation;
 * - capped test amount;
 * - no applicant vault writes;
 * - no runner or official-portal imports;
 * - PAN, expiry, and CVV are never printed or persisted.
 *
 * It stops after card validation. It never performs a merchant or government
 * portal payment.
 */

import { createPhotonPayClient, isSucceeded, type CardBin } from "../src/clients/photonpay.js";

const UAT_BASE_URL = "https://x-api1.uat.photontech.cc";
const CONFIRMATION = "ISSUE_ONE_UAT_CARD";
const MAX_TEST_AMOUNT_USD = 25;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before running the issuance test`);
  return value;
}

function maskPan(pan?: string): string {
  if (!pan) return "(not returned)";
  const compact = pan.replace(/\s/g, "");
  return compact.length <= 10 ? "****" : `${compact.slice(0, 6)}••••${compact.slice(-4)}`;
}

function chooseUsdRechargeBin(bins: CardBin[]): CardBin {
  const requested = process.env.PHOTONPAY_UAT_CARD_BIN?.trim();
  const eligible = bins.filter(
    (bin) =>
      bin.cardCurrency === "USD" &&
      /recharge/i.test(bin.cardType) &&
      /virtual_card/i.test(bin.cardFormFactor),
  );
  const selected = requested ? eligible.find((bin) => bin.cardBin === requested) : eligible[0];
  if (!selected) {
    throw new Error(
      requested
        ? `PHOTONPAY_UAT_CARD_BIN=${requested} is not an eligible USD virtual recharge BIN`
        : "No eligible USD virtual recharge BIN is available",
    );
  }
  return selected;
}

async function main(): Promise<void> {
  const baseUrl = required("PHOTONPAY_BASE_URL").replace(/\/$/, "");
  if (baseUrl !== UAT_BASE_URL) {
    throw new Error(`Refusing to issue: PHOTONPAY_BASE_URL must be ${UAT_BASE_URL}`);
  }
  if (process.env.PHOTONPAY_ISSUANCE_TEST_CONFIRM !== CONFIRMATION) {
    throw new Error(
      `Refusing to issue: set PHOTONPAY_ISSUANCE_TEST_CONFIRM=${CONFIRMATION} explicitly`,
    );
  }

  const amount = Number(process.env.PHOTONPAY_ISSUANCE_TEST_AMOUNT ?? "20");
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_TEST_AMOUNT_USD) {
    throw new Error(`PHOTONPAY_ISSUANCE_TEST_AMOUNT must be > 0 and <= ${MAX_TEST_AMOUNT_USD}`);
  }

  const accountId = required("PHOTONPAY_UAT_USD_ACCOUNT");
  if (!/^FA-USD/i.test(accountId)) throw new Error("PHOTONPAY_UAT_USD_ACCOUNT must be a USD funding account");

  const client = createPhotonPayClient();
  if (!client) throw new Error("PHOTONPAY_ENABLED is off");

  const bins = await client.getCardBins();
  const bin = chooseUsdRechargeBin(bins);
  const requestId = `viza-issuance-test-${Date.now()}`;
  const cardholderId = process.env.PHOTONPAY_UAT_CARDHOLDER?.trim();
  let cardId: string | undefined;
  let cleanupError: Error | undefined;

  console.log("PhotonPay issuance-only test → UAT");
  console.log(`account=${accountId} bin=${bin.cardBin} currency=USD amount=${amount.toFixed(2)}`);
  console.log(`requestId=${requestId}`);

  try {
    const opened = await client.openCard({
      requestId,
      cardBin: bin.cardBin,
      cardCurrency: "USD",
      cardType: "recharge",
      ...(cardholderId ? { cardholderId } : {}),
      accountId,
      rechargeAmount: amount,
      transactionLimitType: "unlimited",
      nickname: "VIZA UAT issuance test",
    });
    cardId = opened.card?.cardId;
    if (!isSucceeded(opened.status) || !cardId) {
      throw new Error(`PhotonPay openCard did not succeed (status=${opened.status ?? "unknown"})`);
    }

    const recovered = await client.getRequestResult(requestId);
    if (recovered.card?.cardId !== cardId) {
      throw new Error("PhotonPay request-result recovery did not return the issued card");
    }

    const detail = await client.getCardDetail(cardId);
    const cvv = detail.cvv ?? (await client.getCvv(cardId));
    if (!cvv || !detail.expirationDate) throw new Error("Card detail/CVV validation incomplete");

    console.log(
      `issued cardId=${cardId} maskedPan=${maskPan(detail.cardNo)} ` +
        `status=${detail.cardStatus ?? "unknown"} balance=${detail.cardBalance ?? "unknown"}`,
    );
    console.log("validated PAN/CVV/expiry in memory only; official payment was not attempted");
  } finally {
    if (cardId) {
      try {
        await client.cancelCard(cardId);
        console.log(`cleanup=cancelled cardId=${cardId}`);
      } catch (error) {
        cleanupError = error instanceof Error ? error : new Error(String(error));
        console.error(`cleanup failed for cardId=${cardId}; do not use the card`);
      }
    }
  }

  if (cleanupError) throw cleanupError;
  console.log("STOP: no official portal navigation, card entry, or payment action occurred");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
