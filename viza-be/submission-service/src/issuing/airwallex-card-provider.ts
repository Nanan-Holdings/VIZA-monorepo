/** Durable, vault-free Airwallex adapter for managed government-fee cards. */

import {
  AirwallexConfigError,
  AirwallexIssuanceGuardError,
  createAirwallexIssuingClient,
  readAirwallexCurrencyMaximums,
} from "../clients/airwallex-issuing.js";
import { routingFor } from "../payment-routing.js";
import type { EscrowCard, EscrowCardOutcome } from "./photonpay-card-provider.js";
import {
  assertAttemptMatchesContext,
  defaultIssuerCardRepository,
  type IssuerCardRepository,
} from "./issuer-card-repository.js";

export interface AirwallexEscrowContext {
  applicationId: string;
  allocationId: string;
  officialFeePaymentIntentId: string;
  workerId: string;
  country: string;
  visaType: string;
}

export interface AirwallexClientLike {
  getIssuingConfig: NonNullable<ReturnType<typeof createAirwallexIssuingClient>>["getIssuingConfig"];
  createApplicationFeeCard: NonNullable<ReturnType<typeof createAirwallexIssuingClient>>["createApplicationFeeCard"];
  getSensitiveDetails: NonNullable<ReturnType<typeof createAirwallexIssuingClient>>["getSensitiveDetails"];
  freezeCard: NonNullable<ReturnType<typeof createAirwallexIssuingClient>>["freezeCard"];
}

export interface AirwallexEscrowDependencies {
  client?: AirwallexClientLike | null;
  repository?: IssuerCardRepository;
  now?: () => Date;
  env?: NodeJS.ProcessEnv;
}

