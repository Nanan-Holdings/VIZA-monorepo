-- =============================================================================
-- Travel destination index and session durability
--
-- Stores a broad searchable destination catalog while keeping destination cards
-- lazy and on-demand. The frontend must query with search/featured filters and
-- never pull this table wholesale.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS travel_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  display_name text NOT NULL,
  normalized_name text,
  country_code text,
  country_name text,
  region text,
  city text,
  place_type text,
  latitude numeric,
  longitude numeric,
  timezone text,
  currency text,
  population bigint,
  popularity_score numeric DEFAULT 0,
  source text,
  source_updated_at timestamptz,
  geonames_id text,
  wikidata_qid text,
  osm_id text,
  confidence_score numeric DEFAULT 1,
  is_verified boolean DEFAULT false,
  is_active boolean DEFAULT true,
  is_searchable boolean DEFAULT true,
  show_on_home boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_destination_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES travel_destinations(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text,
  language text,
  source text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_destination_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES travel_destinations(id) ON DELETE CASCADE,
  card_type text NOT NULL,
  title text NOT NULL,
  subtitle text,
  image_url text,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,
  is_generated boolean DEFAULT false,
  confidence_score numeric DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_itinerary_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  application_id uuid,
  destination_id uuid REFERENCES travel_destinations(id) ON DELETE SET NULL,
  conversation_memory_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  itinerary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  map_state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  card_state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_unresolved_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_input text NOT NULL,
  resolved_name text,
  llm_guess_json jsonb,
  confidence_score numeric,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS travel_destinations_normalized_name_idx
  ON travel_destinations (normalized_name);
CREATE INDEX IF NOT EXISTS travel_destinations_normalized_name_trgm_idx
  ON travel_destinations USING gin (normalized_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS travel_destinations_country_code_idx
  ON travel_destinations (country_code);
CREATE INDEX IF NOT EXISTS travel_destinations_place_type_idx
  ON travel_destinations (place_type);
CREATE INDEX IF NOT EXISTS travel_destinations_popularity_score_idx
  ON travel_destinations (popularity_score DESC);
CREATE INDEX IF NOT EXISTS travel_destinations_is_searchable_idx
  ON travel_destinations (is_searchable);
CREATE INDEX IF NOT EXISTS travel_destinations_show_on_home_idx
  ON travel_destinations (show_on_home);
CREATE INDEX IF NOT EXISTS travel_destinations_is_featured_idx
  ON travel_destinations (is_featured);
CREATE INDEX IF NOT EXISTS travel_destinations_geonames_id_idx
  ON travel_destinations (geonames_id);
CREATE INDEX IF NOT EXISTS travel_destinations_wikidata_qid_idx
  ON travel_destinations (wikidata_qid);
CREATE INDEX IF NOT EXISTS travel_destinations_search_tsv_idx
  ON travel_destinations USING gin (
    to_tsvector(
      'simple',
      coalesce(canonical_name, '') || ' ' ||
      coalesce(display_name, '') || ' ' ||
      coalesce(country_name, '') || ' ' ||
      coalesce(region, '') || ' ' ||
      coalesce(city, '')
    )
  );
CREATE UNIQUE INDEX IF NOT EXISTS travel_destinations_geonames_id_unique_idx
  ON travel_destinations (geonames_id);
CREATE UNIQUE INDEX IF NOT EXISTS travel_destinations_wikidata_qid_unique_idx
  ON travel_destinations (wikidata_qid);

CREATE INDEX IF NOT EXISTS travel_destination_aliases_destination_idx
  ON travel_destination_aliases (destination_id);
CREATE INDEX IF NOT EXISTS travel_destination_aliases_normalized_alias_idx
  ON travel_destination_aliases (normalized_alias);
CREATE INDEX IF NOT EXISTS travel_destination_aliases_normalized_alias_trgm_idx
  ON travel_destination_aliases USING gin (normalized_alias gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS travel_destination_aliases_destination_alias_unique_idx
  ON travel_destination_aliases (destination_id, normalized_alias);

CREATE INDEX IF NOT EXISTS travel_destination_cards_destination_idx
  ON travel_destination_cards (destination_id);
CREATE INDEX IF NOT EXISTS travel_destination_cards_card_type_idx
  ON travel_destination_cards (card_type);
CREATE UNIQUE INDEX IF NOT EXISTS travel_destination_cards_destination_type_unique_idx
  ON travel_destination_cards (destination_id, card_type);

CREATE INDEX IF NOT EXISTS travel_itinerary_sessions_user_idx
  ON travel_itinerary_sessions (user_id);
CREATE INDEX IF NOT EXISTS travel_itinerary_sessions_application_idx
  ON travel_itinerary_sessions (application_id);
CREATE INDEX IF NOT EXISTS travel_itinerary_sessions_destination_idx
  ON travel_itinerary_sessions (destination_id);
CREATE INDEX IF NOT EXISTS travel_itinerary_sessions_updated_at_idx
  ON travel_itinerary_sessions (updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS travel_itinerary_sessions_user_application_unique_idx
  ON travel_itinerary_sessions (user_id, coalesce(application_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS travel_unresolved_destinations_user_input_idx
  ON travel_unresolved_destinations (user_input);
CREATE INDEX IF NOT EXISTS travel_unresolved_destinations_user_input_trgm_idx
  ON travel_unresolved_destinations USING gin (user_input gin_trgm_ops);
CREATE INDEX IF NOT EXISTS travel_unresolved_destinations_status_idx
  ON travel_unresolved_destinations (status);

ALTER TABLE travel_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_destination_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_destination_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_itinerary_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_unresolved_destinations ENABLE ROW LEVEL SECURITY;
