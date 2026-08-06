-- Phase 2: treasury evidence and reconciliation controls.
--
-- This migration records provider evidence only. It does not configure Stripe
-- payouts, move money, issue cards, or persist card data.

ALTER TABLE public.payment_provisioning_jobs
  ADD COLUMN IF NOT EXISTS allocation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (allocation_status IN ('pending', 'completed'));

CREATE TABLE IF NOT EXISTS public.treasury_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider = 'stripe'),
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  stripe_payout_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_transit', 'paid', 'failed', 'canceled')),
  amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  fee_cents BIGINT NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  net_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  arrival_at TIMESTAMPTZ,
  payout_created_at TIMESTAMPTZ,
  event_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  destination_fingerprint TEXT,
  destination_last4 TEXT,
  bank_reference TEXT,
  reconciliation_status TEXT NOT NULL DEFAULT 'unreconciled'
    CHECK (reconciliation_status IN ('unreconciled', 'matched', 'exception')),
  payload_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  reconciled_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id),
  UNIQUE (provider, stripe_payout_id)
);

CREATE INDEX IF NOT EXISTS treasury_payouts_status_idx
  ON public.treasury_payouts(reconciliation_status, status, event_created_at);
CREATE INDEX IF NOT EXISTS treasury_payouts_unreconciled_age_idx
  ON public.treasury_payouts(event_created_at)
  WHERE reconciliation_status = 'unreconciled';

-- Read-only treasury control input for Phase 2. Card issuance remains a later
-- phase; this ledger records reservations and their aging without spending.
CREATE TABLE IF NOT EXISTS public.government_fee_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public."order"(id) ON DELETE CASCADE,
  order_line_id UUID REFERENCES public.order_line(id) ON DELETE SET NULL,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  official_fee_payment_intent_id UUID REFERENCES public.official_fee_payment_intents(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS government_fee_allocations_state_idx
  ON public.government_fee_allocations(state, reserved_at);
CREATE INDEX IF NOT EXISTS government_fee_allocations_currency_idx
  ON public.government_fee_allocations(currency, state);

CREATE TABLE IF NOT EXISTS public.treasury_funding_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  provider_transaction_id TEXT,
  funding_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'reversed')),
  amount NUMERIC(20, 8) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL,
  source_stripe_payout_id TEXT,
  bank_reference TEXT,
  balance_after NUMERIC(20, 8),
  confirmed_at TIMESTAMPTZ,
  event_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS treasury_funding_events_transaction_idx
  ON public.treasury_funding_events(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS treasury_funding_events_account_idx
  ON public.treasury_funding_events(provider, funding_account_id, event_created_at DESC);
CREATE INDEX IF NOT EXISTS treasury_funding_events_status_idx
  ON public.treasury_funding_events(status, event_created_at DESC);

CREATE TABLE IF NOT EXISTS public.treasury_reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'failed')),
  payout_count INTEGER NOT NULL DEFAULT 0 CHECK (payout_count >= 0),
  funding_event_count INTEGER NOT NULL DEFAULT 0 CHECK (funding_event_count >= 0),
  exception_count INTEGER NOT NULL DEFAULT 0 CHECK (exception_count >= 0),
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS treasury_reconciliation_runs_provider_idx
  ON public.treasury_reconciliation_runs(provider, started_at DESC);

CREATE TABLE IF NOT EXISTS public.treasury_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('warning', 'critical')),
  provider TEXT,
  entity_key TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  message TEXT NOT NULL,
  metadata_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS treasury_exceptions_queue_idx
  ON public.treasury_exceptions(status, severity, last_seen_at DESC);

ALTER TABLE public.treasury_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_funding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_fee_allocations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.treasury_payouts,
  public.treasury_funding_events,
  public.treasury_reconciliation_runs,
  public.treasury_exceptions,
  public.government_fee_allocations
FROM anon, authenticated;
GRANT ALL ON TABLE
  public.treasury_payouts,
  public.treasury_funding_events,
  public.treasury_reconciliation_runs,
  public.treasury_exceptions,
  public.government_fee_allocations
TO service_role;

