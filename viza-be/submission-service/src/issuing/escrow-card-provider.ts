/**
 * Escrow-card provider (PAY-004) — orchestration layer above the Airwallex
 * Issuing client and the per-applicant vault.
 *
 * `ensureEscrowCard` mints a single-use virtual card for one applicant and
 * stages it in the vault under the same well-known keys the runners already
 * read (viza.escrow.card.pan|expiry|cvv), so no Playwright/payment code has to
 * change — it just reads a freshly issued card instead of a fixed one.
 *
 * `finalizeEscrowCard` freezes the card and purges the PAN/CVV after payment.
 *
 * Both are no-ops when AIRWALLEX_ISSUING_ENABLED is off (factory returns null),
 * so this stays dormant until the integration is switched on per country.
 *
 * Idempotent per (applicantId, attempt): a RetryableRunnerError retry reuses
 * the same request_id and short-circuits on the already-stored card id, so a
 * retry never mints a second card for the same attempt.
 *
 * PCI: never log PAN/CVV from here. We log only the masked number / card id.
 */

import { createAirwallexIssuingClient } from "../clients/airwallex-issuing.js";
import { getApplicantSecret, setApplicantSecret } from "../applicant-vault.js";
import type { RoutingDecision } from "../payment-routing.js";

/** Vault keys shared with the runners' escrow-card read path. */
const VAULT = {
  pan: "viza.escrow.card.pan",
  /** MM/YY — matches loadEscrowCard's parse (src/vietnam/govt-payment.ts). */
  expiry: "viza.escrow.card.expiry",
  cvv: "viza.escrow.card.cvv",
  cardId: "viza.issued_card.id",
} as const;

const ACTOR = "airwallex:issuing";

function cardholderId(): string {
  return process.env.AIRWALLEX_ISSUING_CARDHOLDER_ID ?? "";
}

function createdBy(): string {
  return process.env.AIRWALLEX_ISSUING_CREATED_BY ?? "VIZA";
}

function windowMinutes(): number {
  const n = Number(process.env.AIRWALLEX_ISSUING_CARD_EXPIRY_MINUTES ?? "120");
  return Number.isFinite(n) && n > 0 ? n : 120;
}

function fxBufferPct(): number {
  const n = Number(process.env.AIRWALLEX_ISSUING_FX_BUFFER_PCT ?? "0");
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Airwallex wants ISO 8601 with a +0000 style offset, not the trailing `Z`. */
function awxTime(d: Date): string {
  return d.toISOString().replace("Z", "+0000");
}

/**
 * Issue a single-use card for this applicant and stage it in the vault.
 * Idempotent per (applicantId, attempt). No-op when issuing is disabled.
 */
export async function ensureEscrowCard(
  applicantId: string,
  decision: RoutingDecision,
  attempt = 1,
): Promise<void> {
  const client = createAirwallexIssuingClient();
  if (!client) return; // disabled → fall back to whatever is already in the vault

  // Already provisioned for this run?
  const existing = await getApplicantSecret(applicantId, VAULT.cardId, { actor: ACTOR });
  if (existing) return;

  const now = new Date();
  const amount = (decision.govtFeeCents / 100) * (1 + fxBufferPct() / 100);

  const card = await client.createCard({
    requestId: `${applicantId}:${attempt}`,
    cardholderId: cardholderId(),
    createdBy: createdBy(),
    currency: decision.currency,
    limitAmount: Number(amount.toFixed(2)),
    activeFrom: awxTime(now),
    activeTo: awxTime(new Date(now.getTime() + windowMinutes() * 60_000)),
    // allowedMerchantCategories intentionally omitted (doc §8.4 — MCC lock
    // causes false declines through portals' third-party PSPs).
  });

  console.log(
    `[airwallex] issued card=${card.cardId} masked=${card.maskedNumber} ` +
      `applicant=${applicantId} attempt=${attempt} limit=${amount.toFixed(2)} ${decision.currency}`,
  );

  const details = await client.getSensitiveDetails(card.cardId);
  const mm = details.expiryMonth.padStart(2, "0");
  const yy = details.expiryYear.slice(-2);

  await setApplicantSecret(applicantId, VAULT.cardId, card.cardId, { actor: ACTOR });
  await setApplicantSecret(applicantId, VAULT.pan, details.pan, { actor: ACTOR });
  await setApplicantSecret(applicantId, VAULT.expiry, `${mm}/${yy}`, { actor: ACTOR });
  await setApplicantSecret(applicantId, VAULT.cvv, details.cvv, { actor: ACTOR });
}

/**
 * Freeze the card and purge sensitive material after the portal payment.
 * The card id is retained for finance reconciliation. No-op when disabled.
 */
export async function finalizeEscrowCard(applicantId: string): Promise<void> {
  const client = createAirwallexIssuingClient();
  if (!client) return;

  const cardId = await getApplicantSecret(applicantId, VAULT.cardId, { actor: ACTOR });
  if (cardId) {
    try {
      await client.freezeCard(cardId);
    } catch (err) {
      // SINGLE-use card is already spent; freeze is best-effort.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[airwallex] freeze best-effort failed for card=${cardId}: ${msg}`);
    }
  }

  // Purge PAN/CVV from the vault (no delete helper — overwrite with empty).
  await setApplicantSecret(applicantId, VAULT.pan, "", { actor: ACTOR });
  await setApplicantSecret(applicantId, VAULT.cvv, "", { actor: ACTOR });
}
