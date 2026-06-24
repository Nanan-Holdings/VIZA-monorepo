# Airwallex Virtual Card Issuing — submission-service integration

Status: foundation implemented, flag-off; runner wiring deferred
Author: drafted with Claude, June 2026
Scope: `viza-be/submission-service` escrow-card payment path

## 0. Implementation status (2026-06-24)

Foundation built and type-checks, gated OFF by `AIRWALLEX_ISSUING_ENABLED`:

- `src/clients/airwallex-issuing.ts` — `AirwallexIssuingClient` +
  `createAirwallexIssuingClient()` (returns `null` when disabled). Matches §5.
- `src/issuing/escrow-card-provider.ts` — `ensureEscrowCard()` /
  `finalizeEscrowCard()`. Matches §6, imports corrected to the real vault
  exports (`setApplicantSecret` / `getApplicantSecret`).
- `.env.example` — Airwallex block added (§9).

Corrections to the original sketch, baked into the code:

- **§7 wiring is NOT done and is not yet possible.** `loadEscrowCard()`
  (`src/vietnam/govt-payment.ts`) is reference code — no live runner calls it.
  The Vietnam runner (`runner.ts` → `fillVietnamApplication`) returns
  `submitted_pending_pay` / `scaffolded_pending_walk` and never reads the
  escrow vault. There is no existing `loadEscrowCard()` call to wrap. Wiring is
  blocked on (a) a live vault-read payment path and (b) the unresolved
  `applicationId` ↔ `applicantId` mapping (the queue only carries
  `job.application_id`; the vault is keyed by `applicantId`).
- **§5 module note:** the codebase uses `.js` import specifiers — kept as-is.
- **Sandbox auth probe (api-demo):** `POST /api/v1/authentication/login`
  requires BOTH `x-client-id` (a UUID) and `x-api-key`. The single admin api
  key supplied for testing returns `400 {"code":"invalid_argument","message":
  "Failed to parse x-client-id"}` on its own — a separate Issuing `client_id`
  is still needed from the account before any live/sandbox card can be minted
  (see §11). The client's two-header auth shape is otherwise confirmed correct.

## 1. Goal

Replace the single fixed test card used by `runner_escrow_card` countries with a
freshly issued, single-use Airwallex virtual card per applicant. This stops the
"same card used across many government portals" pattern that gets a card flagged
and frozen, and caps blast radius to one applicant + one fee amount.

The good news: the codebase already has the right seam. Runners read card data
from the encrypted vault via `loadEscrowCard()` against keys
`viza.escrow.card.pan|expiry|cvv`. We issue the card just before that read and
write the result into the same keys, so no Playwright/runner payment code has to
change. We add issuance before payment and a freeze after.

## 2. Why this card configuration

Issue a **non-personalized COMMERCIAL VIRTUAL card, SINGLE use**, per applicant:

- `is_personalized: false` lets us retrieve the raw PAN + CVV directly from the
  API (personalized cards need either PCI attestation or the secure-iframe flow,
  which does not work for server-side Playwright form-fill). See the PCI note in
  section 8.
- `allowed_transaction_count: SINGLE` is mandatory and immutable. The card dies
  after one successful debit, so a leaked PAN cannot be reused.
- `transaction_limits` pinned to the exact government fee plus a small FX buffer.
- `active_from` / `active_to` window of a couple of hours bounds the exposure.
- Non-personalized cards attach to a single shared business ("DELEGATE")
  cardholder, so we create the cardholder once and reuse it for every card.

## 3. Airwallex API surface we use

Base URL is account/region bound. For your Hong Kong entity use the global host;
sandbox is a separate host. Make it an env var (do not hardcode `api.hk.*`,
that subdomain is not the issuing host).

- Production: `https://api.airwallex.com`
- Sandbox/demo: `https://api-demo.airwallex.com`

