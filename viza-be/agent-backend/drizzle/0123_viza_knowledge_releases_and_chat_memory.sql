-- Versioned VIZA knowledge releases, deterministic entry rules, and durable
-- per-session memory. Existing knowledge remains active as a legacy bootstrap
-- release until a fully audited release is promoted.

CREATE TABLE IF NOT EXISTS visa_knowledge_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'active', 'quarantined', 'retired')),
  description TEXT,
  expected_entry_rule_count INTEGER NOT NULL DEFAULT 385,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  quarantined_at TIMESTAMPTZ
);

INSERT INTO visa_knowledge_releases (release_key, status, description, activated_at)
VALUES (
  'legacy-bootstrap',
  'active',
  'Knowledge present before versioned release management was introduced.',
  NOW()
)
ON CONFLICT (release_key) DO NOTHING;

UPDATE visa_knowledge_releases
SET expected_entry_rule_count = 1
WHERE release_key = 'legacy-bootstrap';

ALTER TABLE visa_documents
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS ingestion_scope TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES visa_knowledge_releases(id),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('staged', 'active', 'quarantined', 'retired')),
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS quarantined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

UPDATE visa_documents
SET
  source_key = COALESCE(
    source_key,
    'legacy:' || country || ':' || visa_type || ':' || document_type || ':' || id::text
  ),
  release_id = COALESCE(
    release_id,
    (SELECT id FROM visa_knowledge_releases WHERE release_key = 'legacy-bootstrap')
  )
WHERE source_key IS NULL OR release_id IS NULL;

ALTER TABLE visa_documents ALTER COLUMN source_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS visa_documents_release_source_key_unique_idx
  ON visa_documents (release_id, source_key);
CREATE INDEX IF NOT EXISTS visa_documents_release_status_idx
  ON visa_documents (release_id, status);
CREATE INDEX IF NOT EXISTS visa_documents_scope_country_idx
  ON visa_documents (ingestion_scope, country);

CREATE TABLE IF NOT EXISTS visa_entry_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL,
  release_id UUID NOT NULL REFERENCES visa_knowledge_releases(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'staged'
    CHECK (status IN ('staged', 'active', 'quarantined', 'retired')),
  destination_country TEXT NOT NULL,
  passport_country_iso3 TEXT NOT NULL,
  passport_type TEXT NOT NULL DEFAULT 'ordinary',
  trip_purpose TEXT NOT NULL DEFAULT 'tourism',
  max_stay_days INTEGER,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('visa_exempt', 'visa_required', 'conditional', 'unknown')),
  visa_type TEXT,
  arrival_card_types TEXT[] NOT NULL DEFAULT '{}',
  conditions_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT NOT NULL,
  effective_from DATE,
  verified_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS visa_entry_rules_release_rule_key_unique_idx
  ON visa_entry_rules (release_id, rule_key);
CREATE INDEX IF NOT EXISTS visa_entry_rules_lookup_idx
  ON visa_entry_rules (
    destination_country,
    passport_country_iso3,
    passport_type,
    trip_purpose,
    status
  );
CREATE INDEX IF NOT EXISTS visa_entry_rules_release_status_idx
  ON visa_entry_rules (release_id, status);

INSERT INTO visa_entry_rules (
  rule_key,
  release_id,
  status,
  destination_country,
  passport_country_iso3,
  passport_type,
  trip_purpose,
  max_stay_days,
  outcome,
  visa_type,
  arrival_card_types,
  conditions_json,
  source_url,
  effective_from,
  verified_at,
  content_hash
)
SELECT
  'singapore:CHN:ordinary:tourism:2024-02-09',
  id,
  'active',
  'singapore',
  'CHN',
  'ordinary',
  'tourism',
  30,
  'visa_exempt',
  NULL,
  ARRAY['SG_ARRIVAL_CARD'],
  '{"sgac_window":"within 3 days before arrival, including arrival day","excluded_purposes":["work","study","journalism","long_stay"]}'::jsonb,
  'https://www.ica.gov.sg/news-and-publications/newsroom/media-release/mutual-30-day-visa-exemption-arrangement-between-singapore-and-the-people-s-republic-of-china',
  '2024-02-09',
  '2026-07-30T00:00:00Z',
  'reviewed:singapore-prc-ordinary-30-day-exemption:2026-07-30'
FROM visa_knowledge_releases
WHERE release_key = 'legacy-bootstrap'
ON CONFLICT (release_id, rule_key) DO UPDATE SET
  status = EXCLUDED.status,
  verified_at = EXCLUDED.verified_at,
  conditions_json = EXCLUDED.conditions_json,
  content_hash = EXCLUDED.content_hash,
  updated_at = NOW();

ALTER TABLE visa_chat_sessions
  ADD COLUMN IF NOT EXISTS memory_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS memory_revision BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS memory_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS visa_agent_run_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES visa_chat_sessions(id) ON DELETE CASCADE,
  memory_revision BIGINT NOT NULL DEFAULT 0,
  destination_country TEXT,
  passport_country_iso3 TEXT,
  entry_rule_outcome TEXT,
  visa_type TEXT,
  intent TEXT,
  source_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  fallback_reason TEXT,
  model TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visa_agent_run_diagnostics_session_created_idx
  ON visa_agent_run_diagnostics (session_id, created_at DESC);

