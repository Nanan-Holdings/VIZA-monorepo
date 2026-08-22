/**
 * Issue one PhotonPay virtual card through the Open API, validate it, then
 * cancel it.
 *
 * This script is deliberately stricter than the normal provider:
 * - explicit, environment-specific operator confirmation;
 * - UAT recharge-card amount capped at USD 25;
 * - production cross-currency recharge-card arrival capped at USD 20.01;
 * - no applicant vault writes;
 * - no runner or official-portal imports;
 * - PAN, expiry, and CVV are never printed or persisted.
 *
 * It stops after card validation. It never performs a merchant or government
 * portal payment.
 */

import { createPhotonPayClient, isSucceeded, type CardBin } from "../src/clients/photonpay.js";

const UAT_BASE_URL = "https://x-api1.uat.photontech.cc";
const PROD_BASE_URL = "https://x-api.photonpay.com";
const UAT_CONFIRMATION = "ISSUE_ONE_UAT_CARD";
const PROD_CONFIRMATION = "ISSUE_ONE_PROD_CARD_AND_CANCEL";
const UAT_MAX_TEST_AMOUNT_USD = 25;
const PROD_MAX_TEST_AMOUNT_USD = 20.01;

interface IssuanceTarget {
  label: "UAT" | "production";
  confirmation: string;
  maxAmountUsd: number;
  amountMode: "recharge" | "arrival";
}

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

function resolveTarget(baseUrl: string): IssuanceTarget {
  if (baseUrl === UAT_BASE_URL) {
    return {
      label: "UAT",
      confirmation: UAT_CONFIRMATION,
      maxAmountUsd: UAT_MAX_TEST_AMOUNT_USD,
      amountMode: "recharge",
    };
  }
  if (baseUrl === PROD_BASE_URL) {
    return {
      label: "production",
      confirmation: PROD_CONFIRMATION,
      maxAmountUsd: PROD_MAX_TEST_AMOUNT_USD,
      amountMode: "arrival",
    };
  }
  throw new Error(
    `Refusing to issue: PHOTONPAY_BASE_URL must be ${UAT_BASE_URL} or ${PROD_BASE_URL}`,
  );
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
        ? "Requested BIN is not an eligible USD virtual recharge BIN"
        : "No eligible USD virtual recharge BIN is available",
    );
  }
  return selected;
}

async function main(): Promise<void> {
  const baseUrl = required("PHOTONPAY_BASE_URL").replace(/\/$/, "");
  const target = resolveTarget(baseUrl);
  if (process.env.PHOTONPAY_ISSUANCE_TEST_CONFIRM !== target.confirmation) {
    throw new Error(
      `Refusing to issue: set PHOTONPAY_ISSUANCE_TEST_CONFIRM=${target.confirmation} explicitly`,
    );
  }

  const defaultAmount = target.label === "production" ? "20.01" : "20";
  const amount = Number(process.env.PHOTONPAY_ISSUANCE_TEST_AMOUNT ?? defaultAmount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > target.maxAmountUsd) {
    throw new Error(
      `PHOTONPAY_ISSUANCE_TEST_AMOUNT must be > 0 and <= ${target.maxAmountUsd}`,
    );
  }

  const accountId =
    target.label === "UAT"
      ? required("PHOTONPAY_UAT_USD_ACCOUNT")
      : required("PHOTONPAY_ISSUANCE_TEST_FUNDING_ACCOUNT");
  if (target.label === "UAT" && !/^FA-USD/i.test(accountId)) {
    throw new Error("PHOTONPAY_UAT_USD_ACCOUNT must be a USD funding account");
  }
  const cardType = process.env.PHOTONPAY_ISSUANCE_TEST_CARD_TYPE === "share"
    ? "share"
    : "recharge";
  const amountMode = /^FA-USD/i.test(accountId) ? "recharge" : target.amountMode;

  const client = createPhotonPayClient();
  if (!client) throw new Error("PHOTONPAY_ENABLED is off");

  const bins = await client.getCardBins();
  const bin = chooseUsdRechargeBin(bins);
  const requestId = `viza-${target.label.toLowerCase()}-issuance-test-${Date.now()}`;
  const cardholderId =
    process.env.PHOTONPAY_ISSUING_CARDHOLDER_ID?.trim() ||
    process.env.PHOTONPAY_UAT_CARDHOLDER?.trim();
  let cardId: string | undefined;
  let cleanupError: Error | undefined;

  console.log(`PhotonPay issuance-only test → ${target.label}`);
  console.log(
    `mode=${cardType}/${cardType === "share" ? "limited" : amountMode} ` +
      `bin=${bin.cardBin} currency=USD ` +
      `maxSpend=${amount.toFixed(2)}`,
  );
  console.log(`requestId=${requestId}`);

  try {
    const opened = await client.openCard({
      requestId,
      cardBin: bin.cardBin,
      cardCurrency: "USD",
      cardType,
      ...(cardholderId ? { cardholderId } : {}),
      accountId,
      ...(cardType === "share"
        ? { transactionLimitType: "limited" as const, transactionLimit: amount }
        : amountMode === "recharge"
          ? { rechargeAmount: amount, transactionLimitType: "unlimited" as const }
          : { arrivalAmount: amount, transactionLimitType: "unlimited" as const }),
      nickname: `VIZA ${target.label} API pilot`,
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