| Step | Method + path | Notes |
|------|---------------|-------|
| Auth | `POST /api/v1/authentication/login` | Headers `x-client-id`, `x-api-key`. Returns a bearer `token` (~30 min TTL). Cache and refresh. |
| Create cardholder (once) | `POST /api/v1/issuing/cardholders/create` | DELEGATE/business type. Store the returned `cardholder_id`. |
| Create card | `POST /api/v1/issuing/cards/create` | Single-use virtual commercial card. Returns `card_id`, masked `card_number`, `card_status` (PENDING auto-transitions to ACTIVE for virtual). |
| Get sensitive details | `GET /api/v1/issuing/cards/{card_id}/details` | Full PAN, CVV, expiry. Direct retrieval allowed for non-personalized cards. |
| Freeze / cancel | `POST /api/v1/issuing/cards/{card_id}/...` (update status) | Freeze after payment. Confirm exact path in Cancel-or-freeze docs. |

### Create-card request, mapped to `RoutingDecision`

```jsonc
{
  "request_id": "<applicantId>:<attempt>",      // idempotency, survives retries
  "created_by": "Nanan Holdings Ltd",            // your legal entity name
  "program": {
    "purpose": "COMMERCIAL",
    "type": "PREPAID",                            // or CREDIT/GOOD_FUNDS_CREDIT per account
    "sub_type": "GOOD_FUNDS_CREDIT"               // confirm with your account manager
  },
  "is_personalized": false,
  "form_factor": "VIRTUAL",
  "cardholder_id": "<shared delegate cardholder id>",
  "authorization_controls": {
    "allowed_transaction_count": "SINGLE",
    "allowed_currencies": ["USD"],               // decision.currency
    "active_from": "2026-06-23T00:00:00+0000",
    "active_to":   "2026-06-23T02:00:00+0000",   // now + 2h
    "transaction_limits": {
      "currency": "USD",                          // decision.currency
      "limits": [
        { "amount": 27.50, "interval": "PER_TRANSACTION" },
        { "amount": 27.50, "interval": "ALL_TIME" }
      ]
    }
    // allowed_merchant_categories: left OPEN on purpose, see section 8 (MCC)
  }
}
```

Limit amount = `decision.govtFeeCents / 100` plus a 1-3% FX buffer if the portal
bills in a currency other than the card currency.

## 4. Flow: before vs after

Current (Vietnam shown, all escrow-card countries identical):

```
dispatch -> runVietnam -> fillVietnamApplication -> [payment screen]
  -> loadEscrowCard(applicantId)        # reads vault: fixed test card
  -> fillCardForm(page, card)           # Playwright types PAN/expiry/CVV
  -> submit -> recordPortalReceipt(...)
```

After (new steps marked NEW, nothing else changes):

```
dispatch -> runVietnam -> fillVietnamApplication -> [payment screen]
  -> NEW ensureEscrowCard(applicantId, decision)
        - login (cached token)
        - POST cards/create  (single-use, limit=fee, window=2h, currency=decision.currency)
        - GET  cards/{id}/details  (PAN, expiry, CVV)
        - vault.set viza.escrow.card.pan|expiry|cvv  (actor: airwallex:issuing)
        - vault.set viza.issued_card.id = card_id
  -> loadEscrowCard(applicantId)        # unchanged: now reads the issued card
  -> fillCardForm(page, card)           # unchanged
  -> submit -> recordPortalReceipt(...) # unchanged
  -> NEW finalizeEscrowCard(applicantId)
        - POST cards/{id} freeze   (idempotent; SINGLE card is already spent)
        - vault.purge viza.escrow.card.*  (drop PAN/CVV from storage)
```

`ensureEscrowCard` is idempotent on `request_id = applicantId:attempt`, so a
`RetryableRunnerError` retry will not mint a second card for the same attempt.

## 5. New file: `src/clients/airwallex-issuing.ts`

Uses native `fetch` (Node 18+), so no new dependency. Matches the existing
`createClient`-style factory and env-gating pattern.