CREATE OR REPLACE FUNCTION public.record_treasury_payout_event(
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_stripe_payout_id TEXT,
  p_status TEXT,
  p_amount_cents BIGINT,
  p_fee_cents BIGINT,
  p_net_cents BIGINT,
  p_currency TEXT,
  p_arrival_at TIMESTAMPTZ,
  p_payout_created_at TIMESTAMPTZ,
  p_event_created_at TIMESTAMPTZ,
  p_destination_fingerprint TEXT,
  p_destination_last4 TEXT,
  p_bank_reference TEXT,
  p_payload_redacted JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(payout_row_id UUID, event_replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.treasury_payouts;
  v_replayed BOOLEAN;
BEGIN
  SELECT * INTO v_row
  FROM public.treasury_payouts
  WHERE provider = 'stripe' AND provider_event_id = p_provider_event_id
  FOR UPDATE;

  IF v_row.id IS NOT NULL THEN
    UPDATE public.treasury_payouts
    SET last_seen_at = now(), updated_at = now()
    WHERE id = v_row.id;
    RETURN QUERY SELECT v_row.id, true;
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.treasury_payouts
  WHERE provider = 'stripe' AND stripe_payout_id = p_stripe_payout_id
  FOR UPDATE;

  IF v_row.id IS NOT NULL THEN
    v_replayed := p_event_created_at <= v_row.event_created_at;
    UPDATE public.treasury_payouts AS payout
    SET
      provider_event_id = CASE WHEN p_event_created_at >= payout.event_created_at THEN p_provider_event_id ELSE payout.provider_event_id END,
      event_type = CASE WHEN p_event_created_at >= payout.event_created_at THEN p_event_type ELSE payout.event_type END,
      status = CASE WHEN p_event_created_at >= payout.event_created_at THEN p_status ELSE payout.status END,
      amount_cents = CASE WHEN p_event_created_at >= payout.event_created_at THEN p_amount_cents ELSE payout.amount_cents END,
      fee_cents = CASE WHEN p_event_created_at >= payout.event_created_at THEN p_fee_cents ELSE payout.fee_cents END,
      net_cents = CASE WHEN p_event_created_at >= payout.event_created_at THEN p_net_cents ELSE payout.net_cents END,
      currency = CASE WHEN p_event_created_at >= payout.event_created_at THEN p_currency ELSE payout.currency END,
      arrival_at = CASE WHEN p_event_created_at >= payout.event_created_at THEN p_arrival_at ELSE payout.arrival_at END,
      payout_created_at = COALESCE(payout.payout_created_at, p_payout_created_at),
      event_created_at = GREATEST(payout.event_created_at, p_event_created_at),
      destination_fingerprint = COALESCE(p_destination_fingerprint, payout.destination_fingerprint),
      destination_last4 = COALESCE(p_destination_last4, payout.destination_last4),
      bank_reference = COALESCE(p_bank_reference, payout.bank_reference),
      reconciliation_status = CASE
        WHEN p_status IN ('failed', 'canceled') THEN 'exception'
        ELSE payout.reconciliation_status
      END,
      payload_redacted = CASE WHEN p_event_created_at >= payout.event_created_at THEN COALESCE(p_payload_redacted, '{}'::jsonb) ELSE payout.payload_redacted END,
      last_seen_at = now(),
      updated_at = now()
    WHERE payout.id = v_row.id
    RETURNING payout.* INTO v_row;
    RETURN QUERY SELECT v_row.id, v_replayed;
    RETURN;
  END IF;

  INSERT INTO public.treasury_payouts (
    provider_event_id, event_type, stripe_payout_id, status,
    amount_cents, fee_cents, net_cents, currency, arrival_at,
    payout_created_at, event_created_at, destination_fingerprint,
    destination_last4, bank_reference, reconciliation_status,
    payload_redacted
  )
  VALUES (
    p_provider_event_id, p_event_type, p_stripe_payout_id, p_status,
    p_amount_cents, p_fee_cents, p_net_cents, p_currency, p_arrival_at,
    p_payout_created_at, p_event_created_at, p_destination_fingerprint,
    p_destination_last4, p_bank_reference,
    CASE WHEN p_status IN ('failed', 'canceled') THEN 'exception' ELSE 'unreconciled' END,
    COALESCE(p_payload_redacted, '{}'::jsonb)
  )
  RETURNING id INTO v_row.id;

  RETURN QUERY SELECT v_row.id, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_treasury_funding_event(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_provider_transaction_id TEXT,
  p_funding_account_id TEXT,
  p_status TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_source_stripe_payout_id TEXT,
  p_bank_reference TEXT,
  p_balance_after NUMERIC,
  p_confirmed_at TIMESTAMPTZ,
  p_event_created_at TIMESTAMPTZ,
  p_payload_redacted JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(funding_event_row_id UUID, event_replayed BOOLEAN)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.treasury_funding_events;
  v_replayed BOOLEAN;
BEGIN
  SELECT * INTO v_row
  FROM public.treasury_funding_events
  WHERE provider = p_provider AND provider_event_id = p_provider_event_id
  FOR UPDATE;

  IF v_row.id IS NOT NULL THEN
    UPDATE public.treasury_funding_events
    SET last_seen_at = now(), updated_at = now()
    WHERE id = v_row.id;
    RETURN QUERY SELECT v_row.id, true;
    RETURN;
  END IF;

  SELECT * INTO v_row
  FROM public.treasury_funding_events
  WHERE provider = p_provider
    AND p_provider_transaction_id IS NOT NULL
    AND provider_transaction_id = p_provider_transaction_id
  FOR UPDATE;

  IF v_row.id IS NOT NULL THEN
    v_replayed := p_event_created_at <= v_row.event_created_at;
    UPDATE public.treasury_funding_events AS funding
    SET
      event_type = CASE WHEN p_event_created_at >= funding.event_created_at THEN p_event_type ELSE funding.event_type END,
      funding_account_id = COALESCE(funding.funding_account_id, p_funding_account_id),
      status = CASE WHEN p_event_created_at >= funding.event_created_at THEN p_status ELSE funding.status END,
      amount = CASE WHEN p_event_created_at >= funding.event_created_at THEN p_amount ELSE funding.amount END,
      currency = CASE WHEN p_event_created_at >= funding.event_created_at THEN p_currency ELSE funding.currency END,
      source_stripe_payout_id = COALESCE(funding.source_stripe_payout_id, p_source_stripe_payout_id),
      bank_reference = COALESCE(funding.bank_reference, p_bank_reference),
      balance_after = CASE WHEN p_event_created_at >= funding.event_created_at THEN p_balance_after ELSE funding.balance_after END,
      confirmed_at = COALESCE(funding.confirmed_at, p_confirmed_at),
      event_created_at = GREATEST(funding.event_created_at, p_event_created_at),
      payload_redacted = CASE WHEN p_event_created_at >= funding.event_created_at THEN COALESCE(p_payload_redacted, '{}'::jsonb) ELSE funding.payload_redacted END,
      last_seen_at = now(),
      updated_at = now()
    WHERE funding.id = v_row.id
    RETURNING funding.* INTO v_row;
    RETURN QUERY SELECT v_row.id, v_replayed;
    RETURN;
  END IF;

  INSERT INTO public.treasury_funding_events (
    provider, provider_event_id, event_type, provider_transaction_id,
    funding_account_id, status, amount, currency, source_stripe_payout_id,
    bank_reference, balance_after, confirmed_at, event_created_at,
    payload_redacted
  )
  VALUES (
    p_provider, p_provider_event_id, p_event_type, p_provider_transaction_id,
    p_funding_account_id, p_status, p_amount, p_currency, p_source_stripe_payout_id,
    p_bank_reference, p_balance_after, p_confirmed_at, p_event_created_at,
    COALESCE(p_payload_redacted, '{}'::jsonb)
  )
  RETURNING id INTO v_row.id;

  RETURN QUERY SELECT v_row.id, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_treasury_exception(
  p_exception_key TEXT,
  p_kind TEXT,
  p_severity TEXT,
  p_provider TEXT,
  p_entity_key TEXT,
  p_message TEXT,
  p_metadata_redacted JSONB DEFAULT '{}'::jsonb
)
RETURNS public.treasury_exceptions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.treasury_exceptions;
BEGIN
  INSERT INTO public.treasury_exceptions (
    exception_key, kind, severity, provider, entity_key, message, metadata_redacted
  )
  VALUES (
    p_exception_key, p_kind, p_severity, p_provider, p_entity_key,
    left(p_message, 2000), COALESCE(p_metadata_redacted, '{}'::jsonb)
  )
  ON CONFLICT (exception_key) DO UPDATE
  SET
    kind = EXCLUDED.kind,
    severity = EXCLUDED.severity,
    provider = EXCLUDED.provider,
    entity_key = EXCLUDED.entity_key,
    message = EXCLUDED.message,
    metadata_redacted = EXCLUDED.metadata_redacted,
    status = CASE WHEN public.treasury_exceptions.status = 'resolved' THEN 'open' ELSE public.treasury_exceptions.status END,
    resolved_at = CASE WHEN public.treasury_exceptions.status = 'resolved' THEN NULL ELSE public.treasury_exceptions.resolved_at END,
    last_seen_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.record_treasury_payout_event(
  TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT, BIGINT, TEXT, TIMESTAMPTZ,
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_treasury_funding_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, NUMERIC,
  TIMESTAMPTZ, TIMESTAMPTZ, JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_treasury_exception(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_treasury_payout_event(
  TEXT, TEXT, TEXT, TEXT, BIGINT, BIGINT, BIGINT, TEXT, TIMESTAMPTZ,
  TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_treasury_funding_event(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, NUMERIC,
  TIMESTAMPTZ, TIMESTAMPTZ, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_treasury_exception(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

COMMENT ON TABLE public.treasury_payouts IS
  'Redacted Stripe payout evidence and reconciliation state; does not configure or initiate payouts.';
COMMENT ON TABLE public.treasury_funding_events IS
  'Redacted PhotonPay funding/issuing evidence and idempotency keys; no card data is stored.';
COMMENT ON TABLE public.treasury_exceptions IS
  'Finance-owned daily exception queue for payout, funding, balance, and aging controls.';
