-- Enable pg_trgm extension for trigram-based GIN indexes (efficient ILIKE '%term%' searches)
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Add a generated stored column that concatenates all searchable fields into one text blob.
-- PostgreSQL auto-maintains this on every INSERT/UPDATE — no application code needed.
ALTER TABLE public.orders
ADD COLUMN search_text text GENERATED ALWAYS AS (
  coalesce(shopify_order_id, '') || ' ' ||
  coalesce(order_data->>'name', '') || ' ' ||
  coalesce(order_data->'customer'->>'first_name', '') || ' ' ||
  coalesce(order_data->'customer'->>'last_name', '') || ' ' ||
  coalesce(order_data->'customer'->>'email', '') || ' ' ||
  coalesce(order_data->>'email', '')
) STORED;

-- GIN trigram index on search_text — replaces 6 sequential ILIKE scans with a single indexed lookup
CREATE INDEX idx_orders_search_text_trgm
ON public.orders
USING gin (search_text extensions.gin_trgm_ops);

-- Expression btree indexes on JSONB paths used for tab filtering
CREATE INDEX idx_orders_fulfillment_status
ON public.orders ((order_data->>'fulfillment_status'));

CREATE INDEX idx_orders_cancelled_at
ON public.orders ((order_data->>'cancelled_at'));

CREATE INDEX idx_orders_financial_status
ON public.orders ((order_data->>'financial_status'));

-- btree index on fulfillment_hold_status (regular column) for needs_action tab
CREATE INDEX idx_orders_fulfillment_hold_status
ON public.orders (fulfillment_hold_status);

-- Expression btree index on created_at from order_data for default date sort (DESC)
CREATE INDEX idx_orders_order_data_created_at
ON public.orders ((order_data->>'created_at') DESC);
