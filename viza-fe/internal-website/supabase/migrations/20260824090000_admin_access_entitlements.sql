-- Admin invitation access, account-level high access, and final-submission
-- payment entitlements.
--
-- The tables in this migration are server-owned. Applicant clients may read
-- their own active membership/grant projections where explicitly allowed, but
-- all writes and all payment/submission transitions are service-role actions.
-- The final-submission fence is deliberately fail-closed: an application must
-- have a ready entitlement before it can enter a live queue or become
-- processing/submitted. The retired placeholder dry-run remains the only
-- local QA exception.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public."order"(id) ON DELETE SET NULL;

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS government_fee_cents INTEGER,
  ADD COLUMN IF NOT EXISTS government_fee_currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS government_fee_mode TEXT DEFAULT 'display_only';

CREATE INDEX IF NOT EXISTS payment_records_order_id_idx
  ON public.payment_records(order_id);

-- Ensure the treasury table exists in backend-only migration environments. In
-- the website database this is a no-op because the treasury migration already
-- owns the complete table definition.
CREATE TABLE IF NOT EXISTS public.government_fee_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public."order"(id) ON DELETE CASCADE,
  order_line_id UUID REFERENCES public.order_line(id) ON DELETE SET NULL,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'reserved_pending_treasury'
    CHECK (state IN ('reserved_pending_treasury', 'reserved', 'issuable', 'card_issued', 'portal_processing', 'consumed', 'released', 'review_required')),
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  metadata_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.applicant_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  granted_by_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT applicant_access_grants_expiry_check
    CHECK (expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT applicant_access_grants_revocation_check
    CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS applicant_access_grants_one_active_idx
  ON public.applicant_access_grants(auth_user_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS applicant_access_grants_account_status_idx
  ON public.applicant_access_grants(auth_user_id, status, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS applicant_access_grants_expiry_idx
  ON public.applicant_access_grants(expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.applicant_access_grant_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES public.applicant_access_grants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('granted', 'extended', 'revoked', 'expired')),
  actor_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applicant_access_grant_events_grant_idx
  ON public.applicant_access_grant_events(grant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.application_submission_entitlements (
  application_id UUID PRIMARY KEY REFERENCES public.applications(id) ON DELETE CASCADE,
  payer_auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  access_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (access_level IN ('standard', 'high')),
  access_grant_id UUID REFERENCES public.applicant_access_grants(id) ON DELETE SET NULL,
  grant_locked_at TIMESTAMPTZ,
  agency_fee_status TEXT NOT NULL DEFAULT 'required'
    CHECK (agency_fee_status IN ('required', 'paid', 'waived', 'review_required')),
  agency_fee_amount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (agency_fee_amount_cents >= 0),
  official_fee_status TEXT NOT NULL DEFAULT 'required'
    CHECK (official_fee_status IN ('required', 'paid', 'not_required', 'offline', 'review_required')),
  official_fee_amount_cents INTEGER NOT NULL DEFAULT 0
    CHECK (official_fee_amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  order_id UUID REFERENCES public."order"(id) ON DELETE SET NULL,
  payment_record_id UUID REFERENCES public.payment_records(id) ON DELETE SET NULL,
  government_fee_allocation_id UUID REFERENCES public.government_fee_allocations(id) ON DELETE SET NULL,
  decision_status TEXT NOT NULL DEFAULT 'payment_required'
    CHECK (decision_status IN ('ready', 'payment_required', 'review_required')),
  decision_reason TEXT NOT NULL DEFAULT 'not_evaluated',
  locked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT application_submission_entitlements_high_grant_check
    CHECK (access_level <> 'high' OR access_grant_id IS NOT NULL),
  CONSTRAINT application_submission_entitlements_grant_lock_check
    CHECK (grant_locked_at IS NULL OR access_grant_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS application_submission_entitlements_payer_idx
  ON public.application_submission_entitlements(payer_auth_user_id, decision_status);
CREATE INDEX IF NOT EXISTS application_submission_entitlements_order_idx
  ON public.application_submission_entitlements(order_id);
CREATE INDEX IF NOT EXISTS application_submission_entitlements_allocation_idx
  ON public.application_submission_entitlements(government_fee_allocation_id);

CREATE TABLE IF NOT EXISTS public.application_submission_entitlement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_status TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_submission_entitlement_events_app_idx
  ON public.application_submission_entitlement_events(application_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  granted_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_memberships_revocation_check
    CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_memberships_one_active_idx
  ON public.admin_memberships(auth_user_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS admin_memberships_status_idx
  ON public.admin_memberships(status, granted_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_membership_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES public.admin_memberships(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('granted', 'revoked', 'restored')),
  actor_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_membership_events_membership_idx
  ON public.admin_membership_events(membership_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_registration_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_digest TEXT NOT NULL UNIQUE,
  created_by_admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'accepted', 'revoked', 'expired')),
  claimed_email TEXT,
  claimed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  revoked_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_registration_invites_claim_check
    CHECK ((status IN ('claimed', 'accepted') AND claimed_at IS NOT NULL) OR status NOT IN ('claimed', 'accepted')),
  CONSTRAINT admin_registration_invites_accept_check
    CHECK ((status = 'accepted') = (accepted_at IS NOT NULL)),
  CONSTRAINT admin_registration_invites_revoke_check
    CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS admin_registration_invites_status_expiry_idx
  ON public.admin_registration_invites(status, expires_at);
CREATE INDEX IF NOT EXISTS admin_registration_invites_claimed_user_idx
  ON public.admin_registration_invites(claimed_user_id)
  WHERE claimed_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_registration_invite_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES public.admin_registration_invites(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'claimed', 'accepted', 'revoked', 'expired')),
  actor_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_registration_invite_events_invite_idx
  ON public.admin_registration_invite_events(invite_id, created_at DESC);

-- Make grant expiration observable and allow a new grant to replace an
-- already-expired active row without relying on a cron job.
CREATE OR REPLACE FUNCTION private.expire_stale_applicant_access_grant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expired RECORD;
BEGIN
  IF NEW.status = 'active' THEN
    FOR v_expired IN
      UPDATE public.applicant_access_grants
      SET status = 'expired', updated_at = now()
      WHERE auth_user_id = NEW.auth_user_id
        AND status = 'active'
        AND expires_at IS NOT NULL
        AND expires_at <= now()
      RETURNING id
    LOOP
      INSERT INTO public.applicant_access_grant_events(
        grant_id, event_type, reason, metadata
      )
      VALUES (
        v_expired.id,
        'expired',
        'grant_expired',
        jsonb_build_object('expired_at', now())
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_admin_registration_invites()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE public.admin_registration_invites
    SET status = 'expired', updated_at = now()
    WHERE status IN ('pending', 'claimed')
      AND expires_at <= now()
    RETURNING id
  ), events AS (
    INSERT INTO public.admin_registration_invite_events(invite_id, event_type, metadata)
    SELECT id, 'expired', jsonb_build_object('expired_at', now())
    FROM expired
    RETURNING invite_id
  )
  SELECT count(*)::INTEGER INTO v_count FROM events;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_applicant_access_grants(
  p_auth_user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE public.applicant_access_grants
    SET status = 'expired', updated_at = now()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at <= now()
      AND (p_auth_user_id IS NULL OR auth_user_id = p_auth_user_id)
    RETURNING id
  ), events AS (
    INSERT INTO public.applicant_access_grant_events(
      grant_id, event_type, reason, metadata
    )
    SELECT id, 'expired', 'grant_expired', jsonb_build_object('expired_at', now())
    FROM expired
    RETURNING grant_id
  )
  SELECT count(*)::INTEGER INTO v_count FROM events;
  RETURN COALESCE(v_count, 0);
END;
$$;

DROP TRIGGER IF EXISTS expire_stale_applicant_access_grant
  ON public.applicant_access_grants;
CREATE TRIGGER expire_stale_applicant_access_grant
BEFORE INSERT OR UPDATE OF auth_user_id, status, expires_at
ON public.applicant_access_grants
FOR EACH ROW
EXECUTE FUNCTION private.expire_stale_applicant_access_grant();

REVOKE ALL ON FUNCTION private.expire_stale_applicant_access_grant() FROM PUBLIC, anon, authenticated;

-- Authoritative high-access grant mutation. Keeping this operation in one
-- transaction prevents two admins from creating concurrent active grants.
CREATE OR REPLACE FUNCTION public.grant_applicant_high_access(
  p_auth_user_id UUID,
  p_admin_id UUID,
  p_expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 year'),
  p_reason TEXT DEFAULT 'admin_granted',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.applicant_access_grants
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grant public.applicant_access_grants;
  v_expiry TIMESTAMPTZ := p_expires_at;
  v_event_type TEXT := 'granted';
BEGIN
  IF p_auth_user_id IS NULL OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'high access grant requires an account and admin';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS user_projection
    JOIN public.admin_memberships AS membership ON membership.auth_user_id = user_projection.id
    WHERE user_projection.id = p_admin_id
      AND user_projection.role = 'admin'
      AND user_projection.deleted_at IS NULL
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'high access grant requires an active admin';
  END IF;
  IF v_expiry IS NOT NULL AND v_expiry <= now() THEN
    RAISE EXCEPTION 'high access grant expiry must be in the future';
  END IF;

  -- Serialize grant/extension operations for one account so two admins cannot
  -- create competing active rows or lose an extension update.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_auth_user_id::text, 0));
  PERFORM public.expire_applicant_access_grants(p_auth_user_id);

  SELECT * INTO v_grant
  FROM public.applicant_access_grants
  WHERE auth_user_id = p_auth_user_id
    AND status = 'active'
  FOR UPDATE;

  IF v_grant.id IS NULL THEN
    INSERT INTO public.applicant_access_grants (
      auth_user_id, status, starts_at, expires_at, granted_by_admin_id,
      reason, metadata
    )
    VALUES (
      p_auth_user_id, 'active', now(), v_expiry, p_admin_id,
      left(COALESCE(NULLIF(trim(p_reason), ''), 'admin_granted'), 1000),
      COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING * INTO v_grant;
  ELSE
    v_event_type := 'extended';
    UPDATE public.applicant_access_grants
    SET expires_at = v_expiry,
        granted_by_admin_id = p_admin_id,
        reason = left(COALESCE(NULLIF(trim(p_reason), ''), 'admin_granted'), 1000),
        metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb),
        updated_at = now()
    WHERE id = v_grant.id
    RETURNING * INTO v_grant;
  END IF;

  INSERT INTO public.applicant_access_grant_events (
    grant_id, event_type, actor_admin_id, reason, metadata
  )
  VALUES (v_grant.id, v_event_type, p_admin_id, v_grant.reason, v_grant.metadata);

  RETURN v_grant;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_applicant_high_access(
  p_grant_id UUID,
  p_admin_id UUID,
  p_reason TEXT DEFAULT 'admin_revoked'
)
RETURNS public.applicant_access_grants
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grant public.applicant_access_grants;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS user_projection
    JOIN public.admin_memberships AS membership ON membership.auth_user_id = user_projection.id
    WHERE user_projection.id = p_admin_id
      AND user_projection.role = 'admin'
      AND user_projection.deleted_at IS NULL
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'high access revoke requires an active admin';
  END IF;

  UPDATE public.applicant_access_grants
  SET status = 'revoked',
      revoked_by_admin_id = p_admin_id,
      revoked_at = now(),
      updated_at = now()
  WHERE id = p_grant_id
    AND status = 'active'
  RETURNING * INTO v_grant;

  IF v_grant.id IS NULL THEN
    RAISE EXCEPTION 'high access grant is not active';
  END IF;

  INSERT INTO public.applicant_access_grant_events (
    grant_id, event_type, actor_admin_id, reason, metadata
  )
  VALUES (
    v_grant.id, 'revoked', p_admin_id,
    left(COALESCE(NULLIF(trim(p_reason), ''), 'admin_revoked'), 1000),
    jsonb_build_object('revoked_at', v_grant.revoked_at)
  );
  RETURN v_grant;
END;
$$;

-- Invite claim and acceptance are split so the first visit can bind a
-- verified email before either the existing-account or new-account path is
-- selected. The token itself never reaches this database function; callers
-- pass only its SHA-256 digest.
CREATE OR REPLACE FUNCTION public.claim_admin_registration_invite(
  p_token_digest TEXT,
  p_claimed_email TEXT,
  p_claimed_user_id UUID DEFAULT NULL
)
RETURNS public.admin_registration_invites
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite public.admin_registration_invites;
  v_email TEXT := lower(trim(COALESCE(p_claimed_email, '')));
BEGIN
  IF length(COALESCE(p_token_digest, '')) <> 64 OR v_email = '' THEN
    RAISE EXCEPTION 'invalid admin registration invite';
  END IF;

  PERFORM public.expire_admin_registration_invites();

  UPDATE public.admin_registration_invites
  SET status = 'claimed',
      claimed_email = v_email,
      claimed_user_id = p_claimed_user_id,
      claimed_at = now(),
      updated_at = now()
  WHERE token_digest = lower(p_token_digest)
    AND status = 'pending'
    AND expires_at > now()
  RETURNING * INTO v_invite;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invalid admin registration invite';
  END IF;

  INSERT INTO public.admin_registration_invite_events (
    invite_id, event_type, metadata
  )
  VALUES (
    v_invite.id, 'claimed',
    jsonb_build_object('claimed_email', v_email, 'claimed_user_id', p_claimed_user_id)
  );
  RETURN v_invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_registration_invite(
  p_token_digest TEXT,
  p_admin_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.admin_registration_invites
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite public.admin_registration_invites;
BEGIN
  IF COALESCE(p_token_digest, '') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid admin registration invite';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS user_projection
    JOIN public.admin_memberships AS membership
      ON membership.auth_user_id = user_projection.id
    WHERE user_projection.id = p_admin_id
      AND user_projection.role = 'admin'
      AND user_projection.deleted_at IS NULL
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'admin invitation requires an active admin';
  END IF;

  INSERT INTO public.admin_registration_invites(
    token_digest,
    created_by_admin_id,
    expires_at,
    status,
    metadata
  )
  VALUES (
    p_token_digest,
    p_admin_id,
    now() + interval '24 hours',
    'pending',
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_invite;

  INSERT INTO public.admin_registration_invite_events(
    invite_id, event_type, actor_admin_id, metadata
  )
  VALUES (v_invite.id, 'created', p_admin_id, v_invite.metadata);
  RETURN v_invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin_registration_invite(
  p_invite_id UUID,
  p_admin_id UUID,
  p_reason TEXT DEFAULT 'admin_revoked'
)
RETURNS public.admin_registration_invites
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite public.admin_registration_invites;
  v_reason TEXT := left(COALESCE(NULLIF(trim(p_reason), ''), 'admin_revoked'), 1000);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS user_projection
    JOIN public.admin_memberships AS membership
      ON membership.auth_user_id = user_projection.id
    WHERE user_projection.id = p_admin_id
      AND user_projection.role = 'admin'
      AND user_projection.deleted_at IS NULL
      AND membership.status = 'active'
  ) THEN
    RAISE EXCEPTION 'admin invitation revoke requires an active admin';
  END IF;

  PERFORM public.expire_admin_registration_invites();

  UPDATE public.admin_registration_invites
  SET status = 'revoked',
      revoked_by_admin_id = p_admin_id,
      revoked_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('revoke_reason', v_reason),
      updated_at = now()
  WHERE id = p_invite_id
    AND status IN ('pending', 'claimed')
    AND expires_at > now()
  RETURNING * INTO v_invite;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invalid admin registration invite';
  END IF;

  INSERT INTO public.admin_registration_invite_events(
    invite_id, event_type, actor_admin_id, metadata
  )
  VALUES (v_invite.id, 'revoked', p_admin_id, jsonb_build_object('reason', v_reason));
  RETURN v_invite;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_admin_registration_invite(
  p_token_digest TEXT,
  p_user_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL
)
RETURNS TABLE(invite_id UUID, membership_id UUID)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite public.admin_registration_invites;
  v_membership public.admin_memberships;
  v_email TEXT := lower(trim(COALESCE(p_email, '')));
  v_name TEXT := COALESCE(NULLIF(trim(p_name), ''), v_email);
BEGIN
  SELECT * INTO v_invite
  FROM public.admin_registration_invites
  WHERE token_digest = lower(COALESCE(p_token_digest, ''))
  FOR UPDATE;

  IF v_invite.id IS NULL
     OR v_invite.status NOT IN ('pending', 'claimed')
     OR v_invite.expires_at <= now()
     OR (v_invite.claimed_email IS NOT NULL AND v_invite.claimed_email <> v_email)
     OR (v_invite.claimed_user_id IS NOT NULL AND v_invite.claimed_user_id <> p_user_id) THEN
    IF v_invite.id IS NOT NULL AND v_invite.status IN ('pending', 'claimed')
       AND v_invite.expires_at <= now() THEN
      UPDATE public.admin_registration_invites
      SET status = 'expired', updated_at = now()
      WHERE id = v_invite.id;
    END IF;
    RAISE EXCEPTION 'invalid admin registration invite';
  END IF;

  INSERT INTO public.users (id, email, name, role)
  VALUES (p_user_id, v_email, v_name, 'admin')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = CASE WHEN NULLIF(trim(public.users.name), '') IS NULL THEN EXCLUDED.name ELSE public.users.name END,
      role = 'admin';

  SELECT * INTO v_membership
  FROM public.admin_memberships
  WHERE auth_user_id = p_user_id AND status = 'active'
  FOR UPDATE;

  IF v_membership.id IS NULL THEN
    UPDATE public.admin_memberships
    SET status = 'active',
        granted_by_admin_id = v_invite.created_by_admin_id,
        granted_at = now(),
        revoked_by_admin_id = NULL,
        revoked_at = NULL,
        updated_at = now()
    WHERE auth_user_id = p_user_id AND status = 'revoked'
    RETURNING * INTO v_membership;
  END IF;

  IF v_membership.id IS NULL THEN
    INSERT INTO public.admin_memberships (
      auth_user_id, status, granted_by_admin_id, metadata
    )
    VALUES (
      p_user_id, 'active', v_invite.created_by_admin_id,
      jsonb_build_object('source', 'admin_registration_invite', 'invite_id', v_invite.id)
    )
    RETURNING * INTO v_membership;
  END IF;

  UPDATE public.admin_registration_invites
  SET status = 'accepted',
      claimed_at = COALESCE(claimed_at, now()),
      claimed_email = COALESCE(claimed_email, v_email),
      claimed_user_id = COALESCE(claimed_user_id, p_user_id),
      accepted_at = now(),
      updated_at = now()
  WHERE id = v_invite.id;

  INSERT INTO public.admin_registration_invite_events(invite_id, event_type, actor_admin_id, metadata)
  VALUES (
    v_invite.id,
    'accepted',
    v_invite.created_by_admin_id,
    jsonb_build_object('email', v_email, 'accepted_user_id', p_user_id)
  );
  INSERT INTO public.admin_membership_events(membership_id, event_type, actor_admin_id, metadata)
  VALUES (
    v_membership.id,
    'granted',
    v_invite.created_by_admin_id,
    jsonb_build_object('invite_id', v_invite.id, 'accepted_user_id', p_user_id)
  );

  RETURN QUERY SELECT v_invite.id, v_membership.id;
END;
$$;

-- Serialize creation/reuse of the one open final-submission quote for an
-- application. The amount split is derived from the persisted entitlement,
-- never from browser input, and order/lines/payment-record are one transaction.
CREATE OR REPLACE FUNCTION public.ensure_submission_checkout_order(
  p_application_id UUID,
  p_payer_auth_user_id UUID,
  p_return_to TEXT DEFAULT NULL,
  p_checkout_claim_token UUID DEFAULT gen_random_uuid()
)
RETURNS TABLE(
  order_id UUID,
  stripe_checkout_session_id TEXT,
  order_created BOOLEAN,
  checkout_claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application public.applications;
  v_entitlement public.application_submission_entitlements;
  v_order public."order";
  v_payment public.payment_records;
  v_agency_due INTEGER;
  v_official_due INTEGER;
  v_agency_line_total BIGINT;
  v_official_line_total BIGINT;
  v_created BOOLEAN := false;
  v_checkout_claimed BOOLEAN := false;
BEGIN
  IF p_application_id IS NULL OR p_payer_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'submission checkout requires application and payer';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_application_id::text, 1));

  SELECT * INTO v_application
  FROM public.applications
  WHERE id = p_application_id
  FOR UPDATE;
  SELECT * INTO v_entitlement
  FROM public.application_submission_entitlements
  WHERE application_id = p_application_id
  FOR UPDATE;

  IF v_application.id IS NULL
     OR v_entitlement.application_id IS NULL
     OR v_entitlement.payer_auth_user_id <> p_payer_auth_user_id
     OR v_entitlement.decision_status <> 'payment_required' THEN
    RAISE EXCEPTION 'application payment quote is unavailable';
  END IF;

  v_agency_due := CASE
    WHEN v_entitlement.agency_fee_status = 'required'
      THEN v_entitlement.agency_fee_amount_cents
    ELSE 0
  END;
  v_official_due := CASE
    WHEN v_entitlement.official_fee_status = 'required'
      THEN v_entitlement.official_fee_amount_cents
    ELSE 0
  END;
  IF v_agency_due + v_official_due <= 0 THEN
    RAISE EXCEPTION 'application payment quote has no amount due';
  END IF;

  SELECT payable.* INTO v_order
  FROM public."order" AS payable
  WHERE payable.application_id = p_application_id
    AND payable.status IN ('draft', 'pending')
    AND upper(payable.currency) = upper(v_entitlement.currency)
    AND payable.agency_fee_cents = v_agency_due
    AND payable.govt_fee_cents = v_official_due
  ORDER BY payable.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    INSERT INTO public."order"(
      application_id,
      applicant_id,
      agency_fee_cents,
      govt_fee_cents,
      currency,
      status,
      metadata
    )
    VALUES (
      p_application_id,
      v_application.applicant_id,
      v_agency_due,
      v_official_due,
      upper(v_entitlement.currency),
      'pending',
      jsonb_build_object(
        'source', 'submission_entitlement_checkout',
        'access_level', v_entitlement.access_level,
        'entitlement_id', v_entitlement.application_id,
        'return_to', p_return_to
      )
    )
    RETURNING * INTO v_order;
    v_created := true;
  END IF;

  SELECT COALESCE(sum(line.amount_cents), 0) INTO v_agency_line_total
  FROM public.order_line AS line
  WHERE line.order_id = v_order.id AND line.kind = 'agency';
  IF v_agency_due > 0 AND v_agency_line_total = 0 THEN
    INSERT INTO public.order_line(
      order_id, kind, amount_cents, currency, payee, description, metadata
    )
    VALUES (
      v_order.id,
      'agency',
      v_agency_due,
      upper(v_entitlement.currency),
      'VIZA',
      'VIZA agency fee',
      jsonb_build_object('entitlement_id', v_entitlement.application_id)
    );
  ELSIF v_agency_line_total <> v_agency_due THEN
    RAISE EXCEPTION 'agency order line mismatch';
  END IF;

  SELECT COALESCE(sum(line.amount_cents), 0) INTO v_official_line_total
  FROM public.order_line AS line
  WHERE line.order_id = v_order.id AND line.kind = 'govt';
  IF v_official_due > 0 AND v_official_line_total = 0 THEN
    INSERT INTO public.order_line(
      order_id, kind, amount_cents, currency, payee, description, metadata
    )
    VALUES (
      v_order.id,
      'govt',
      v_official_due,
      upper(v_entitlement.currency),
      v_application.country,
      'Official fee reserve',
      jsonb_build_object('entitlement_id', v_entitlement.application_id)
    );
  ELSIF v_official_line_total <> v_official_due THEN
    RAISE EXCEPTION 'government order line mismatch';
  END IF;

  SELECT record.* INTO v_payment
  FROM public.payment_records AS record
  WHERE record.order_id = v_order.id
    AND record.status = 'pending'
  ORDER BY record.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    INSERT INTO public.payment_records(
      application_id,
      applicant_id,
      auth_user_id,
      order_id,
      provider,
      amount_cents,
      currency,
      status,
      fee_type,
      metadata
    )
    VALUES (
      p_application_id,
      v_application.applicant_id,
      p_payer_auth_user_id,
      v_order.id,
      'stripe',
      v_agency_due + v_official_due,
      upper(v_entitlement.currency),
      'pending',
      'submission_checkout',
      jsonb_build_object(
        'source', 'submission_entitlement_checkout',
        'access_level', v_entitlement.access_level,
        'entitlement_id', v_entitlement.application_id
      )
    )
    RETURNING * INTO v_payment;
  ELSIF v_payment.amount_cents <> v_agency_due + v_official_due
     OR upper(v_payment.currency) <> upper(v_entitlement.currency) THEN
    RAISE EXCEPTION 'submission payment record mismatch';
  END IF;

  UPDATE public.application_submission_entitlements
  SET order_id = v_order.id,
      payment_record_id = v_payment.id,
      updated_at = now()
  WHERE application_id = p_application_id;

  IF (
       COALESCE(v_order.metadata, '{}'::jsonb) ->> 'submission_checkout_claim_token' IS NULL
       OR CASE
            WHEN jsonb_typeof(COALESCE(v_order.metadata, '{}'::jsonb) -> 'submission_checkout_claim_expires_epoch') = 'number'
              THEN (v_order.metadata ->> 'submission_checkout_claim_expires_epoch')::NUMERIC <= extract(epoch FROM now())
            ELSE true
          END
       OR v_order.metadata ->> 'submission_checkout_claim_token' = p_checkout_claim_token::TEXT
     ) THEN
    UPDATE public."order"
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'submission_checkout_claim_token', p_checkout_claim_token,
          'submission_checkout_claim_expires_epoch', extract(epoch FROM now() + interval '2 minutes')
        ),
        updated_at = now()
    WHERE id = v_order.id
    RETURNING * INTO v_order;
    v_checkout_claimed := true;
  END IF;

  RETURN QUERY SELECT
    v_order.id,
    v_order.stripe_checkout_session_id,
    v_created,
    v_checkout_claimed;
END;
$$;

-- A verified payment callback uses this transaction to bind a provider-paid
-- order to its records and atomically create or verify the exact government
-- allocation before marking the entitlement ready.
CREATE OR REPLACE FUNCTION public.confirm_submission_order_payment(
  p_order_id UUID,
  p_provider_payment_id TEXT,
  p_provider_session_id TEXT,
  p_paid_at TIMESTAMPTZ DEFAULT now(),
  p_tax_amount_cents BIGINT DEFAULT NULL,
  p_tax_country TEXT DEFAULT NULL,
  p_tax_rate_basis_points INTEGER DEFAULT NULL,
  p_provider TEXT DEFAULT 'stripe'
)
RETURNS TABLE(
  order_id UUID,
  application_id UUID,
  payment_record_id UUID,
  entitlement_ready BOOLEAN
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public."order";
  v_payment_id UUID;
  v_payer_auth_user_id UUID;
  v_government_line public.order_line;
  v_allocation public.government_fee_allocations;
  v_ready BOOLEAN := false;
  v_metadata JSONB := '{}'::jsonb;
BEGIN
  SELECT * INTO v_order
  FROM public."order"
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'submission order was not found';
  END IF;
  IF v_order.status IN ('refunded', 'partially_refunded', 'cancelled', 'disputed', 'chargeback') THEN
    RAISE EXCEPTION 'submission order is not payable';
  END IF;
  IF NULLIF(trim(COALESCE(p_provider_payment_id, '')), '') IS NULL
     AND NULLIF(trim(COALESCE(p_provider_session_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'verified provider payment reference is required';
  END IF;

  IF p_tax_amount_cents IS NOT NULL
     OR p_tax_country IS NOT NULL
     OR p_tax_rate_basis_points IS NOT NULL THEN
    v_metadata := jsonb_build_object(
      'tax_amount_cents', p_tax_amount_cents,
      'tax_country', p_tax_country,
      'tax_rate_basis_points', p_tax_rate_basis_points
    );
  END IF;

  UPDATE public."order"
  SET status = CASE
        WHEN status IN ('submitted', 'completed') THEN status
        ELSE 'paid'
      END,
      stripe_payment_intent_id = COALESCE(NULLIF(trim(p_provider_payment_id), ''), stripe_payment_intent_id),
      stripe_checkout_session_id = COALESCE(NULLIF(trim(p_provider_session_id), ''), stripe_checkout_session_id),
      paid_at = COALESCE(p_paid_at, now()),
      metadata = COALESCE(metadata, '{}'::jsonb) || v_metadata,
      updated_at = now()
  WHERE id = v_order.id;

  UPDATE public.payment_records
  SET status = 'paid',
      provider_payment_id = COALESCE(NULLIF(trim(p_provider_payment_id), ''), provider_payment_id),
      provider_session_id = COALESCE(NULLIF(trim(p_provider_session_id), ''), provider_session_id),
      paid_at = COALESCE(p_paid_at, now()),
      updated_at = now()
  WHERE order_id = v_order.id
    AND status NOT IN ('refunded', 'partially_refunded', 'disputed', 'chargeback', 'cancelled');

  SELECT payment.id INTO v_payment_id
  FROM public.payment_records AS payment
  WHERE payment.order_id = v_order.id
    AND lower(payment.status) IN ('paid', 'succeeded', 'success', 'complete', 'completed')
  ORDER BY payment.created_at DESC
  LIMIT 1;

  IF v_payment_id IS NULL THEN
    SELECT entitlement.payer_auth_user_id
    INTO v_payer_auth_user_id
    FROM public.application_submission_entitlements AS entitlement
    WHERE entitlement.application_id = v_order.application_id;

    IF v_payer_auth_user_id IS NULL THEN
      SELECT profile.auth_user_id
      INTO v_payer_auth_user_id
      FROM public.applicant_profiles AS profile
      WHERE profile.id = v_order.applicant_id;
    END IF;

    INSERT INTO public.payment_records(
      application_id,
      applicant_id,
      auth_user_id,
      order_id,
      provider,
      provider_session_id,
      provider_payment_id,
      amount_cents,
      currency,
      status,
      fee_type,
      metadata,
      paid_at
    )
    VALUES (
      v_order.application_id,
      v_order.applicant_id,
      v_payer_auth_user_id,
      v_order.id,
      lower(COALESCE(NULLIF(trim(p_provider), ''), 'stripe')),
      NULLIF(trim(COALESCE(p_provider_session_id, '')), ''),
      NULLIF(trim(COALESCE(p_provider_payment_id, '')), ''),
      v_order.agency_fee_cents + v_order.govt_fee_cents,
      upper(v_order.currency),
      'paid',
      'submission_checkout',
      jsonb_build_object('source', 'verified_order_payment'),
      COALESCE(p_paid_at, now())
    )
    RETURNING id INTO v_payment_id;
  END IF;

  IF v_order.govt_fee_cents > 0 THEN
    SELECT line.* INTO v_government_line
    FROM public.order_line AS line
    WHERE line.order_id = v_order.id
      AND line.kind = 'govt'
    ORDER BY line.created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_government_line.id IS NULL
       OR v_government_line.amount_cents <> v_order.govt_fee_cents
       OR upper(v_government_line.currency) <> upper(v_order.currency) THEN
      RAISE EXCEPTION 'government order line mismatch';
    END IF;

    SELECT allocation.* INTO v_allocation
    FROM public.government_fee_allocations AS allocation
    WHERE allocation.order_id = v_order.id
    FOR UPDATE;

    IF v_allocation.id IS NULL THEN
      INSERT INTO public.government_fee_allocations(
        order_id,
        order_line_id,
        application_id,
        amount_cents,
        currency,
        state,
        metadata_redacted
      )
      VALUES (
        v_order.id,
        v_government_line.id,
        v_order.application_id,
        v_order.govt_fee_cents,
        upper(v_order.currency),
        'reserved_pending_treasury',
        jsonb_build_object('source', 'verified_order_payment')
      )
      RETURNING * INTO v_allocation;
    ELSIF v_allocation.application_id <> v_order.application_id
       OR v_allocation.order_line_id IS DISTINCT FROM v_government_line.id
       OR v_allocation.amount_cents <> v_order.govt_fee_cents
       OR upper(v_allocation.currency) <> upper(v_order.currency)
       OR v_allocation.state IN ('released', 'review_required') THEN
      RAISE EXCEPTION 'government allocation mismatch';
    END IF;
  END IF;

  UPDATE public.application_submission_entitlements AS entitlement
  SET order_id = COALESCE(entitlement.order_id, v_order.id),
      payment_record_id = COALESCE(entitlement.payment_record_id, v_payment_id),
      government_fee_allocation_id = COALESCE(v_allocation.id, entitlement.government_fee_allocation_id),
      agency_fee_status = CASE
        WHEN v_order.agency_fee_cents > 0 THEN 'paid'
        WHEN entitlement.access_level = 'high' THEN 'waived'
        ELSE entitlement.agency_fee_status
      END,
      official_fee_status = CASE
        WHEN v_order.govt_fee_cents > 0 AND v_allocation.id IS NOT NULL THEN 'paid'
        ELSE entitlement.official_fee_status
      END,
      decision_status = CASE
        WHEN entitlement.agency_fee_status IN ('review_required', 'required')
             AND v_order.agency_fee_cents = 0
             AND entitlement.access_level <> 'high' THEN 'payment_required'
        WHEN entitlement.official_fee_status = 'review_required' THEN 'review_required'
        WHEN (
          CASE WHEN v_order.agency_fee_cents > 0 THEN 'paid'
               WHEN entitlement.access_level = 'high' THEN 'waived'
               ELSE entitlement.agency_fee_status END
        ) IN ('paid', 'waived')
        AND (
          CASE
            WHEN v_order.govt_fee_cents > 0 AND v_allocation.id IS NOT NULL THEN 'paid'
            ELSE entitlement.official_fee_status
          END
        ) IN ('paid', 'not_required', 'offline') THEN 'ready'
        ELSE entitlement.decision_status
      END,
      decision_reason = 'verified_order_payment',
      updated_at = now()
  WHERE entitlement.application_id = v_order.application_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.application_submission_entitlements AS entitlement
    WHERE entitlement.application_id = v_order.application_id
      AND entitlement.decision_status = 'ready'
      AND entitlement.agency_fee_status IN ('paid', 'waived')
      AND entitlement.official_fee_status IN ('paid', 'not_required', 'offline')
  ) INTO v_ready;

  RETURN QUERY SELECT v_order.id, v_order.application_id, v_payment_id, v_ready;
END;
$$;

-- Internal readiness predicate used by database fences. It intentionally does
-- not infer payment state from an arbitrary account, order, or application row.
CREATE OR REPLACE FUNCTION private.submission_entitlement_ready(p_application_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.application_submission_entitlements AS entitlement
    WHERE entitlement.application_id = p_application_id
      AND entitlement.decision_status = 'ready'
      AND (
        entitlement.agency_fee_status = 'waived'
        OR (
          entitlement.agency_fee_status = 'paid'
          AND (
            EXISTS (
              SELECT 1
              FROM public."order" AS paid_order
              WHERE paid_order.application_id = entitlement.application_id
                AND lower(paid_order.status) IN ('paid', 'submitted', 'completed')
                AND paid_order.agency_fee_cents >= entitlement.agency_fee_amount_cents
                AND upper(paid_order.currency) = upper(entitlement.currency)
            )
            OR EXISTS (
              SELECT 1
              FROM public.payment_records AS paid_record
              WHERE paid_record.application_id = entitlement.application_id
                AND (
                  paid_record.fee_type = 'agency_fee'
                  OR (
                    paid_record.id = entitlement.payment_record_id
                    AND paid_record.fee_type = 'submission_checkout'
                    AND EXISTS (
                      SELECT 1
                      FROM public."order" AS linked_order
                      WHERE linked_order.id = paid_record.order_id
                        AND linked_order.application_id = entitlement.application_id
                        AND linked_order.agency_fee_cents >= entitlement.agency_fee_amount_cents
                    )
                  )
                )
                AND lower(paid_record.status) IN ('paid', 'succeeded', 'success', 'complete', 'completed')
                AND paid_record.amount_cents >= entitlement.agency_fee_amount_cents
                AND upper(paid_record.currency) = upper(entitlement.currency)
            )
          )
        )
      )
      AND (
        entitlement.official_fee_status IN ('not_required', 'offline')
        OR (
          entitlement.official_fee_status = 'paid'
          AND EXISTS (
            SELECT 1
            FROM public.government_fee_allocations AS allocation
            WHERE allocation.id = entitlement.government_fee_allocation_id
              AND allocation.application_id = entitlement.application_id
              AND allocation.state IN (
                'reserved_pending_treasury',
                'reserved',
                'issuable',
                'card_issued',
                'portal_processing',
                'consumed'
              )
              AND allocation.amount_cents = entitlement.official_fee_amount_cents
              AND upper(allocation.currency) = upper(entitlement.currency)
          )
        )
      )
  );
$$;

-- A refund, dispute, or chargeback invalidates an unfinished application's
-- ability to enter the queue. Once official submission is already underway or
-- complete, the application is not rolled back; an immutable entitlement event
-- gives the operations team an exception to review instead.
CREATE OR REPLACE FUNCTION private.record_submission_payment_risk_work_item(
  p_application_id UUID,
  p_order_id UUID,
  p_source_type TEXT,
  p_source_id TEXT,
  p_title TEXT,
  p_metadata JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF to_regclass('public.admin_work_items') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE $sql$
    INSERT INTO public.admin_work_items(
      application_id,
      order_id,
      source_type,
      source_id,
      dedupe_key,
      kind,
      title,
      description,
      status,
      priority,
      owning_team,
      metadata_redacted
    )
    VALUES (
      $1, $2, $3, $4,
      'submission-payment-risk:' || $3 || ':' || $4,
      'payment_exception',
      $5,
      'Payment or official-fee evidence changed after official submission started.',
      'open',
      'p1',
      'operations',
      $6
    )
    ON CONFLICT (dedupe_key) DO UPDATE
    SET status = 'open',
        priority = 'p1',
        metadata_redacted = EXCLUDED.metadata_redacted,
        updated_at = now()
  $sql$ USING p_application_id, p_order_id, p_source_type, p_source_id, p_title, p_metadata;
END;
$$;

CREATE OR REPLACE FUNCTION private.mark_submission_entitlement_review_on_order_risk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_application_status TEXT;
  v_entitlement public.application_submission_entitlements;
BEGIN
  IF NEW.status NOT IN ('refunded', 'partially_refunded', 'disputed', 'chargeback')
     OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT application.status
  INTO v_application_status
  FROM public.applications AS application
  WHERE application.id = NEW.application_id;

  SELECT * INTO v_entitlement
  FROM public.application_submission_entitlements AS entitlement
  WHERE entitlement.application_id = NEW.application_id
  FOR UPDATE;

  IF v_entitlement.application_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(COALESCE(v_application_status, '')) NOT IN ('processing', 'submitted', 'completed') THEN
    UPDATE public.application_submission_entitlements
    SET decision_status = 'review_required',
        decision_reason = 'order_payment_reversed',
        updated_at = now()
    WHERE application_id = NEW.application_id;
  END IF;

  INSERT INTO public.application_submission_entitlement_events(
    application_id,
    event_type,
    decision_status,
    snapshot
  )
  VALUES (
    NEW.application_id,
    CASE
      WHEN lower(COALESCE(v_application_status, '')) IN ('processing', 'submitted', 'completed')
        THEN 'order_payment_reversed_after_submission'
      ELSE 'order_payment_reversed'
    END,
    CASE
      WHEN lower(COALESCE(v_application_status, '')) IN ('processing', 'submitted', 'completed')
        THEN v_entitlement.decision_status
      ELSE 'review_required'
    END,
    jsonb_build_object(
      'order_id', NEW.id,
      'order_status', NEW.status,
      'application_status', v_application_status,
      'recorded_at', now()
    )
  );
  IF lower(COALESCE(v_application_status, '')) IN ('processing', 'submitted', 'completed') THEN
    PERFORM private.record_submission_payment_risk_work_item(
      NEW.application_id,
      NEW.id,
      'order',
      NEW.id::TEXT,
      'Payment reversal after submission',
      jsonb_build_object('order_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_submission_entitlement_review_on_order_risk
  ON public."order";
CREATE TRIGGER mark_submission_entitlement_review_on_order_risk
AFTER UPDATE OF status
ON public."order"
FOR EACH ROW
EXECUTE FUNCTION private.mark_submission_entitlement_review_on_order_risk();

CREATE OR REPLACE FUNCTION private.mark_submission_entitlement_review_on_payment_risk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_application_status TEXT;
  v_entitlement public.application_submission_entitlements;
BEGIN
  IF NEW.application_id IS NULL
     OR NEW.status NOT IN ('refunded', 'partially_refunded', 'disputed', 'chargeback')
     OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT application.status
  INTO v_application_status
  FROM public.applications AS application
  WHERE application.id = NEW.application_id;

  SELECT * INTO v_entitlement
  FROM public.application_submission_entitlements AS entitlement
  WHERE entitlement.application_id = NEW.application_id
  FOR UPDATE;

  IF v_entitlement.application_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(COALESCE(v_application_status, '')) NOT IN ('processing', 'submitted', 'completed') THEN
    UPDATE public.application_submission_entitlements
    SET decision_status = 'review_required',
        decision_reason = 'payment_record_reversed',
        updated_at = now()
    WHERE application_id = NEW.application_id;
  END IF;

  INSERT INTO public.application_submission_entitlement_events(
    application_id, event_type, decision_status, snapshot
  )
  VALUES (
    NEW.application_id,
    CASE
      WHEN lower(COALESCE(v_application_status, '')) IN ('processing', 'submitted', 'completed')
        THEN 'payment_record_reversed_after_submission'
      ELSE 'payment_record_reversed'
    END,
    CASE
      WHEN lower(COALESCE(v_application_status, '')) IN ('processing', 'submitted', 'completed')
        THEN v_entitlement.decision_status
      ELSE 'review_required'
    END,
    jsonb_build_object(
      'payment_record_id', NEW.id,
      'payment_status', NEW.status,
      'application_status', v_application_status,
      'recorded_at', now()
    )
  );
  IF lower(COALESCE(v_application_status, '')) IN ('processing', 'submitted', 'completed') THEN
    PERFORM private.record_submission_payment_risk_work_item(
      NEW.application_id,
      NEW.order_id,
      'payment_record',
      NEW.id::TEXT,
      'Payment record reversal after submission',
      jsonb_build_object('payment_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_submission_entitlement_review_on_payment_risk
  ON public.payment_records;
CREATE TRIGGER mark_submission_entitlement_review_on_payment_risk
AFTER UPDATE OF status
ON public.payment_records
FOR EACH ROW
EXECUTE FUNCTION private.mark_submission_entitlement_review_on_payment_risk();

CREATE OR REPLACE FUNCTION private.mark_submission_entitlement_review_on_allocation_risk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_application_status TEXT;
  v_entitlement public.application_submission_entitlements;
BEGIN
  IF NEW.state NOT IN ('released', 'review_required')
     OR OLD.state IS NOT DISTINCT FROM NEW.state THEN
    RETURN NEW;
  END IF;

  SELECT application.status
  INTO v_application_status
  FROM public.applications AS application
  WHERE application.id = NEW.application_id;

  SELECT * INTO v_entitlement
  FROM public.application_submission_entitlements AS entitlement
  WHERE entitlement.application_id = NEW.application_id
  FOR UPDATE;

  IF v_entitlement.application_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(COALESCE(v_application_status, '')) NOT IN ('processing', 'submitted', 'completed') THEN
    UPDATE public.application_submission_entitlements
    SET decision_status = 'review_required',
        official_fee_status = 'review_required',
        decision_reason = 'government_allocation_abnormal',
        updated_at = now()
    WHERE application_id = NEW.application_id;
  END IF;

  INSERT INTO public.application_submission_entitlement_events(
    application_id, event_type, decision_status, snapshot
  )
  VALUES (
    NEW.application_id,
    CASE
      WHEN lower(COALESCE(v_application_status, '')) IN ('processing', 'submitted', 'completed')
        THEN 'government_allocation_abnormal_after_submission'
      ELSE 'government_allocation_abnormal'
    END,
    CASE
      WHEN lower(COALESCE(v_application_status, '')) IN ('processing', 'submitted', 'completed')
        THEN v_entitlement.decision_status
      ELSE 'review_required'
    END,
    jsonb_build_object(
      'allocation_id', NEW.id,
      'allocation_state', NEW.state,
      'application_status', v_application_status,
      'recorded_at', now()
    )
  );
  IF lower(COALESCE(v_application_status, '')) IN ('processing', 'submitted', 'completed') THEN
    PERFORM private.record_submission_payment_risk_work_item(
      NEW.application_id,
      NEW.order_id,
      'government_fee_allocation',
      NEW.id::TEXT,
      'Official-fee allocation exception after submission',
      jsonb_build_object('allocation_state', NEW.state)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mark_submission_entitlement_review_on_allocation_risk
  ON public.government_fee_allocations;
CREATE TRIGGER mark_submission_entitlement_review_on_allocation_risk
AFTER UPDATE OF state
ON public.government_fee_allocations
FOR EACH ROW
EXECUTE FUNCTION private.mark_submission_entitlement_review_on_allocation_risk();

-- Queue insertion and application lifecycle updates share one gate. The
-- trigger does not trust an end-user JWT, user_metadata, or a client-provided
-- payment flag. A failed check uses SQLSTATE 42501 and the stable code in the
-- message/detail so HTTP boundaries can return 402/application_payment_required.
CREATE OR REPLACE FUNCTION private.enforce_submission_payment_fence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_application_id UUID;
  v_purpose TEXT;
  v_dry_run BOOLEAN := false;
  v_status TEXT;
BEGIN
  IF TG_TABLE_NAME = 'applications' THEN
    v_application_id := NEW.id;
  ELSE
    v_application_id := NEW.application_id;
    v_status := lower(COALESCE(to_jsonb(NEW) ->> 'status', ''));
    IF v_status NOT IN ('pending', 'queued', 'claimed', 'running', 'processing', 'scheduled')
       AND v_status <> 'france_live_official_portal_opened'
       AND v_status NOT LIKE '%\_pending' ESCAPE '\'
       AND v_status NOT LIKE '%\_scheduled' ESCAPE '\'
       AND v_status NOT LIKE '%\_processing' ESCAPE '\' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT application.purpose
  INTO v_purpose
  FROM public.applications AS application
  WHERE application.id = v_application_id;

  IF TG_TABLE_NAME = 'submission_queue' THEN
    v_dry_run := lower(COALESCE(to_jsonb(NEW) ->> 'mode', '')) = 'dry_run';
  ELSIF TG_TABLE_NAME = 'runner_job' THEN
    v_dry_run := lower(COALESCE(to_jsonb(NEW) -> 'metadata' ->> 'mode', '')) = 'dry_run';
  END IF;

  IF v_purpose = 'VIZA_PLACEHOLDER_DRY_RUN'
     AND v_dry_run
     AND session_user IN ('postgres', 'supabase_admin')
     AND current_setting('app.viza_schema_qa_payment_bypass', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NOT private.submission_entitlement_ready(v_application_id) THEN
    RAISE EXCEPTION 'application_payment_required'
      USING ERRCODE = '42501',
            DETAIL = 'application_payment_required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_submission_payment_fence_on_queue
  ON public.submission_queue;
CREATE TRIGGER enforce_submission_payment_fence_on_queue
BEFORE INSERT OR UPDATE OF application_id, status, mode
ON public.submission_queue
FOR EACH ROW
EXECUTE FUNCTION private.enforce_submission_payment_fence();

DROP TRIGGER IF EXISTS enforce_submission_payment_fence_on_runner
  ON public.runner_job;
CREATE TRIGGER enforce_submission_payment_fence_on_runner
BEFORE INSERT OR UPDATE OF application_id, status, metadata
ON public.runner_job
FOR EACH ROW
EXECUTE FUNCTION private.enforce_submission_payment_fence();

DROP TRIGGER IF EXISTS enforce_submission_payment_fence_on_application
  ON public.applications;
CREATE TRIGGER enforce_submission_payment_fence_on_application
BEFORE UPDATE OF status
ON public.applications
FOR EACH ROW
WHEN (NEW.status IN ('processing', 'submitted') AND OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION private.enforce_submission_payment_fence();

REVOKE ALL ON FUNCTION private.submission_entitlement_ready(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_submission_payment_fence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.mark_submission_entitlement_review_on_order_risk() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.record_submission_payment_risk_work_item(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.mark_submission_entitlement_review_on_payment_risk() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.mark_submission_entitlement_review_on_allocation_risk() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_applicant_high_access(UUID, UUID, TIMESTAMPTZ, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_applicant_high_access(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_admin_registration_invite(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_admin_registration_invites() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_applicant_access_grants(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_admin_registration_invite(TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_admin_registration_invite(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_admin_registration_invite(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_submission_checkout_order(UUID, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_submission_order_payment(UUID, TEXT, TEXT, TIMESTAMPTZ, BIGINT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_applicant_high_access(UUID, UUID, TIMESTAMPTZ, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_applicant_high_access(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_admin_registration_invite(TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_admin_registration_invites() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_applicant_access_grants(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_admin_registration_invite(TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_admin_registration_invite(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_admin_registration_invite(TEXT, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_submission_checkout_order(UUID, UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_submission_order_payment(UUID, TEXT, TEXT, TIMESTAMPTZ, BIGINT, TEXT, INTEGER, TEXT) TO service_role;

-- Fix the Auth trigger so raw_user_metadata.role cannot grant privileges. The
-- metadata name is display-only; authorization is determined by memberships.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.raw_app_meta_data ->> 'user_type' = 'patient' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.users(id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'name', ''), NEW.email),
    'client'
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = CASE WHEN NULLIF(trim(public.users.name), '') IS NULL THEN EXCLUDED.name ELSE public.users.name END;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Runtime authorization requires both users.role and an active membership. The
-- six production bootstrap accounts plus the local test account are migrated
-- once from the existing role projection; the email list is not a runtime
-- allowlist and is never consulted by application code.
INSERT INTO public.users(id, email, name, role)
SELECT auth_user.id,
       auth_user.email,
       COALESCE(NULLIF(auth_user.raw_user_meta_data ->> 'name', ''), auth_user.email),
       'admin'
FROM auth.users AS auth_user
WHERE lower(auth_user.email) IN (
  'czz19974931995@gmail.com',
  'edward.zehua.zhang@gmail.com',
  'fionatsui2017@gmail.com',
  'junjieran05@gmail.com',
  'e1484122@u.nus.edu',
  'nanan.viza2016@gmail.com',
  'admin@viza.test'
)
ON CONFLICT (id) DO UPDATE
SET role = 'admin', email = EXCLUDED.email;

INSERT INTO public.admin_memberships(auth_user_id, status, granted_by_admin_id, metadata)
SELECT auth_user.id,
       'active',
       auth_user.id,
       jsonb_build_object('source', 'bootstrap_membership')
FROM auth.users AS auth_user
LEFT JOIN public.users AS user_projection ON user_projection.id = auth_user.id
WHERE user_projection.role = 'admin'
  AND user_projection.deleted_at IS NULL
  AND lower(auth_user.email) IN (
    'czz19974931995@gmail.com',
    'edward.zehua.zhang@gmail.com',
    'fionatsui2017@gmail.com',
    'junjieran05@gmail.com',
    'e1484122@u.nus.edu',
    'nanan.viza2016@gmail.com',
    'admin@viza.test'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.admin_memberships AS membership
    WHERE membership.auth_user_id = auth_user.id
      AND membership.status = 'active'
  );

INSERT INTO public.admin_membership_events(membership_id, event_type, actor_admin_id, metadata)
SELECT membership.id, 'granted', membership.granted_by_admin_id, membership.metadata
FROM public.admin_memberships AS membership
WHERE membership.metadata ->> 'source' = 'bootstrap_membership'
  AND NOT EXISTS (
    SELECT 1
    FROM public.admin_membership_events AS event
    WHERE event.membership_id = membership.id
      AND event.event_type = 'granted'
  );

-- Reconcile already-paid applications into an explicit entitlement. This is a
-- conservative backfill: only verified paid orders/agency records qualify;
-- managed government fees remain required until a strict allocation exists.
UPDATE public.payment_records AS payment
SET order_id = paid_order.id,
    updated_at = now()
FROM public."order" AS paid_order
WHERE payment.order_id IS NULL
  AND payment.application_id = paid_order.application_id
  AND (
    (payment.provider_session_id IS NOT NULL
      AND payment.provider_session_id = paid_order.stripe_checkout_session_id)
    OR (payment.provider_payment_id IS NOT NULL
      AND payment.provider_payment_id = paid_order.stripe_payment_intent_id)
  );

WITH unambiguous_order AS (
  SELECT payment.id AS payment_id, min(paid_order.id::TEXT)::UUID AS order_id
  FROM public.payment_records AS payment
  JOIN public."order" AS paid_order
    ON paid_order.application_id = payment.application_id
   AND upper(paid_order.currency) = upper(payment.currency)
   AND lower(paid_order.status) IN ('paid', 'submitted', 'completed')
   AND paid_order.agency_fee_cents > 0
  WHERE payment.order_id IS NULL
    AND payment.fee_type = 'agency_fee'
    AND lower(payment.status) IN ('paid', 'succeeded', 'success', 'complete', 'completed')
  GROUP BY payment.id
  HAVING count(*) = 1
)
UPDATE public.payment_records AS payment
SET order_id = candidate.order_id,
    updated_at = now()
FROM unambiguous_order AS candidate
WHERE payment.id = candidate.payment_id;

INSERT INTO public.application_submission_entitlements (
  application_id,
  payer_auth_user_id,
  access_level,
  agency_fee_status,
  agency_fee_amount_cents,
  official_fee_status,
  official_fee_amount_cents,
  currency,
  order_id,
  payment_record_id,
  government_fee_allocation_id,
  decision_status,
  decision_reason,
  locked_at,
  grant_locked_at,
  metadata
)
SELECT application.id,
       profile.auth_user_id,
       'standard',
       CASE
         WHEN COALESCE(paid_order.agency_fee_cents, 0) > 0
           OR EXISTS (
             SELECT 1 FROM public.payment_records AS payment
             WHERE payment.application_id = application.id
               AND payment.fee_type = 'agency_fee'
               AND lower(payment.status) IN ('paid', 'succeeded', 'success', 'completed')
           ) THEN 'paid'
         ELSE 'required'
       END,
       GREATEST(0, COALESCE(paid_order.agency_fee_cents, 0)),
       CASE
         WHEN allocation.id IS NOT NULL THEN 'paid'
         ELSE 'required'
       END,
       GREATEST(0, COALESCE(application.government_fee_cents, paid_order.govt_fee_cents, 0)),
       COALESCE(application.government_fee_currency, paid_order.currency, 'USD'),
       paid_order.id,
       paid_payment.id,
       allocation.id,
       CASE
         WHEN (
           COALESCE(paid_order.agency_fee_cents, 0) > 0
           OR EXISTS (
             SELECT 1 FROM public.payment_records AS payment
             WHERE payment.application_id = application.id
               AND payment.fee_type = 'agency_fee'
               AND lower(payment.status) IN ('paid', 'succeeded', 'success', 'completed')
           )
         ) AND (
           allocation.id IS NOT NULL
         ) THEN 'ready'
         ELSE 'payment_required'
       END,
       'historical_payment_backfill',
       now(),
       NULL,
       jsonb_build_object('source', '20260824090000_admin_access_entitlements')
FROM public.applications AS application
JOIN public.applicant_profiles AS profile ON profile.id = application.applicant_id
LEFT JOIN LATERAL (
  SELECT paid.id, paid.agency_fee_cents, paid.govt_fee_cents, paid.currency
  FROM public."order" AS paid
  WHERE paid.application_id = application.id
    AND paid.status IN ('paid', 'submitted', 'completed')
  ORDER BY paid.paid_at DESC NULLS LAST, paid.created_at DESC
  LIMIT 1
) AS paid_order ON true
LEFT JOIN LATERAL (
  SELECT payment.id
  FROM public.payment_records AS payment
  WHERE payment.application_id = application.id
    AND payment.fee_type = 'agency_fee'
    AND lower(payment.status) IN ('paid', 'succeeded', 'success', 'completed')
  ORDER BY payment.paid_at DESC NULLS LAST, payment.created_at DESC
  LIMIT 1
) AS paid_payment ON true
LEFT JOIN LATERAL (
  SELECT allocation.id
  FROM public.government_fee_allocations AS allocation
  WHERE allocation.application_id = application.id
    AND allocation.state NOT IN ('released', 'review_required')
    AND allocation.amount_cents = COALESCE(application.government_fee_cents, paid_order.govt_fee_cents, 0)
    AND upper(allocation.currency) = upper(COALESCE(application.government_fee_currency, paid_order.currency, 'USD'))
  ORDER BY allocation.created_at DESC
  LIMIT 1
) AS allocation ON true
WHERE profile.auth_user_id IS NOT NULL
  AND (paid_order.id IS NOT NULL OR paid_payment.id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1
    FROM public.application_submission_entitlements AS existing
    WHERE existing.application_id = application.id
  )
ON CONFLICT (application_id) DO NOTHING;

ALTER TABLE public.applicant_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_access_grant_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_submission_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_submission_entitlement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_membership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_registration_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_registration_invite_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_fee_allocations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.applicant_access_grants,
  public.applicant_access_grant_events,
  public.application_submission_entitlements,
  public.application_submission_entitlement_events,
  public.admin_memberships,
  public.admin_membership_events,
  public.admin_registration_invites,
  public.admin_registration_invite_events,
  public.government_fee_allocations
FROM anon, authenticated;
GRANT ALL ON TABLE
  public.applicant_access_grants,
  public.applicant_access_grant_events,
  public.application_submission_entitlements,
  public.application_submission_entitlement_events,
  public.admin_memberships,
  public.admin_membership_events,
  public.admin_registration_invites,
  public.admin_registration_invite_events,
  public.government_fee_allocations
TO service_role;

-- A signed-in user may inspect only their current membership/grant. All
-- mutations continue to require service_role, and entitlements/invites/audit
-- tables stay private to server code.
GRANT SELECT ON TABLE public.admin_memberships TO authenticated;
GRANT SELECT ON TABLE public.applicant_access_grants TO authenticated;
DROP POLICY IF EXISTS admin_memberships_select_own ON public.admin_memberships;
CREATE POLICY admin_memberships_select_own
ON public.admin_memberships FOR SELECT TO authenticated
USING (auth_user_id = (SELECT auth.uid()) AND status = 'active');
DROP POLICY IF EXISTS applicant_access_grants_select_own ON public.applicant_access_grants;
CREATE POLICY applicant_access_grants_select_own
ON public.applicant_access_grants FOR SELECT TO authenticated
USING (
  auth_user_id = (SELECT auth.uid())
  AND status = 'active'
  AND starts_at <= now()
  AND (expires_at IS NULL OR expires_at > now())
);

COMMENT ON TABLE public.applicant_access_grants IS
  'Admin-granted account-wide high access. NULL expires_at means permanent; application locks are independent snapshots.';
COMMENT ON TABLE public.application_submission_entitlements IS
  'Application-scoped final-submission payment/waiver snapshot. It is the only database fence input.';
COMMENT ON TABLE public.admin_registration_invites IS
  'Single-use 24-hour admin registration links. Only token SHA-256 digests are persisted.';
COMMENT ON FUNCTION private.enforce_submission_payment_fence() IS
  'Fail-closed final-submission fence; only the controlled placeholder dry-run can bypass the entitlement.';
