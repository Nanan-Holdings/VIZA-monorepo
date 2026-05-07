# Runbook — payment dispute / chargeback

> Last reviewed: 2026-05-07.
> Alert class: `payments.dispute.<id>`.

## Symptoms

- Stripe webhook delivered `charge.dispute.created`.
- `order.status = 'disputed'` and `submission_queue.status =
  'paused_dispute'` for the application (PAY-004 webhook handler).
- Slack alert with the dispute reason (fraudulent / not_received /
  product_unacceptable / ...).

## Diagnosis

- Pull the order + applicant + dispute metadata:

  ```sql
  SELECT o.id, o.status, o.metadata, ap.full_name, ap.email
    FROM "order" o
    JOIN applicant_profiles ap ON ap.id = o.applicant_id
   WHERE o.id = '<order_id>';
  ```

- Stripe dashboard → Disputes → look at the customer evidence
  bundle requirement and the deadline.

## Mitigation

1. Within 24 h: gather evidence — receipt PDF (PAY-005), runner
   timeline (`/admin/jobs/<id>`), proof of submission to the
   destination portal.
2. Submit evidence in Stripe dashboard before the deadline.
3. Keep the runner paused — `submission_queue.status =
   'paused_dispute'` is intentional. Do **not** flip back to
   `*_pending` until the dispute resolves.

## Escalation

- Dispute amount > USD 500 or pattern of fraudulent disputes → loop
  in the maintainer; consider blocking the applicant_id with
  `applicant_profiles.deletion_requested_at` and refusing future
  orders.
- Won disputes → unfreeze the queue:

  ```sql
  UPDATE submission_queue SET status = 'au_prefill_pending'
   WHERE application_id = '<id>' AND status = 'paused_dispute';
  ```
