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
  officialFeePaymentIntentId: string;
  workerId: string;
  country: string;
  visaType: string;
}

export type EscrowCardOutcome = "consumed" | "cancelled" | "review_required";

interface IssuerCardAttempt {
  id: string;
  allocation_id: string;
  application_id: string;
  official_fee_payment_intent_id: string;
  attempt_number: number;
  issuer_request_id: string;
  issuer_card_id: string | null;
  status: string;
  currency: string;
  limit_amount: number;
  masked_pan: string | null;
  claim_count: number;
}

export interface PhotonPayClientLike {
  openCard: NonNullable<ReturnType<typeof createPhotonPayClient>>["openCard"];
  getRequestResult: NonNullable<ReturnType<typeof createPhotonPayClient>>["getRequestResult"];
  getCardDetail: NonNullable<ReturnType<typeof createPhotonPayClient>>["getCardDetail"];
  getCvv: NonNullable<ReturnType<typeof createPhotonPayClient>>["getCvv"];
  freezeCard: NonNullable<ReturnType<typeof createPhotonPayClient>>["freezeCard"];
  cancelCard: NonNullable<ReturnType<typeof createPhotonPayClient>>["cancelCard"];
}

export interface IssuerCardRepository {
  claim(context: PhotonPayEscrowContext): Promise<IssuerCardAttempt>;
  markIssued(
    attemptId: string,
    workerId: string,
    cardId: string,
    maskedPan: string,
    evidence: Record<string, unknown>,
  ): Promise<IssuerCardAttempt>;
  markPortalProcessing(attemptId: string, workerId: string): Promise<void>;
  finish(
    attemptId: string,
    workerId: string,
    outcome: "consumed" | "cancelled" | "failed" | "review_required",
    errorCode?: string,
    errorMessage?: string,
    evidence?: Record<string, unknown>,
  ): Promise<void>;
}

export interface PhotonPayEscrowDependencies {
  client?: PhotonPayClientLike | null;
  repository?: IssuerCardRepository;
}

function requiredConfig(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PhotonPay issuing requires ${name}`);
  return value;
}

function cardCurrency(): string {
  return (process.env.PHOTONPAY_ISSUING_CURRENCY ?? "USD").trim().toUpperCase();
}

function cardholderId(): string | undefined {
  return process.env.PHOTONPAY_ISSUING_CARDHOLDER_ID?.trim() || undefined;
}

function cardholderName(): string {
  return process.env.PHOTONPAY_ISSUING_CARDHOLDER_NAME?.trim() || "VIZA";
}

function allowPendingTreasury(): boolean {
  return process.env.PHOTONPAY_ISSUING_ALLOW_PENDING_TREASURY === "true";
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

function parseAttempt(value: unknown): IssuerCardAttempt {
  const row = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | null;
  if (!row || typeof row.id !== "string" || typeof row.issuer_request_id !== "string") {
    throw new Error("Issuer-card RPC returned no attempt");
  }
  return {
    id: row.id,
    allocation_id: String(row.allocation_id),
    application_id: String(row.application_id),
    official_fee_payment_intent_id: String(row.official_fee_payment_intent_id),
    attempt_number: Number(row.attempt_number),
    issuer_request_id: row.issuer_request_id,
    issuer_card_id: typeof row.issuer_card_id === "string" ? row.issuer_card_id : null,
    status: String(row.status),
    currency: String(row.currency).toUpperCase(),
    limit_amount: Number(row.limit_amount),
    masked_pan: typeof row.masked_pan === "string" ? row.masked_pan : null,
    claim_count: Number(row.claim_count),
  };
}

const defaultRepository: IssuerCardRepository = {
  async claim(context) {
    const { supabase } = await import("../supabase.js");
    const { data, error } = await supabase.rpc("claim_issuer_card_attempt", {
      p_application_id: context.applicationId,
      p_official_fee_payment_intent_id: context.officialFeePaymentIntentId,
      p_worker_id: context.workerId,
      p_lease_seconds: 900,
      p_allow_pending_treasury: allowPendingTreasury(),
    });
    if (error) throw new Error(`Could not claim issuer-card attempt: ${error.message}`);
    return parseAttempt(data);
  },

  async markIssued(attemptId, workerId, cardId, maskedPan, evidence) {
    const { supabase } = await import("../supabase.js");
    const { data, error } = await supabase.rpc("mark_issuer_card_issued", {
      p_attempt_id: attemptId,
      p_worker_id: workerId,
      p_issuer_card_id: cardId,
      p_masked_pan: maskedPan,
      p_provider_evidence_redacted: evidence,
    });
    if (error) throw new Error(`Could not persist issued card reference: ${error.message}`);
    return parseAttempt(data);
  },

  async markPortalProcessing(attemptId, workerId) {
    const { supabase } = await import("../supabase.js");
    const { error } = await supabase.rpc("mark_issuer_card_portal_processing", {
      p_attempt_id: attemptId,
      p_worker_id: workerId,
    });
    if (error) throw new Error(`Could not mark issuer card in portal use: ${error.message}`);
  },

  async finish(attemptId, workerId, outcome, errorCode, errorMessage, evidence = {}) {
    const { supabase } = await import("../supabase.js");
    const { error } = await supabase.rpc("finish_issuer_card_attempt", {
      p_attempt_id: attemptId,
      p_worker_id: workerId,
      p_outcome: outcome,
      p_error_code: errorCode ?? null,
      p_error_message: errorMessage ?? null,
      p_provider_evidence_redacted: evidence,
    });
    if (error) throw new Error(`Could not finish issuer-card attempt: ${error.message}`);
  },
};

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
  const repository = dependencies.repository ?? defaultRepository;
  const attempt = await repository.claim(context);

  const expectedCurrency = cardCurrency();
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
        cardBin: requiredConfig("PHOTONPAY_ISSUING_BIN"),
        cardCurrency: expectedCurrency,
        cardType: "share",
        cardholderId: cardholderId(),
        accountId: requiredConfig("PHOTONPAY_ISSUING_ACCOUNT"),
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
  const client = dependencies.client === undefined ? createPhotonPayClient() : dependencies.client;
  if (!client) return;
  const repository = dependencies.repository ?? defaultRepository;

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