```ts
// src/clients/airwallex-issuing.ts
// Low-level Airwallex Issuing client. Native fetch, ESM, no extra deps.

export interface AirwallexConfig {
  baseUrl: string;     // https://api.airwallex.com  (prod) | api-demo (sandbox)
  clientId: string;
  apiKey: string;
}

export interface CreateCardInput {
  requestId: string;          // idempotency key
  cardholderId: string;
  createdBy: string;
  currency: string;           // e.g. "USD"
  limitAmount: number;        // major units, e.g. 27.5
  activeFrom: string;         // ISO 8601 with +0000 offset
  activeTo: string;
  allowedMerchantCategories?: string[]; // omit to allow all
}

export interface CreatedCard {
  cardId: string;
  cardStatus: string;
  maskedNumber: string;
}

export interface SensitiveCardDetails {
  pan: string;
  cvv: string;
  expiryMonth: string;        // "01".."12"
  expiryYear: string;         // "2026" (normalize as needed)
}

export class AirwallexIssuingClient {
  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private cfg: AirwallexConfig) {}

  private async authHeader(): Promise<Record<string, string>> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt - 60_000) {
      return { Authorization: `Bearer ${this.token}` };
    }
    const res = await fetch(`${this.cfg.baseUrl}/api/v1/authentication/login`, {
      method: "POST",
      headers: {
        "x-client-id": this.cfg.clientId,
        "x-api-key": this.cfg.apiKey,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Airwallex auth failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { token: string; expires_at?: string };
    this.token = body.token;
    // token lives ~30 min; refresh a minute early
    this.tokenExpiresAt = now + 29 * 60_000;
    return { Authorization: `Bearer ${this.token}` };
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method: "POST",
      headers: { ...(await this.authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Airwallex POST ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method: "GET",
      headers: await this.authHeader(),
    });
    if (!res.ok) {
      throw new Error(`Airwallex GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  async createCard(input: CreateCardInput): Promise<CreatedCard> {
    const body = await this.post<{
      card_id: string;
      card_status: string;
      card_number: string;
    }>("/api/v1/issuing/cards/create", {
      request_id: input.requestId,
      created_by: input.createdBy,
      cardholder_id: input.cardholderId,
      is_personalized: false,
      form_factor: "VIRTUAL",
      program: { purpose: "COMMERCIAL", type: "PREPAID", sub_type: "GOOD_FUNDS_CREDIT" },
      authorization_controls: {
        allowed_transaction_count: "SINGLE",
        allowed_currencies: [input.currency],
        active_from: input.activeFrom,
        active_to: input.activeTo,
        ...(input.allowedMerchantCategories
          ? { allowed_merchant_categories: input.allowedMerchantCategories }
          : {}),
        transaction_limits: {
          currency: input.currency,
          limits: [
            { amount: input.limitAmount, interval: "PER_TRANSACTION" },
            { amount: input.limitAmount, interval: "ALL_TIME" },
          ],
        },
      },
    });
    return { cardId: body.card_id, cardStatus: body.card_status, maskedNumber: body.card_number };
  }

  async getSensitiveDetails(cardId: string): Promise<SensitiveCardDetails> {
    const d = await this.get<{
      card_number: string;
      cvv: string;
      expiry_month: string;
      expiry_year: string;
    }>(`/api/v1/issuing/cards/${cardId}/details`);
    return {
      pan: d.card_number,
      cvv: d.cvv,
      expiryMonth: d.expiry_month,
      expiryYear: d.expiry_year,
    };
  }

  async freezeCard(cardId: string): Promise<void> {
    // Confirm exact endpoint in the Cancel-or-freeze docs; this is the expected shape.
    await this.post(`/api/v1/issuing/cards/${cardId}/update`, { card_status: "INACTIVE" });
  }
}

export function createAirwallexIssuingClient(): AirwallexIssuingClient | null {
  const enabled = /^(1|true|yes|on)$/i.test(process.env.AIRWALLEX_ISSUING_ENABLED ?? "");
  if (!enabled) return null;
  const clientId = process.env.AIRWALLEX_ISSUING_CLIENT_ID;
  const apiKey = process.env.AIRWALLEX_ISSUING_API_KEY;
  const baseUrl = process.env.AIRWALLEX_ISSUING_BASE_URL ?? "https://api.airwallex.com";
  if (!clientId || !apiKey) {
    throw new Error("AIRWALLEX_ISSUING_CLIENT_ID and AIRWALLEX_ISSUING_API_KEY must be set");
  }
  return new AirwallexIssuingClient({ baseUrl, clientId, apiKey });
}
```

## 6. New file: `src/issuing/escrow-card-provider.ts`

Orchestration layer the runners call. Verify the exact vault export names
(`setApplicantSecret` / `requireApplicantSecret` / a delete helper) against
`src/applicant-vault.ts` and adjust imports.

```ts
// src/issuing/escrow-card-provider.ts
import { createAirwallexIssuingClient } from "../clients/airwallex-issuing.js";
import { setApplicantSecret, getApplicantSecret } from "../applicant-vault.js";
import type { RoutingDecision } from "../payment-routing.js";

