-- Korea e-Arrival Card package, schema metadata, free-fee catalog row, and
-- shared-runner compatibility. Keep this separate from KR_C39_SHORT_TERM_VISIT
-- and K-ETA. The historical 0149 migration is immutable; the DO blocks below
-- replace only the affected function/view definitions and active-flow check
-- south_korea/kr_arrival_card tuple.

WITH product AS (
  SELECT
    'south_korea'::TEXT AS country,
    'KR_E_ARRIVAL_CARD'::TEXT AS visa_type,
    'Korea e-Arrival Card'::TEXT AS name,
    'Korea e-Arrival Card preparation and assisted submission for one foreign traveller. This is a free immigration arrival declaration, not a visa or K-ETA. The official submission window is the three-calendar-day window ending on the Korea arrival date; group declarations, visa applications, K-ETA applications, government-fee payment, and non-official websites are outside this package.'::TEXT AS description,
    jsonb_build_object(
      'official_portal_url', 'https://www.e-arrivalcard.go.kr/portal/main/index.do',
      'official_guide_url', 'https://www.e-arrivalcard.go.kr/portal/guide/eacTargetGuide.do',
      'form_seed', 'scripts/seed-kr-e-arrival-card-form-fields.ts',
      'scope', 'single_traveller_foreign_entry_declaration',
      'support_level', 'assisted_submission',
      'email_policy', 'runner_managed_viza_alias_only_user_notification_requires_consent',
      'timezone', 'Asia/Seoul',
      'submission_window', 'arrival_date_minus_two_calendar_days_through_arrival_date',
      'validity_hours', 72,
      'government_fee', jsonb_build_object(
        'mode', 'display_only',
        'amount_cents', 0,
        'currency', 'USD',
        'label', 'Korea e-Arrival Card government fee',
        'payer', 'applicant',
        'collection_method', 'official_portal',
        'source_url', 'https://www.e-arrivalcard.go.kr/portal/guide/eacTargetGuide.do'
      ),
      'official_options_snapshot', 'scripts/kr-e-arrival/official-options.snapshot.json',
      'group_submission', 'out_of_scope_v1',
      'eligibility_policy', 'Use the current official target guide at product entry. Do not infer a visa or K-ETA exemption from nationality alone.'
    ) AS metadata
), inserted AS (
  INSERT INTO public.visa_packages (country, visa_type, name, description, metadata)
  SELECT product.country, product.visa_type, product.name, product.description, product.metadata
  FROM product
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.visa_packages existing
    WHERE LOWER(existing.country) = LOWER(product.country)
      AND UPPER(existing.visa_type) = UPPER(product.visa_type)
  )
  RETURNING id
)
UPDATE public.visa_packages package
SET name = product.name,
    description = product.description,
    metadata = COALESCE(package.metadata, '{}'::JSONB) || product.metadata,
    is_active = TRUE,
    updated_at = NOW()
FROM product
WHERE LOWER(package.country) = LOWER(product.country)
  AND UPPER(package.visa_type) = UPPER(product.visa_type);

-- Official e-Arrival Card submission is free. package_pricing describes the
-- government fee only; any VIZA service fee remains a separate product price.
INSERT INTO public.package_pricing (
  visa_package_id,
  currency,
  government_fee_cents,
  agency_fee_cents,
  source
)
SELECT package.id, 'USD', 0, 0, 'seed'
FROM public.visa_packages package
WHERE LOWER(package.country) = 'south_korea'
  AND UPPER(package.visa_type) = 'KR_E_ARRIVAL_CARD'
ON CONFLICT (visa_package_id, currency)
DO UPDATE SET
  government_fee_cents = EXCLUDED.government_fee_cents,
  source = EXCLUDED.source,
  updated_at = NOW();

INSERT INTO public.government_fee_rules (
  visa_package_id,
  country,
  visa_type,
  fee_type,
  mode,
  amount_cents,
  currency,
  label,
  payer,
  collection_method,
  effective_from,
  source_url,
  notes,
  metadata
)
SELECT
  package.id,
  package.country,
  package.visa_type,
  'government_fee',
  'display_only',
  0,
  'USD',
  'Korea e-Arrival Card government fee',
  'applicant',
  'official_portal',
  CURRENT_DATE,
  'https://www.e-arrivalcard.go.kr/portal/guide/eacTargetGuide.do',
  'The official e-Arrival Card is free. Do not create an official-fee payment intent for this package.',
  jsonb_build_object('official_free', TRUE, 'package', 'KR_E_ARRIVAL_CARD')
