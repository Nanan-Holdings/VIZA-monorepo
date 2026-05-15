-- RAG retrieval RPC for VIZA AI chat.
-- Uses pgvector cosine distance over visa_chunks.embedding.

CREATE OR REPLACE FUNCTION match_visa_chunks(
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
    (1 - (vc.embedding <=> query_embedding))::REAL AS similarity
  FROM visa_chunks vc
  LEFT JOIN visa_documents vd ON vd.id = vc.document_id
  WHERE vc.embedding IS NOT NULL
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
