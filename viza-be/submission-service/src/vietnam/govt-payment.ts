import { supabase } from "../supabase.js";
import { applicantVault } from "../applicant-vault.js";
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
  applicantId: string,
): Promise<VnEscrowCard> {
  const pan = await applicantVault.require(
    applicantId,
    "viza.escrow.card.pan",
    { actor: "vietnam:govt-payment", correlationId: applicantId },
  );
  const expiry = await applicantVault.require(
    applicantId,
    "viza.escrow.card.expiry",
    { actor: "vietnam:govt-payment", correlationId: applicantId },
  );
  const cvv = await applicantVault.require(
    applicantId,
    "viza.escrow.card.cvv",
    { actor: "vietnam:govt-payment", correlationId: applicantId },
  );
  const m = /^(\d{2})\/(\d{2,4})$/.exec(expiry.trim());
  if (!m) throw new Error(`Invalid escrow card expiry: ${expiry}`);
  const month = m[1];
  let year = m[2];
  if (year.length === 2) year = `20${year}`;
  return { pan, expiryMonth: month, expiryYear: year, cvv };
}

export interface RecordPortalReceiptInput {
  orderId: string;
  amountCents: number;
  currency: string;
  portalReceiptId: string;
}

export async function recordPortalReceipt(
  input: RecordPortalReceiptInput,
): Promise<void> {
  const { error: lineErr } = await supabase.from("order_line").insert({
    order_id: input.orderId,
    kind: "govt",
    amount_cents: input.amountCents,
    currency: input.currency,
    payee: "vietnam",
    description: "VN e-Visa government fee — runner escrow card",
    metadata: { portal_receipt_id: input.portalReceiptId },
  });
  if (lineErr) {
    throw new Error(`order_line insert: ${lineErr.message}`);
  }
  const { error: orderErr } = await supabase
    .from("order")
    .update({
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.orderId)
    .eq("status", "paid");
  if (orderErr) {
    throw new Error(`order status update: ${orderErr.message}`);
  }
}

export async function recordPortalDecline(
  orderId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from("order")
    .update({
      status: "govt_payment_failed",
      metadata: { decline_reason: reason },
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) {
    throw new Error(`order decline update: ${error.message}`);
  }
}
