-- Keep client Settings privacy requests and reusable-traveler ownership safe.

ALTER TABLE public.applicant_profiles
  DROP CONSTRAINT IF EXISTS applicant_profiles_single_owner_check;

ALTER TABLE public.applicant_profiles
  ADD CONSTRAINT applicant_profiles_single_owner_check
  CHECK (auth_user_id IS NULL OR dependant_of_user_id IS NULL)
  NOT VALID;

CREATE OR REPLACE FUNCTION public.submit_client_privacy_request(
  p_applicant_id UUID,
  p_auth_user_id UUID,
  p_request_type TEXT
)
RETURNS TABLE (
  id UUID,
  request_type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  already_pending BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_aliases TEXT[];
  v_request public.data_privacy_requests%ROWTYPE;
BEGIN
  IF p_request_type = 'export' THEN
    v_aliases := ARRAY['export', 'data_export', 'personal_data_export'];
  ELSIF p_request_type = 'deletion' THEN
    v_aliases := ARRAY['deletion', 'delete', 'data_deletion'];
  ELSE
    RAISE EXCEPTION 'unsupported privacy request type' USING ERRCODE = '22023';
  END IF;

  -- Serialize submissions for one applicant and canonical request type so two
  -- tabs cannot create duplicate active requests.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_applicant_id::TEXT || ':' || p_request_type, 0)
  );

  SELECT request.*
  INTO v_request
  FROM public.data_privacy_requests AS request
  WHERE request.applicant_id = p_applicant_id
    AND lower(request.request_type) = ANY(v_aliases)
    AND lower(request.status) = ANY(
      ARRAY['requested', 'pending', 'queued', 'reviewing', 'in_review', 'processing', 'in_progress']
    )
  ORDER BY request.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_request.auth_user_id IS NULL THEN
      UPDATE public.data_privacy_requests AS request
      SET auth_user_id = p_auth_user_id,
          updated_at = now()
      WHERE request.id = v_request.id
      RETURNING request.* INTO v_request;
    END IF;

    RETURN QUERY SELECT
      v_request.id,
      v_request.request_type,
      v_request.status,
      v_request.created_at,
      v_request.updated_at,
      v_request.fulfilled_at,
      TRUE;
    RETURN;
  END IF;

  INSERT INTO public.data_privacy_requests (
    applicant_id,
    auth_user_id,
    request_type,
    status
  ) VALUES (
    p_applicant_id,
    p_auth_user_id,
    p_request_type,
    'requested'
  )
  RETURNING * INTO v_request;

  RETURN QUERY SELECT
    v_request.id,
    v_request.request_type,
    v_request.status,
    v_request.created_at,
    v_request.updated_at,
    v_request.fulfilled_at,
    FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_client_privacy_request(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_client_privacy_request(UUID, UUID, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.set_default_client_payment_binding(
  p_applicant_id UUID,
  p_binding_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_applicant_id::TEXT || ':payment-binding', 0));

  IF NOT EXISTS (
    SELECT 1
    FROM public.payment_records
    WHERE id = p_binding_id
      AND applicant_id = p_applicant_id
      AND fee_type = 'payment_method_binding'
      AND status = 'bound'
  ) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.payment_records AS record
  SET metadata = coalesce(record.metadata, '{}'::JSONB) || jsonb_build_object(
        'settings',
        coalesce(record.metadata -> 'settings', '{}'::JSONB) || jsonb_build_object(
          'is_default',
          record.id = p_binding_id
        )
      ),
      updated_at = now()
  WHERE record.applicant_id = p_applicant_id
    AND record.fee_type = 'payment_method_binding'
    AND record.status = 'bound';

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_default_client_payment_binding(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_client_payment_binding(UUID, UUID)
  TO service_role;
