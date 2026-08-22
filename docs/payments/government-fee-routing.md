# Government-fee routing per country (PAY-003)

> Last reviewed: 2026-08-15.

> Product policy: every electronically payable official fee must move to
> `runner_escrow_card`. Applicants do not enter cards on official portals and
> are not sent away to pay directly. Routes without a verified live payment
> adapter fail closed into staff review without issuing a card.

Each visa portal collects the government fee in a different way. We
classify each into one of four mechanisms and pick the one that costs
us the least operational risk while staying inside the portal's terms
of service. The runner code references this table by importing the
mechanism enum from `viza-be/submission-service/src/payment-routing.ts`.

## Mechanism options

| Code | Mechanism | When chosen |
|---|---|---|
| `runner_escrow_card` | (a) Runner pays the portal with a virtual card minted from VIZA's escrow account. | Portal accepts third-party cards, no PCI flag, government-fee amount predictable, refunds on cancel cleanly. |
| `client_in_portal` | Legacy migration marker for a runner that currently pauses at the payment screen. | Do not expose as an applicant handoff. Map the hosted payment controls and migrate the route to VIZA-managed virtual-card payment before launch. |
| `applicant_direct_link` | Legacy migration marker for an asynchronous portal-supplied payment URL. | Do not send the link to the applicant. Add a VIZA worker capable of opening the link, paying with the application-scoped card, and recording confirmation. |
| `paper_only_no_fee` | (d) No portal-side fee; the consular fee is collected at the in-person appointment or via a separate paper transfer. VIZA records the order as `govt_pending_offline`. | Embassy/consulate paper flows (some Schengen-via-VFS, some JP itineraries, ID B211a paper backup). |

## Per-country routing

| Country | Visa type | Mechanism | Notes |
|---|---|---|---|
| United States | B1_B2 (DS-160) | `runner_escrow_card` | VIZA-managed MRV payment; fail closed to staff review until the selected appointment-post adapter is verified. |
| United Kingdom | UK_STANDARD_VISITOR | `runner_escrow_card` | UKVI hosted payment is amount/currency checked before a limited virtual card is acquired. |
| EU / Schengen (FR) | EU_SCHENGEN_C_SHORT_STAY | `runner_escrow_card` | France electronic fees are VIZA-managed; unsupported or uncertain payment pages enter staff review. Italy is an explicit offline route. |
| Vietnam | VN_E_VISA | `runner_escrow_card` | **Reference implementation.** Portal accepts third-party cards; fee is fixed (USD 25 / 50). Runner submits via VIZA's virtual card; line item logged. |
| Australia | AU_VISITOR_600 | `runner_escrow_card` | VIZA-managed payment; uncertain ImmiAccount controls enter staff review. |
| Japan | JP_TOURIST | `paper_only_no_fee` | Free visa for many nationalities; paid at consulate when not. |
| Indonesia | B211A / ID_C1_TOURIST | `runner_escrow_card` | imigrasi.go.id online; portal accepts third-party cards. |
| Egypt | EG_E_VISA | `runner_escrow_card` | visa2egypt.gov.eg; flat USD 25 (single) / 60 (multi). |
| South Korea | KR_C39_SHORT_TERM_VISIT | `runner_escrow_card` | VIZA-managed official gateway payment; unsupported gateway states enter staff review. |
| Thailand | TH_TOURIST_E_VISA | `runner_escrow_card` | thaievisa.go.th accepts third-party cards. |
| Malaysia | MY_TOURIST_E_VISA | `runner_escrow_card` | imigresen-online.imi.gov.my. |
| Singapore | SG_VISITOR_VISA | `runner_escrow_card` | VIZA-managed SAVE payment; unsupported payment states enter staff review. |
| Hong Kong | HK_VISIT_VISA | `paper_only_no_fee` | Fee paid on collection at HKID. |
| Macau | MO_VISIT_VISA | `paper_only_no_fee` | Fee on entry / on collection. |
| New Zealand | NZ_VISITOR_VISA | `runner_escrow_card` | VIZA-managed Immigration NZ payment; unsupported payment states enter staff review. |
| Russia | RU_E_VISA | `runner_escrow_card` | electronic-visa.kdmid.ru flat USD 52. |
| Turkey | TR_E_VISA | `runner_escrow_card` | evisa.gov.tr flat USD 50. |
| UAE | AE_TOURIST_VISA | `runner_escrow_card` | smartservices.ica.gov.ae. |
| Canada | CA_TRV | `runner_escrow_card` | VIZA-managed IRCC payment; unsupported payment states enter staff review. |
| Maldives | MV_IMUGA | `paper_only_no_fee` | Free e-visa. |
| Philippines | PH_TEMPORARY_VISITOR_VISA | `runner_escrow_card` | VIZA-managed where electronic payment is supported; otherwise staff review. |
| Cambodia | KH_TOURIST_E_VISA | `runner_escrow_card` | evisa.gov.kh. |
| Laos | LA_TOURIST_E_VISA | `runner_escrow_card` | laoevisa.gov.la. |
| Sri Lanka | LK_ETA | `runner_escrow_card` | eta.gov.lk. |
| India | IN_E_VISA | `runner_escrow_card` | indianvisaonline.gov.in/evisa accepts third-party cards. |
| South Africa | ZA_VISITOR_VISA | `runner_escrow_card` | VIZA opens the VFS pay-link in a worker; unverified controls enter staff review without card issuance. |

## Reference implementation — Vietnam

The Vietnam runner uses `runner_escrow_card`. The runner:

1. Reaches the portal payment step with a normalised application body.
2. Selects "Pay by international card" and requests a just-in-time PhotonPay
   virtual card tied to the official-fee allocation and payment intent. PAN,
   expiry, and CVV stay in worker memory; only the issuer card id and masked PAN
   may be persisted.
3. On the portal's success redirect, the runner records an
   `order_line(kind='govt', payee='vietnam', amount_cents, currency,
   metadata={portal_receipt_id})` row tied to the application's
   open `order`.
4. If the portal returns a card decline, the runner flips the order
   to `status='govt_payment_failed'` and surfaces a re-attempt prompt
   to ops.

## Tests

`viza-be/submission-service/src/__tests__/payment-routing.spec.ts`
asserts every catalog entry maps to a known mechanism so the table
above and the source of truth in code stay paired.
