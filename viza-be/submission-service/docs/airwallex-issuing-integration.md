# Airwallex managed-card fallback

Status: implemented, production-disabled until the account controls below are
verified.

## Decision

PhotonPay is the primary virtual-card issuer. Airwallex is a fallback only for
an explicit, pre-issuance PhotonPay capability or configuration failure for the
exact portal currency. A timeout, ambiguous provider response, or any existing
issuer-card attempt must not switch providers.

Airwallex cards are created only by
`src/issuing/managed-card-provider.ts` through the durable adapter in
`src/issuing/airwallex-card-provider.ts`. The low-level client's generic
`createCard` method is permanently disabled. PAN and CVV remain in worker
memory and must never be stored or logged.

## Required account isolation

Do not connect the production issuing key to VIZA's main Airwallex wallet.
Per-card limits do not protect the wallet if a credential can create many
cards.

Before enabling the fallback:

1. Create a dedicated supplementary or connected Airwallex account for VIZA
   government fees, backed by its own low-balance wallet. Finance owns the
   float and replenishment ceiling.
2. Ask the Airwallex account manager to enable Issuing APIs, Cards, and Remote
   Authorization and to set conservative account-level maximum card limits.
3. Configure Remote Authorization version 2 with the production HTTPS endpoint
   `/api/webhooks/airwallex/remote-authorization` and provider-side
   `default_action=DECLINED`.
4. Give the runtime key only Cards Read/Write, Cardholders Read, Config Read,
   and the minimum transaction-read permissions required for reconciliation.
   The runtime key must not have Config Write, transfer, conversion, payout, or
   general wallet movement permissions.
5. Store the issuing key only in the production submission worker's secret
   store. Do not put it in local or preview environments. Store the remote-auth
   shared secret only in the production web application's secret store.

The key can still create many cards, so the isolated wallet and provider-side
default decline are mandatory blast-radius controls, not optional hardening.

## Card and authorization controls

Every Airwallex card is bound to one application, one government-fee
allocation, one payment intent, one deterministic attempt number, one exact
currency, and one exact amount. It is virtual, single-use, and active for no
more than four hours. Both its per-transaction and all-time limits equal the
canonical official fee; no FX buffer is permitted.

Before issuing, the worker reads Airwallex Issuing configuration and refuses to
claim an allocation unless Remote Authorization is enabled, uses version 2,
and defaults to `DECLINED`.

The remote-authorization endpoint verifies Airwallex's HMAC-SHA256 signature
and nonce age, expected account ID, purchase category, managed card ID,
application allocation state, exact amount, exact currency, and a mandatory
per-currency daily ceiling. Missing configuration, malformed requests, database
errors, timeout, or any mismatch decline the transaction.

## Environment

Submission worker:

```dotenv
AIRWALLEX_ISSUING_ENABLED=false
AIRWALLEX_ISSUING_BASE_URL=https://api.airwallex.com
AIRWALLEX_ISSUING_CLIENT_ID=
AIRWALLEX_ISSUING_API_KEY=
AIRWALLEX_ISSUING_CARDHOLDER_ID=
AIRWALLEX_ISSUING_CARDHOLDER_NAME=VIZA
AIRWALLEX_ISSUING_CREATED_BY=Nanan Holdings Ltd
AIRWALLEX_ISSUING_CARD_EXPIRY_MINUTES=120
AIRWALLEX_ISSUING_SUPPORTED_CURRENCIES=GBP,USD
AIRWALLEX_ISSUING_MAX_CARD_AMOUNT_GBP=200
AIRWALLEX_ISSUING_MAX_CARD_AMOUNT_USD=300
```

Production web application:

```dotenv
AIRWALLEX_ISSUING_ACCOUNT_ID=
AIRWALLEX_REMOTE_AUTH_SHARED_SECRET=
AIRWALLEX_REMOTE_AUTH_DAILY_LIMITS=GBP:500,USD:500
```

Values above are examples, not approved limits. Finance must set lower values
from the actual official-fee catalogue and expected daily volume. Keep
`AIRWALLEX_ISSUING_ENABLED=false` until the isolated wallet, account maximums,
Remote Authorization configuration, production secrets, and alerting have all
been verified.

## Rollout

1. Verify the controls in Airwallex demo/sandbox without moving real funds.
2. Confirm that a valid exact transaction is authorized and that wrong amount,
   wrong currency, unknown card, stale signature, timeout, and unavailable
   database are declined.
3. Confirm retries reuse the same issuer attempt and never create a second card
   or switch providers after an uncertain result.
4. Deploy the remote-auth endpoint and verify its latency stays safely below
   Airwallex's 2.5-second response deadline.
5. Put only a deliberately small amount into the isolated production wallet,
   then enable one currency with a conservative daily ceiling.
6. Perform one owner-approved low-value live payment and reconcile the card,
   allocation, portal receipt, and Airwallex transaction before expanding.

No rollout step authorizes a card creation or real transaction by itself.
