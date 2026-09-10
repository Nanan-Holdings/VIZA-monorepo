-- One-person beta invitations for the launch cohort. Plaintext codes are
-- returned once by the admin action and never persisted; checkout compares a
-- SHA-256 digest. "promo_code" and "link_suffix" are the two A/B variants.

CREATE TABLE public.beta_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign TEXT NOT NULL DEFAULT 'launch-beta-2026',
  audience TEXT NOT NULL CHECK (audience IN ('social', 'friends')),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('promo_code', 'link_suffix')),
  discount_percent INTEGER NOT NULL CHECK (discount_percent IN (50, 100)),
  access_scope TEXT NOT NULL CHECK (access_scope IN ('one_country', 'all_countries')),
  code_hash TEXT NOT NULL UNIQUE CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  code_hint TEXT NOT NULL CHECK (length(code_hint) BETWEEN 4 AND 12),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'expired')),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT beta_access_code_offer_identity UNIQUE
    (id, campaign, audience, delivery_method, discount_percent, access_scope),
  CONSTRAINT beta_access_code_offer_check CHECK (
    (audience = 'social' AND discount_percent = 50 AND access_scope = 'one_country') OR
    (audience = 'friends' AND discount_percent = 100 AND access_scope = 'all_countries')
  )
);

CREATE TABLE public.beta_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL UNIQUE REFERENCES public.beta_access_codes(id) ON DELETE RESTRICT,
  applicant_id UUID NOT NULL REFERENCES public.applicant_profiles(id) ON DELETE RESTRICT,
  first_application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE RESTRICT,
  first_order_id UUID NOT NULL UNIQUE REFERENCES public."order"(id) ON DELETE RESTRICT,
  country TEXT NOT NULL CHECK (btrim(country) <> ''),
  campaign TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('social', 'friends')),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('promo_code', 'link_suffix')),
  discount_percent INTEGER NOT NULL CHECK (discount_percent IN (50, 100)),
  access_scope TEXT NOT NULL CHECK (access_scope IN ('one_country', 'all_countries')),
  base_agency_fee_cents INTEGER NOT NULL CHECK (base_agency_fee_cents >= 0),
  discount_cents INTEGER NOT NULL CHECK (
    discount_cents >= 0 AND discount_cents <= base_agency_fee_cents
  ),
  checkout_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT beta_access_grant_offer_matches_code FOREIGN KEY
    (code_id, campaign, audience, delivery_method, discount_percent, access_scope)
    REFERENCES public.beta_access_codes
    (id, campaign, audience, delivery_method, discount_percent, access_scope)
    ON DELETE RESTRICT
);

CREATE INDEX beta_access_codes_campaign_variant_idx
  ON public.beta_access_codes(campaign, audience, delivery_method, created_at DESC);
CREATE INDEX beta_access_grants_variant_funnel_idx
  ON public.beta_access_grants(campaign, audience, delivery_method, checkout_started_at DESC);
CREATE INDEX beta_access_grants_applicant_scope_idx
  ON public.beta_access_grants(applicant_id, access_scope, created_at DESC);

ALTER TABLE public.beta_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_access_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.beta_access_codes, public.beta_access_grants FROM anon, authenticated;
GRANT ALL ON TABLE public.beta_access_codes, public.beta_access_grants TO service_role;

CREATE OR REPLACE FUNCTION private.mark_beta_order_converted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'paid' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.beta_access_grants
       SET converted_at = COALESCE(converted_at, NEW.paid_at, now())
     WHERE first_order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER beta_order_conversion_trigger
AFTER UPDATE OF status ON public."order"
FOR EACH ROW EXECUTE FUNCTION private.mark_beta_order_converted();

CREATE OR REPLACE FUNCTION private.mark_beta_application_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('submitted', 'processing', 'under_review', 'approved', 'rejected', 'completed')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.beta_access_grants
       SET submitted_at = COALESCE(submitted_at, now())
     WHERE first_application_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER beta_application_submission_trigger
AFTER UPDATE OF status ON public.applications
FOR EACH ROW EXECUTE FUNCTION private.mark_beta_application_submitted();

REVOKE ALL ON FUNCTION private.mark_beta_order_converted() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.mark_beta_application_submitted() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.beta_access_codes IS
  'Hashed, single-person launch-beta invitations. Plaintext values must never be stored.';
COMMENT ON TABLE public.beta_access_grants IS
  'A/B funnel and applicant-bound benefit created by the first successful code claim.';
