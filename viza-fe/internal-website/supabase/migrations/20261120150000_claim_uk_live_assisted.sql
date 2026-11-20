-- Restore UK live-assisted rows to the generic legacy claim RPC.
--
-- Migration 0212 added the provider denylist by copying the claim function's
-- status list, but omitted uk_live_assisted_pending. The worker's work probe
-- still sees that status, so a queued UK job can keep a Machine alive while
-- remaining unclaimed. Preserve the existing eight-argument signature,
-- denylist behavior, lease fence, and service-role-only execution.

CREATE OR REPLACE FUNCTION public.claim_submission_queue_batch(
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 20,
  p_lease_seconds INTEGER DEFAULT 900,
  p_target_job_id UUID DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 3,
  p_provider_allowlist TEXT[] DEFAULT NULL,
  p_allow_failed BOOLEAN DEFAULT FALSE,
  p_provider_denylist TEXT[] DEFAULT NULL
)
RETURNS SETOF public.submission_queue
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NULLIF(BTRIM(p_worker_id), '') IS NULL THEN
    RAISE EXCEPTION 'p_worker_id must not be blank';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT sq.id
    FROM public.submission_queue AS sq
    WHERE (
        sq.status IN (
          'pending',
          'ds160_prefill_pending',
          'ds160_live_assisted_pending',
          'ds160_proof_pending',
          'fv_prefill_pending',
          'france_live_assisted_pending',
          'uk_prefill_pending',
          'uk_live_assisted_pending',
          'vn_dry_run_pending',
          'vn_live_assisted_pending',
          'vn_payment_pending',
          'sgac_dry_run_pending',
          'sgac_live_assisted_scheduled',
          'sgac_live_assisted_pending',
          'mdac_dry_run_pending',
          'mdac_live_assisted_scheduled',
          'mdac_live_assisted_pending',
          'tdac_dry_run_pending',
          'kr_eac_dry_run_pending',
          'tdac_live_assisted_scheduled',
          'tdac_live_assisted_pending',
          'kr_eac_live_assisted_scheduled',
          'kr_eac_live_assisted_pending',
          'phetravel_dry_run_pending',
          'phetravel_live_assisted_scheduled',
          'phetravel_live_assisted_pending',
          'vn_prefill_pending',
          'au_prefill_pending'
        )
        OR (
          COALESCE(p_allow_failed, FALSE)
          AND p_target_job_id IS NOT NULL
          AND sq.status IN (
            'ds160_prefill_failed',
            'ds160_live_assisted_failed',
            'ds160_proof_failed',
            'fv_prefill_failed',
            'france_live_assisted_failed',
            'uk_prefill_failed',
            'vn_dry_run_failed',
            'vn_live_assisted_failed',
            'vn_payment_failed',
            'sgac_dry_run_failed',
            'sgac_live_assisted_failed',
            'mdac_dry_run_failed',
            'mdac_live_assisted_failed',
            'tdac_dry_run_failed',
            'kr_eac_dry_run_failed',
            'tdac_live_assisted_failed',
            'kr_eac_live_assisted_failed',
            'phetravel_dry_run_failed',
            'phetravel_live_assisted_failed',
            'vn_prefill_failed',
            'au_prefill_failed'
          )
        )
      )
      AND sq.attempts < GREATEST(1, COALESCE(p_max_attempts, 3))
      AND (p_target_job_id IS NULL OR sq.id = p_target_job_id)
      AND (
        COALESCE(CARDINALITY(p_provider_allowlist), 0) = 0
        OR sq.provider = ANY (p_provider_allowlist)
      )
      AND (
        COALESCE(CARDINALITY(p_provider_denylist), 0) = 0
        OR sq.provider IS NULL
        OR NOT (sq.provider = ANY (p_provider_denylist))
      )
      AND (sq.locked_until IS NULL OR sq.locked_until < NOW())
    ORDER BY
      CASE
        WHEN sq.status IN (
          'sgac_live_assisted_scheduled',
          'sgac_live_assisted_pending',
          'mdac_live_assisted_scheduled',
          'mdac_live_assisted_pending',
          'tdac_live_assisted_scheduled',
          'tdac_live_assisted_pending',
          'kr_eac_live_assisted_scheduled',
          'kr_eac_live_assisted_pending',
          'phetravel_live_assisted_scheduled',
          'phetravel_live_assisted_pending'
        ) THEN 0
        WHEN sq.status IN (
          'sgac_dry_run_pending',
          'mdac_dry_run_pending',
          'tdac_dry_run_pending',
          'kr_eac_dry_run_pending',
          'phetravel_dry_run_pending'
        ) THEN 1
        WHEN sq.status IN ('vn_live_assisted_pending', 'uk_live_assisted_pending') THEN 2
        WHEN sq.status = 'vn_dry_run_pending' THEN 3
        ELSE 10
      END,
      sq.created_at,
      sq.id
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.submission_queue AS sq
  SET
    locked_by = BTRIM(p_worker_id),
    locked_at = NOW(),
    locked_until = NOW() + MAKE_INTERVAL(
      secs => GREATEST(60, LEAST(COALESCE(p_lease_seconds, 900), 3600))
    ),
    updated_at = NOW()
  FROM candidates
  WHERE sq.id = candidates.id
  RETURNING sq.*;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER, TEXT[], BOOLEAN, TEXT[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER, TEXT[], BOOLEAN, TEXT[]
) TO service_role;

COMMENT ON FUNCTION public.claim_submission_queue_batch(
  TEXT, INTEGER, INTEGER, UUID, INTEGER, TEXT[], BOOLEAN, TEXT[]
) IS
  'Atomically claims generic submission_queue rows with optional provider allow/deny filtering; failed rows are eligible only for an explicitly targeted retry.';

DO $assert$
DECLARE
  claim_oid OID;
  claim_definition TEXT;
BEGIN
  SELECT p.oid, pg_get_functiondef(p.oid)
    INTO claim_oid, claim_definition
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
   WHERE p.oid = to_regprocedure(
     'public.claim_submission_queue_batch(text,integer,integer,uuid,integer,text[],boolean,text[])'
   );

  IF claim_oid IS NULL THEN
    RAISE EXCEPTION 'claim_submission_queue_batch eight-argument signature is missing';
  END IF;
  IF POSITION('''uk_live_assisted_pending''' IN claim_definition) = 0 THEN
    RAISE EXCEPTION 'claim_submission_queue_batch does not claim UK live-assisted rows';
  END IF;
  IF POSITION('FOR UPDATE SKIP LOCKED' IN claim_definition) = 0
     OR POSITION('locked_until = NOW() + MAKE_INTERVAL' IN claim_definition) = 0 THEN
    RAISE EXCEPTION 'claim_submission_queue_batch lost its atomic lease fence';
  END IF;
  IF NOT has_function_privilege('service_role', claim_oid, 'EXECUTE')
     OR has_function_privilege('anon', claim_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', claim_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'claim_submission_queue_batch execution ACL is not service-role-only';
  END IF;
END;
$assert$;