function requiredEnv(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Airwallex issuing requires ${name}`);
  return value;
}

function windowMinutes(env: NodeJS.ProcessEnv): number {
  const value = Number(env.AIRWALLEX_ISSUING_CARD_EXPIRY_MINUTES);
  if (!Number.isSafeInteger(value) || value < 5 || value > 240) {
    throw new Error("AIRWALLEX_ISSUING_CARD_EXPIRY_MINUTES must be an integer from 5 to 240");
  }
  return value;
}

function awxTime(value: Date): string {
  return value.toISOString().replace("Z", "+0000");
}

function holderName(env: NodeJS.ProcessEnv): string {
  return env.AIRWALLEX_ISSUING_CARDHOLDER_NAME?.trim() || "VIZA";
}

function assertApplicationScopedAttempt(
  attempt: {
    application_id: string;
    allocation_id: string;
    attempt_number: number;
    issuer_request_id: string;
    currency: string;
    limit_amount: number;
  },
  env: NodeJS.ProcessEnv,
): void {
  const expectedRequestId =
    `viza-airwallex-${attempt.application_id}-${attempt.allocation_id}-${attempt.attempt_number}`;
  if (attempt.issuer_request_id !== expectedRequestId) {
    throw new Error(
      "Airwallex issuer request id is not application/allocation scoped",
    );
  }
  const currency = attempt.currency.trim().toUpperCase();
  const maximum = readAirwallexCurrencyMaximums(env)[currency];
  if (!maximum) {
    throw new Error(`Airwallex allocation currency ${currency || "(empty)"} is not allowlisted`);
  }
  const amountCents = Math.round(attempt.limit_amount * 100);
  if (
    !Number.isFinite(attempt.limit_amount) ||
    attempt.limit_amount <= 0 ||
    !Number.isSafeInteger(amountCents) ||
    Math.abs(amountCents / 100 - attempt.limit_amount) > Number.EPSILON
  ) {
    throw new Error("Airwallex allocation amount must be exact to at most two decimal places");
  }
  if (attempt.limit_amount > maximum) {
    throw new Error(`Airwallex allocation amount exceeds the ${currency} per-card maximum`);
  }
}

function maskPan(value: string): string {
  const compact = value.replace(/\s/g, "");
  if (compact.includes("*")) return compact;
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

function assertEligibleRouting(context: AirwallexEscrowContext): void {
  const routing = routingFor(
    normalizeCountry(context.country),
    normalizeVisaType(context.visaType),
  );
  if (routing.mechanism !== "runner_escrow_card") {
    throw new Error(
      `Airwallex issuing is forbidden for ${routing.country}/${routing.visaType} (${routing.mechanism})`,
    );
  }
}

export async function ensureAirwallexEscrowCard(
  context: AirwallexEscrowContext,
  dependencies: AirwallexEscrowDependencies = {},
): Promise<EscrowCard | null> {
  const client = dependencies.client === undefined
    ? createAirwallexIssuingClient()
    : dependencies.client;
  if (!client) return null;
  assertEligibleRouting(context);

  // Config Read must pass before the durable claim. A claim could otherwise
  // reserve an allocation for an account that would authorize on webhook
  // failure, defeating the remote-authorization fail-closed boundary.
  const issuingConfig = await client.getIssuingConfig();
  if (
    !issuingConfig.remoteAuthEnabled ||
    issuingConfig.remoteAuthDefaultAction !== "DECLINED" ||
    issuingConfig.remoteAuthVersion !== 2
  ) {
    throw new AirwallexIssuanceGuardError(
      "Airwallex Remote Auth version=2 must be enabled with default_action=DECLINED before card issuance",
    );
  }

  const repository = dependencies.repository ?? defaultIssuerCardRepository;
  const env = dependencies.env ?? process.env;
  const claimContext = { ...context, issuer: "airwallex" as const };
  const attempt = await repository.claim(claimContext);
  assertAttemptMatchesContext(attempt, claimContext);

  let cardId = attempt.issuer_card_id;
  try {
    assertApplicationScopedAttempt(attempt, env);
    if (!cardId) {
      const now = dependencies.now?.() ?? new Date();
      const created = await client.createApplicationFeeCard({
        applicationId: attempt.application_id,
        allocationId: attempt.allocation_id,
        officialFeePaymentIntentId: attempt.official_fee_payment_intent_id,
        attemptNumber: attempt.attempt_number,
        requestId: attempt.issuer_request_id,
        cardholderId: requiredEnv("AIRWALLEX_ISSUING_CARDHOLDER_ID", env),
        createdBy: env.AIRWALLEX_ISSUING_CREATED_BY?.trim() || "VIZA",
        currency: attempt.currency,
        exactAmount: attempt.limit_amount,
        activeFrom: awxTime(now),
        activeTo: awxTime(new Date(now.getTime() + windowMinutes(env) * 60_000)),
      });
      cardId = created.cardId;
      await repository.markIssued(
        attempt.id,
        context.workerId,
        cardId,
        maskPan(created.maskedNumber),
        {
          request_status: created.cardStatus,
          card_type: "virtual_single_use",
          transaction_limit: attempt.limit_amount,
          allowed_currency: attempt.currency,
        },
      );
    }

    const details = await client.getSensitiveDetails(cardId);
    if (!details.pan || !details.cvv || !details.expiryMonth || !details.expiryYear) {
      throw new Error("Airwallex returned incomplete card details");
    }
    if (attempt.issuer_card_id) {
      await repository.markIssued(
        attempt.id,
        context.workerId,
        cardId,
        maskPan(details.pan),
        { request_status: "recovered", allowed_currency: attempt.currency },
      );
    }
    await repository.markPortalProcessing(attempt.id, context.workerId);

    return {
      attemptId: attempt.id,
      cardId,
      pan: details.pan,
      expiry: `${details.expiryMonth.padStart(2, "0")}/${details.expiryYear.slice(-2)}`,
      cvv: details.cvv,
      holderName: holderName(env),
    };
  } catch (error) {
    const guardrailFailure =
      error instanceof AirwallexConfigError ||
      error instanceof AirwallexIssuanceGuardError ||
      (error instanceof Error && /Airwallex (?:allocation|issuer request)|AIRWALLEX_ISSUING_/i.test(error.message));
    await repository.finish(
      attempt.id,
      context.workerId,
      "review_required",
      guardrailFailure ? "issuer_guardrail_rejected" : "issuer_transport_uncertain",
      error instanceof Error ? error.message : String(error),
    );
    throw new Error(
      guardrailFailure
        ? "Airwallex issuance was rejected by managed-card guardrails"
        : "Airwallex issuance failed or card recovery was inconclusive",
    );
  }
}

export async function finalizeAirwallexEscrowCard(
  card: Pick<EscrowCard, "attemptId" | "cardId">,
  workerId: string,
  outcome: EscrowCardOutcome,
  dependencies: AirwallexEscrowDependencies = {},
): Promise<void> {
  const repository = dependencies.repository ?? defaultIssuerCardRepository;
  let client: AirwallexClientLike | null;
  try {
    client = dependencies.client === undefined
      ? createAirwallexIssuingClient()
      : dependencies.client;
  } catch (error) {
    await repository.finish(
      card.attemptId,
      workerId,
      "review_required",
      "card_cleanup_client_unavailable",
      error instanceof Error ? error.message : String(error),
    );
    throw new Error("Airwallex card cleanup client is unavailable");
  }
  if (!client) {
    await repository.finish(
      card.attemptId,
      workerId,
      "review_required",
      "card_cleanup_client_unavailable",
      "Airwallex issuing is disabled or incomplete during card cleanup",
    );
    throw new Error("Airwallex card cleanup client is unavailable");
  }

  try {
    await client.freezeCard(card.cardId);
  } catch (error) {
    await repository.finish(
      card.attemptId,
      workerId,
      "review_required",
      "card_freeze_failed",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }

  await repository.finish(
    card.attemptId,
    workerId,
    outcome,
    outcome === "review_required" ? "portal_result_uncertain" : undefined,
    outcome === "review_required"
      ? "Official payment result requires reconciliation before another card may be issued"
      : undefined,
    { provider_card_freeze_requested: true },
  );
}