FROM public.visa_packages package
WHERE LOWER(package.country) = 'south_korea'
  AND UPPER(package.visa_type) = 'KR_E_ARRIVAL_CARD'
  AND NOT EXISTS (
    SELECT 1
    FROM public.government_fee_rules existing
    WHERE existing.visa_package_id = package.id
      AND existing.fee_type = 'government_fee'
      AND existing.effective_to IS NULL
  );

-- The shared pool already has a Korea cap row from 0127. Keep one country cap
-- for both Korea e-Form and Korea e-Arrival Card, and never create an always-on
-- Korea-specific machine here.
INSERT INTO public.runner_concurrency_cap (country, max_concurrent, paused, notes)
VALUES ('south_korea', 1, FALSE, 'Shared pool: Korea e-Form and e-Arrival Card sessions')
ON CONFLICT (country) DO UPDATE
SET notes = EXCLUDED.notes,
    updated_at = NOW();

-- Extend the active-flow database fence without modifying 0149. Replacing the
-- exact kr_eform comparison with an IN-list is safe for every alias used in
-- these four functions and preserves their SECURITY DEFINER/GRANT attributes.
DO $$
DECLARE
  function_oid REGPROCEDURE;
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  FOR function_oid IN
    SELECT unnest(ARRAY[
      'public.enqueue_runner_pool_job(uuid,text,text,timestamptz,integer,text,jsonb,timestamptz)'::REGPROCEDURE,
      'runner_private.claim_runner_pool_job_core(text,integer,boolean,timestamptz,uuid,boolean)'::REGPROCEDURE,
      'runner_private.guard_runner_job_running_insert()'::REGPROCEDURE,
      'public.requeue_runner_job(uuid)'::REGPROCEDURE
    ])
  LOOP
    original_definition := pg_get_functiondef(function_oid);
    IF original_definition LIKE '%kr_arrival_card%' THEN
      CONTINUE;
    END IF;
    updated_definition := replace(
      original_definition,
      'flow_key = ''kr_eform''',
      'flow_key IN (''kr_eform'', ''kr_arrival_card'')'
    );
    updated_definition := replace(
      updated_definition,
      'v_flow = ''kr_eform''',
      'v_flow IN (''kr_eform'', ''kr_arrival_card'')'
    );
    IF updated_definition = original_definition THEN
      IF original_definition NOT LIKE '%kr_arrival_card%' THEN
        RAISE EXCEPTION 'Korea runner tuple was not found in %', function_oid;
      END IF;
    ELSE
      EXECUTE updated_definition;
    END IF;
  END LOOP;
END;
$$;

