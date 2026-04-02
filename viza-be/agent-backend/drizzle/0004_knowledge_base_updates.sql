-- Migration: 0004_knowledge_base_updates
-- Tracks news articles for review/re-ingest workflow (Telegram approval flow)

CREATE TABLE IF NOT EXISTS "knowledge_base_updates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "article_url" text NOT NULL,
  "headline" text NOT NULL,
  "source" text NOT NULL,
  "published_at" timestamp with time zone,
  "status" text NOT NULL DEFAULT 'pending_review',
  "triggered_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "knowledge_base_updates_status_idx"
  ON "knowledge_base_updates"("status");

CREATE INDEX IF NOT EXISTS "knowledge_base_updates_triggered_at_idx"
  ON "knowledge_base_updates"("triggered_at" DESC);

-- Enable RLS
ALTER TABLE "knowledge_base_updates" ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "knowledge_base_updates_service" ON "knowledge_base_updates"
  FOR ALL TO service_role USING (true) WITH CHECK (true);
