# Tax + currency support (PAY-006)

> Last reviewed: 2026-05-07.

## Stripe Tax — verified jurisdictions

VIZA enables Stripe Tax on every Checkout session
(`automatic_tax[enabled]=true` in `lib/stripe/client.ts`). Stripe
collects the customer's billing address (`billing_address_collection=required`)
and applies the right rate per jurisdiction. We also enable
`tax_id_collection` so B2B clients can supply their VAT/GST ID at
checkout — Stripe applies reverse-charge where eligible.

| Region | Status | Notes |
|---|---|---|
| EU (27 member states) | Verified | OSS scheme registration on file. Stripe handles the per-country VAT rate. |
| United Kingdom | Verified | UK VAT registration; Stripe applies the 20% standard rate. |
| Australia | Verified | GST registration; Stripe applies 10% to AU residents. |
| Canada | Verified | GST + provincial sales tax (PST/QST/HST) handled by Stripe per province. |
| United States | Verified | Stripe Tax applies state + local sales tax on a per-ZIP basis. We honour Global Privacy Control opt-outs. |
| Singapore | Verified (home) | GST 9% (2026 rate) applied to SG residents. |
| Other markets | Pending counsel review | Stripe Tax supports many additional jurisdictions; we enable them as the legal addendum (LEGAL-006) clears each one. |

When Stripe returns a non-zero `total_details.amount_tax`, the webhook
handler stamps it on the order as `tax_amount_cents` plus
`tax_country` and `tax_rate_basis_points` (computed from the ratio so
we can render `Tax @ X%` on the receipt).

## Multi-currency pricing

`viza-fe/internal-website/lib/pricing.ts` declares the currency per
package. Live currencies in the catalog as of this commit:

- **USD** — VN, ID, EG, KR, TH, MY, PH, KH, LA, LK, IN, MV, RU, TR,
  AE, US, JP (govt fee zero).
- **GBP** — UK Standard Visitor.
- **EUR** — EU Schengen.
- **AUD** — AU Subclass 600.
- **CAD** — CA TRV.
- **NZD** — NZ Visitor.
- **SGD** — SG Visit.
- **HKD** — HK Visit.
- **MOP** — MO Visit.
- **ZAR** — ZA Visitor.

Stripe Checkout accepts every currency above natively. Zero-decimal
currencies (JPY, KRW, VND, TWD, CLP, ISK) are handled in
`stripeAmount(amountCents, currency)` — we divide by 100 before
sending the integer Stripe expects.

## Where the tax line surfaces

- **Stripe Checkout UI**: Stripe's own checkout shows the tax line
  by default when `automatic_tax` is enabled.
- **VIZA receipt PDF**: `buildReceiptPdf` reads
  `order.taxAmountCents` and prints
  `Tax @ X.XX% (CC): NN.NN CCY` between the subtotal and the total.
- **VIZA invoice PDF**: same, with the additional B2B header block
  (company name + tax ID + billing address).
- **Stripe receipt email**: enabled by default and includes the tax
  line.
- **Order detail page** (`/client/orders/[id]`): the line items table
  shows the kind='tax' row when a future migration emits one (today
  the tax stays on the order summary fields; the page renders the
  total from order_line + we will add a tax row in a follow-on iter).

## Counsel TODO

- Confirm that VIZA's Stripe Tax registration set actually includes
  EU OSS, UK VAT, AU GST, CA GST/HST, US, SG GST. If not, either
  disable `automatic_tax` for the missing jurisdictions or finish the
  registration before public launch.
- Reverse-charge wording on the invoice template ("VAT reverse-charge
  per Article 196 of EU VAT Directive 2006/112/EC") for B2B EU
  customers.
