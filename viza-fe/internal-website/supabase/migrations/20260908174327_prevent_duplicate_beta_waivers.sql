-- A friend beta grant can waive the VIZA agency fee once per application.
-- The partial unique index makes retrying checkout idempotent and prevents two
-- concurrent requests from producing duplicate zero-value accounting records.
CREATE UNIQUE INDEX payment_records_one_beta_waiver_per_application_idx
  ON public.payment_records (application_id)
  WHERE provider = 'beta'
    AND fee_type = 'agency_fee'
    AND status IN ('paid', 'succeeded', 'success', 'complete', 'completed');
