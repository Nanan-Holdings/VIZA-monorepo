-- Fixed execution and namespace baseline for legacy invoker functions.
--
-- Production evidence:
-- - architecture-audit run 32617315831
-- - Supabase Security Advisor: 9 function_search_path_mutable warnings
-- - anon/authenticated/service_role cannot CREATE in public
--
-- These ALTER statements preserve each function's OID, body, volatility, and
-- identity. A fixed pg_catalog-first path keeps legacy unqualified public
-- relation/operator references working without trusting the caller's path.

ALTER FUNCTION public.purge_old_inbound_email(integer)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.purge_old_inbound_email(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_inbound_email(integer)
  TO service_role;

ALTER FUNCTION public.purge_old_application_answers(integer)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.purge_old_application_answers(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_application_answers(integer)
  TO service_role;

ALTER FUNCTION public.purge_old_application_documents(integer)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.purge_old_application_documents(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_application_documents(integer)
  TO service_role;

ALTER FUNCTION public.purge_old_submission_artifacts(integer)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.purge_old_submission_artifacts(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_submission_artifacts(integer)
  TO service_role;

ALTER FUNCTION public.purge_old_recon_artifacts(integer)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.purge_old_recon_artifacts(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_recon_artifacts(integer)
  TO service_role;

ALTER FUNCTION public.purge_old_audit_logs(integer)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.purge_old_audit_logs(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_audit_logs(integer)
  TO service_role;

ALTER FUNCTION public.purge_post_delivery_documents(integer, integer, integer)
  SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.purge_post_delivery_documents(integer, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_post_delivery_documents(integer, integer, integer)
  TO service_role;

ALTER FUNCTION public.iso_week_start(timestamp with time zone)
  SET search_path = pg_catalog, public;

ALTER FUNCTION public.match_visa_chunks(
  public.vector,
  integer,
  text,
  text,
  text[],
  real
) SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.match_visa_chunks(
  public.vector,
  integer,
  text,
  text,
  text[],
  real
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_visa_chunks(
  public.vector,
  integer,
  text,
  text,
  text[],
  real
) TO authenticated, service_role;
