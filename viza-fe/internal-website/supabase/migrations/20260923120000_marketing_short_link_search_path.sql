-- The original service-role-only function used a mutable public search path.
-- Pin it to an empty path; all table references in the function are qualified.
ALTER FUNCTION public.record_marketing_short_link_click(UUID, TEXT, TEXT, TEXT, TEXT)
  SET search_path = '';
