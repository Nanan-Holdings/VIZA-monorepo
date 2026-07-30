-- Travel Agent server-owned conversation state.

CREATE TABLE IF NOT EXISTS travel_agent_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  application_id uuid,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  state_version bigint NOT NULL DEFAULT 0,
  memory_summary text NOT NULL DEFAULT '',
  openai_previous_response_id text,
  pending_actions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  legacy_destination_review_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL REFERENCES travel_agent_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  external_message_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  openai_response_id text,
  response_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, external_message_id, role)
);

CREATE TABLE IF NOT EXISTS travel_user_preferences (
  user_id uuid PRIMARY KEY REFERENCES public.applicant_profiles(id) ON DELETE CASCADE,
  preferences_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS travel_agent_sessions_user_updated_idx
  ON travel_agent_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS travel_agent_sessions_application_idx
  ON travel_agent_sessions (application_id);
CREATE INDEX IF NOT EXISTS travel_agent_messages_session_created_idx
  ON travel_agent_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS travel_agent_messages_user_created_idx
  ON travel_agent_messages (user_id, created_at DESC);

ALTER TABLE travel_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS travel_agent_sessions_owner_all ON travel_agent_sessions;
CREATE POLICY travel_agent_sessions_owner_all ON travel_agent_sessions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM applicant_profiles
    WHERE applicant_profiles.id = user_id
      AND applicant_profiles.auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM applicant_profiles
    WHERE applicant_profiles.id = user_id
      AND applicant_profiles.auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS travel_agent_messages_owner_all ON travel_agent_messages;
CREATE POLICY travel_agent_messages_owner_all ON travel_agent_messages
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM applicant_profiles
    WHERE applicant_profiles.id = user_id
      AND applicant_profiles.auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM applicant_profiles
    WHERE applicant_profiles.id = user_id
      AND applicant_profiles.auth_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS travel_user_preferences_owner_all ON travel_user_preferences;
CREATE POLICY travel_user_preferences_owner_all ON travel_user_preferences
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM applicant_profiles
    WHERE applicant_profiles.id = user_id
      AND applicant_profiles.auth_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM applicant_profiles
    WHERE applicant_profiles.id = user_id
      AND applicant_profiles.auth_user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION commit_travel_agent_turn(
  p_session_id text,
  p_user_id uuid,
  p_external_message_id text,
  p_expected_state_version bigint,
  p_user_content text,
  p_assistant_content text,
  p_state_json jsonb,
  p_memory_summary text,
  p_openai_response_id text,
  p_pending_actions_json jsonb,
  p_response_json jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_session travel_agent_sessions%ROWTYPE;
  stored_response jsonb;
BEGIN
  SELECT response_json INTO stored_response
  FROM travel_agent_messages
  WHERE session_id = p_session_id
    AND user_id = p_user_id
    AND external_message_id = p_external_message_id
    AND role = 'user';

  IF stored_response IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'replayed', 'response', stored_response);
  END IF;

  SELECT * INTO current_session
  FROM travel_agent_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND OR current_session.user_id <> p_user_id THEN
    RETURN jsonb_build_object('status', 'missing');
  END IF;

  IF current_session.state_version <> p_expected_state_version THEN
    RETURN jsonb_build_object(
      'status', 'conflict',
      'state_version', current_session.state_version,
      'state', current_session.state_json
    );
  END IF;

  UPDATE travel_agent_sessions
  SET state_json = p_state_json,
      state_version = state_version + 1,
      memory_summary = p_memory_summary,
      openai_previous_response_id = p_openai_response_id,
      pending_actions_json = p_pending_actions_json,
      updated_at = now()
  WHERE id = p_session_id;

  INSERT INTO travel_agent_messages (
    session_id, user_id, external_message_id, role, content,
    openai_response_id, response_json
  ) VALUES (
    p_session_id, p_user_id, p_external_message_id, 'user', p_user_content,
    p_openai_response_id, p_response_json
  );

  INSERT INTO travel_agent_messages (
    session_id, user_id, external_message_id, role, content,
    openai_response_id
  ) VALUES (
    p_session_id, p_user_id, p_external_message_id, 'assistant',
    p_assistant_content, p_openai_response_id
  );

  RETURN jsonb_build_object('status', 'ok', 'response', p_response_json);
END;
$$;

REVOKE ALL ON FUNCTION commit_travel_agent_turn(
  text, uuid, text, bigint, text, text, jsonb, text, text, jsonb, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commit_travel_agent_turn(
  text, uuid, text, bigint, text, text, jsonb, text, text, jsonb, jsonb
) TO service_role;
