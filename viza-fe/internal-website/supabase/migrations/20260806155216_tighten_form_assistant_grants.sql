-- Supabase default grants can include table-owner privileges for authenticated.
-- Keep client access to the assistant tables at CRUD only; RLS still applies.
REVOKE ALL ON TABLE public.form_assistant_sessions FROM authenticated;
REVOKE ALL ON TABLE public.form_assistant_messages FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.form_assistant_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.form_assistant_messages TO authenticated;
