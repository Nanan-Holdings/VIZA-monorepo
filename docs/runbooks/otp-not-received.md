# Runbook — OTP / confirmation mail not received

> Last reviewed: 2026-05-07.
> Alert class: `inbox.otp.not_received`.

## Symptoms

- Runner throws `InboxTimeoutError` after the configured wait window.
- Applicant complains that their visa-portal email never arrived.
- Sudden drop in `runner_metric.success` for VN / UK / KR (the flows
  that depend on inbound mail).

## Diagnosis

- Confirm the alias was minted:

  ```sql
  SELECT id, inbox_alias, inbox_alias_retired_at
    FROM applicant_profiles WHERE id = '<applicant_id>';
  ```

- Check Cloudflare Email Routing dashboard — any rejection / spam
  in the last hour for the alias?
- Check `inbound_email` directly:

  ```sql
  SELECT id, from_addr, subject, received_at, processed, quarantined,
         spam_score, rejection_reason
    FROM inbound_email
   WHERE to_addr = '<alias>'
   ORDER BY received_at DESC LIMIT 20;
  ```

- If `quarantined = TRUE`: spam score crossed the threshold —
  legitimate mail is being filtered. Lower
  `SPAM_SCORE_QUARANTINE` in wrangler.toml or whitelist the sender
  domain in the worker.

## Mitigation

1. If mail did land but `processed = FALSE`: the runner gave up
   before polling. Re-enqueue the runner_job (see
   [runner-job-stuck.md](./runner-job-stuck.md)).
2. If no mail in 30 min: the portal didn't send. Manually trigger
   the portal's "resend" path from the admin tools and re-poll.
3. If the alias was retired before the mail arrived: re-issue an
   alias via `assignApplicantInboxAlias` and ask the portal for a
   resend.

## Escalation

- Cloudflare Email Routing dashboard shows wide-spread rejection
  (DKIM/SPF break) → escalate to maintainer (DNS).
- Repeated misses for the same sender domain → tune the extractor
  in `viza-be/submission-service/src/inbox/extractors/<sender>.ts`.
