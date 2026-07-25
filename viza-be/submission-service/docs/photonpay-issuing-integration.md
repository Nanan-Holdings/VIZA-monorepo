# PhotonPay Virtual Card Issuing (发卡) — submission-service integration

Status: client + provider implemented and UAT-accepted; runner wiring NOT done
Author: drafted with Claude, July 2026
Scope: `viza-be/submission-service` escrow-card payment path

PhotonPay (光子易) replaces Airwallex as the card issuer for the
`runner_escrow_card` payment mechanism — see
[airwallex-issuing-integration.md](./airwallex-issuing-integration.md) for the
design this supersedes. Everything below is derived from the vendor's
「API 对接指南」/「签名⽂档」/「回调通知验签」PDFs and the signed acceptance
workbook, none of which are in version control (they live under the gitignored
`output/`). This file is the committed record.

## 0. Implementation status (2026-07-25)

Built, type-checks, tested, gated OFF by `PHOTONPAY_ENABLED`:

- `src/clients/photonpay.ts` — `PhotonPayClient` + `createPhotonPayClient()`
  (returns `null` when disabled). Full issuing surface plus the v5 cashier.
- `src/clients/photonpay.spec.ts` — signing pinned to the vendor's published
  worked example, webhook verification, token expiry, token de-duplication.
- `src/issuing/photonpay-card-provider.ts` — `ensurePhotonPayEscrowCard()` /
  `finalizePhotonPayEscrowCard()`.
- `scripts/photonpay-uat-*.ts` — the three live UAT scripts.
- `scripts/photonpay-smoke.mjs` (repo root) — dependency-free connectivity probe.

**Not done — the provider has zero callers.** `ensurePhotonPayEscrowCard` is not
referenced by any runner. Nothing mints a card in a real submission today; VN and
ID still pay with either a client-typed one-time card or the shared
`VN_FIXED_CARD_*` test PAN. See §7 for the two seams where wiring goes.

**UAT acceptance passed 2026-07-15** against the old host: all 14 interface items
plus webhook signature verification, the `{"roger": true}` contract, the token
refresh discipline, and the redacted request/response logging. Evidence is in
`output/photonpay-uat-acceptance.log` and the acceptance workbook.

**Production API access verified 2026-07-26.** `scripts/photonpay-smoke.mjs
--env prod` passes end to end: token, account list, signed request accepted,
signature enforcement confirmed, card BIN readable. See §2 for what unblocked it
and §10 for the live values.

**Production is not yet usable for real cards**: every funding account reads
0.00. A card cannot be loaded until the USD account is funded.

## 1. Goal

Mint a fresh, single-use virtual card per applicant, loaded with the exact
government fee, and have the Playwright runner pay the government portal with it.
This replaces the shared fixed test card, which gets flagged and frozen when the
same PAN hits many government portals, and caps blast radius to one applicant and
one fee.

## 2. Environments

| | OPENAPI host | Merchant portal |
|---|---|---|
| Sandbox | `https://x-api.sandbox.photontech.cc` | `https://portal.sandbox.photontech.cc` |
| Production | `https://x-api.photonpay.com` | `https://portal.photonpay.com` |

`https://x-api1.uat.photontech.cc` was **decommissioned 2026-07-24**. PhotonPay
migrated the test environment on 2026-07-20 (data cutover) / 2026-07-24 (old host
retired), stating that merchant accounts, transaction data and historical
configuration carry over unchanged. Portal login is no longer IP-restricted on
sandbox; **whether the sandbox OPENAPI still enforces an IP allowlist is
unconfirmed** — the notice only mentioned portal login.

`PHOTONPAY_BASE_URL` is **required** whenever `PHOTONPAY_ENABLED` is truthy.
It deliberately has no default: it used to fall back to production, so any UAT
script run with the variable unset minted real cards against real money.

### The IP allowlist is the thing that bites

**Production enforces a merchant IP allowlist on every OpenAPI call**, configured
at Developers → Developer settings → IP Address. Calling from an address that is
not listed returns:

```
HTTP 200  {"code":"403","msg":"forbidden","path":"/token/accessToken"}
```

That is easy to misdiagnose as bad credentials. It is not. Distinguish them by
sending a deliberately fabricated `appId`: a nonexistent app answers
`union-oauth2:21301 "app not exist"`, so a plain `403 forbidden` means the app
is real and your **IP** is the problem.

