-- The function predates the reviewed-release migration and may retain explicit
-- PostgREST grants even after PUBLIC is revoked. Promotion is a service-only
-- deployment operation.

REVOKE ALL ON FUNCTION public.promote_visa_knowledge_release(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.promote_visa_knowledge_release(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.promote_visa_knowledge_release(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.promote_visa_knowledge_release(TEXT) TO service_role;
