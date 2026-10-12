import { rejectRemovedPayment } from "../payment-removed.js";
import {
  type RedactedVietnamFixedCard,
  type VietnamFixedCard,
  type VietnamFixedCardInput
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
const sessions = new Map<string, VietnamCardSession>();

export function vietnamCardSessionsEnabled(
  _env: Record<string, string | undefined> = process.env,
): boolean {
  return false;
}

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

export function putVietnamCardSession(_input: {
  applicationId: string;
  card: VietnamFixedCardInput;
  ttlMs?: number;
  referenceTimeMs?: number;
}, _env: Record<string, string | undefined> = process.env): VietnamCardSessionResult {
  return rejectRemovedPayment();
}

export function peekVietnamCardSession(applicationId: string, referenceTimeMs = nowMs()): VietnamCardSession | null {
  const normalized = normalizeApplicationId(applicationId);
  cleanupExpired(referenceTimeMs);
  return sessions.get(normalized) ?? null;
}

export function consumeVietnamCardSession(_applicationId: string, _referenceTimeMs = nowMs()): VietnamFixedCard | null {
  return null;
}

/** Delete an unused card without returning its sensitive contents. */
export function discardVietnamCardSession(applicationId: string, referenceTimeMs = nowMs()): boolean {
  const normalized = normalizeApplicationId(applicationId);
  cleanupExpired(referenceTimeMs);
  return sessions.delete(normalized);
}

export function hasVietnamCardSessions(referenceTimeMs = nowMs()): boolean {
  cleanupExpired(referenceTimeMs);
  return sessions.size > 0;
}

export function clearVietnamCardSessions(): void {
  sessions.clear();
}
