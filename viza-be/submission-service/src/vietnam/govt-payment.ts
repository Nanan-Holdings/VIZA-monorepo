import { rejectRemovedPayment } from "../payment-removed.js";
import { routingFor } from "../payment-routing.js";

/**
 * Vietnam — government-fee routing reference implementation
 * (PAY-003 mechanism `runner_escrow_card`).
 *
 * `loadEscrowCard` reads the rotating VIZA escrow card from the
 * per-applicant credential vault under the well-known keys:
 *
 *   viza.escrow.card.pan
 *   viza.escrow.card.expiry  (MM/YY)
 *   viza.escrow.card.cvv
 *
 * The card is per-applicant because we mint a single-use virtual card
 * per submission to bound the blast radius of a portal compromise.
 *
 * `recordPortalReceipt(orderId, amountCents, currency, portalReceiptId)`
 * appends an order_line row tagged kind='govt' once the portal
 * confirms payment, and flips the parent order to status='submitted'
 * if it was 'paid'.
 *
 * Other Vietnam-specific portal interaction (filling the card form,
 * waiting for the success redirect) lives in the Playwright runner
 * itself; this module is the thin VIZA-side bookkeeping that survives
 * a runner crash.
 */

export interface VnEscrowCard {
  pan: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export const VN_GOVT_PAYMENT_MECHANISM = routingFor(
  "vietnam",
  "VN_E_VISA",
).mechanism;

export async function loadEscrowCard(
  _applicantId: string,
): Promise<VnEscrowCard> {
  return rejectRemovedPayment();
}

export interface RecordPortalReceiptInput {
  orderId: string;
  amountCents: number;
  currency: string;
  portalReceiptId: string;
}

export async function recordPortalReceipt(
  _input: RecordPortalReceiptInput,
): Promise<void> {
  return rejectRemovedPayment();
}

export async function recordPortalDecline(
  _orderId: string,
  _reason: string,
): Promise<void> {
  return rejectRemovedPayment();
}
