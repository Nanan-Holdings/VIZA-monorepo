-- VIZA Initial Migration
-- Indonesia B211A Tourist Visa Application Platform
--
-- PREREQUISITE: Enable pgvector extension before running this migration:
--   CREATE EXTENSION IF NOT EXISTS vector;
-- This must be done via the Supabase Dashboard → Database → Extensions,
-- or via the SQL Editor with a superuser role.
--
-- Supabase project: https://oyjxdzsoejraedqghndi.supabase.co

-- =============================================================================
-- APPLICANT PROFILES
-- =============================================================================

CREATE TABLE IF NOT EXISTS applicant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  full_name TEXT,
  date_of_birth DATE,
  place_of_birth TEXT,
  gender TEXT,
  nationality TEXT,
  occupation TEXT,
  address TEXT,
  passport_number TEXT,
  passport_issue_date DATE,
  passport_expiry_date DATE,
  passport_issuing_country TEXT,
  passport_issuing_authority TEXT,
  email TEXT,
  phone TEXT,
  wechat TEXT,
  language_pref TEXT NOT NULL DEFAULT 'en',
  onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- APPLICATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  country TEXT NOT NULL DEFAULT 'indonesia',
  visa_type TEXT NOT NULL DEFAULT 'tourist_b211a',
  status TEXT NOT NULL DEFAULT 'draft',
  arrival_date DATE,
  departure_date DATE,
  port_of_entry TEXT,
  purpose TEXT,
  accommodation_name TEXT,
  accommodation_address TEXT,
  confirmation_number TEXT,
  submitted_at TIMESTAMPTZ,
  estimated_processing_days INTEGER,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- APPLICATION DOCUMENTS
-- document_type: passport_copy | photo | flight_booking | hotel_booking |
--                travel_itinerary | bank_statement
-- status: uploaded | validated | rejected | missing
-- =============================================================================

CREATE TABLE IF NOT EXISTS application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  storage_path TEXT,
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SUBMISSION QUEUE
-- status: pending | processing | done | failed
-- =============================================================================

CREATE TABLE IF NOT EXISTS submission_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- VISA CHAT SESSIONS
-- Replaces companion_sessions from legacy codebase
-- =============================================================================

CREATE TABLE IF NOT EXISTS visa_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES applicant_profiles(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- VISA CHAT MESSAGES
-- Replaces companion_messages from legacy codebase
-- role: user | assistant
-- =============================================================================

CREATE TABLE IF NOT EXISTS visa_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES visa_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- VISA DOCUMENTS
-- Knowledge base source documents
-- document_type: requirements | process | faq | form_fields | common_mistakes
-- =============================================================================

CREATE TABLE IF NOT EXISTS visa_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  document_type TEXT NOT NULL,
  title TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- VISA CHUNKS
-- Chunked knowledge with OpenAI text-embedding-3-small embeddings (1536 dim)
-- Requires pgvector extension enabled (see prerequisite note above)
-- =============================================================================

CREATE TABLE IF NOT EXISTS visa_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES visa_documents(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  document_type TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cosine similarity search on embeddings
CREATE INDEX IF NOT EXISTS visa_chunks_embedding_idx
  ON visa_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for filtering by country + visa_type before vector search
CREATE INDEX IF NOT EXISTS visa_chunks_country_visa_type_idx
  ON visa_chunks (country, visa_type);
