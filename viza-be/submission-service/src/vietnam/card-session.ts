import {
  parseVietnamFixedCardInput,
  redactVietnamFixedCard,
  type RedactedVietnamFixedCard,
  type VietnamFixedCard,
  type VietnamFixedCardInput,
} from "./fixed-card-payment";

export interface VietnamCardSession {
  applicationId: string;
  card: VietnamFixedCard;
  createdAt: number;
  expiresAt: number;
}

export interface VietnamCardSessionResult {
  applicationId: string;
  expiresAtIso: string;
  redactedCard: RedactedVietnamFixedCard;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const sessions = new Map<string, VietnamCardSession>();

function nowMs(): number {
  return Date.now();
}

function normalizeApplicationId(applicationId: string): string {
  const normalized = applicationId.trim();
  if (!normalized) {
    throw new Error("applicationId is required.");
  }
  return normalized;
}

function cleanupExpired(referenceTime = nowMs()): void {
  for (const [applicationId, session] of sessions.entries()) {
    if (session.expiresAt <= referenceTime) {
      sessions.delete(applicationId);
    }
  }
}

export function putVietnamCardSession(input: {
  applicationId: string;
  card: VietnamFixedCardInput;
  ttlMs?: number;
  referenceTimeMs?: number;
}): VietnamCardSessionResult {
  const applicationId = normalizeApplicationId(input.applicationId);
  const referenceTime = input.referenceTimeMs ?? nowMs();
  cleanupExpired(referenceTime);
  const ttlMs = Math.max(30_000, Math.min(input.ttlMs ?? DEFAULT_TTL_MS, 15 * 60 * 1000));
  const card = parseVietnamFixedCardInput(input.card);
  const session: VietnamCardSession = {
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

export function peekVietnamCardSession(applicationId: string, referenceTimeMs = nowMs()): VietnamCardSession | null {
  const normalized = normalizeApplicationId(applicationId);
  cleanupExpired(referenceTimeMs);
  return sessions.get(normalized) ?? null;
}

export function consumeVietnamCardSession(applicationId: string, referenceTimeMs = nowMs()): VietnamFixedCard | null {
  const session = peekVietnamCardSession(applicationId, referenceTimeMs);
  if (!session) return null;
  sessions.delete(session.applicationId);
  return session.card;
}

export function clearVietnamCardSessions(): void {
  sessions.clear();
}
