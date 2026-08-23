-- Narrow the inbound-email Data API surface after the website moved both
-- Supabase Auth and signed legacy VIZA sessions behind an explicit server-side
-- applicant-profile/active-alias ownership check.
--
-- The existing authenticated SELECT policy remains the row-ownership fence for
-- direct authenticated reads. Anonymous reads and all client mutations are no
-- longer part of the public contract. Submission/email workers retain their
-- service-role access. This migration changes no rows or RLS policies.

REVOKE ALL ON TABLE public.inbound_email FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.inbound_email TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.inbound_email TO service_role;
