# Airwallex Sandbox Payment Testing

## Local Environment

Use local-only `.env.local` values. Never commit real Airwallex credentials.

```text
AIRWALLEX_ENV=demo
AIRWALLEX_BASE_URL=https://api-demo.airwallex.com
AIRWALLEX_CLIENT_ID=<sandbox client id>
AIRWALLEX_API_KEY=<sandbox api key>
AIRWALLEX_WEBHOOK_SECRET=<sandbox webhook secret>
APP_BASE_URL=http://localhost:3000
```

`AIRWALLEX_LOGIN_AS` is optional and should only be set when the Airwallex
account requires login-as account routing.

## Smoke Flow

1. Start the frontend app from `viza-fe/internal-website`.
2. Open `/client/subscription` while signed in.
3. Select a monthly or pay-per country product.
4. Confirm the browser navigates to `/payments/checkout?paymentId=...`.
5. Verify the page shows a CNY amount and loads the Airwallex drop-in element.
6. Complete a sandbox card payment or choose a wallet method.
7. Confirm the browser returns to `/payments/result?paymentId=...`.
8. Confirm the result page polls `/api/payments/airwallex/:paymentId/status`.

## Webhook

Configure the Airwallex sandbox webhook notification URL:

```text
<APP_BASE_URL>/api/webhooks/airwallex
```

Subscribe to PaymentIntent events, especially succeeded, failed, and cancelled
events. Copy the webhook secret into `AIRWALLEX_WEBHOOK_SECRET`.

## Expected Database Writes

The integration uses the existing `payment_records` table:

- `provider`: `airwallex`
- `provider_session_id`: Airwallex PaymentIntent id
- `provider_payment_id`: Airwallex PaymentIntent id
- `amount_cents`: CNY minor units from the server-side VIZA product catalog
- `status`: `pending`, `paid`, or `failed`
- `metadata.airwallex`: provider status and next-action diagnostics

If a record has an `application_id`, successful webhook/status reconciliation
also updates `applications.payment_status` to `paid`.
