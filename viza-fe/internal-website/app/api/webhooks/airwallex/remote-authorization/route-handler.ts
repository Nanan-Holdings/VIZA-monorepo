import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_NONCE_MAX_AGE_MS = 5 * 60_000;

export interface AirwallexRemoteAuthorizationRequest {
  version: 2;
  accountId: string;
  cardId: string;
  cardTransactionEventId: string;
  cardTransactionLifecycleId: string;
  transactionType: "AUTHORIZATION" | "CLEARING";
  transactionCategory: string;
  transactionAmount: number;
  transactionCurrency: string;
}

export interface AirwallexAuthorizationCardContext {
  issuer: string;
  attemptStatus: string;
  currency: string;
  limitAmount: number;
  allocationState: string;
}

export interface AirwallexRemoteAuthorizationResponse {
  card_transaction_event_id: string;
  response_status: "AUTHORIZED" | "DECLINED";
  status_reason: string;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function verifyAirwallexRemoteAuthorizationSignature(input: {
  nonce: string | null;
  signature: string | null;
  sharedSecret: string;
  now?: number;
  maxAgeMs?: number;
}): boolean {
  const nonce = input.nonce?.trim();
  const signature = input.signature?.trim();
  if (!nonce || !signature || !input.sharedSecret) return false;

  const timestampText = nonce.split(".", 1)[0];
  const timestamp = Number(timestampText);
  const now = input.now ?? Date.now();
  const maxAgeMs = input.maxAgeMs ?? DEFAULT_NONCE_MAX_AGE_MS;
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > maxAgeMs) {
    return false;
  }

  const expected = Buffer.from(
    createHmac("sha256", input.sharedSecret).update(nonce).digest("base64"),
  );
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function parseAirwallexRemoteAuthorizationRequest(
  value: unknown,
): AirwallexRemoteAuthorizationRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const version = Number(payload.version);
  const accountId = nonEmptyString(payload.account_id);
  const cardId = nonEmptyString(payload.card_id);
  const eventId = nonEmptyString(payload.card_transaction_event_id);
  const lifecycleId = nonEmptyString(payload.card_transaction_lifecycle_id);
  const transactionType = nonEmptyString(payload.transaction_type)?.toUpperCase();
  const transactionCategory = nonEmptyString(payload.transaction_category)?.toUpperCase();
  const transactionAmount = Number(payload.transaction_amount);
  const transactionCurrency = nonEmptyString(payload.transaction_currency)?.toUpperCase();

  if (
    version !== 2 ||
    !accountId ||
    !cardId ||
    !eventId ||
    !lifecycleId ||
    (transactionType !== "AUTHORIZATION" && transactionType !== "CLEARING") ||
    !transactionCategory ||
    !Number.isFinite(transactionAmount) ||
    transactionAmount <= 0 ||
    !transactionCurrency ||
    !/^[A-Z]{3}$/.test(transactionCurrency)
  ) {
    return null;
  }

  return {
    version: 2,
    accountId,
    cardId,
    cardTransactionEventId: eventId,
    cardTransactionLifecycleId: lifecycleId,
    transactionType,
    transactionCategory,
    transactionAmount,
    transactionCurrency,
  };
}

function response(
  eventId: string,
  status: "AUTHORIZED" | "DECLINED",
  reason: string,
): AirwallexRemoteAuthorizationResponse {
  return {
    card_transaction_event_id: eventId,
    response_status: status,
    status_reason: reason,
  };
}

function sameMinorUnits(left: number, right: number): boolean {
  return Math.round(left * 100) === Math.round(right * 100);
}

export function decideAirwallexRemoteAuthorization(input: {
  request: AirwallexRemoteAuthorizationRequest;
  expectedAccountId: string;
  card: AirwallexAuthorizationCardContext | null;
  dailyLimit: number | null;
  dailyReservedAmount: number;
}): AirwallexRemoteAuthorizationResponse {
  const { request, card } = input;
  const decline = (reason: string) => response(
    request.cardTransactionEventId,
    "DECLINED",
    reason,
  );

  if (!input.expectedAccountId || request.accountId !== input.expectedAccountId) {
    return decline("account not authorized");
  }
  if (!card || card.issuer !== "airwallex") {
    return decline("card not issued by managed payment service");
  }
  if (request.transactionCategory !== "PURCHASE") {
    return decline("transaction category not authorized");
  }
  if (request.transactionCurrency !== card.currency.trim().toUpperCase()) {
    return decline("transaction currency does not match allocation");
  }
  if (!sameMinorUnits(request.transactionAmount, card.limitAmount)) {
    return decline("transaction amount does not match allocation");
  }

  if (request.transactionType === "AUTHORIZATION") {
    if (
      input.dailyLimit === null ||
      !Number.isFinite(input.dailyLimit) ||
      input.dailyLimit <= 0 ||
      input.dailyReservedAmount > input.dailyLimit
    ) {
      return decline("daily Airwallex safety limit is unavailable or exceeded");
    }
    if (card.attemptStatus !== "portal_processing" || card.allocationState !== "portal_processing") {
      return decline("card is not in active portal payment state");
    }
  } else if (
    !["portal_processing", "consumed"].includes(card.attemptStatus) ||
    !["portal_processing", "consumed"].includes(card.allocationState)
  ) {
    return decline("clearing is not linked to an active or consumed allocation");
  }

  return response(
    request.cardTransactionEventId,
    "AUTHORIZED",
    "exact managed government fee payment",
  );
}

export function parseAirwallexDailyLimits(value: string | undefined): ReadonlyMap<string, number> {
  const limits = new Map<string, number>();
  for (const entry of (value ?? "").split(",")) {
    if (!entry.trim()) continue;
    const [rawCurrency, rawAmount, ...extra] = entry.split(":");
    const currency = rawCurrency?.trim().toUpperCase();
    const amount = Number(rawAmount?.trim());
    if (
      extra.length > 0 ||
      !currency ||
      !/^[A-Z]{3}$/.test(currency) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.round(amount * 100) !== amount * 100
    ) {
      return new Map();
    }
    limits.set(currency, amount);
  }
  return limits;
}
