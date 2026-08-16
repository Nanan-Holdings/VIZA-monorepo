/**
 * Durable PhotonPay card issuing for government-fee portal payments.
 *
 * The database owns idempotency and restart recovery. A card is scoped to one
 * application allocation/payment intent, not to an applicant or inbox. Only
 * the PhotonPay card id and a masked PAN are persisted; PAN, expiry, and CVV
 * stay in memory until the official payment form consumes them.
 */

import { createPhotonPayClient, isFailed, isSucceeded } from "../clients/photonpay.js";
import { routingFor } from "../payment-routing.js";
import {
  assertAttemptMatchesContext,
  defaultIssuerCardRepository,
  type IssuerCardAttempt,
  type IssuerCardRepository,
} from "./issuer-card-repository.js";

export type { IssuerCardRepository } from "./issuer-card-repository.js";

export interface EscrowCard {
  attemptId: string;
  cardId: string;
  /** Full PAN. Sensitive: never persist or log. */
  pan: string;
  /** MM/YY. Sensitive: never persist or log. */
  expiry: string;
  /** Sensitive: use once and never persist or log. */
  cvv: string;
  holderName: string;
}

export interface PhotonPayEscrowContext {
  applicationId: string;
  allocationId: string;
  officialFeePaymentIntentId: string;
  workerId: string;
  country: string;
  visaType: string;
}

export interface PhotonPayCardConfig {
  currency: string;
  bin: string;
  account: string;
}

export type EscrowCardOutcome = "consumed" | "cancelled" | "review_required";

export interface PhotonPayClientLike {
  openCard: NonNullable<ReturnType<typeof createPhotonPayClient>>["openCard"];
  getRequestResult: NonNullable<ReturnType<typeof createPhotonPayClient>>["getRequestResult"];
  getCardDetail: NonNullable<ReturnType<typeof createPhotonPayClient>>["getCardDetail"];
  getCvv: NonNullable<ReturnType<typeof createPhotonPayClient>>["getCvv"];
  freezeCard: NonNullable<ReturnType<typeof createPhotonPayClient>>["freezeCard"];
  cancelCard: NonNullable<ReturnType<typeof createPhotonPayClient>>["cancelCard"];
}

export interface PhotonPayEscrowDependencies {
  client?: PhotonPayClientLike | null;
  repository?: IssuerCardRepository;
  cardConfig?: PhotonPayCardConfig | null;
}

function envEnabled(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

export function resolvePhotonPayCardConfig(
  currency: string,
  env: NodeJS.ProcessEnv = process.env,
): PhotonPayCardConfig | null {
  const normalized = currency.trim().toUpperCase();
  if (!envEnabled(env.PHOTONPAY_ENABLED) || !["USD", "EUR", "GBP"].includes(normalized)) {
    return null;
  }

  const configuredBin = env[`PHOTONPAY_ISSUING_BIN_${normalized}`]?.trim();
  const configuredAccount = env[`PHOTONPAY_ISSUING_ACCOUNT_${normalized}`]?.trim();
  if (configuredBin && configuredAccount) {
    return { currency: normalized, bin: configuredBin, account: configuredAccount };
  }

  const legacyCurrency = env.PHOTONPAY_ISSUING_CURRENCY?.trim().toUpperCase();
  const legacyBin = env.PHOTONPAY_ISSUING_BIN?.trim();
  const legacyAccount = env.PHOTONPAY_ISSUING_ACCOUNT?.trim();
  return legacyCurrency === normalized && legacyBin && legacyAccount
    ? { currency: normalized, bin: legacyBin, account: legacyAccount }
    : null;
}

function cardholderId(): string | undefined {
  return process.env.PHOTONPAY_ISSUING_CARDHOLDER_ID?.trim() || undefined;
}

function cardholderName(): string {
  return process.env.PHOTONPAY_ISSUING_CARDHOLDER_NAME?.trim() || "VIZA";
}

function maskPan(pan: string | undefined): string {
  const compact = (pan ?? "").replace(/\s/g, "");
  return compact.length <= 10 ? "****" : `${compact.slice(0, 6)}******${compact.slice(-4)}`;
}

function normalizeCountry(country: string): string {
  const normalized = country.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["vn", "viet_nam"].includes(normalized)) return "vietnam";
  if (normalized === "id") return "indonesia";
  return normalized;
}