-- The country/flow fence is not sufficient for Korea: the application visa
-- type must select the matching Korea transport. Keep the synthetic load
-- marker as the only exception used by the staging concurrency harness.
DO $$
DECLARE
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_functiondef(
    'public.enqueue_runner_pool_job(uuid,text,text,timestamptz,integer,text,jsonb,timestamptz)'::REGPROCEDURE
  );
  IF original_definition LIKE '%v_application_visa_type%'
    AND original_definition LIKE '%KR_E_ARRIVAL_CARD%'
  THEN
    RETURN;
  END IF;
  updated_definition := replace(
    original_definition,
    $kr$  v_application_status TEXT;
  v_available_at TIMESTAMPTZ;$kr$,
    $kr$  v_application_status TEXT;
  v_application_visa_type TEXT;
  v_available_at TIMESTAMPTZ;$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$  SELECT application.status
  INTO v_application_status$kr$,
    $kr$  SELECT application.status,
         UPPER(application.visa_type)
  INTO v_application_status, v_application_visa_type$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$  IF v_application_status = 'staff_action_required' THEN
    RAISE EXCEPTION 'Application % is paused for staff review', p_application_id
      USING ERRCODE = '55000';
  END IF;$kr$,
    $kr$  IF v_application_status = 'staff_action_required' THEN
    RAISE EXCEPTION 'Application % is paused for staff review', p_application_id
      USING ERRCODE = '55000';
  END IF;
  IF v_country = 'south_korea'
    AND v_application_visa_type IS DISTINCT FROM (
      CASE v_flow
        WHEN 'kr_eform' THEN 'KR_C39_SHORT_TERM_VISIT'
        WHEN 'kr_arrival_card' THEN 'KR_E_ARRIVAL_CARD'
      END
    )
    AND NOT (
      v_application_visa_type = 'CONCURRENCY_LOAD'
      AND COALESCE(p_metadata -> 'concurrency_load_synthetic', 'false'::JSONB) = 'true'::JSONB
      AND COALESCE(p_correlation_id, '') LIKE 'concurrency-load:%'
    )
  THEN
    RAISE EXCEPTION 'South Korea runner flow does not match application visa type'
      USING ERRCODE = '22023';
  END IF;$kr$
  );
  IF updated_definition NOT LIKE '%v_application_visa_type%'
    OR updated_definition NOT LIKE '%KR_E_ARRIVAL_CARD%'
  THEN
    RAISE EXCEPTION 'Korea enqueue visa-type routing patch was not applied';
  END IF;
  IF updated_definition <> original_definition THEN
    EXECUTE updated_definition;
  END IF;
END;
$$;

