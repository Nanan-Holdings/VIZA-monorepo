import { rejectRemovedPayment } from "../payment-removed.js";
import {
  type RedactedVietnamFixedCard,
  type VietnamFixedCard,
  type VietnamFixedCardInput
} from "../vietnam/fixed-card-payment";

export function putJapanVfsPaymentSession(_input: {
  jobId: string;
  card: VietnamFixedCardInput;
  ttlMs?: number;
}): { sessionId: string; expiresAt: string; redacted: RedactedVietnamFixedCard } {
  return rejectRemovedPayment();
}

export function consumeJapanVfsPaymentSession(_sessionId: string, _jobId: string): VietnamFixedCard | null {
  return null;
}