function normalizeVisaType(visaType: string): string {
  const normalized = visaType.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["VIETNAM_E_VISA", "E_VISA_TOURISM", "EVISA_TOURISM", "TOURIST_E_VISA", "TOURIST_EVISA"].includes(normalized)) {
    return "VN_E_VISA";
  }
  if (normalized === "C1_TOURIST") return "ID_C1_TOURIST";
  if (["B1_EVOA", "EVOA"].includes(normalized)) return "ID_B1_EVOA";
  return normalized;
}

function assertEligibleRouting(context: PhotonPayEscrowContext): void {
  const routing = routingFor(
    normalizeCountry(context.country),
    normalizeVisaType(context.visaType),
  );
  if (routing.mechanism !== "runner_escrow_card") {
    throw new Error(
      `PhotonPay issuing is forbidden for ${routing.country}/${routing.visaType} (${routing.mechanism})`,
    );
  }
}

async function recoverIssuedCard(
  client: PhotonPayClientLike,
  attempt: IssuerCardAttempt,
): Promise<{ cardId: string; pan?: string; expiry?: string; cvv?: string } | null> {
  if (attempt.issuer_card_id) {
    const detail = await client.getCardDetail(attempt.issuer_card_id);
    return {
      cardId: attempt.issuer_card_id,
      pan: detail.cardNo,
      expiry: detail.expirationDate,
      cvv: detail.cvv,
    };
  }
  const recovered = await client.getRequestResult(attempt.issuer_request_id);
  if (!isSucceeded(recovered.status) || !recovered.card?.cardId) return null;
  return {
    cardId: recovered.card.cardId,
    pan: recovered.card.cardNo,
    expiry: recovered.card.expirationDate,
    cvv: recovered.card.cvv,
  };
}

/**
 * Claim, issue, or recover the one card for an application payment attempt.
 * Returns null while PhotonPay is disabled. All card secrets remain in memory.
 */
export async function ensurePhotonPayEscrowCard(
  context: PhotonPayEscrowContext,
  dependencies: PhotonPayEscrowDependencies = {},
): Promise<EscrowCard | null> {
  const client = dependencies.client === undefined ? createPhotonPayClient() : dependencies.client;
  if (!client) return null;
  assertEligibleRouting(context);
  const repository = dependencies.repository ?? defaultIssuerCardRepository;
  const claimContext = { ...context, issuer: "photonpay" as const };
  const attempt = await repository.claim(claimContext);
  assertAttemptMatchesContext(attempt, claimContext);

  const cardConfig = dependencies.cardConfig ?? resolvePhotonPayCardConfig(attempt.currency);
  if (!cardConfig) {
    await repository.finish(
      attempt.id,
      context.workerId,
      "failed",
      "issuer_currency_unsupported",
      `PhotonPay has no exact BIN/account configuration for ${attempt.currency}`,
    );
    throw new Error(`PhotonPay issuer currency unsupported: ${attempt.currency}`);
  }
  const expectedCurrency = cardConfig.currency;
  if (attempt.currency !== expectedCurrency) {
    await repository.finish(
      attempt.id,
      context.workerId,
      "failed",
      "currency_not_supported",
      `Allocation currency ${attempt.currency} does not match PhotonPay card currency ${expectedCurrency}`,
    );
    throw new Error(`PhotonPay card currency mismatch: ${attempt.currency} allocation, ${expectedCurrency} card`);
  }

  let material: { cardId: string; pan?: string; expiry?: string; cvv?: string } | null = null;
  try {
    if (attempt.claim_count > 1 || attempt.issuer_card_id) {
      material = await recoverIssuedCard(client, attempt);
      if (!material) {
        await repository.finish(
          attempt.id,
          context.workerId,
          "review_required",
          "issuer_recovery_inconclusive",
          "PhotonPay did not return a terminal success for the existing request id",
        );
        throw new Error("PhotonPay issuance recovery is inconclusive; manual reconciliation is required");
      }
    } else {
      const opened = await client.openCard({
        requestId: attempt.issuer_request_id,
        cardBin: cardConfig.bin,
        cardCurrency: expectedCurrency,
        cardType: "share",
        cardholderId: cardholderId(),
        accountId: cardConfig.account,
        transactionLimitType: "limited",
        transactionLimit: attempt.limit_amount,
        nickname: `VIZA ${context.applicationId.slice(0, 8)} #${attempt.attempt_number}`,
      });
      if (isFailed(opened.status)) {
        await repository.finish(
          attempt.id,
          context.workerId,
          "cancelled",
          "issuer_declined",
          "PhotonPay returned a terminal issuance failure",
        );
        throw new Error("PhotonPay declined the virtual-card issuance request");
      }
      if (!isSucceeded(opened.status) || !opened.card?.cardId) {
        material = await recoverIssuedCard(client, attempt);
        if (!material) {
          await repository.finish(
            attempt.id,
            context.workerId,
            "review_required",
            "issuer_result_inconclusive",
            "PhotonPay issuance did not return or recover a terminal result",
          );
          throw new Error("PhotonPay issuance result is inconclusive; manual reconciliation is required");
        }
      } else {
        material = {
          cardId: opened.card.cardId,
          pan: opened.card.cardNo,
          expiry: opened.card.expirationDate,
          cvv: opened.card.cvv,
        };
      }
    }
  } catch (error) {
    if (material) throw error;
    if (error instanceof Error && /manual reconciliation|required|declined|currency mismatch/i.test(error.message)) {
      throw error;
    }
    try {
      material = await recoverIssuedCard(client, attempt);
    } catch {
      // The original failure remains authoritative; the attempt is quarantined below.
    }
    if (!material) {
      await repository.finish(
        attempt.id,
        context.workerId,
        "review_required",
        "issuer_transport_uncertain",
        error instanceof Error ? error.message : String(error),
      );
      throw new Error("PhotonPay issuance transport failed and recovery was inconclusive");
    }
  }

  const detail = material.pan && material.expiry
    ? material
    : await client.getCardDetail(material.cardId).then((value) => ({
        cardId: material?.cardId ?? value.cardId,
        pan: value.cardNo,
        expiry: value.expirationDate,
        cvv: value.cvv,
      }));
  const cvv = detail.cvv ?? await client.getCvv(detail.cardId);
  if (!detail.pan || !detail.expiry || !cvv) {
    await repository.finish(
      attempt.id,
      context.workerId,
      "review_required",
      "card_material_incomplete",
      "PhotonPay card details were incomplete",
    );
    throw new Error("PhotonPay returned incomplete card details");
  }

  await repository.markIssued(
    attempt.id,
    context.workerId,
    detail.cardId,
    maskPan(detail.pan),
    { request_status: "succeed", card_type: "share", transaction_limit: attempt.limit_amount },
  );
  await repository.markPortalProcessing(attempt.id, context.workerId);

  return {
    attemptId: attempt.id,
    cardId: detail.cardId,
    pan: detail.pan,
    expiry: detail.expiry,
    cvv,
    holderName: cardholderName(),
  };
}

