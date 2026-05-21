# Identity verification (PRODUCT-007)

## Gate semantics

A `visa_packages` row may carry `requires_stripe_identity=true`. When set, the corresponding application **cannot** be enqueued for runner submission until a verified `stripe_identity_session` exists.

Enforcement points:

1. **Producer** (whatever inserts `submission_queue` rows): call `isApplicationIdentityVerified(applicationId)` first; refuse with a clear error when false.
2. **Worker** (already running): double-check at claim time so an enqueue that races a Stripe webhook still gets caught.

## Per-package flag

Set on the package row in `/admin/pricing` (or directly via SQL during seeding):

```sql
UPDATE visa_packages SET requires_stripe_identity = TRUE
 WHERE (country, visa_type) IN (('US','b1b2'),('UK','standard'));
```

The decision of which countries need the gate is a compliance call — high-fraud destinations / packages with biometric requirements should be gated.

## Flow

1. Applicant lands on `/application/[id]` and sees the "Verify your identity" banner.
2. Clicks the CTA → `startStripeIdentitySession(applicationId)` returns either a `client_secret` (for the inline modal) or a `hostedUrl` (for the redirect flow).
3. Applicant completes the Stripe-hosted document + selfie + liveness flow.
4. Stripe fires `identity.verification_session.verified` → our webhook calls `recordStripeIdentityEvent({ sessionId, status: 'verified', lastReportId })`.
5. `/application/[id]` polls the status and unlocks the submission CTA.

## Webhook wiring

In `app/api/stripe/webhooks/route.ts`:

```ts
case "identity.verification_session.verified":
case "identity.verification_session.requires_input":
case "identity.verification_session.canceled": {
  const session = event.data.object as Stripe.Identity.VerificationSession;
  await recordStripeIdentityEvent({
    sessionId: session.id,
    status: session.status,
    lastErrorCode: session.last_error?.code ?? null,
    lastReportId: session.last_verification_report ?? null,
  });
  break;
}
```

## Cost

Stripe Identity charges per session — see https://stripe.com/identity/pricing. Track spend under `/admin/costs` (OBS-003). Budget alarm at $500/month sustained.

## Failure modes

- **`requires_input`** with `last_error.code='document_unverified_other'` → applicant retries with a different document.
- **`canceled`** by the applicant → unlock the CTA again so they can re-start.
- **`processing`** for > 1h → page on-call (likely Stripe outage).

## What this is NOT

- Not a replacement for the face-match check (DOCUP-004). Stripe Identity proves the document is genuine + the selfie matches the document; face-match proves the selfie matches the applicant photo stored against the application. Both run.
- Not used for non-gated packages — adds friction unnecessarily.
