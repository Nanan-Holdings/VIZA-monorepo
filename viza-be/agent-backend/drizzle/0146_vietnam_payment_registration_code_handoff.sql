-- Preserve the encrypted Vietnam registration-code checkpoint when an
-- official-fee authorization creates a new isolated payment queue row.
--
-- The enqueue RPC intentionally stores only a boolean registration-code
-- marker in JSON.  The worker, correctly, requires the encrypted value before
-- it opens the official payment search.  Copying ciphertext here keeps that
-- handoff inside the same application/provider boundary without exposing the
-- code to the frontend, logs, or RPC arguments.

CREATE OR REPLACE FUNCTION public.carry_forward_vietnam_payment_registration_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.provider <> 'vietnam_evisa_live'
    OR NEW.status <> 'vn_payment_pending'
    OR NEW.vn_registration_code_encrypted IS NOT NULL
    OR COALESCE(NEW.vn_result_payload ->> 'registrationCodeCaptured', 'false') <> 'true'
  THEN
    RETURN NEW;
  END IF;

  SELECT sq.vn_registration_code_encrypted
  INTO NEW.vn_registration_code_encrypted
  FROM public.submission_queue AS sq
  WHERE sq.application_id = NEW.application_id
    AND sq.provider = NEW.provider
    AND sq.vn_registration_code_encrypted IS NOT NULL
  ORDER BY sq.updated_at DESC NULLS LAST, sq.created_at DESC
  LIMIT 1
  FOR UPDATE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submission_queue_carry_forward_vietnam_payment_registration_code
  ON public.submission_queue;

CREATE TRIGGER submission_queue_carry_forward_vietnam_payment_registration_code
BEFORE INSERT ON public.submission_queue
FOR EACH ROW
EXECUTE FUNCTION public.carry_forward_vietnam_payment_registration_code();

REVOKE ALL ON FUNCTION public.carry_forward_vietnam_payment_registration_code()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.carry_forward_vietnam_payment_registration_code() IS
  'Copies only an existing encrypted Vietnam registration code into a new payment queue row for the same application/provider.';

