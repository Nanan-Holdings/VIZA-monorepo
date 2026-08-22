export type ManagedCardIssuer = "photonpay" | "airwallex";

export interface IssuerCardClaimContext {
  applicationId: string;
  allocationId: string;
  officialFeePaymentIntentId: string;
  workerId: string;
  issuer: ManagedCardIssuer;
}

export interface IssuerCardAttempt {
  id: string;
  allocation_id: string;
  application_id: string;
  official_fee_payment_intent_id: string;
  attempt_number: number;
  issuer: ManagedCardIssuer;
  issuer_request_id: string;
  issuer_card_id: string | null;
  status: string;
  currency: string;
  limit_amount: number;
  masked_pan: string | null;
  claim_count: number;
}

export interface IssuerCardRepository {
  claim(context: IssuerCardClaimContext): Promise<IssuerCardAttempt>;
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

function parseAttempt(value: unknown): IssuerCardAttempt {
  const row = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | null;
  if (!row || typeof row.id !== "string" || typeof row.issuer_request_id !== "string") {
    throw new Error("Issuer-card RPC returned no attempt");
  }
  const issuer = String(row.issuer);
  if (issuer !== "photonpay" && issuer !== "airwallex") {
    throw new Error(`Issuer-card RPC returned unsupported issuer ${issuer}`);
  }
  return {
    id: row.id,
    allocation_id: String(row.allocation_id),
    application_id: String(row.application_id),
    official_fee_payment_intent_id: String(row.official_fee_payment_intent_id),
    attempt_number: Number(row.attempt_number),
    issuer,
    issuer_request_id: row.issuer_request_id,
    issuer_card_id: typeof row.issuer_card_id === "string" ? row.issuer_card_id : null,
    status: String(row.status),
    currency: String(row.currency).toUpperCase(),
    limit_amount: Number(row.limit_amount),
    masked_pan: typeof row.masked_pan === "string" ? row.masked_pan : null,
    claim_count: Number(row.claim_count),
  };
}

export const defaultIssuerCardRepository: IssuerCardRepository = {
  async claim(context) {
    const { supabase } = await import("../supabase.js");
    const { data, error } = await supabase.rpc("claim_issuer_card_attempt", {
      p_allocation_id: context.allocationId,
      p_application_id: context.applicationId,
      p_official_fee_payment_intent_id: context.officialFeePaymentIntentId,
      p_issuer: context.issuer,
      p_worker_id: context.workerId,
      p_lease_seconds: 900,
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

export function assertAttemptMatchesContext(
  attempt: IssuerCardAttempt,
  context: IssuerCardClaimContext,
): void {
  if (
    attempt.allocation_id !== context.allocationId ||
    attempt.application_id !== context.applicationId ||
    attempt.official_fee_payment_intent_id !== context.officialFeePaymentIntentId ||
    attempt.issuer !== context.issuer
  ) {
    throw new Error(
      "Issuer-card claim returned an issuer, allocation, application, or payment intent outside the requested execution context",
    );
  }
}
