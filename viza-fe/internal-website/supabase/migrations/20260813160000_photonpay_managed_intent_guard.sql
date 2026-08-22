-- Defense in depth: only an explicitly consented VIZA-managed-card intent may
-- acquire a durable PhotonPay issuer-card attempt. Legacy client-entered card
-- intents must remain isolated even when PhotonPay is enabled globally.

CREATE OR REPLACE FUNCTION public.enforce_issuer_card_managed_intent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application_id UUID;
  v_payment_method_type TEXT;
BEGIN
  SELECT intent.application_id, intent.payment_method_type
  INTO v_application_id, v_payment_method_type
  FROM public.official_fee_payment_intents AS intent
  WHERE intent.id = NEW.official_fee_payment_intent_id;

  IF v_application_id IS NULL OR v_application_id <> NEW.application_id THEN
    RAISE EXCEPTION 'issuer-card intent does not belong to application';
  END IF;
  IF v_payment_method_type IS DISTINCT FROM 'viza_managed_virtual_card' THEN
    RAISE EXCEPTION 'issuer-card attempts require a VIZA-managed virtual-card intent';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS issuer_card_attempts_managed_intent_guard
  ON public.issuer_card_attempts;
CREATE TRIGGER issuer_card_attempts_managed_intent_guard
BEFORE INSERT OR UPDATE OF application_id, official_fee_payment_intent_id
ON public.issuer_card_attempts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_issuer_card_managed_intent();

REVOKE ALL ON FUNCTION public.enforce_issuer_card_managed_intent()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_issuer_card_managed_intent()
  TO service_role;
