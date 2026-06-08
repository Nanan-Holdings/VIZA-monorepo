-- =============================================================================
-- Travel local-first destination enrichment
--
-- Extends the destination index into a local-first cache with localized names,
-- verified assets, attraction records, and enrichment job/event audit tables.
-- =============================================================================

ALTER TABLE travel_destinations
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_zh text,
  ADD COLUMN IF NOT EXISTS aliases_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS country_name_en text,
  ADD COLUMN IF NOT EXISTS country_name_zh text,
  ADD COLUMN IF NOT EXISTS is_dropdown_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_popular boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_quality text NOT NULL DEFAULT 'incomplete',
  ADD COLUMN IF NOT EXISTS completeness_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_enriched_at timestamptz;

UPDATE travel_destinations
SET
  name_en = COALESCE(name_en, display_name, canonical_name),
  country_name_en = COALESCE(country_name_en, country_name),
  data_quality = CASE
    WHEN data_quality IS NOT NULL AND data_quality <> '' THEN data_quality
    WHEN is_verified THEN 'verified'
    ELSE 'incomplete'
  END
WHERE name_en IS NULL
  OR country_name_en IS NULL
  OR data_quality IS NULL
  OR data_quality = '';

CREATE TABLE IF NOT EXISTS travel_attractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES travel_destinations(id) ON DELETE CASCADE,
  canonical_name text NOT NULL,
  name_en text NOT NULL,
  name_zh text,
  description_en text,
  description_zh text,
  category text,
  latitude numeric,
  longitude numeric,
  recommended_duration_minutes integer,
  popularity_score numeric DEFAULT 0,
  data_quality text NOT NULL DEFAULT 'incomplete',
  source text,
  source_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  asset_type text NOT NULL,
  image_url text NOT NULL,
  thumbnail_url text,
  width integer,
  height integer,
  source text,
  source_url text,
  attribution text,
  license text,
  confidence_score numeric DEFAULT 0,
  verified boolean DEFAULT false,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE travel_destination_cards
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_zh text,
  ADD COLUMN IF NOT EXISTS subtitle_en text,
  ADD COLUMN IF NOT EXISTS subtitle_zh text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_zh text,
  ADD COLUMN IF NOT EXISTS image_asset_id uuid REFERENCES travel_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_status text NOT NULL DEFAULT 'placeholder';

UPDATE travel_destination_cards
SET
  title_en = COALESCE(title_en, title),
  subtitle_en = COALESCE(subtitle_en, subtitle),
  source_status = CASE
    WHEN source_status IS NOT NULL AND source_status <> '' THEN source_status
    WHEN is_generated THEN 'llm_generated'
    WHEN source = 'database' THEN 'local_cached'
    WHEN source = 'enrichment' THEN 'api_enriched'
    ELSE 'placeholder'
  END
WHERE title_en IS NULL
  OR subtitle_en IS NULL
  OR source_status IS NULL
  OR source_status = '';

CREATE TABLE IF NOT EXISTS travel_enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES travel_destinations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  missing_fields_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text,
  error_code text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_enrichment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES travel_enrichment_jobs(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES travel_destinations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  message text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS travel_destinations_normalized_country_unique_idx
  ON travel_destinations (normalized_name, country_code)
  WHERE normalized_name IS NOT NULL AND country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS travel_destinations_dropdown_enabled_idx
  ON travel_destinations (is_dropdown_enabled);
CREATE INDEX IF NOT EXISTS travel_destinations_data_quality_idx
  ON travel_destinations (data_quality);
CREATE INDEX IF NOT EXISTS travel_destinations_completeness_score_idx
  ON travel_destinations (completeness_score DESC);

CREATE INDEX IF NOT EXISTS travel_attractions_destination_idx
  ON travel_attractions (destination_id);
CREATE INDEX IF NOT EXISTS travel_attractions_data_quality_idx
  ON travel_attractions (data_quality);
CREATE UNIQUE INDEX IF NOT EXISTS travel_attractions_destination_canonical_unique_idx
  ON travel_attractions (destination_id, canonical_name);

CREATE INDEX IF NOT EXISTS travel_assets_entity_idx
  ON travel_assets (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS travel_assets_primary_idx
  ON travel_assets (entity_type, entity_id, is_primary);
CREATE INDEX IF NOT EXISTS travel_assets_verified_idx
  ON travel_assets (verified);
CREATE UNIQUE INDEX IF NOT EXISTS travel_assets_entity_type_asset_url_unique_idx
  ON travel_assets (entity_type, entity_id, asset_type, image_url);

CREATE INDEX IF NOT EXISTS travel_destination_cards_image_asset_idx
  ON travel_destination_cards (image_asset_id);
CREATE INDEX IF NOT EXISTS travel_destination_cards_source_status_idx
  ON travel_destination_cards (source_status);

CREATE INDEX IF NOT EXISTS travel_enrichment_jobs_destination_idx
  ON travel_enrichment_jobs (destination_id);
CREATE INDEX IF NOT EXISTS travel_enrichment_jobs_status_idx
  ON travel_enrichment_jobs (status);
CREATE INDEX IF NOT EXISTS travel_enrichment_jobs_created_at_idx
  ON travel_enrichment_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS travel_enrichment_events_job_idx
  ON travel_enrichment_events (job_id);
CREATE INDEX IF NOT EXISTS travel_enrichment_events_destination_idx
  ON travel_enrichment_events (destination_id);

ALTER TABLE travel_attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_enrichment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_enrichment_events ENABLE ROW LEVEL SECURITY;
