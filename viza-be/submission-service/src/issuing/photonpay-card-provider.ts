/**
 * PhotonPay escrow-card provider — the issuing counterpart to the Airwallex
 * escrow-card-provider. Mints a single-use recharge card scoped to one
 * applicant's government visa fee, so the runner pays the portal from a fresh
 * card capped to the fee amount and short-lived.
 *
 * PCI (PhotonPay acceptance requirement): the CVV must NEVER be stored. Unlike
 * the Airwallex provider, this one does NOT vault the PAN/expiry/CVV. It
 * returns the three card elements to the caller IN MEMORY for immediate use at
 * the payment step, and vaults only the non-sensitive cardId (+ a masked PAN)
 * for idempotency and finance reconciliation. When wiring this into a runner,
 * the payment step must consume the returned object directly rather than
 * reading card secrets from the vault.
 *
 * Idempotent per (applicantId, attempt): a retry reuses the same requestId and
 * short-circuits on the already-issued cardId, re-fetching its details rather
 * than minting a second card.
 *
 * No-op (returns null) when PHOTONPAY_ENABLED is off, so it stays dormant until
 * switched on per country.
 */

import { createPhotonPayClient, isSucceeded } from "../clients/photonpay.js";
import { getApplicantSecret, setApplicantSecret } from "../applicant-vault.js";
import type { RoutingDecision } from "../payment-routing.js";

/** Non-sensitive vault keys (cardId + masked PAN only — never CVV/PAN/expiry). */
const VAULT = {
  cardId: "viza.issued_card.id",
  masked: "viza.issued_card.masked",
} as const;

const ACTOR = "photonpay:issuing";

/** The card three-elements, held in memory only and used once at payment time. */
export interface EscrowCard {
  cardId: string;
  /** Full PAN. Sensitive — do not persist or log. */
  pan: string;
  /** "MM/YY". */
  expiry: string;
  /** Sensitive — use once, never persist or log. */
  cvv: string;
}

function issuingBin(): string {
  return process.env.PHOTONPAY_ISSUING_BIN ?? "";
}

function cardholderId(): string {
  return process.env.PHOTONPAY_ISSUING_CARDHOLDER_ID ?? "";
}

/** Card currency — PhotonPay issues USD cards on this account by default. */
function cardCurrency(): string {
  return process.env.PHOTONPAY_ISSUING_CURRENCY ?? "USD";
}

/** Funding PhotonPay account (accountNo, e.g. FA-USD…) the card draws from. */
function fundingAccount(): string {
  return process.env.PHOTONPAY_ISSUING_ACCOUNT ?? "";
}

function fxBufferPct(): number {
  const n = Number(process.env.PHOTONPAY_ISSUING_FX_BUFFER_PCT ?? "0");
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function maskPan(pan: string | undefined): string {
  if (!pan) return "";
  const s = pan.replace(/\s/g, "");
  return s.length <= 10 ? "****" : `${s.slice(0, 6)}******${s.slice(-4)}`;
}

/**
 * Issue (or recover) a single-use escrow card for this applicant and return its
 * three elements in memory. No-op → null when issuing is disabled.
 *
 * NOTE on currency: the card is issued in `cardCurrency()` (USD by default) and
 * loaded with the fee amount; when the government fee is in another currency the
 * card network handles FX at the portal. Aligning the recharge amount to a
 * non-USD fee (explicit FX quote) is a follow-up, tracked where this is wired.
 */
export async function ensurePhotonPayEscrowCard(
  applicantId: string,
  decision: RoutingDecision,
  attempt = 1,
): Promise<EscrowCard | null> {
  const client = createPhotonPayClient();
  if (!client) return null;

  // Idempotency: reuse a card already issued for this applicant/run.
  const existingId = await getApplicantSecret(applicantId, VAULT.cardId, { actor: ACTOR });
  if (existingId) {
    const detail = await client.getCardDetail(existingId);
    const cvv = detail.cvv ?? (await client.getCvv(existingId));
    return {
      cardId: existingId,
      pan: detail.cardNo ?? "",
      expiry: detail.expirationDate ?? "",
      cvv,
    };
  }

  const amount = (decision.govtFeeCents / 100) * (1 + fxBufferPct() / 100);
  const result = await client.openCard({
    requestId: `${applicantId}:${attempt}`,
    cardBin: issuingBin(),
    cardCurrency: cardCurrency(),
    cardType: "recharge", // regular card loaded to an exact amount = escrow model
    cardholderId: cardholderId(),
    accountId: fundingAccount(),
    rechargeAmount: Number(amount.toFixed(2)),
    transactionLimitType: "unlimited",
    nickname: `VIZA ${applicantId.slice(0, 8)}`,
  });

  if (!isSucceeded(result.status) || !result.card?.cardId) {
    throw new Error(`PhotonPay openCard failed: ${JSON.stringify(result.raw)}`);
  }
  const c = result.card;

  // Persist only non-sensitive references. NEVER the CVV, and not the full PAN.
  await setApplicantSecret(applicantId, VAULT.cardId, c.cardId, { actor: ACTOR });
  await setApplicantSecret(applicantId, VAULT.masked, maskPan(c.cardNo), { actor: ACTOR });

  console.log(
    `[photonpay] issued card=${c.cardId} masked=${maskPan(c.cardNo)} ` +
      `applicant=${applicantId} attempt=${attempt} load=${amount.toFixed(2)} ${cardCurrency()}`,
  );

  const cvv = c.cvv ?? (await client.getCvv(c.cardId));
  return { cardId: c.cardId, pan: c.cardNo ?? "", expiry: c.expirationDate ?? "", cvv };
}

/**
 * Cancel the escrow card after the portal payment. The cardId is retained in the
 * vault for reconciliation. No-op when disabled. Best-effort: a spent single-use
 * card is already inert.
 */
export async function finalizePhotonPayEscrowCard(applicantId: string): Promise<void> {
  const client = createPhotonPayClient();
  if (!client) return;
  const cardId = await getApplicantSecret(applicantId, VAULT.cardId, { actor: ACTOR });
  if (!cardId) return;
  try {
    await client.cancelCard(cardId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[photonpay] cancel best-effort failed for card=${cardId}: ${msg}`);
  }
}
