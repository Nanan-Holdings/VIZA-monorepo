-- Supabase project default privileges grant new functions directly to API
-- roles. Restrict issuer-card state transitions to the service role only.

REVOKE ALL ON FUNCTION public.claim_issuer_card_attempt(UUID, UUID, TEXT, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_issuer_card_issued(UUID, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_issuer_card_portal_processing(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_issuer_card_attempt(UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_issuer_card_attempt(UUID, UUID, TEXT, INTEGER, BOOLEAN)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_issuer_card_issued(UUID, TEXT, TEXT, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_issuer_card_portal_processing(UUID, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_issuer_card_attempt(UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
  TO service_role;
