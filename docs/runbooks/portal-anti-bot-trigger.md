# Runbook — portal anti-bot trigger

> Last reviewed: 2026-05-07.
> Alert class: `runner.anti_bot.<country>` (also fires
> `runner.failed.<country>` once retries exhaust).

## Symptoms

- Multiple jobs for the same country fail with `anti_bot_gate` /
  Cloudflare challenge / 403 / unusual redirect to a captcha page
  before the runner reaches its first form.
- US CEAC: `outcome: "anti_bot_gate"` in the run JSON.
- VFS Global corridors: 503 served via Cloudflare.

## Diagnosis

- Pull the most recent failed jobs for the country:

  ```sql
  SELECT id, last_error, metadata->'proxy' AS proxy
    FROM runner_job
   WHERE country = '<country>' AND status = 'failed'
   ORDER BY finished_at DESC LIMIT 10;
  ```

- Look at the proxy session ids — are they all on the same upstream
  IP? If yes, that IP is burned.
- Open `/admin/jobs/<id>` for the most recent fail and look at the
  step screenshots. Anti-bot pages typically render at step 0 / 1.

## Mitigation

1. Force a proxy session rotation by clearing the sticky pin:

   ```sql
   UPDATE applicant_browser_profile
      SET storage_state_json = NULL
    WHERE applicant_id IN (
      SELECT applicant_id FROM applications
       WHERE country = '<country>'
         AND id IN (SELECT application_id FROM runner_job
                    WHERE country = '<country>' AND status = 'failed'
                      AND finished_at > NOW() - INTERVAL '1 hour')
    );
   ```

2. Drop the country's `runner_concurrency_cap.max_concurrent` to 1
   while the portal is in this state:

   ```sql
   UPDATE runner_concurrency_cap SET max_concurrent = 1
    WHERE country = '<country>';
   ```

3. If the anti-bot is global (not session-specific), pause and wait
   the cool-down out:

   ```sql
   UPDATE runner_concurrency_cap SET paused = TRUE
    WHERE country = '<country>';
   ```

   Resume after 30–60 minutes; verify with the canary
   (`/admin/portal-health`).

## Escalation

- 3+ alert fires for the same country in 24 h → escalate to the
  proxy provider (Bright Data) for IP-tier rotation.
- Sustained block (> 4 h) → consider switching the country to
  `paper_only_no_fee` mechanism temporarily and notify staff.