The allowlist is a fixed set of slots, added one at a time in the portal.
A workstation added for local smoke tests will silently stop working when its
residential IP rotates. **Whatever host runs submission-service in production
must have its egress IP on this list**, or issuing fails in production while
working perfectly from a laptop.

## 3. Auth

`POST {baseUrl}/oauth2/token/accessToken` with header
`Authorization: basic base64(appId + "/" + appSecret)`.

Two traps: the scheme is lowercase `basic`, and the credential pair is joined
with `/`, not the RFC-7617 `:`. Neither matches standard HTTP Basic — do not
substitute a library helper.

Every business call then carries `X-PD-TOKEN: <token>`.

Tokens last ~2 hours and **fetching a new one invalidates the old one**. Two
consequences the client handles:

- The token is cached and reused for its whole life, refreshed 5 minutes early.
  Never fetch per-request.
- Concurrent cache misses share one in-flight fetch (`tokenInFlight`). Without
  that, a second fetch would invalidate the token a first request is still
  carrying.

The response field is named `expiresIn` but the UAT tenant returned an
**absolute epoch-ms timestamp**, not a relative duration. `resolveTokenExpiry()`
accepts either form and clamps the result to 24h.

## 4. Signing

Requests with a body (POST/PUT) carry `X-PD-SIGN`: base64 of an **MD5withRSA**
(PKCS#1 v1.5) signature over the **exact JSON string sent as the body**, using
the merchant RSA private key.

The body is serialized once and that same string is both signed and sent —
re-serializing changes bytes and breaks the signature. GET and empty-body calls
need no signature.

`photonpay.spec.ts` pins `sign()` byte-for-byte against the vendor's published
worked example. If that test ever fails, every signed request will be rejected
with "invalid sign".

Reading the response tells you which half failed, which matters when debugging:

| Response | Meaning |
|---|---|
| `code 1001` `"invalid sign"` | the signature itself was rejected |
| `code 1000` `"<field> can not be blank"` | **signature accepted**, payload incomplete |

So a `1000` is a *passing* signature check. `scripts/photonpay-smoke.mjs` asserts
on exactly this, and also sends a deliberately bad signature to confirm the
server still enforces verification — otherwise the check would pass against a
server that had stopped verifying altogether.

Keys live in `.secrets/photonpay/` (gitignored):

```
merchant_private_pkcs8.pem      signs our requests
merchant_public.pem             uploaded to the portal (开发者)
photonpay_platform_public.pem   verifies their webhooks
uat/                            the same three for the test tenant
```

The platform public key may differ per tenant. If webhooks start returning 401
after an environment change, re-download it from 开发者 → API Key → PhotonPay公钥
before suspecting anything else.

## 5. Webhooks

Callbacks arrive with an `x-pd-sign` header, verified with the same MD5withRSA
primitive against PhotonPay's platform public key, over the **raw received
bytes** — never a re-serialized object.

Two hard vendor requirements:

1. Verify the signature before doing anything with the payload. Reject with 401
   on failure.
2. Respond `{"roger": true}`. **Eight consecutive non-conforming responses
   suspend delivery of every webhook topic on the account**, not just the failing
   one. Any handler must therefore ack rather than 500 on a payload it cannot
   process — including when a payload is signed but malformed.

Subscribe with `PUT /exchange-center/open/api/v1/webhook/notification`. Topics
used for issuing:

| topicCode | templateCode |
|---|---|
| `issuing_transaction_topic` | `issuing_transaction_v4_template` |
| `issuing_card_status_update_topic` | `issuing_card_status_update_v4_template` |

Treat webhooks as the source of truth; query endpoints are for reconciliation and
recovery only. The vendor explicitly asks that we not poll at high frequency.

## 6. API surface

All paths relative to `PHOTONPAY_BASE_URL`.

| Client method | HTTP + path |
|---|---|
| `getCardBins()` | `GET /vcc/openApi/v4/getCardBin` |
| `openCard()` | `POST /vcc/openApi/v4/openCard` |
| `getRequestResult()` | `GET /vcc/openApi/v4/getRequestResult` |
| `getCardDetail()` | `GET /vcc/openApi/v4/getCardDetail` |
| `getCvv()` | `GET /vcc/openApi/v4/getCvv` |
| `freezeCard()` | `POST /vcc/openApi/v4/freezeCard` |
| `cancelCard()` | `POST /vcc/openApi/v4/cancelCard` |
| `addCardholder()` | `POST /vcc/openApi/v4/addCardholder` |
| `preRecharge()` | `GET /vcc/openApi/v4/preRecharge` |
| `recharge()` | `POST /vcc/openApi/v4/recharge` |
| `rechargeReturn()` | `POST /vcc/openApi/v4/rechargeReturn` |
| `getIssuingHistory()` | `GET /vcc/openApi/v4/pagingIssuingHistory` |
| `getTradeOrders()` | `GET /vcc/openApi/v4/pagingVccTradeOrder` |
| `sandboxTransaction()` | `POST /vcc/open/v2/sandBoxTransaction` |
| `getWebhookTopics()` | `GET /exchange-center/open/api/v1/webhook/notification` |
| `subscribeWebhook()` | `PUT /exchange-center/open/api/v1/webhook/notification` |
| `createCashierSession()` | `POST /txncore/openApi/v5/cashierSession` |

Notes:

- Responses are `{ code, msg, data }`; success is `code === "0000"` (or `"0"`).
  `cashierSession` is the exception — its results are **siblings of `code`**, not
  nested under `data`.
- `sandBoxTransaction` sits on `open/v2`, not `openApi/v4`, and its card field is
  `cardID` with a capital ID. It is how you drive a real issuing webhook on
  sandbox without a real merchant.
- `requestId` is the idempotency key on every card mutation. A retry with the
  same `requestId` must not mint a second card; `getRequestResult` re-reads the
  outcome of an interrupted call.
- Omitting `cardholderId` on `openCard` attaches the card to the account's
  default cardholder. That is VIZA's setup — one company cardholder, not one per
  applicant.

## 7. Where the runner wiring goes

Only two countries actually pay a fee with a card today.

**Vietnam** — `src/index.ts` resolves a card via
`consumeVietnamCardSessionWithGrace()` in `processVnItem`, and again in
`processVnPaymentItem` for the resume path. A PhotonPay card becomes a third
fallback tier after the client-typed session and before
`loadVietnamFixedCardFromEnv()`. `loadApplicantData()` has already put
`profile.id` in scope, so the `applicationId` ↔ `applicantId` mapping that
blocked the Airwallex design is not a problem here. Convert the returned
`EscrowCard` with `parseVietnamFixedCardInput()`; call
`finalizePhotonPayEscrowCard()` once payment reaches `paid`.

**Indonesia** — `src/indonesia/runner.ts` resolves
`oneTimeCard ?? takeOneTimeCard?.()`. `takeOneTimeCard` is already a lazy
callback, which makes it the cleanest seam in the codebase: mint the card at the
moment the Finpay form renders and cancel it seconds later.

Do Vietnam first. It has a manual fallback and a resume-by-registration-code
recovery path; Indonesia fails hard with no fallback if no card is available.

The BIN must be a scheme the Vietcombank brand-tile selector recognises
(VISA / MASTERCARD / JCB / AMEX) and that Finpay accepts.

Every other country runner halts before payment, several with the literal reason
"escrow-card payment pending integration". Enabling those means reviving the
seven `pay*WithEscrowCard` modules, which read from the vault rather than taking
a card in memory — a separate, larger piece of work.

## 8. PCI and compliance constraints

From the signed acceptance workbook, item 7 — these are contractual, not advice:

- **Never store the CVV.** Not encrypted, not anywhere.
- **Do not store the PAN or expiry** unless genuinely required, and then only
  encrypted.
- Store the minimum: the card id and a masked number (`first6******last4`).

What the code does: `photonpay-card-provider.ts` vaults only
`viza.issued_card.id` and `viza.issued_card.masked`. The PAN, expiry and CVV are
returned in memory to the caller, used once at the payment form, and never
written down. `photonpay.ts` redacts `cardNo`/`cardNumber`/`pan`/`cvv`/`cvv2`/
`expirationDate`/`expiryDate` plus the `X-PD-TOKEN`, `X-PD-SIGN` and
`Authorization` headers before any log line is emitted.

Known gap: the redaction regex matches string values only, and does not cover
cardholder PII (`certId`, `dateOfBirth`, `email`, `mobile`) sent to
`addCardholder`. Tighten before that endpoint is used in anger.

Operational rule from `AGENTS.md`: `GET /deploy-ready` must keep returning 409
while a card is unconsumed, so a deploy cannot kill a session holding live card
material.

## 9. Logging

Acceptance item 5 requires request time, body, headers, response time, body,
headers and status for every call, retained for vendor support to debug against.
`PhotonPayClient` funnels every request through one `send()` chokepoint that logs
both directions with duration and status, redacted per §8. Enable the built-in
console logger with `PHOTONPAY_LOG=1`, or pass a `logger` into the config to
route it at your own sink.

The token fetch currently bypasses `send()` and so is not logged. Worth fixing if
vendor support ever needs to debug an auth failure.

## 10. Env

See the `PhotonPay issuing` block in `.env.example`. Required when enabled:

```
PHOTONPAY_ENABLED=false
PHOTONPAY_BASE_URL=https://x-api.sandbox.photontech.cc   # required, no default
PHOTONPAY_APP_ID=
PHOTONPAY_APP_SECRET=
PHOTONPAY_PRIVATE_KEY= | PHOTONPAY_PRIVATE_KEY_PATH=
PHOTONPAY_PLATFORM_PUBLIC_KEY= | PHOTONPAY_PLATFORM_PUBLIC_KEY_PATH=
PHOTONPAY_ISSUING_BIN=
PHOTONPAY_ISSUING_CURRENCY=USD
PHOTONPAY_ISSUING_ACCOUNT=          # funding accountNo, FA-USD…
PHOTONPAY_ISSUING_CARDHOLDER_ID=    # optional; empty = account default holder
PHOTONPAY_ISSUING_FX_BUFFER_PCT=0
```

Credentials live in `.secrets/` (gitignored), one file per environment —
`prod.env` and `uat.env`. Neither is committed:

```
set -a; . .secrets/photonpay/prod.env; set +a
node scripts/photonpay-smoke.mjs --env prod
```

The smoke script is dependency-free and validates auth, signing, signature
enforcement and connectivity in one run. Nothing else is testable until it
passes.

### Production account shape (read 2026-07-26)

The live identifiers — app id, funding `accountNo`, BIN, member id — are **not
recorded here on purpose**. They live in `.secrets/photonpay/prod.env`
(gitignored), and every one of them is readable at runtime from the API:
`getCardBin` for the BIN, `wallet/openApi/v4/account/list` for the funding
account. Read them, do not hardcode them.

What matters for design, and was true at that date:

| | |
|---|---|
| Card BINs available | **exactly one** — MasterCard, USD, `share,recharge` |
| Currency accounts | seven (USD, GBP, EUR, JPY, CNH, HKD, IDR) |
| Cardholder | one, approved. Omit `cardholderId` to use it as the account default |
| Card quota | 300 available, 0 issued |
| Balance | **0.00 across all seven accounts** |

Two consequences worth planning around:

- **Only a MasterCard BIN exists.** The Vietcombank brand-tile selector must pick
  MASTERCARD, and Finpay must accept MasterCard, or VN/ID payment will fail at
  the form even though issuing succeeds.
- **Only USD.** Government fees priced in VND/IDR will be FX'd by PhotonPay at
  authorisation. Confirm the spread before relying on an exact-amount card load.

## 11. Open items

Blocking a first real card:

1. **Fund the USD account.** It is at 0.00. Nothing can be loaded until it has
   money.
2. **Allowlist the production backend's egress IP** (§2). Only a workstation IP
   is currently listed, so issuing would work locally and fail on Render/Fly.
3. **Set the webhook URL.** Developers → Developer settings → Webhook has the
   subscription toggle ON but an empty URL, so no callback is delivered anywhere.
   Decide the public endpoint and register it, then subscribe the issuing topics.

To confirm with PhotonPay:

4. Is the account's MasterCard BIN 3DS-capable? Vietnam's payment step goes
   through a Vietcombank 3DS challenge, and only that one BIN is available.
5. What FX spread applies when a USD card authorises a VND or IDR charge, and
   what should `PHOTONPAY_ISSUING_FX_BUFFER_PCT` be as a result?
6. Is the account default cardholder sufficient for volume issuing, or is a
   per-applicant cardholder (`addCardholder`) required for compliance?
7. Card quota is 300. What is the reissue/renewal policy once it is consumed —
   single-use cards will burn through it quickly.