const VAULT = {
  pan: "viza.escrow.card.pan",
  expiry: "viza.escrow.card.expiry",   // MM/YY, matches existing runners
  cvv: "viza.escrow.card.cvv",
  cardId: "viza.issued_card.id",
} as const;

const CARDHOLDER_ID = process.env.AIRWALLEX_ISSUING_CARDHOLDER_ID ?? "";
const CREATED_BY = process.env.AIRWALLEX_ISSUING_CREATED_BY ?? "VIZA";
const WINDOW_MIN = Number(process.env.AIRWALLEX_ISSUING_CARD_EXPIRY_MINUTES ?? "120");
const FX_BUFFER = Number(process.env.AIRWALLEX_ISSUING_FX_BUFFER_PCT ?? "0"); // e.g. 3 = +3%

function awxTime(d: Date): string {
  // Airwallex wants ISO 8601 with a +0000 style offset
  return d.toISOString().replace("Z", "+0000");
}

/** Issue a single-use card for this applicant and stage it in the vault.
 *  Idempotent per (applicantId, attempt): a retry reuses the same request_id. */
export async function ensureEscrowCard(
  applicantId: string,
  decision: RoutingDecision,
  attempt = 1,
): Promise<void> {
  const client = createAirwallexIssuingClient();
  if (!client) return; // disabled -> fall back to whatever is already in the vault

  // already provisioned for this run?
  if (await getApplicantSecret(applicantId, VAULT.cardId)) return;

  const now = new Date();
  const amount = (decision.govtFeeCents / 100) * (1 + FX_BUFFER / 100);

  const card = await client.createCard({
    requestId: `${applicantId}:${attempt}`,
    cardholderId: CARDHOLDER_ID,
    createdBy: CREATED_BY,
    currency: decision.currency,
    limitAmount: Number(amount.toFixed(2)),
    activeFrom: awxTime(now),
    activeTo: awxTime(new Date(now.getTime() + WINDOW_MIN * 60_000)),
    // allowedMerchantCategories intentionally omitted; see MCC note in the doc
  });

  const details = await client.getSensitiveDetails(card.cardId);
  const mm = details.expiryMonth.padStart(2, "0");
  const yy = details.expiryYear.slice(-2);

  const actor = "airwallex:issuing";
  await setApplicantSecret(applicantId, VAULT.cardId, card.cardId, { actor });
  await setApplicantSecret(applicantId, VAULT.pan, details.pan, { actor });
  await setApplicantSecret(applicantId, VAULT.expiry, `${mm}/${yy}`, { actor });
  await setApplicantSecret(applicantId, VAULT.cvv, details.cvv, { actor });
}

/** Freeze the card and purge sensitive material after the portal payment. */
export async function finalizeEscrowCard(applicantId: string): Promise<void> {
  const client = createAirwallexIssuingClient();
  if (!client) return;
  const cardId = await getApplicantSecret(applicantId, VAULT.cardId);
  if (cardId) {
    try {
      await client.freezeCard(cardId);
    } catch {
      // SINGLE-use card is already spent; freeze is best-effort
    }
  }
  // purge PAN/CVV from the vault (keep cardId for reconciliation if desired)
  const actor = "airwallex:issuing";
  await setApplicantSecret(applicantId, VAULT.pan, "", { actor });
  await setApplicantSecret(applicantId, VAULT.cvv, "", { actor });
}
```

## 7. Runner change (Vietnam example, ~4 lines)

In `src/vietnam/run.ts`, right before the existing `loadEscrowCard()` call, and
after the receipt is recorded:

```ts
import { ensureEscrowCard, finalizeEscrowCard } from "../issuing/escrow-card-provider.js";
import { decisionFor } from "../payment-routing.js"; // confirm exported name

// ...inside the orchestrator, before payment:
const decision = decisionFor(application.country, application.visaType);
if (decision.policy === "collect" && decision.collector === "viza") {
  await ensureEscrowCard(applicantId, decision, job.attempt ?? 1);
}

