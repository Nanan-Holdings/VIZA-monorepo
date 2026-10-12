-- `beta_access_grants.discount_percent` is INTEGER. Match that concrete row
-- type in the RPC result so successful claims do not fail at RETURN QUERY.
DROP FUNCTION public.claim_social_beta_access(TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, INTEGER);

CREATE FUNCTION public.claim_social_beta_access(
  p_code_hash TEXT,
  p_delivery_method TEXT,
  p_claimant_identity_hmac TEXT,
  p_applicant_id UUID,
  p_application_id UUID,
  p_order_id UUID,
  p_country TEXT,
  p_base_agency_fee_cents INTEGER
)
RETURNS TABLE (
  grant_id UUID,
  audience TEXT,
  delivery_method TEXT,
  access_scope TEXT,
  discount_percent INTEGER,
  discount_cents INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  access_code public.beta_access_codes%ROWTYPE;
  assignment public.beta_social_assignments%ROWTYPE;
  existing_grant public.beta_access_grants%ROWTYPE;
  inserted_grant public.beta_access_grants%ROWTYPE;
  calculated_discount INTEGER;
BEGIN
  IF p_code_hash !~ '^[a-f0-9]{64}$'
     OR p_claimant_identity_hmac !~ '^[a-f0-9]{64}$'
     OR p_delivery_method NOT IN ('promo_code', 'link_suffix')
     OR p_base_agency_fee_cents < 0 THEN
    RAISE EXCEPTION 'beta_social_claim_invalid';
  END IF;

  SELECT code.* INTO access_code
    FROM public.beta_access_codes code
   WHERE code.code_hash = p_code_hash
     AND code.status = 'active'
     AND code.audience = 'social'
   FOR UPDATE;
  IF NOT FOUND OR (access_code.expires_at IS NOT NULL AND access_code.expires_at <= now()) THEN
    RAISE EXCEPTION 'beta_social_claim_invalid';
  END IF;

  SELECT row.* INTO assignment
    FROM public.beta_social_assignments row
   WHERE row.id = access_code.assignment_id
   FOR UPDATE;
  IF NOT FOUND OR assignment.delivered_at IS NULL
     OR assignment.delivery_method <> p_delivery_method
     OR assignment.recipient_identity_hmac <> p_claimant_identity_hmac THEN
    RAISE EXCEPTION 'beta_social_claim_invalid';
  END IF;

  calculated_discount := pg_catalog.round(
    p_base_agency_fee_cents::numeric * access_code.discount_percent::numeric / 100
  )::integer;

  BEGIN
    INSERT INTO public.beta_access_grants (
      code_id, applicant_id, first_application_id, first_order_id, country,
      campaign, audience, delivery_method, discount_percent, access_scope,
      base_agency_fee_cents, discount_cents
    ) VALUES (
      access_code.id, p_applicant_id, p_application_id, p_order_id,
      pg_catalog.lower(pg_catalog.btrim(p_country)), access_code.campaign,
      access_code.audience, access_code.delivery_method,
      access_code.discount_percent, access_code.access_scope,
      p_base_agency_fee_cents, calculated_discount
    )
    RETURNING * INTO inserted_grant;
  EXCEPTION WHEN unique_violation THEN
    SELECT grant_row.* INTO existing_grant
      FROM public.beta_access_grants grant_row
     WHERE grant_row.code_id = access_code.id;
    IF NOT FOUND OR existing_grant.applicant_id <> p_applicant_id
       OR existing_grant.first_application_id <> p_application_id
       OR existing_grant.first_order_id <> p_order_id THEN
      RAISE EXCEPTION 'beta_social_claim_used';
    END IF;
    inserted_grant := existing_grant;
  END;

  RETURN QUERY SELECT inserted_grant.id, inserted_grant.audience,
    inserted_grant.delivery_method, inserted_grant.access_scope,
    inserted_grant.discount_percent, inserted_grant.discount_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_social_beta_access(TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_beta_access(TEXT, TEXT, TEXT, UUID, UUID, UUID, TEXT, INTEGER)
  TO service_role;
