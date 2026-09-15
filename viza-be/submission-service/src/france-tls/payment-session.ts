import { rejectRemovedPayment } from "../payment-removed.js";

export interface FranceTlsPaymentInput {
  cardNumber: string;
  cvc: string;
  expMonth: string;
  expYear: string;
  holderName?: string | null;
}

export interface FranceTlsPaymentRedacted {
  brand: "visa" | "mastercard" | "amex" | "unknown";
  last4: string;
  expMonth: string;
  expYear: string;
  holderNamePresent: boolean;
}

export interface FranceTlsPaymentSession {
  id: string;
  jobId: string;
  expiresAt: number;
  redacted: FranceTlsPaymentRedacted;
}

interface StoredPaymentSession extends FranceTlsPaymentSession {
  payment: FranceTlsPaymentInput;
}

function normalizeCardNumber(value: string): string {
  return value.replace(/\D/gu, "");
}

function detectBrand(cardNumber: string): FranceTlsPaymentRedacted["brand"] {
  if (/^4/u.test(cardNumber)) return "visa";
  if (/^5[1-5]/u.test(cardNumber) || /^2(2[2-9]|[3-6]\d|7[01]|720)/u.test(cardNumber)) return "mastercard";
  if (/^3[47]/u.test(cardNumber)) return "amex";
  return "unknown";
}

export function redactFranceTlsPaymentInput(input: FranceTlsPaymentInput): FranceTlsPaymentRedacted {
  const normalized = normalizeCardNumber(input.cardNumber);
  return {
    brand: detectBrand(normalized),
    last4: normalized.slice(-4),
    expMonth: input.expMonth.padStart(2, "0"),
    expYear: input.expYear,
    holderNamePresent: Boolean(input.holderName?.trim()),
  };
}

export function createFranceTlsPaymentSessionStore(options: { now?: () => number } = {}) {
  const now = options.now ?? Date.now;
  const sessions = new Map<string, StoredPaymentSession>();

  return {
    create(_input: { jobId: string; ttlMs: number; payment: FranceTlsPaymentInput }): FranceTlsPaymentSession { return rejectRemovedPayment(); },

    consume(_sessionId: string, _jobId: string): FranceTlsPaymentInput | null { return null; },

    snapshot(): FranceTlsPaymentSession[] {
      return [...sessions.values()].map((session) => ({
        id: session.id,
        jobId: session.jobId,
        expiresAt: session.expiresAt,
        redacted: session.redacted,
      }));
    },
  };
}

export const franceTlsPaymentSessions = createFranceTlsPaymentSessionStore();
