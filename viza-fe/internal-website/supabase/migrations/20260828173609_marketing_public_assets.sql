-- Public, server-managed assets used by VIZA blog and social posts. Public
-- reads are intentional; uploads still go through an authenticated server
-- route using the service role.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'marketing-public-assets',
  'marketing-public-assets',
  true,
  20971520,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.marketing_social_compositions
  ADD COLUMN IF NOT EXISTS short_link_id UUID
  REFERENCES public.marketing_short_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS marketing_social_compositions_short_link_idx
  ON public.marketing_social_compositions (short_link_id)
  WHERE short_link_id IS NOT NULL;

COMMENT ON COLUMN public.marketing_social_compositions.short_link_id IS
  'Optional VIZA-owned short link used for privacy-safe social attribution.';
