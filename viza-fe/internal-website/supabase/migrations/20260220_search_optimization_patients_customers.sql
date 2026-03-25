-- ============================================================
-- Search Optimization: patients, shopify_customers, activity_log
-- Adds generated search_text columns with GIN trigram indexes
-- ============================================================

-- 1. patients: search_text = name + email
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS search_text text GENERATED ALWAYS AS (
    coalesce(name, '') || ' ' || coalesce(email, '')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_patients_search_text_trgm
  ON public.patients USING gin (search_text extensions.gin_trgm_ops);

-- 2. shopify_customers: search_text = email + first_name + last_name
ALTER TABLE public.shopify_customers
  ADD COLUMN IF NOT EXISTS search_text text GENERATED ALWAYS AS (
    coalesce(email, '') || ' ' || coalesce(first_name, '') || ' ' || coalesce(last_name, '')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_shopify_customers_search_text_trgm
  ON public.shopify_customers USING gin (search_text extensions.gin_trgm_ops);

-- btree index on patient_id for "unlinked shopify" tab (WHERE patient_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_shopify_customers_patient_id_null
  ON public.shopify_customers (patient_id) WHERE patient_id IS NULL;

-- 3. activity_log: search_text = event_type + resource_id
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS search_text text GENERATED ALWAYS AS (
    coalesce(event_type, '') || ' ' || coalesce(resource_id, '')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_activity_log_search_text_trgm
  ON public.activity_log USING gin (search_text extensions.gin_trgm_ops);
