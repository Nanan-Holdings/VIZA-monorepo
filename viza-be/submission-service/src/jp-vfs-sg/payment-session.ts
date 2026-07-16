import { randomUUID } from "node:crypto";
import {
  parseVietnamFixedCardInput,
  redactVietnamFixedCard,
  type RedactedVietnamFixedCard,
  type VietnamFixedCard,
  type VietnamFixedCardInput,
} from "../vietnam/fixed-card-payment";

interface StoredSession {
  id: string;
  jobId: string;
  card: VietnamFixedCard;
  expiresAt: number;
}

const sessions = new Map<string, StoredSession>();

export function putJapanVfsPaymentSession(input: {
  jobId: string;
  card: VietnamFixedCardInput;
  ttlMs?: number;
}): { sessionId: string; expiresAt: string; redacted: RedactedVietnamFixedCard } {
  const jobId = input.jobId.trim();
  if (!jobId) throw new Error("jobId is required.");
  const now = Date.now();
  for (const [id, session] of sessions) if (session.expiresAt <= now) sessions.delete(id);
  const card = parseVietnamFixedCardInput(input.card);
  const session: StoredSession = {
    id: randomUUID(),
    jobId,
    card,
    expiresAt: now + Math.max(30_000, Math.min(input.ttlMs ?? 10 * 60_000, 15 * 60_000)),
  };
  sessions.set(session.id, session);
  return { sessionId: session.id, expiresAt: new Date(session.expiresAt).toISOString(), redacted: redactVietnamFixedCard(card) };
}

export function consumeJapanVfsPaymentSession(sessionId: string, jobId: string): VietnamFixedCard | null {
  const session = sessions.get(sessionId);
  sessions.delete(sessionId);
  if (!session || session.jobId !== jobId || session.expiresAt <= Date.now()) return null;
  return session.card;
}