/** Cancel/freeze the provider card and atomically transition its allocation. */
export async function finalizePhotonPayEscrowCard(
  card: Pick<EscrowCard, "attemptId" | "cardId">,
  workerId: string,
  outcome: EscrowCardOutcome,
  dependencies: PhotonPayEscrowDependencies = {},
): Promise<void> {
  const repository = dependencies.repository ?? defaultIssuerCardRepository;
  const finishWithoutClient = async (): Promise<void> => {
    if (outcome === "consumed") {
      await repository.finish(
        card.attemptId,
        workerId,
        "consumed",
        undefined,
        undefined,
        {
          provider_card_cancel_requested: false,
          provider_client_unavailable: true,
        },
      );
      return;
    }
    await repository.finish(
      card.attemptId,
      workerId,
      "review_required",
      "provider_client_unavailable",
      "PhotonPay client is unavailable; the issued card requires reconciliation",
      {
        provider_card_action_requested: false,
        provider_client_unavailable: true,
        requested_outcome: outcome,
      },
    );
  };

  let client: PhotonPayClientLike | null;
  try {
    client = dependencies.client === undefined ? createPhotonPayClient() : dependencies.client;
  } catch {
    await finishWithoutClient();
    return;
  }
  if (!client) {
    await finishWithoutClient();
    return;
  }

  if (outcome === "review_required") {
    try {
      await client.freezeCard(card.cardId, `${card.attemptId}-review`, "freeze");
    } catch {
      // The durable review state is more important than a best-effort freeze.
    }
    await repository.finish(
      card.attemptId,
      workerId,
      "review_required",
      "portal_result_uncertain",
      "Official payment result requires reconciliation before another card may be issued",
    );
    return;
  }

  try {
    await client.cancelCard(card.cardId);
  } catch (error) {
    if (outcome !== "consumed") {
      await repository.finish(
        card.attemptId,
        workerId,
        "review_required",
        "card_cancel_failed",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  await repository.finish(
    card.attemptId,
    workerId,
    outcome,
    undefined,
    undefined,
    { provider_card_cancel_requested: true },
  );
}
