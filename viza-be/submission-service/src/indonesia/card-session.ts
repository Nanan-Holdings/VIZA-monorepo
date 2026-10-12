import { rejectRemovedPayment } from "../payment-removed.js";
import {
  type RedactedVietnamFixedCard,
  type VietnamFixedCard,
  type VietnamFixedCardInput
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
const sessions = new Map<string, IndonesiaCardSession>();

export function indonesiaCardSessionsEnabled(
  _env: Record<string, string | undefined> = process.env,
): boolean {
  return false;
}

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

export function putIndonesiaCardSession(_input: {
  applicationId: string;
  card: IndonesiaOneTimeCardInput;
  ttlMs?: number;
  referenceTimeMs?: number;
}, _env: Record<string, string | undefined> = process.env): IndonesiaCardSessionResult {
  return rejectRemovedPayment();
}

export function peekIndonesiaCardSession(applicationId: string, referenceTimeMs = nowMs()): IndonesiaCardSession | null {
  const normalized = normalizeApplicationId(applicationId);
  cleanupExpired(referenceTimeMs);
  return sessions.get(normalized) ?? null;
}

export function consumeIndonesiaCardSession(_applicationId: string, _referenceTimeMs = nowMs()): IndonesiaOneTimeCard | null {
  return null;
}

/** Delete an unused card without returning its sensitive contents. */
export function discardIndonesiaCardSession(applicationId: string, referenceTimeMs = nowMs()): boolean {
  const normalized = normalizeApplicationId(applicationId);
  cleanupExpired(referenceTimeMs);
  return sessions.delete(normalized);
}

export function hasIndonesiaCardSessions(referenceTimeMs = nowMs()): boolean {
  cleanupExpired(referenceTimeMs);
  return sessions.size > 0;
}

export function clearIndonesiaCardSessions(): void {
  sessions.clear();
}