ALTER TABLE visa_knowledge_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE visa_entry_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE visa_agent_run_diagnostics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON visa_knowledge_releases FROM anon, authenticated;
REVOKE ALL ON visa_entry_rules FROM anon, authenticated;
REVOKE ALL ON visa_agent_run_diagnostics FROM anon, authenticated;
GRANT ALL ON visa_knowledge_releases TO service_role;
GRANT ALL ON visa_entry_rules TO service_role;
GRANT ALL ON visa_agent_run_diagnostics TO service_role;

DROP FUNCTION IF EXISTS match_visa_chunks(
  vector(1536),
  INT,
  TEXT,
  TEXT,
  TEXT[],
  REAL
);

CREATE FUNCTION match_visa_chunks(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  filter_country TEXT DEFAULT NULL,
  filter_visa_type TEXT DEFAULT NULL,
  filter_document_types TEXT[] DEFAULT NULL,
  min_similarity REAL DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  country TEXT,
  visa_type TEXT,
  document_type TEXT,
  title TEXT,
  source_url TEXT,
  source_key TEXT,
  verified_at TIMESTAMPTZ,
  similarity REAL
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    vc.id,
    vc.document_id,
    vc.content,
    vc.country,
    vc.visa_type,
    vc.document_type,
    vd.title,
    vd.source_url,
    vd.source_key,
    vd.verified_at,
    (1 - (vc.embedding <=> query_embedding))::REAL AS similarity
  FROM visa_chunks vc
  INNER JOIN visa_documents vd ON vd.id = vc.document_id
  INNER JOIN visa_knowledge_releases vkr ON vkr.id = vd.release_id
  WHERE vc.embedding IS NOT NULL
    AND vd.status = 'active'
    AND vkr.status = 'active'
    AND (filter_country IS NULL OR vc.country = filter_country)
    AND (filter_visa_type IS NULL OR vc.visa_type = filter_visa_type)
    AND (
      filter_document_types IS NULL
      OR vc.document_type = ANY(filter_document_types)
    )
    AND (1 - (vc.embedding <=> query_embedding)) >= min_similarity
  ORDER BY vc.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 12);
$$;

GRANT EXECUTE ON FUNCTION match_visa_chunks(
  vector(1536),
  INT,
  TEXT,
  TEXT,
  TEXT[],
  REAL
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION promote_visa_knowledge_release(
  target_release_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_release_id UUID;
BEGIN
  SELECT id INTO target_release_id
  FROM visa_knowledge_releases
  WHERE release_key = target_release_key
    AND status = 'staged'
  FOR UPDATE;

  IF target_release_id IS NULL THEN
    RAISE EXCEPTION 'staged knowledge release not found: %', target_release_key;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM visa_documents WHERE release_id = target_release_id
  ) THEN
    RAISE EXCEPTION 'knowledge release has no documents';
  END IF;
  IF (
    SELECT COUNT(*)
    FROM visa_entry_rules
    WHERE release_id = target_release_id
  ) < (
    SELECT expected_entry_rule_count
    FROM visa_knowledge_releases
    WHERE id = target_release_id
  ) THEN
    RAISE EXCEPTION 'knowledge release does not contain the complete entry-rule matrix';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM visa_documents vd
    WHERE vd.release_id = target_release_id
      AND (
        vd.source_key IS NULL
        OR vd.source_url IS NULL
        OR vd.verified_at IS NULL
        OR vd.content_hash IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'knowledge release contains documents missing governance metadata';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM visa_documents vd
    LEFT JOIN visa_chunks vc ON vc.document_id = vd.id
    WHERE vd.release_id = target_release_id
    GROUP BY vd.id
    HAVING COUNT(vc.id) = 0 OR COUNT(vc.embedding) <> COUNT(vc.id)
  ) THEN
    RAISE EXCEPTION 'knowledge release contains empty or unembedded documents';
  END IF;

  UPDATE visa_documents
  SET
    status = 'quarantined',
    quarantined_at = NOW(),
    quarantine_reason = 'superseded by release ' || target_release_key
  WHERE release_id IN (
    SELECT id FROM visa_knowledge_releases WHERE status = 'active'
  );
  UPDATE visa_entry_rules
  SET status = 'quarantined', updated_at = NOW()
  WHERE release_id IN (
    SELECT id FROM visa_knowledge_releases WHERE status = 'active'
  );
  UPDATE visa_knowledge_releases
  SET status = 'quarantined', quarantined_at = NOW()
  WHERE status = 'active';

  UPDATE visa_documents
  SET status = 'active', quarantined_at = NULL, quarantine_reason = NULL
  WHERE release_id = target_release_id;
  UPDATE visa_entry_rules
  SET status = 'active', updated_at = NOW()
  WHERE release_id = target_release_id;
  UPDATE visa_knowledge_releases
  SET status = 'active', activated_at = NOW(), quarantined_at = NULL
  WHERE id = target_release_id;

  RETURN target_release_id;
END;
$$;

REVOKE ALL ON FUNCTION promote_visa_knowledge_release(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promote_visa_knowledge_release(TEXT) TO service_role;