// existing payment path is unchanged:
const card = await loadEscrowCard(applicantId);
// ...fillCardForm + submit + recordPortalReceipt...

// after receipt recorded:
await finalizeEscrowCard(applicantId);
```

Every other escrow-card country gets the identical two-call wrap. Because the
vault keys are shared, you can also centralize this in the dispatcher
(`queue/handler.ts`) so each country runner does not repeat it.

## 8. Compliance and operational caveats (read before building)

1. PCI scope. Pulling the raw PAN/CVV server-side to type into a Playwright form
   puts submission-service in PCI DSS scope (likely SAQ D). Mitigations already
   half in place: the vault encrypts at rest (AES-256-GCM); add short retention
   and purge after payment (`finalizeEscrowCard` does this). Lock down logs so
   PAN/CVV never get logged. Talk to Airwallex about your attestation path.
2. Funding model. Airwallex cards spend from a prefunded issuing balance, not
   Stripe-style just-in-time funding. You must keep the HK wallet topped up to
   cover in-flight fees. Monitor balance and alert on low funds.
3. 3D Secure. Government PSPs often trigger 3DS. Airwallex sends the OTP to the
   cardholder contact (email/mobile). You already run `imapflow` for email
   verification, so point the cardholder contact email at an inbox the runner
   reads and extract the OTP there. Alternatively enable Airwallex Remote
   Authorization to approve/decline programmatically. Decide this per country.
4. MCC locking. Tempting to lock `allowed_merchant_categories` to government
   codes (9399, 9311, etc.), but visa portals route through third-party PSPs with
   unpredictable MCCs, so an MCC lock will cause false declines. Start with
   amount + SINGLE + active window only. Observe real MCCs per country from
   transaction data, then tighten.
5. Currency. Set `allowed_currencies` and the limit currency to
   `decision.currency` (the portal's billing currency). Airwallex auto-conversion
   covers mismatches but adds FX cost and variance, hence the FX buffer on the
   limit.
6. Idempotency. `request_id = applicantId:attempt` prevents a retried job from
   minting duplicate cards. Keep `attempt` stable within a single job attempt.
7. Reconciliation. Store `card_id` and the portal receipt together
   (`order_line.metadata.virtual_card_issuer = "airwallex"`, plus `card_id`) so
   finance can match Airwallex transactions to applications.

## 9. Env additions (`.env.example`)

```bash
# Airwallex virtual card issuing (HK entity)
AIRWALLEX_ISSUING_ENABLED=false
AIRWALLEX_ISSUING_BASE_URL=https://api.airwallex.com   # api-demo.airwallex.com for sandbox
AIRWALLEX_ISSUING_CLIENT_ID=
AIRWALLEX_ISSUING_API_KEY=
AIRWALLEX_ISSUING_CARDHOLDER_ID=        # shared delegate cardholder, created once
AIRWALLEX_ISSUING_CREATED_BY=Nanan Holdings Ltd
AIRWALLEX_ISSUING_CARD_EXPIRY_MINUTES=120
AIRWALLEX_ISSUING_FX_BUFFER_PCT=0
```

## 10. Rollout

1. Sandbox (`api-demo`): create the delegate cardholder, issue a card, use the
   transaction simulator to confirm a single debit then auto-decline.
2. Wire `ensureEscrowCard` / `finalizeEscrowCard` into Vietnam only, behind
   `AIRWALLEX_ISSUING_ENABLED`. Dry-run, then one real low-value e-visa.
3. Validate 3DS handling end to end (OTP via imapflow or remote auth).
4. Roll to the other `runner_escrow_card` countries (India, etc.).
5. Add balance + decline alerting; document in `docs/payments/`.

## 11. Confirm with your Airwallex account manager

- Enable Issuing APIs on the HK account and confirm the production base host.
- Confirm `program.type` / `sub_type` available to you (PREPAID vs GOOD_FUNDS_CREDIT).
- Confirm non-personalized cards can retrieve sensitive details via API on your
  plan, and the exact freeze/cancel endpoint and payload.
- Confirm "paying government visa fees on behalf of customers" is an approved
  use case for the account.
