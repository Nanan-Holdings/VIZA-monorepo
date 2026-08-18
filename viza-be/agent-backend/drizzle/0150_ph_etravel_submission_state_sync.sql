-- Philippines eTravel submitted-state synchronization RPC.
--
-- This is the database half of the submission-service
-- PH_ETRAVEL_SUBMISSION_STATE_SYNC_RPC_CONTRACT v2. It synchronizes only
-- already-trusted PH eTravel arrival results; it never drives, claims, or
-- retries an official submission.

ALTER TABLE public.submission_queue
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS official_status TEXT,
  ADD COLUMN IF NOT EXISTS current_stage TEXT,
  ADD COLUMN IF NOT EXISTS manual_action_status TEXT,
  ADD COLUMN IF NOT EXISTS official_portal_url TEXT,
  ADD COLUMN IF NOT EXISTS official_confirmation_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS live_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS live_screenshot_url TEXT;

CREATE OR REPLACE FUNCTION public.sync_ph_etravel_submission_state(
  application_id UUID,
  queue_id UUID,
  idempotency_key TEXT,
  result_json JSONB,
  application_patch JSONB,
  queue_patch JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_application public.applications%ROWTYPE;
  v_queue public.submission_queue%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_target_status TEXT := result_json ->> 'target_status';
  v_safe_reason_code TEXT := COALESCE(NULLIF(result_json ->> 'safe_reason_code', ''), 'ph_etravel_safe_failure');
  v_official_reference TEXT := NULLIF(BTRIM(result_json ->> 'official_reference'), '');
  v_authoritative_read JSONB := result_json -> 'authoritative_result_read';
  v_qr_render JSONB := result_json -> 'qr_render_metadata';
  v_expected_application_status TEXT;
  v_expected_queue_status TEXT;
  v_expected_submission_result_status TEXT;
  v_patch_expected_application_status TEXT := application_patch ->> 'expected_status';
  v_patch_expected_submission_result_status TEXT := application_patch ->> 'expected_submission_result_status';
  v_patch_expected_queue_status TEXT := queue_patch ->> 'expected_status';
  v_existing_result JSONB;
  v_existing_idempotency_key TEXT;
  v_existing_reference TEXT;
  v_submission_result JSONB;
BEGIN
  IF NULLIF(BTRIM(sync_ph_etravel_submission_state.idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'PH eTravel sync idempotency_key is required' USING ERRCODE = '22023';
  END IF;
  IF v_target_status NOT IN ('submitted', 'action_required', 'recovery_required') THEN
    RAISE EXCEPTION 'Unsupported PH eTravel sync target_status: %', v_target_status USING ERRCODE = '22023';
  END IF;
  IF v_safe_reason_code !~ '^[A-Za-z][A-Za-z0-9_-]{0,79}$' THEN
    RAISE EXCEPTION 'Unsafe PH eTravel sync reason code' USING ERRCODE = '22023';
  END IF;

  v_expected_application_status := CASE WHEN v_target_status = 'submitted' THEN 'submitted' ELSE 'processing' END;
  v_expected_queue_status := CASE WHEN v_target_status = 'submitted' THEN 'done' ELSE 'phetravel_blocked' END;
  v_expected_submission_result_status := CASE WHEN v_target_status = 'submitted' THEN 'completed' ELSE 'action_required' END;

  IF application_patch ->> 'status' IS DISTINCT FROM v_expected_application_status
    OR application_patch ->> 'submission_result_status' IS DISTINCT FROM v_expected_submission_result_status
    OR queue_patch ->> 'status' IS DISTINCT FROM v_expected_queue_status THEN
    RAISE EXCEPTION 'PH eTravel sync patch does not match target_status' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_application
  FROM public.applications AS app
  WHERE app.id = sync_ph_etravel_submission_state.application_id
  FOR UPDATE;

  SELECT *
  INTO v_queue
  FROM public.submission_queue AS sq
  WHERE sq.id = sync_ph_etravel_submission_state.queue_id
    AND sq.application_id = sync_ph_etravel_submission_state.application_id
  FOR UPDATE;

  IF v_application.id IS NULL OR v_queue.id IS NULL THEN
    RETURN jsonb_build_object(
      'outcome', 'expected_prior_state_mismatch',
      'application_id', sync_ph_etravel_submission_state.application_id,
      'queue_id', sync_ph_etravel_submission_state.queue_id,
      'idempotency_key', sync_ph_etravel_submission_state.idempotency_key,
      'target_status', v_target_status
    );
  END IF;

  IF LOWER(v_application.country) <> 'philippines'
    OR UPPER(v_application.visa_type) <> 'PH_ETRAVEL_ARRIVAL_CARD' THEN
    RAISE EXCEPTION 'sync_ph_etravel_submission_state only supports PH_ETRAVEL_ARRIVAL_CARD' USING ERRCODE = '22023';
  END IF;

  v_existing_result := v_application.submission_result;
  v_existing_idempotency_key := v_existing_result #>> '{stateSync,idempotencyKey}';
  v_existing_reference := v_existing_result #>> '{resultEvidence,authoritativeRead,referenceNumber}';

  IF v_existing_idempotency_key = sync_ph_etravel_submission_state.idempotency_key THEN
    RETURN jsonb_build_object(
      'outcome', 'idempotent_replay',
      'application_id', v_application.id,
      'queue_id', v_queue.id,
      'idempotency_key', sync_ph_etravel_submission_state.idempotency_key,
      'target_status', v_target_status,
      'application_status', v_application.status,
      'queue_status', v_queue.status,
      'submission_result_status', v_application.submission_result_status
    );
  END IF;

  IF v_existing_result ->> 'country' = 'PH'
    AND v_existing_result ->> 'visaType' = 'PH_ETRAVEL_ARRIVAL_CARD'
    AND v_existing_result ->> 'provider' = 'philippines_etravel_live'
    AND v_existing_result ->> 'status' = 'submitted'
    AND v_existing_result ->> 'submitted' = 'true'
    AND v_existing_result #>> '{resultEvidence,authoritativeRead,source}' = 'official_registration_result_read'
    AND v_existing_result #>> '{resultEvidence,authoritativeRead,postSubmitRead}' = 'true'
    AND v_existing_result #>> '{resultEvidence,authoritativeRead,stableReference}' = 'true'
    AND v_existing_result #>> '{resultEvidence,qrRender,renderer}' = 'official_client_reference_qr'
    AND v_existing_result #>> '{resultEvidence,qrRender,rendered}' = 'true'
    AND v_existing_result #>> '{resultEvidence,qrRender,referenceValueValidated}' = 'true'
    AND v_existing_result #>> '{resultEvidence,qrRender,renderedForReference}' = v_existing_reference THEN
    IF v_target_status = 'submitted' AND v_existing_reference = v_official_reference THEN
      RETURN jsonb_build_object(
        'outcome', 'idempotent_replay',
        'application_id', v_application.id,
        'queue_id', v_queue.id,
        'idempotency_key', sync_ph_etravel_submission_state.idempotency_key,
        'target_status', v_target_status,
        'application_status', v_application.status,
        'queue_status', v_queue.status,
        'submission_result_status', v_application.submission_result_status
      );
    END IF;

    RETURN jsonb_build_object(
      'outcome', 'expected_prior_state_mismatch',
      'application_id', v_application.id,
      'queue_id', v_queue.id,
      'idempotency_key', sync_ph_etravel_submission_state.idempotency_key,
      'target_status', v_target_status
    );
  END IF;

  IF v_patch_expected_application_status IS DISTINCT FROM v_application.status
    OR v_patch_expected_queue_status IS DISTINCT FROM v_queue.status
    OR (
      v_patch_expected_submission_result_status IS NOT NULL
      AND v_patch_expected_submission_result_status IS DISTINCT FROM v_application.submission_result_status
    ) THEN
    RETURN jsonb_build_object(
      'outcome', 'expected_prior_state_mismatch',
      'application_id', v_application.id,
      'queue_id', v_queue.id,
      'idempotency_key', sync_ph_etravel_submission_state.idempotency_key,
      'target_status', v_target_status
    );
  END IF;

  IF v_target_status = 'submitted' THEN
    IF v_official_reference IS NULL OR v_official_reference !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
      OR v_authoritative_read ->> 'source' <> 'official_registration_result_read'
      OR v_authoritative_read ->> 'post_submit_read' <> 'true'
      OR v_authoritative_read ->> 'reference_number' IS DISTINCT FROM v_official_reference
      OR v_authoritative_read ->> 'stable_reference' <> 'true'
      OR v_qr_render ->> 'renderer' <> 'official_client_reference_qr'
      OR v_qr_render ->> 'rendered_for_reference' IS DISTINCT FROM v_official_reference
      OR v_qr_render ->> 'rendered' <> 'true'
      OR v_qr_render ->> 'reference_value_validated' <> 'true' THEN
      RAISE EXCEPTION 'Submitted PH eTravel sync requires trusted reference and QR evidence' USING ERRCODE = '22023';
    END IF;

    v_submission_result := jsonb_build_object(
      'country', 'PH',
      'visaType', 'PH_ETRAVEL_ARRIVAL_CARD',
      'status', 'submitted',
      'mode', 'live_assisted',
      'provider', 'philippines_etravel_live',
      'applicationId', v_application.id,
      'submitted', true,
      'confirmationNumber', v_official_reference,
      'referenceNumber', v_official_reference,
      'resultEvidence', jsonb_build_object(
        'authoritativeRead', jsonb_build_object(
          'source', 'official_registration_result_read',
          'postSubmitRead', true,
          'referenceNumber', v_official_reference,
          'stableReference', true
        ),
        'qrRender', jsonb_build_object(
          'renderer', 'official_client_reference_qr',
          'renderedForReference', v_official_reference,
          'rendered', true,
          'referenceValueValidated', true
        )
      ),
      'artifacts', jsonb_build_object('screenshots', '[]'::jsonb, 'qrCodes', '[]'::jsonb, 'pdfs', '[]'::jsonb, 'logs', '[]'::jsonb, 'traces', '[]'::jsonb),
      'stateSync', jsonb_build_object(
        'version', 2,
        'idempotencyKey', sync_ph_etravel_submission_state.idempotency_key,
        'syncedAt', v_now
      )
    );
  ELSE
    v_submission_result := jsonb_build_object(
      'country', 'PH',
      'visaType', 'PH_ETRAVEL_ARRIVAL_CARD',
      'status', 'official_portal_error',
      'mode', 'live_assisted',
      'provider', 'philippines_etravel_live',
      'applicationId', v_application.id,
      'submitted', false,
      'errorDetails', jsonb_build_object(
        'code', v_safe_reason_code,
        'message', 'PH eTravel submission state requires recovery before internal synchronization.'
      ),
      'stateSync', jsonb_build_object(
        'version', 2,
        'idempotencyKey', sync_ph_etravel_submission_state.idempotency_key,
        'syncedAt', v_now
      )
    );
  END IF;

  UPDATE public.applications AS app
  SET status = v_expected_application_status,
      submission_result_status = v_expected_submission_result_status,
      submission_result = v_submission_result,
      submission_result_updated_at = v_now,
      confirmation_number = CASE WHEN v_target_status = 'submitted' THEN v_official_reference ELSE app.confirmation_number END,
      external_reference = CASE WHEN v_target_status = 'submitted' THEN v_official_reference ELSE app.external_reference END,
      submitted_at = CASE WHEN v_target_status = 'submitted' THEN COALESCE(app.submitted_at, v_now) ELSE app.submitted_at END,
      updated_at = v_now
  WHERE app.id = v_application.id;

  UPDATE public.submission_queue AS sq
  SET status = v_expected_queue_status,
      last_error = CASE WHEN v_target_status = 'submitted' THEN NULL ELSE 'PH eTravel submission state sync requires recovery.' END,
      error_code = CASE WHEN v_target_status = 'submitted' THEN NULL ELSE v_safe_reason_code END,
      error_message = CASE WHEN v_target_status = 'submitted' THEN NULL ELSE 'PH eTravel submission state requires recovery before internal synchronization.' END,
      current_stage = CASE WHEN v_target_status = 'submitted' THEN 'submitted' ELSE 'result_consistency_recovery_required' END,
      official_status = CASE WHEN v_target_status = 'submitted' THEN 'submitted' ELSE 'submitted_pending_application_sync' END,
      manual_action_status = CASE WHEN v_target_status = 'submitted' THEN NULL ELSE 'required' END,
      live_submitted_at = CASE WHEN v_target_status = 'submitted' THEN COALESCE(sq.live_submitted_at, v_now) ELSE sq.live_submitted_at END,
      updated_at = v_now
  WHERE sq.id = v_queue.id;

  RETURN jsonb_build_object(
    'outcome', 'applied',
    'application_id', v_application.id,
    'queue_id', v_queue.id,
    'idempotency_key', sync_ph_etravel_submission_state.idempotency_key,
    'target_status', v_target_status,
    'application_status', v_expected_application_status,
    'queue_status', v_expected_queue_status,
    'submission_result_status', v_expected_submission_result_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_ph_etravel_submission_state(
  UUID, UUID, TEXT, JSONB, JSONB, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_ph_etravel_submission_state(
  UUID, UUID, TEXT, JSONB, JSONB, JSONB
) TO service_role;

COMMENT ON FUNCTION public.sync_ph_etravel_submission_state(
  UUID, UUID, TEXT, JSONB, JSONB, JSONB
) IS
  'Service-role-only PH eTravel arrival state sync v2. Atomically records only trusted submitted/reference/QR evidence and blocks weak result overwrites.';
