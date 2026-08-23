-- Optimize the nine audited chat and travel ownership policies so the caller
-- identity is evaluated once per statement through a scalar init plan. Policy
-- identities, commands, roles, permissiveness, and ownership semantics remain
-- unchanged.

ALTER POLICY "travel_agent_sessions_owner_all"
  ON public.travel_agent_sessions
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicant_profiles
      WHERE applicant_profiles.id = travel_agent_sessions.user_id
        AND applicant_profiles.auth_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applicant_profiles
      WHERE applicant_profiles.id = travel_agent_sessions.user_id
        AND applicant_profiles.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "travel_agent_messages_owner_all"
  ON public.travel_agent_messages
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicant_profiles
      WHERE applicant_profiles.id = travel_agent_messages.user_id
        AND applicant_profiles.auth_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applicant_profiles
      WHERE applicant_profiles.id = travel_agent_messages.user_id
        AND applicant_profiles.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "travel_user_preferences_owner_all"
  ON public.travel_user_preferences
  USING (
    EXISTS (
      SELECT 1
      FROM public.applicant_profiles
      WHERE applicant_profiles.id = travel_user_preferences.user_id
        AND applicant_profiles.auth_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.applicant_profiles
      WHERE applicant_profiles.id = travel_user_preferences.user_id
        AND applicant_profiles.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "user_chat_sessions_select"
  ON public.user_chat_sessions
  USING ((select auth.uid()) = auth_user_id);

ALTER POLICY "visa_chat_sessions_select_own"
  ON public.visa_chat_sessions
  USING (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "visa_chat_sessions_insert_own"
  ON public.visa_chat_sessions
  WITH CHECK (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "visa_chat_sessions_update_own"
  ON public.visa_chat_sessions
  USING (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    applicant_id IN (
      SELECT id
      FROM public.applicant_profiles
      WHERE auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "visa_chat_messages_select_own"
  ON public.visa_chat_messages
  USING (
    session_id IN (
      SELECT vcs.id
      FROM public.visa_chat_sessions AS vcs
      JOIN public.applicant_profiles AS ap ON ap.id = vcs.applicant_id
      WHERE ap.auth_user_id = (select auth.uid())
    )
  );

ALTER POLICY "visa_chat_messages_insert_own"
  ON public.visa_chat_messages
  WITH CHECK (
    session_id IN (
      SELECT vcs.id
      FROM public.visa_chat_sessions AS vcs
      JOIN public.applicant_profiles AS ap ON ap.id = vcs.applicant_id
      WHERE ap.auth_user_id = (select auth.uid())
    )
  );
