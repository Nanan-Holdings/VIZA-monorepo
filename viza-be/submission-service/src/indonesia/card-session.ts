import {
  parseVietnamFixedCardInput,
  redactVietnamFixedCard,
  type RedactedVietnamFixedCard,
  type VietnamFixedCard,
  type VietnamFixedCardInput,
} from "../vietnam/fixed-card-payment";

export type IndonesiaOneTimeCard = VietnamFixedCard;
export type IndonesiaOneTimeCardInput = VietnamFixedCardInput;
export type RedactedIndonesiaOneTimeCard = RedactedVietnamFixedCard;

export interface IndonesiaCardSession {
  applicationId: string;
  card: IndonesiaOneTimeCard;
  createdAt: number;
  expiresAt: number;
}

export interface IndonesiaCardSessionResult {
  applicationId: string;
  expiresAtIso: string;
  redactedCard: RedactedIndonesiaOneTimeCard;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const sessions = new Map<string, IndonesiaCardSession>();

function nowMs(): number {
  return Date.now();
}

function normalizeApplicationId(applicationId: string): string {
  const normalized = applicationId.trim();
  if (!normalized) throw new Error("applicationId is required.");
  return normalized;
}

function cleanupExpired(referenceTime = nowMs()): void {
  for (const [applicationId, session] of sessions.entries()) {
    if (session.expiresAt <= referenceTime) {
      sessions.delete(applicationId);
    }
  }
}

export function putIndonesiaCardSession(input: {
  applicationId: string;
  card: IndonesiaOneTimeCardInput;
  ttlMs?: number;
  referenceTimeMs?: number;
}): IndonesiaCardSessionResult {
  const applicationId = normalizeApplicationId(input.applicationId);
  const referenceTime = input.referenceTimeMs ?? nowMs();
  cleanupExpired(referenceTime);
  const ttlMs = Math.max(30_000, Math.min(input.ttlMs ?? DEFAULT_TTL_MS, 15 * 60 * 1000));
  const card = parseVietnamFixedCardInput(input.card, {
    panLabel: "cardNumber",
    expiryLabel: "expiry",
    cvvLabel: "cvv",
  });
  if (!input.card.holderName?.trim() || card.holderName === "VIZA") {
    throw new Error("holderName is required for Indonesia official payment.");
  }
  const session: IndonesiaCardSession = {
    applicationId,
    card,
    createdAt: referenceTime,
    expiresAt: referenceTime + ttlMs,
  };
  sessions.set(applicationId, session);
  return {
    applicationId,
    expiresAtIso: new Date(session.expiresAt).toISOString(),
    redactedCard: redactVietnamFixedCard(card),
  };
}

export function peekIndonesiaCardSession(applicationId: string, referenceTimeMs = nowMs()): IndonesiaCardSession | null {
  const normalized = normalizeApplicationId(applicationId);
  cleanupExpired(referenceTimeMs);
  return sessions.get(normalized) ?? null;
}

export function consumeIndonesiaCardSession(applicationId: string, referenceTimeMs = nowMs()): IndonesiaOneTimeCard | null {
  const session = peekIndonesiaCardSession(applicationId, referenceTimeMs);
  if (!session) return null;
  sessions.delete(session.applicationId);
  return session.card;
}

export function clearIndonesiaCardSessions(): void {
  sessions.clear();
}