DO $$
DECLARE
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_functiondef(
    'runner_private.claim_runner_pool_job_core(text,integer,boolean,timestamptz,uuid,boolean)'::REGPROCEDURE
  );
  IF original_definition LIKE '%application.visa_type%'
    AND original_definition LIKE '%KR_E_ARRIVAL_CARD%'
  THEN
    RETURN;
  END IF;
  updated_definition := original_definition;

  updated_definition := replace(
    updated_definition,
    $kr$(expired.country = 'south_korea' AND expired.flow_key IN ('kr_eform', 'kr_arrival_card'))$kr$,
    $kr$(expired.country = 'south_korea' AND (
        (expired.flow_key = 'kr_eform' AND UPPER(BTRIM(COALESCE(application.visa_type, ''))) = 'KR_C39_SHORT_TERM_VISIT')
        OR (expired.flow_key = 'kr_arrival_card' AND UPPER(BTRIM(COALESCE(application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD')
        OR (p_scope_run_id IS NOT NULL AND UPPER(BTRIM(COALESCE(application.visa_type, ''))) = 'CONCURRENCY_LOAD')
      ))$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$(v_expired_old_row.country = 'south_korea' AND v_expired_old_row.flow_key IN ('kr_eform', 'kr_arrival_card'))$kr$,
    $kr$(v_expired_old_row.country = 'south_korea' AND (
        (v_expired_old_row.flow_key = 'kr_eform' AND UPPER(BTRIM(COALESCE(v_expired_application_visa_type, ''))) = 'KR_C39_SHORT_TERM_VISIT')
        OR (v_expired_old_row.flow_key = 'kr_arrival_card' AND UPPER(BTRIM(COALESCE(v_expired_application_visa_type, ''))) = 'KR_E_ARRIVAL_CARD')
        OR (p_scope_run_id IS NOT NULL AND UPPER(BTRIM(COALESCE(v_expired_application_visa_type, ''))) = 'CONCURRENCY_LOAD')
      ))$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$(oldest_candidate.country = 'south_korea' AND oldest_candidate.flow_key IN ('kr_eform', 'kr_arrival_card'))$kr$,
    $kr$(oldest_candidate.country = 'south_korea' AND (
        (oldest_candidate.flow_key = 'kr_eform' AND UPPER(BTRIM(COALESCE(application.visa_type, ''))) = 'KR_C39_SHORT_TERM_VISIT')
        OR (oldest_candidate.flow_key = 'kr_arrival_card' AND UPPER(BTRIM(COALESCE(application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD')
        OR (p_scope_run_id IS NOT NULL AND UPPER(BTRIM(COALESCE(application.visa_type, ''))) = 'CONCURRENCY_LOAD')
      ))$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$(candidate.country = 'south_korea' AND candidate.flow_key IN ('kr_eform', 'kr_arrival_card'))$kr$,
    $kr$(candidate.country = 'south_korea' AND (
        (candidate.flow_key = 'kr_eform' AND UPPER(BTRIM(COALESCE(application.visa_type, ''))) = 'KR_C39_SHORT_TERM_VISIT')
        OR (candidate.flow_key = 'kr_arrival_card' AND UPPER(BTRIM(COALESCE(application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD')
        OR (p_scope_run_id IS NOT NULL AND UPPER(BTRIM(COALESCE(application.visa_type, ''))) = 'CONCURRENCY_LOAD')
      ))$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$(active.country = 'south_korea' AND active.flow_key IN ('kr_eform', 'kr_arrival_card'))$kr$,
    $kr$(active.country = 'south_korea' AND (
        (active.flow_key = 'kr_eform' AND EXISTS (
          SELECT 1 FROM public.applications AS active_application
          WHERE active_application.id = active.application_id
            AND UPPER(BTRIM(COALESCE(active_application.visa_type, ''))) = 'KR_C39_SHORT_TERM_VISIT'
        ))
        OR (active.flow_key = 'kr_arrival_card' AND EXISTS (
          SELECT 1 FROM public.applications AS active_application
          WHERE active_application.id = active.application_id
            AND UPPER(BTRIM(COALESCE(active_application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD'
        ))
        OR (p_scope_run_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.applications AS active_application
          WHERE active_application.id = active.application_id
            AND UPPER(BTRIM(COALESCE(active_application.visa_type, ''))) = 'CONCURRENCY_LOAD'
        ))
      ))$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$(active_global.country = 'south_korea' AND active_global.flow_key IN ('kr_eform', 'kr_arrival_card'))$kr$,
    $kr$(active_global.country = 'south_korea' AND (
        (active_global.flow_key = 'kr_eform' AND EXISTS (
          SELECT 1 FROM public.applications AS active_global_application
          WHERE active_global_application.id = active_global.application_id
            AND UPPER(BTRIM(COALESCE(active_global_application.visa_type, ''))) = 'KR_C39_SHORT_TERM_VISIT'
        ))
        OR (active_global.flow_key = 'kr_arrival_card' AND EXISTS (
          SELECT 1 FROM public.applications AS active_global_application
          WHERE active_global_application.id = active_global.application_id
            AND UPPER(BTRIM(COALESCE(active_global_application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD'
        ))
        OR (p_scope_run_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.applications AS active_global_application
          WHERE active_global_application.id = active_global.application_id
            AND UPPER(BTRIM(COALESCE(active_global_application.visa_type, ''))) = 'CONCURRENCY_LOAD'
        ))
      ))$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$    IF v_claimed_old_row.available_at > v_now THEN
      CONTINUE;
    END IF;$kr$,
    $kr$    IF v_claimed_old_row.available_at > v_now THEN
      CONTINUE;
    END IF;
    IF v_claimed_old_row.country = 'south_korea'
      AND NOT EXISTS (
        SELECT 1
        FROM public.applications AS claimed_application
        WHERE claimed_application.id = v_claimed_old_row.application_id
          AND (
            (v_claimed_old_row.flow_key = 'kr_eform' AND UPPER(BTRIM(COALESCE(claimed_application.visa_type, ''))) = 'KR_C39_SHORT_TERM_VISIT')
            OR (v_claimed_old_row.flow_key = 'kr_arrival_card' AND UPPER(BTRIM(COALESCE(claimed_application.visa_type, ''))) = 'KR_E_ARRIVAL_CARD')
            OR (p_scope_run_id IS NOT NULL AND UPPER(BTRIM(COALESCE(claimed_application.visa_type, ''))) = 'CONCURRENCY_LOAD')
          )
      )
    THEN
      CONTINUE;
    END IF;$kr$
  );
  IF updated_definition NOT LIKE '%application.visa_type%'
    OR updated_definition NOT LIKE '%KR_E_ARRIVAL_CARD%'
  THEN
    RAISE EXCEPTION 'Korea claim visa-type routing patch was not applied';
  END IF;
  IF updated_definition <> original_definition THEN
    EXECUTE updated_definition;
  END IF;
END;
$$;

DO $$
DECLARE
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_functiondef(
    'runner_private.guard_runner_job_running_insert()'::REGPROCEDURE
  );
  IF original_definition LIKE '%v_application_visa_type%'
    AND original_definition LIKE '%KR_E_ARRIVAL_CARD%'
  THEN
    RETURN;
  END IF;
  updated_definition := replace(
    original_definition,
    $kr$  v_application_status TEXT;$kr$,
    $kr$  v_application_status TEXT;
  v_application_visa_type TEXT;$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$    SELECT application.status
    INTO v_application_status$kr$,
    $kr$    SELECT application.status,
           UPPER(BTRIM(COALESCE(application.visa_type, '')))
    INTO v_application_status, v_application_visa_type$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$(NEW.country = 'south_korea' AND NEW.flow_key IN ('kr_eform', 'kr_arrival_card'))$kr$,
    $kr$(NEW.country = 'south_korea' AND (
        (NEW.flow_key = 'kr_eform' AND v_application_visa_type = 'KR_C39_SHORT_TERM_VISIT')
        OR (NEW.flow_key = 'kr_arrival_card' AND v_application_visa_type = 'KR_E_ARRIVAL_CARD')
        OR (
          v_application_visa_type = 'CONCURRENCY_LOAD'
          AND NEW.metadata -> 'concurrency_load_synthetic' = 'true'::JSONB
          AND COALESCE(NEW.correlation_id, '') LIKE 'concurrency-load:%'
        )
      ))$kr$
  );
  IF updated_definition NOT LIKE '%v_application_visa_type%'
    OR updated_definition NOT LIKE '%KR_E_ARRIVAL_CARD%'
  THEN
    RAISE EXCEPTION 'Korea running-insert visa-type routing patch was not applied';
  END IF;
  IF updated_definition <> original_definition THEN
    EXECUTE updated_definition;
  END IF;
END;
$$;

DO $$
DECLARE
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_functiondef(
    'public.requeue_runner_job(uuid)'::REGPROCEDURE
  );
  IF original_definition LIKE '%v_application_visa_type%'
    AND original_definition LIKE '%KR_E_ARRIVAL_CARD%'
  THEN
    RETURN;
  END IF;
  updated_definition := replace(
    original_definition,
    $kr$  v_application_status TEXT;
  v_old_row public.runner_job%ROWTYPE;$kr$,
    $kr$  v_application_status TEXT;
  v_application_visa_type TEXT;
  v_old_row public.runner_job%ROWTYPE;$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$  SELECT application.status
  INTO v_application_status$kr$,
    $kr$  SELECT application.status,
         UPPER(BTRIM(COALESCE(application.visa_type, '')))
  INTO v_application_status, v_application_visa_type$kr$
  );
  updated_definition := replace(
    updated_definition,
    $kr$(job.country = 'south_korea' AND job.flow_key IN ('kr_eform', 'kr_arrival_card'))$kr$,
    $kr$(job.country = 'south_korea' AND (
        (job.flow_key = 'kr_eform' AND v_application_visa_type = 'KR_C39_SHORT_TERM_VISIT')
        OR (job.flow_key = 'kr_arrival_card' AND v_application_visa_type = 'KR_E_ARRIVAL_CARD')
        OR (
          v_application_visa_type = 'CONCURRENCY_LOAD'
          AND job.metadata -> 'concurrency_load_synthetic' = 'true'::JSONB
          AND COALESCE(job.correlation_id, '') LIKE 'concurrency-load:%'
        )
      ))$kr$
  );
  IF updated_definition NOT LIKE '%v_application_visa_type%'
    OR updated_definition NOT LIKE '%KR_E_ARRIVAL_CARD%'
  THEN
    RAISE EXCEPTION 'Korea requeue visa-type routing patch was not applied';
  END IF;
  IF updated_definition <> original_definition THEN
    EXECUTE updated_definition;
  END IF;
END;
$$;

-- Keep autoscaling depth metrics aligned with the active-flow fence. View
-- replacement preserves the existing security_invoker option and grants.
DO $$
DECLARE
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_viewdef('public.runner_pool_depth'::REGCLASS, TRUE);
  IF original_definition LIKE '%kr_arrival_card%' THEN
    RETURN;
  END IF;
  updated_definition := replace(
    original_definition,
    'flow_key = ''kr_eform''::text',
    'flow_key IN (''kr_eform''::text, ''kr_arrival_card''::text)'
  );
  IF updated_definition = original_definition THEN
    IF original_definition NOT LIKE '%kr_arrival_card%' THEN
      RAISE EXCEPTION 'Runner pool depth view Korea tuple was not found';
    END IF;
  ELSE
    EXECUTE 'CREATE OR REPLACE VIEW public.runner_pool_depth WITH (security_invoker = true) AS ' || updated_definition;
  END IF;
END;
$$;

ALTER TABLE public.runner_job
  DROP CONSTRAINT IF EXISTS runner_job_active_flow_key_check;

ALTER TABLE public.runner_job
  ADD CONSTRAINT runner_job_active_flow_key_check
  CHECK (
    status NOT IN ('queued', 'running')
    OR COALESCE((
      (country = 'vietnam' AND flow_key = 'vn_prearrival')
      OR (country = 'singapore' AND flow_key = 'sgac')
      OR (country = 'malaysia' AND flow_key = 'mdac')
      OR (country = 'thailand' AND flow_key = 'tdac')
      OR (country = 'south_korea' AND flow_key IN ('kr_eform', 'kr_arrival_card'))
      OR (country = 'taiwan' AND flow_key = 'tw_entry_permit')
    ), FALSE)
  );

-- Add Korea statuses to the legacy submission_queue claim path used during
-- rolling deployments. The runner_job path remains the authoritative live
-- transport for new Korea submissions.
DROP INDEX IF EXISTS public.submission_queue_claim_pending_idx;
CREATE INDEX submission_queue_claim_pending_idx
  ON public.submission_queue(status, locked_until, created_at)
  WHERE status IN (
    'pending',
    'vn_dry_run_pending', 'vn_live_assisted_pending', 'vn_payment_pending',
    'sgac_dry_run_pending', 'sgac_live_assisted_scheduled', 'sgac_live_assisted_pending',
    'mdac_dry_run_pending', 'mdac_live_assisted_scheduled', 'mdac_live_assisted_pending',
    'tdac_dry_run_pending', 'tdac_live_assisted_scheduled', 'tdac_live_assisted_pending',
    'kr_eac_dry_run_pending', 'kr_eac_live_assisted_scheduled', 'kr_eac_live_assisted_pending',
    'phetravel_dry_run_pending', 'phetravel_live_assisted_scheduled', 'phetravel_live_assisted_pending'
  );

DO $$
DECLARE
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_functiondef(
    'public.claim_submission_queue_batch(text,integer,integer,uuid,integer,text[],boolean)'::REGPROCEDURE
  );
  IF original_definition LIKE '%kr_eac_live_assisted_pending%' THEN
    RETURN;
  END IF;
  updated_definition := replace(
    original_definition,
    '''tdac_live_assisted_pending'',',
    '''tdac_live_assisted_pending'',
          ''kr_eac_live_assisted_scheduled'',
          ''kr_eac_live_assisted_pending'', '
  );
  updated_definition := replace(
    updated_definition,
    '''tdac_dry_run_pending'',',
    '''tdac_dry_run_pending'',
          ''kr_eac_dry_run_pending'', '
  );
  updated_definition := replace(
    updated_definition,
    '''tdac_live_assisted_failed'',',
    '''tdac_live_assisted_failed'',
            ''kr_eac_live_assisted_failed'', '
  );
  updated_definition := replace(
    updated_definition,
    '''tdac_dry_run_failed'',',
    '''tdac_dry_run_failed'',
            ''kr_eac_dry_run_failed'', '
  );
  IF updated_definition = original_definition THEN
    IF original_definition NOT LIKE '%kr_eac_live_assisted_pending%' THEN
      RAISE EXCEPTION 'Legacy submission_queue claim function was not found';
    END IF;
  ELSE
    EXECUTE updated_definition;
  END IF;
END;
$$;

DROP INDEX IF EXISTS public.submission_queue_stale_processing_idx;
CREATE INDEX submission_queue_stale_processing_idx
  ON public.submission_queue (
    status,
    (COALESCE(heartbeat_at, updated_at, created_at)),
    id
  )
  WHERE status IN (
    'processing',
    'vn_dry_run_processing', 'vn_live_assisted_processing', 'vn_payment_processing',
    'sgac_dry_run_processing', 'sgac_live_assisted_processing',
    'mdac_dry_run_processing', 'mdac_live_assisted_processing',
    'tdac_dry_run_processing', 'tdac_live_assisted_processing',
    'kr_eac_dry_run_processing', 'kr_eac_live_assisted_processing',
    'phetravel_dry_run_processing', 'phetravel_live_assisted_processing'
  );

-- Stale legacy rows must fail closed rather than remain in processing forever.
DO $$
DECLARE
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_functiondef(
    'public.mark_stale_submission_queue_batch(timestamptz,timestamptz,timestamptz,integer)'::REGPROCEDURE
  );
  IF original_definition LIKE '%kr_eac_live_assisted_processing%' THEN
    RETURN;
  END IF;
  updated_definition := replace(
    original_definition,
    '''tdac_live_assisted_processing'',',
    '''tdac_live_assisted_processing'',
    ''kr_eac_dry_run_processing'',
    ''kr_eac_live_assisted_processing'', '
  );
  updated_definition := replace(
    updated_definition,
    'WHEN queue.status LIKE ''tdac_%'' THEN ''tdac_blocked''',
    'WHEN queue.status LIKE ''tdac_%'' THEN ''tdac_blocked''
        WHEN queue.status LIKE ''kr_eac_live_assisted_%'' THEN ''kr_eac_live_assisted_failed''
        WHEN queue.status LIKE ''kr_eac_dry_run_%'' THEN ''kr_eac_dry_run_failed''
        WHEN queue.status LIKE ''kr_eac_%'' THEN ''kr_eac_blocked'''
  );
  IF updated_definition = original_definition THEN
    IF original_definition NOT LIKE '%kr_eac_live_assisted_processing%' THEN
      RAISE EXCEPTION 'Stale submission_queue maintenance function was not found';
    END IF;
  ELSE
    EXECUTE updated_definition;
  END IF;
END;
$$;

-- Add Korea's package-specific cancellation status to the existing atomic
-- cancel RPC while retaining the exact row/lease fencing from 0149.
DO $$
DECLARE
  original_definition TEXT;
  updated_definition TEXT;
BEGIN
  original_definition := pg_get_functiondef(
    'public.cancel_application_submission(uuid,uuid,text)'::REGPROCEDURE
  );
  IF original_definition LIKE '%kr_eac_live_assisted_cancelled%' THEN
    RETURN;
  END IF;
  updated_definition := replace(
    original_definition,
    '''tdac_live_assisted_scheduled'', ''tdac_live_assisted_pending'',',
    '''tdac_live_assisted_scheduled'', ''tdac_live_assisted_pending'',
        ''kr_eac_live_assisted_scheduled'', ''kr_eac_live_assisted_pending'', '
  );
  updated_definition := replace(
    updated_definition,
    '''tdac_dry_run_pending'',',
    '''tdac_dry_run_pending'',
        ''kr_eac_dry_run_pending'', '
  );
  updated_definition := replace(
    updated_definition,
    'WHEN ''VN_PREARRIVAL_DECLARATION'' THEN ''vn_prearrival_live_assisted_cancelled''',
    'WHEN ''VN_PREARRIVAL_DECLARATION'' THEN ''vn_prearrival_live_assisted_cancelled''
    WHEN ''KR_E_ARRIVAL_CARD'' THEN ''kr_eac_live_assisted_cancelled'''
  );
  IF updated_definition = original_definition THEN
    IF original_definition NOT LIKE '%kr_eac_live_assisted_cancelled%' THEN
      RAISE EXCEPTION 'Application cancellation function was not found';
    END IF;
  ELSE
    EXECUTE updated_definition;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.cancel_application_submission(UUID, UUID, TEXT) IS
  'Atomically cancels queued Korea e-Arrival Card and other supported submission transports before official submission.';
