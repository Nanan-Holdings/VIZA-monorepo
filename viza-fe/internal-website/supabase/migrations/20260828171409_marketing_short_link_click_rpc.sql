CREATE OR REPLACE FUNCTION public.record_marketing_short_link_click(
  p_short_link_id UUID,
  p_referrer_host TEXT DEFAULT NULL,
  p_user_agent_family TEXT DEFAULT NULL,
  p_country_code TEXT DEFAULT NULL,
  p_session_hash TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.marketing_short_links
    WHERE id = p_short_link_id AND active = true
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.marketing_short_link_clicks (
    short_link_id,
    referrer_host,
    user_agent_family,
    country_code,
    session_hash
  ) VALUES (
    p_short_link_id,
    nullif(left(p_referrer_host, 253), ''),
    nullif(left(p_user_agent_family, 64), ''),
    CASE WHEN p_country_code ~ '^[A-Z]{2}$' THEN p_country_code ELSE NULL END,
    CASE WHEN length(p_session_hash) BETWEEN 32 AND 128 THEN p_session_hash ELSE NULL END
  );

  UPDATE public.marketing_short_links
  SET click_count = click_count + 1,
      last_clicked_at = now()
  WHERE id = p_short_link_id AND active = true;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_marketing_short_link_click(UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_marketing_short_link_click(UUID, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION public.record_marketing_short_link_click(UUID, TEXT, TEXT, TEXT, TEXT) IS
  'Service-role-only privacy-safe click recording; raw IP and full user-agent values are prohibited.';
