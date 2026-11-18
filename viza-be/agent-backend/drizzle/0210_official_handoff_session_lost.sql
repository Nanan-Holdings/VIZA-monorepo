-- Official applicant handoff, follow-up to 0209.
--
-- The Indonesia official portal logs an idle session out well before the
-- one-hour VIZA handoff expires. The watcher now keeps the session alive and,
-- when the portal has already logged it out, settles the handoff early with
-- the new 'lost' outcome so the applicant is offered a fresh session instead
-- of opening a logged-out page. Only settle_official_applicant_handoff
-- changes; every ownership, lease, and evidence check from 0209 is kept.

-- Settle: called by the worker holding the watch lease.
--   pending   -> nothing new observed; release the watch lease only.
--   submitted -> official evidence that the applicant submitted; the
--                application is submitted but the session stays open so the
--                applicant can return to pay until it expires.
--   closed    -> close a submitted handoff (expired or payment evidence seen),
--                optionally refreshing the result with newer official evidence.
--   abandoned -> unsubmitted handoff expired; applicant may regenerate.
--   lost      -> the official portal itself logged the session out (its
--                home, country-selection, or login page is showing) before
--                expiry. Unsubmitted: same as abandoned. Submitted: closed.
CREATE OR REPLACE FUNCTION public.settle_official_applicant_handoff(
  p_takeover_id UUID,
  p_queue_id UUID,
  p_worker_id TEXT,
  p_outcome TEXT,
  p_submission_result JSONB DEFAULT NULL
)
RETURNS TABLE (
  settled BOOLEAN,
  application_id UUID,
  handoff_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_application public.applications%ROWTYPE;
  v_queue public.submission_queue%ROWTYPE;
  v_session public.takeover_session%ROWTYPE;
  v_prefix TEXT;
  v_worker_id TEXT := BTRIM(COALESCE(p_worker_id, ''));
  v_now TIMESTAMPTZ;
  v_receipt JSONB;
  v_reference TEXT;
  v_updated_rows INTEGER;
  v_lost BOOLEAN := FALSE;
BEGIN
  IF p_takeover_id IS NULL OR p_queue_id IS NULL THEN
    RAISE EXCEPTION 'takeover and queue ids are required' USING ERRCODE = '22023';
  END IF;
  IF v_worker_id = '' OR length(v_worker_id) > 200 THEN
    RAISE EXCEPTION 'worker id is required and must be at most 200 characters'
      USING ERRCODE = '22023';
  END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('pending', 'submitted', 'closed', 'abandoned', 'lost') THEN
    RAISE EXCEPTION 'outcome must be pending, submitted, closed, abandoned, or lost'
      USING ERRCODE = '22023';
  END IF;
  IF p_outcome IN ('pending', 'abandoned', 'lost') AND p_submission_result IS NOT NULL THEN
    RAISE EXCEPTION 'only submitted or closed outcomes may write a submission result'
      USING ERRCODE = '22023';
  END IF;

  SELECT application.*
  INTO v_application
  FROM public.applications AS application
  JOIN public.takeover_session AS session ON session.application_id = application.id
  WHERE session.id = p_takeover_id
    AND session.submission_queue_id = p_queue_id
  FOR UPDATE OF application;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT queue.*
  INTO v_queue
  FROM public.submission_queue AS queue
  WHERE queue.id = p_queue_id
    AND queue.application_id = v_application.id
    AND queue.locked_by = v_worker_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  v_prefix := public.official_handoff_queue_prefix(v_queue.provider);
  IF v_prefix IS NULL OR v_queue.status NOT IN (
    v_prefix || 'applicant_handoff',
    v_prefix || 'applicant_submitted'
  ) THEN
    RETURN;
  END IF;
  IF p_outcome = 'lost' THEN
    p_outcome := CASE
      WHEN v_queue.status = v_prefix || 'applicant_submitted' THEN 'closed'
      ELSE 'abandoned'
    END;
    v_lost := TRUE;
  END IF;
  IF (p_outcome IN ('submitted', 'abandoned') AND v_queue.status <> v_prefix || 'applicant_handoff')
    OR (p_outcome = 'closed' AND v_queue.status <> v_prefix || 'applicant_submitted')
  THEN
    RETURN;
  END IF;

  SELECT session.*
  INTO v_session
  FROM public.takeover_session AS session
  WHERE session.id = p_takeover_id
    AND session.submission_queue_id = p_queue_id
    AND session.application_id = v_application.id
    AND session.applicant_id = v_application.applicant_id
    AND session.handoff_kind = 'official_applicant_final_submit'
    AND session.status IN ('queued', 'claimed')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_now := pg_catalog.clock_timestamp();
  IF v_queue.locked_until IS NULL OR v_queue.locked_until <= v_now THEN
    RETURN;
  END IF;

  IF p_outcome = 'pending' THEN
    UPDATE public.submission_queue AS queue
    SET locked_by = NULL,
        locked_until = NULL,
        updated_at = v_now
    WHERE queue.id = p_queue_id
      AND queue.locked_by = v_worker_id;
    RETURN QUERY SELECT TRUE, v_application.id, v_session.status;
    RETURN;
  END IF;

  IF p_outcome IN ('submitted', 'closed') AND p_submission_result IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(p_submission_result) <> 'object'
      OR pg_catalog.pg_column_size(p_submission_result) > 524288
      OR p_submission_result ->> 'status' IS DISTINCT FROM 'submitted'
    THEN
      RAISE EXCEPTION 'submitted outcome requires a bounded submitted result'
        USING ERRCODE = '22023';
    END IF;
    v_receipt := p_submission_result -> 'officialReceipt';
    v_reference := BTRIM(COALESCE(v_receipt ->> 'reference', ''));
    IF pg_catalog.jsonb_typeof(v_receipt) IS DISTINCT FROM 'object'
      OR v_receipt ->> 'source' IS DISTINCT FROM 'official_portal_after_applicant_submit'
      OR length(v_reference) < 4
      OR length(v_reference) > 128
      OR NULLIF(BTRIM(v_receipt ->> 'portalUrl'), '') IS NULL
      OR length(v_receipt ->> 'portalUrl') > 4096
      OR v_receipt ->> 'portalUrl' !~* '^https://'
      OR NULLIF(BTRIM(v_receipt ->> 'capturedAt'), '') IS NULL
      OR length(v_receipt ->> 'capturedAt') > 100
    THEN
      RAISE EXCEPTION 'submitted outcome requires official receipt evidence'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_outcome = 'submitted' THEN
    -- Only the applicant can have submitted: the handoff must have been
    -- claimed by the owning applicant. A receipt observed shortly after
    -- expiry is still accepted because it is official evidence.
    IF v_session.status <> 'claimed'
      OR v_session.claimed_by IS DISTINCT FROM v_application.applicant_id
    THEN
      RETURN;
    END IF;
    IF p_submission_result IS NULL THEN
      RAISE EXCEPTION 'submitted outcome requires a submission result'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.applications AS application
    SET status = 'submitted',
        submitted_at = COALESCE(application.submitted_at, v_now),
        submission_result = p_submission_result,
        submission_result_status = 'completed',
        submission_result_updated_at = v_now,
        updated_at = v_now
    WHERE application.id = v_application.id;

    -- The session stays claimed so the applicant can return to pay.
    INSERT INTO public.takeover_action_log (takeover_id, action, actor_user_id, detail, ts)
    VALUES (
      p_takeover_id, 'complete', v_application.applicant_id,
      jsonb_build_object('kind', 'official_applicant_final_submit', 'officialReceiptCaptured', TRUE),
      v_now
    );

    UPDATE public.submission_queue AS queue
    SET status = v_prefix || 'applicant_submitted',
        current_stage = 'applicant_submitted_on_official_portal',
        locked_by = NULL,
        locked_until = NULL,
        updated_at = v_now
    WHERE queue.id = p_queue_id
      AND queue.locked_by = v_worker_id;

    RETURN QUERY SELECT TRUE, v_application.id, 'submitted'::TEXT;
    RETURN;
  END IF;

  IF p_outcome = 'closed' THEN
    IF p_submission_result IS NOT NULL THEN
      UPDATE public.applications AS application
      SET submission_result = p_submission_result,
          submission_result_updated_at = v_now,
          updated_at = v_now
      WHERE application.id = v_application.id;
    END IF;

    UPDATE public.takeover_session AS session
    SET status = 'completed',
        closed_at = v_now,
        operator_notes = NULL
    WHERE session.id = p_takeover_id
      AND session.status IN ('queued', 'claimed');

    INSERT INTO public.takeover_action_log (takeover_id, action, actor_user_id, detail, ts)
    VALUES (
      p_takeover_id, 'close', v_application.applicant_id,
      jsonb_build_object('kind', 'official_applicant_final_submit', 'resultRefreshed', p_submission_result IS NOT NULL),
      v_now
    );

    UPDATE public.submission_queue AS queue
    SET locked_by = NULL,
        locked_until = NULL,
        updated_at = v_now
    WHERE queue.id = p_queue_id
      AND queue.locked_by = v_worker_id;

    RETURN QUERY SELECT TRUE, v_application.id, 'completed'::TEXT;
    RETURN;
  END IF;

  -- abandoned (expired), or lost (official portal logged out early)
  IF NOT v_lost AND (v_session.expires_at IS NULL OR v_session.expires_at > v_now) THEN
    RETURN;
  END IF;

  UPDATE public.takeover_session AS session
  SET status = 'abandoned',
      closed_at = v_now,
      operator_notes = CASE WHEN v_lost
        THEN 'official_portal_session_lost_before_receipt'
        ELSE 'applicant_handoff_expired_before_official_receipt' END
  WHERE session.id = p_takeover_id
    AND session.status IN ('queued', 'claimed');

  INSERT INTO public.takeover_action_log (takeover_id, action, actor_user_id, detail, ts)
  VALUES (
    p_takeover_id, 'abandon', v_application.applicant_id,
    jsonb_build_object(
      'kind', 'official_applicant_final_submit',
      'reason', CASE WHEN v_lost THEN 'official_portal_session_lost' ELSE 'expired_before_official_receipt' END
    ),
    v_now
  );

  UPDATE public.applications AS application
  SET submission_result = COALESCE(application.submission_result, '{}'::jsonb)
        || jsonb_build_object('handoffExpired', TRUE, 'handoffExpiredAt', v_now, 'officialSessionLost', v_lost),
      submission_result_status = 'needs_user_action',
      submission_result_updated_at = v_now,
      updated_at = v_now
  WHERE application.id = v_application.id;

  UPDATE public.submission_queue AS queue
  SET status = v_prefix || 'applicant_handoff_expired',
      current_stage = 'applicant_handoff_expired',
      locked_by = NULL,
      locked_until = NULL,
      updated_at = v_now
  WHERE queue.id = p_queue_id
    AND queue.locked_by = v_worker_id;

  RETURN QUERY SELECT TRUE, v_application.id, 'abandoned'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_official_applicant_handoff(UUID, UUID, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_official_applicant_handoff(UUID, UUID, TEXT, TEXT, JSONB)
  TO service_role;
