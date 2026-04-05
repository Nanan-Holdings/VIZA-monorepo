-- US-034: Persistent single chat session per user
-- One continuous conversation per user, linked to their active visa package

CREATE TABLE IF NOT EXISTS user_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visa_package_id UUID REFERENCES visa_packages(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(auth_user_id)
);

ALTER TABLE user_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_chat_sessions_select" ON user_chat_sessions
  FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);

CREATE POLICY "user_chat_sessions_service" ON user_chat_sessions
  FOR ALL TO service_role USING (true);

-- Add block_data column to visa_chat_messages for inline form blocks
ALTER TABLE visa_chat_messages ADD COLUMN IF NOT EXISTS block_data JSONB;