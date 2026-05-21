# Government-fee routing per country (PAY-003)

> Last reviewed: 2026-05-07.

Each visa portal collects the government fee in a different way. We
classify each into one of four mechanisms and pick the one that costs
us the least operational risk while staying inside the portal's terms
of service. The runner code references this table by importing the
mechanism enum from `viza-be/submission-service/src/payment-routing.ts`.

## Mechanism options

| Code | Mechanism | When chosen |
|---|---|---|
| `runner_escrow_card` | (a) Runner pays the portal with a virtual card minted from VIZA's escrow account. | Portal accepts third-party cards, no PCI flag, government-fee amount predictable, refunds on cancel cleanly. |
| `client_in_portal` | (b) Runner pauses at the payment screen and hands the live session off to the client to enter their own card; the runner resumes after the portal-side success redirect. | Portal forbids third-party cards, or applicant must declare their own funding, or fee is variable until after submission (multi-stream). |
| `applicant_direct_link` | (c) Runner generates a portal-supplied payment URL (e.g. forceResume + payment token) and surfaces it to the applicant; client pays out-of-band; runner resumes when an inbound confirmation email arrives at the applicant alias. | Asynchronous portals where the runner's session can't survive a client payment redirect (UK forceResume, France-Visas e-pay). |
| `paper_only_no_fee` | (d) No portal-side fee; the consular fee is collected at the in-person appointment or via a separate paper transfer. VIZA records the order as `govt_pending_offline`. | Embassy/consulate paper flows (some Schengen-via-VFS, some JP itineraries, ID B211a paper backup). |

## Per-country routing

| Country | Visa type | Mechanism | Notes |
|---|---|---|---|
| United States | B1_B2 (DS-160) | `applicant_direct_link` | DS-160 + MRV fee paid via consular bank link before interview. |
| United Kingdom | UK_STANDARD_VISITOR | `client_in_portal` | UKVI portal collects fee mid-flow; runner stops at pay and hands off to client. |
| EU / Schengen (FR, IT, ...) | EU_SCHENGEN_C_SHORT_STAY | `client_in_portal` | France-Visas + Italy-VFS-CN both expect the applicant to enter their card on portal. |
| Vietnam | VN_E_VISA | `runner_escrow_card` | **Reference implementation.** Portal accepts third-party cards; fee is fixed (USD 25 / 50). Runner submits via VIZA's virtual card; line item logged. |
| Australia | AU_VISITOR_600 | `client_in_portal` | ImmiAccount payment gate; runner pauses at Review-then-Pay. |
| Japan | JP_TOURIST | `paper_only_no_fee` | Free visa for many nationalities; paid at consulate when not. |
| Indonesia | B211A / ID_C1_TOURIST | `runner_escrow_card` | imigrasi.go.id online; portal accepts third-party cards. |
| Egypt | EG_E_VISA | `runner_escrow_card` | visa2egypt.gov.eg; flat USD 25 (single) / 60 (multi). |
| South Korea | KR_C39_SHORT_TERM_VISIT | `applicant_direct_link` | k-eta.go.kr; applicant pays via the portal's own gateway. |
| Thailand | TH_TOURIST_E_VISA | `runner_escrow_card` | thaievisa.go.th accepts third-party cards. |
| Malaysia | MY_TOURIST_E_VISA | `runner_escrow_card` | imigresen-online.imi.gov.my. |
| Singapore | SG_VISITOR_VISA | `client_in_portal` | SAVE portal; sponsor or applicant pays. |
| Hong Kong | HK_VISIT_VISA | `paper_only_no_fee` | Fee paid on collection at HKID. |
| Macau | MO_VISIT_VISA | `paper_only_no_fee` | Fee on entry / on collection. |
| New Zealand | NZ_VISITOR_VISA | `client_in_portal` | Immigration NZ portal payment gate. |
| Russia | RU_E_VISA | `runner_escrow_card` | electronic-visa.kdmid.ru flat USD 52. |
| Turkey | TR_E_VISA | `runner_escrow_card` | evisa.gov.tr flat USD 50. |
| UAE | AE_TOURIST_VISA | `runner_escrow_card` | smartservices.ica.gov.ae. |
| Canada | CA_TRV | `client_in_portal` | IRCC portal forces in-portal payment. |
| Maldives | MV_IMUGA | `paper_only_no_fee` | Free e-visa. |
| Philippines | PH_TEMPORARY_VISITOR_VISA | `applicant_direct_link` | Embassy bank deposit URL. |
| Cambodia | KH_TOURIST_E_VISA | `runner_escrow_card` | evisa.gov.kh. |
| Laos | LA_TOURIST_E_VISA | `runner_escrow_card` | laoevisa.gov.la. |
| Sri Lanka | LK_ETA | `runner_escrow_card` | eta.gov.lk. |
| India | IN_E_VISA | `runner_escrow_card` | indianvisaonline.gov.in/evisa accepts third-party cards. |
| South Africa | ZA_VISITOR_VISA | `applicant_direct_link` | VFS Global pay-link; applicant pays. |

## Reference implementation — Vietnam

The Vietnam runner uses `runner_escrow_card`. The runner:

1. Reaches the portal payment step with a normalised application body.
2. Selects "Pay by international card" and submits the escrow-card
   primary account number, expiry, and CVV from the
   per-applicant credential vault under
   `viza.escrow.card.{pan,expiry,cvv}` (rotated quarterly via
   `scripts/rotate-applicant-secret.ts`, see SECRETS-003).
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
